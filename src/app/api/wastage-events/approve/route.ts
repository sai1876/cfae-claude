import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';
import { z } from 'zod';
import { WastageEventDocument } from '@/lib/types';


const ApproveWastageEventSchema = z.object({
  event_id: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  manager_note: z.string().optional()
}).strict();

export async function POST(req: Request) {
  try {
    const authResult = await requireRole(req, ['manager', 'admin', 'owner']);
    if (authResult instanceof NextResponse) return authResult;
    
    const uid = authResult.uid!;
    const role = authResult.role!;
    
    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const body = await req.json();
    const parseResult = ApproveWastageEventSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message || "Invalid payload." }, { status: 400 });
    }
    
    const { event_id, decision, manager_note } = parseResult.data;

    let deductionOccurred = false;
    let eventData: WastageEventDocument | null = null;

    try {
      await adminDb.runTransaction(async (transaction) => {
        const eventRef = adminDb!.collection('wastage_events').doc(event_id);
        const eventSnap = await transaction.get(eventRef);
        
        if (!eventSnap.exists) {
          throw { status: 404, message: "Wastage event not found." };
        }
        
        eventData = eventSnap.data() as WastageEventDocument;
        
        if (eventData.status !== 'reported') {
          throw { status: 400, message: `Cannot review event in status ${eventData.status}` };
        }
        
        if (eventData.inventory_deducted_at) {
          throw { status: 400, message: "Inventory has already been deducted for this event." };
        }
        
        // Also check if any stock_movements exist for this event to strictly guarantee idempotency
        const movementsSnap = await transaction.get(
          adminDb!.collection('stock_movements').where('event_id', '==', event_id)
        );
        if (!movementsSnap.empty) {
          throw { status: 400, message: "Stock movements already exist for this event." };
        }

        if (decision === 'rejected') {
          transaction.update(eventRef, {
            status: 'rejected',
            approved_by: uid,
            updated_at: Date.now(),
            ...(manager_note && { manager_note: manager_note.trim() })
          });
          return;
        }

        // Approval flow
        const updatePayload: any = {
          status: 'approved',
          approved_by: uid,
          approved_at: Date.now(),
          updated_at: Date.now(),
          ...(manager_note && { manager_note: manager_note.trim() })
        };

        // Inventory deduction
        if (eventData.deduct_inventory && eventData.deduction_method !== 'none' && !eventData.inventory_deducted_at) {
          const deductionRef = `wastage_${event_id}`;
          const movements: any[] = [];
          const now = Date.now();
          
          if (eventData.deduction_method === 'stock_direct') {
            // Direct stock deduction
            for (const item of eventData.items) {
              if (item.loss_basis === 'stock_item' && item.stock_item_id) {
                const stockRef = adminDb!.collection('inventory').doc(item.stock_item_id);
                const stockSnap = await transaction.get(stockRef);
                if (stockSnap.exists) {
                  const currentQty = stockSnap.data()?.current_quantity || 0;
                  const newQty = Math.max(0, currentQty - item.quantity);
                  transaction.update(stockRef, { current_quantity: newQty, last_updated: now, updated_by: uid });
                  
                  movements.push({
                    movement_id: crypto.randomUUID(),
                    stock_id: item.stock_item_id,
                    event_id,
                    movement_type: eventData.event_type === 'missing_item' ? 'wastage' : eventData.event_type,
                    quantity_delta: -item.quantity,
                    previous_quantity: currentQty,
                    new_quantity: newQty,
                    reason_category: eventData.reason_category,
                    actor_id: uid,
                    created_at: now,
                    linked_order_id: eventData.order_id,
                    linked_refund_request_id: eventData.linked_refund_request_id
                  });
                }
              }
            }
          } else if (eventData.deduction_method === 'recipe') {
            // Deduct recipe ingredients for each menu item
            const menuIds = eventData.items.map(i => i.menu_item_id).filter(Boolean) as string[];
            const menuSnaps = await Promise.all(menuIds.map(id => transaction.get(adminDb!.collection('menu').doc(id))));
            
            const recipeRequirements = new Map<string, number>();

            for (const item of eventData.items) {
              if (item.loss_basis === 'menu_item' && item.menu_item_id) {
                const menuSnap = menuSnaps.find(s => s.id === item.menu_item_id);
                if (menuSnap?.exists) {
                  const menuData = menuSnap.data();
                  if (menuData?.recipe) {
                    for (const req of menuData.recipe) {
                      const qty = (recipeRequirements.get(req.stock_id) || 0) + (req.quantity * item.quantity);
                      recipeRequirements.set(req.stock_id, qty);
                    }
                  }
                }
              }
            }

            for (const [stockId, requiredQty] of recipeRequirements.entries()) {
              const stockRef = adminDb!.collection('inventory').doc(stockId);
              const stockSnap = await transaction.get(stockRef);
              if (stockSnap.exists) {
                const currentQty = stockSnap.data()?.current_quantity || 0;
                const newQty = Math.max(0, currentQty - requiredQty);
                transaction.update(stockRef, { current_quantity: newQty, last_updated: now, updated_by: uid });
                
                movements.push({
                  movement_id: crypto.randomUUID(),
                  stock_id: stockId,
                  event_id,
                  movement_type: eventData.event_type === 'missing_item' ? 'wastage' : eventData.event_type,
                  quantity_delta: -requiredQty,
                  previous_quantity: currentQty,
                  new_quantity: newQty,
                  reason_category: eventData.reason_category,
                  actor_id: uid,
                  created_at: now,
                  linked_order_id: eventData.order_id,
                  linked_refund_request_id: eventData.linked_refund_request_id
                });
              }
            }
          }

          // Insert stock movements
          for (const m of movements) {
            transaction.set(adminDb!.collection('stock_movements').doc(m.movement_id), m);
          }

          updatePayload.inventory_deducted_at = now;
          updatePayload.inventory_deduction_ref = deductionRef;
          deductionOccurred = true;
        }

        transaction.update(eventRef, updatePayload);
      });
    } catch (txError: any) {
      if (txError.status) {
        return NextResponse.json({ success: false, error: txError.message }, { status: txError.status });
      }
      throw txError;
    }

    // Logging
    if (eventData) {
      const eData = eventData as WastageEventDocument;
      await logBusinessEvent({
        event_type: decision === 'approved' ? 'wastage_event_approved' : 'wastage_event_rejected',
        actor_type: role as ActorType,
        actor_id: uid,
        target_type: 'order',
        target_id: eData.order_id || event_id,
        severity: decision === 'approved' ? 'warning' : 'info',
        source: 'api',
        metadata: {
          event_id,
          decision,
          deduction_occurred: deductionOccurred,
          deduction_method: eData.deduction_method,
          deduct_inventory: eData.deduct_inventory,
          item_count: eData.items.length,
          source_type: eData.source_type,
          linked_refund_request_id: eData.linked_refund_request_id
        }
      });
    }

    return NextResponse.json({ success: true, event_id });

  } catch (error) {
    console.error("[WASTAGE APPROVE ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
