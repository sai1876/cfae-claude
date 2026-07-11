import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const CreateWastageEventSchema = z.object({
  order_id: z.string().optional(),
  source_type: z.enum(['customer_complaint', 'kitchen_error', 'prep_damage', 'expired_stock', 'staff_meal', 'manual_adjustment']),
  event_type: z.enum(['remake', 'wastage', 'spoilage', 'missing_item']),
  items: z.array(z.object({
    menu_item_id: z.string().optional(),
    stock_item_id: z.string().optional(),
    item_name: z.string(),
    quantity: z.number().positive(),
    unit: z.string().optional(),
    unit_cost_estimate: z.number().optional(),
    station: z.string().optional(),
    loss_basis: z.enum(['menu_item', 'stock_item'])
  })).min(1),
  reason_category: z.string(),
  manager_note: z.string().min(1),
  photo_urls: z.array(z.string()).optional(),
}).strict();

export async function POST(req: Request) {
  try {
    const authResult = await requireRole(req, ['kitchen', 'manager', 'admin', 'owner']);
    if (authResult instanceof NextResponse) return authResult;
    
    const uid = authResult.uid!;
    const role = authResult.role!;
    
    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const body = await req.json();
    const parseResult = CreateWastageEventSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message || "Invalid payload." }, { status: 400 });
    }
    
    const data = parseResult.data;
    
    // Determine inventory deduction rules based on the spec
    let deduct_inventory = false;
    let deduction_method: 'none' | 'recipe' | 'stock_direct' = 'none';

    // Simplified deduction logic for creation step
    // The actual execution will happen in approve.
    if (data.event_type === 'remake' && data.items.some(i => i.loss_basis === 'menu_item')) {
      deduct_inventory = true;
      deduction_method = 'recipe';
    } else if (data.event_type === 'wastage' && ['customer_complaint', 'kitchen_error'].includes(data.source_type)) {
      // Prepared food thrown away
      deduct_inventory = false;
      deduction_method = 'none';
    } else if (['expired_stock', 'prep_damage'].includes(data.source_type) && data.items.some(i => i.loss_basis === 'stock_item')) {
      deduct_inventory = true;
      deduction_method = 'stock_direct';
    } else if (data.source_type === 'staff_meal' && data.items.some(i => i.loss_basis === 'menu_item')) {
      deduct_inventory = true;
      deduction_method = 'recipe';
    } else if (data.event_type === 'missing_item') {
      deduct_inventory = false;
      deduction_method = 'none';
    } else if (data.source_type === 'manual_adjustment') {
      deduct_inventory = true;
      deduction_method = data.items.some(i => i.loss_basis === 'stock_item') ? 'stock_direct' : 'recipe';
    }

    const event_id = uuidv4();
    const now = Date.now();

    const newEvent = {
      event_id,
      ...data,
      reported_by: uid,
      status: 'reported',
      deduct_inventory,
      deduction_method,
      created_at: now,
      updated_at: now
    };

    await adminDb.collection('wastage_events').doc(event_id).set(newEvent);

    await logBusinessEvent({
      event_type: 'wastage_event_reported',
      actor_type: role as ActorType,
      actor_id: uid,
      target_type: 'order',
      target_id: data.order_id || event_id,
      severity: 'info',
      source: 'api',
      metadata: {
        event_id,
        event_type: data.event_type,
        source_type: data.source_type,
        items_count: data.items.length
      }
    });

    return NextResponse.json({ success: true, event_id });

  } catch (error) {
    console.error("[WASTAGE CREATE ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
