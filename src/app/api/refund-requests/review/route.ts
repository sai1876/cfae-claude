import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { processRefundTransaction, ProcessRefundParams } from '@/server/refunds/processRefund';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';

const ReviewRefundRequestSchema = z.object({
  request_id: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  manager_note: z.string().min(3).max(500),
  approved_refund_amount: z.number().positive().optional(),
  approved_items: z.array(z.object({
    item_id: z.string().min(1),
    quantity_refunded: z.number().positive(),
    refund_amount: z.number().positive()
  })).optional(),
  create_wastage_record: z.boolean().optional(),
  wastage_event_type: z.enum(['remake', 'wastage', 'spoilage', 'missing_item']).optional()
}).strict();

export async function POST(req: Request) {
  try {
    const authResult = await requireRole(req, ['manager', 'admin', 'owner']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const uid = authResult.uid!;
    const role = authResult.role!;

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const body = await req.json();
    const parseResult = ReviewRefundRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message || "Invalid payload." }, { status: 400 });
    }

    const { 
      request_id, 
      decision, 
      manager_note, 
      approved_refund_amount, 
      approved_items,
      create_wastage_record,
      wastage_event_type 
    } = parseResult.data;

    const db = adminDb!;
    const requestRef = db.collection('refund_requests').doc(request_id);
    let refundResult: any = null;
    let order_id = '';
    let outlet_id = '';
    let refund_scope = '';
    let orderData: any = null;
    let wastageWarning = '';

    try {
      const db = adminDb!;
      await db.runTransaction(async (transaction) => {
        const reqSnap = await transaction.get(requestRef);
        if (!reqSnap.exists) {
          throw { status: 404, message: "Refund request not found." };
        }

        const reqData = reqSnap.data()!;
        if (reqData.status !== 'pending') {
          throw { status: 400, message: `Cannot review a request that is already ${reqData.status}.` };
        }

        order_id = reqData.order_id;
        refund_scope = reqData.request_scope;
        const db = adminDb!;
        const orderRef = db.collection('orders').doc(order_id);
        const orderSnap = await transaction.get(orderRef);
        if (orderSnap.exists) {
          orderData = orderSnap.data();
        }

        if (decision === 'rejected') {
          transaction.update(requestRef, {
            status: 'rejected',
            manager_note: manager_note.trim(),
            reviewed_by: uid,
            reviewed_at: Date.now(),
            updated_at: Date.now()
          });
          return;
        }

        const finalRefundAmount = approved_refund_amount || reqData.requested_amount;
        if (!finalRefundAmount) {
          throw { status: 400, message: "Approved refund amount must be provided or present on request." };
        }

        let finalItems: any[] | undefined = undefined;

        if (reqData.request_scope === 'items') {
          if (approved_items && approved_items.length > 0) {
            finalItems = approved_items;
          } else if (reqData.items_requested && reqData.items_requested.length > 0) {
            finalItems = reqData.items_requested.map((reqItem: any) => {
              if (reqItem.requested_amount === undefined || reqItem.requested_amount === null) {
                throw { status: 400, message: `Item ${reqItem.item_id} is missing a requested_amount. Manager must supply approved_items.` };
              }
              return {
                item_id: reqItem.item_id,
                quantity_refunded: reqItem.quantity,
                refund_amount: reqItem.requested_amount
              };
            });
          } else {
            throw { status: 400, message: "Item scope requires approved_items or items_requested." };
          }
        }
        
        const params: ProcessRefundParams = {
          refund_scope: reqData.request_scope,
          refund_amount: finalRefundAmount,
          reason: `Approved refund request: ${reqData.reason_category} - ${manager_note}`,
          method: 'manual', // or wallet, etc if extended later
          requestItems: finalItems,
          uid
        };

        refundResult = await processRefundTransaction(transaction, orderRef, params);
        
        outlet_id = refundResult.outlet_id;

        transaction.update(requestRef, {
          status: 'approved',
          payment_status: 'pending',
          linked_refund_id: refundResult.refundId,
          manager_note: manager_note.trim(),
          reviewed_by: uid,
          reviewed_at: Date.now(),
          updated_at: Date.now()
        });
      });
    } catch (txError: any) {
      if (txError.status) {
        return NextResponse.json({ success: false, error: txError.message }, { status: txError.status });
      }
      throw txError;
    }

    // Outside transaction logging
    await logBusinessEvent({
      event_type: 'refund_request_reviewed',
      actor_type: role as ActorType,
      actor_id: uid,
      target_type: 'order',
      target_id: order_id,
      order_id: order_id,
      ...(outlet_id && { outlet_id }),
      severity: 'info',
      source: 'api',
      metadata: {
        request_id,
        decision,
        manager_note: manager_note.trim()
      }
    });

    if (decision === 'approved' && refundResult) {
      await logBusinessEvent({
        event_type: 'refund_processed',
        actor_type: role as ActorType,
        actor_id: uid,
        target_type: 'order',
        target_id: order_id,
        order_id: order_id,
        ...(outlet_id && { outlet_id }),
        severity: 'warning',
        source: 'api',
        metadata: {
          request_id,
          refund_scope,
          refund_amount: approved_refund_amount || refundResult.newRefundedAmount,
          refund_status: refundResult.nextRefundStatus,
          refund_method: 'manual',
          reason: manager_note.trim(),
          ...(refund_scope === 'items' && { item_count: refundResult.itemCount })
        }
      });
    }

    if (decision === 'approved' && create_wastage_record && refundResult) {
      try {
        if (refund_scope === 'custom_amount' && (!approved_items || approved_items.length === 0)) {
          // Log skipped wastage and warn user
          wastageWarning = "Custom amount refund has no item mapping, so no food-loss record was created.";
          await logBusinessEvent({
            event_type: 'wastage_auto_create_skipped',
            actor_type: role as ActorType,
            actor_id: uid,
            target_type: 'order',
            target_id: order_id,
            order_id: order_id,
            severity: 'info',
            source: 'api',
            metadata: {
              request_id,
              refund_scope,
              reason: 'custom_amount_no_item_mapping'
            }
          });
        } else {
          const event_id = crypto.randomUUID();
          const now = Date.now();
          const event_type = wastage_event_type || 'wastage';
          
          let deduct_inventory = false;
          let deduction_method: 'none' | 'recipe' | 'stock_direct' = 'none';

          if (event_type === 'remake') {
            deduct_inventory = true;
            deduction_method = 'recipe';
          }

          let items: any[] = [];
          let skippedSomeItems = false;
          
          if (approved_items && approved_items.length > 0) {
            for (const i of approved_items) {
              const matchedOrderItem = orderData?.items?.find((oi: any) => oi.item_id === i.item_id || oi.id === i.item_id);
              if (!matchedOrderItem || !matchedOrderItem.menu_item_id) {
                skippedSomeItems = true;
                continue;
              }
              items.push({
                menu_item_id: matchedOrderItem.menu_item_id,
                order_item_id: i.item_id,
                item_name: matchedOrderItem.name || `Refunded Item ${matchedOrderItem.menu_item_id}`,
                quantity: i.quantity_refunded,
                loss_basis: 'menu_item'
              });
            }
          } else if (refund_scope === 'full_order' && orderData && orderData.items) {
            for (const i of orderData.items) {
              const menu_item_id = i.menu_item_id;
              if (!menu_item_id) {
                skippedSomeItems = true;
                continue;
              }
              items.push({
                menu_item_id: menu_item_id,
                order_item_id: i.item_id || i.id, // Keep order_item_id if available
                item_name: i.name || `Refunded Item ${menu_item_id}`,
                quantity: i.quantity || 1,
                loss_basis: 'menu_item'
              });
            }
          }

          if (skippedSomeItems) {
            await logBusinessEvent({
              event_type: 'wastage_items_skipped',
              actor_type: role as ActorType,
              actor_id: uid,
              target_type: 'order',
              target_id: order_id,
              order_id: order_id,
              severity: 'warning',
              source: 'api',
              metadata: {
                request_id,
                refund_scope,
                reason: 'missing_menu_item_ids',
                all_skipped: items.length === 0
              }
            });
          }

          if (items.length === 0 && skippedSomeItems) {
            // All items were skipped due to missing menu_item_id
            wastageWarning = "No valid menu items were found for food-loss record.";
          } else if (items.length > 0) {
            await adminDb!.collection('wastage_events').doc(event_id).set({
              event_id,
              order_id,
              source_type: 'customer_complaint',
              event_type,
              items,
              reason_category: 'refund_linked',
              manager_note: `Auto-created from refund ${request_id}`,
              reported_by: uid,
              status: 'reported',
              deduct_inventory,
              deduction_method,
              linked_refund_request_id: request_id,
              created_at: now,
              updated_at: now
            });
            
            await logBusinessEvent({
              event_type: 'wastage_event_reported',
              actor_type: role as ActorType,
              actor_id: uid,
              target_type: 'wastage_event',
              target_id: event_id,
              order_id: order_id,
              severity: 'info',
              source: 'api',
              metadata: {
                event_type,
                source_type: 'customer_complaint',
                deduct_inventory,
                deduction_method,
                item_count: items.length,
                linked_refund_request_id: request_id
              }
            });
          }
        }
      } catch (err) {
        console.warn("[WASTAGE AUTO-CREATE FAILED]", err);
      }
    }
    return NextResponse.json({ 
      success: true, 
      request_id,
      decision,
      ...(wastageWarning ? { wastage_warning: wastageWarning } : {}),
      ...(refundResult && { 
        refund_id: refundResult.refundId,
        refunded_amount: refundResult.newRefundedAmount 
      })
    });

  } catch (error) {
    console.error("[REFUND REQUEST REVIEW ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
