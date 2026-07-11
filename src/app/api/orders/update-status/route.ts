// [INTERNAL] - Restricted to staff, manager, admin, owner
import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';

const UpdateOrderStatusSchema = z.object({
  order_id: z.string().min(1),
  next_status: z.enum([
    'pending',
    'accepted',
    'preparing',
    'ready',
    'dispatched',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled',
    'rejected'
  ]).optional(),
  payment_status: z.enum(['paid', 'unpaid']).optional(),
  rush_held: z.boolean().optional(),
  rider_id: z.string().min(1).optional(),
  reason: z.string().max(300).optional()
}).refine(
  data =>
    data.next_status ||
    data.payment_status ||
    typeof data.rush_held === 'boolean' ||
    data.rider_id,
  { message: 'At least one status field is required' }
);

// Map of allowed forward transitions for basic staff
const FORWARD_TRANSITIONS: Record<string, string[]> = {
  'pending': ['accepted', 'preparing', 'rejected'],
  'accepted': ['preparing', 'ready'],
  'preparing': ['ready'],
  'ready': ['dispatched', 'out_for_delivery', 'delivered', 'completed'],
  'dispatched': ['out_for_delivery', 'delivered', 'completed'],
  'out_for_delivery': ['delivered', 'completed']
};

export async function POST(req: Request) {
  try {
    const authResult = await requireRole(req, ['staff', 'manager', 'admin', 'owner']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const uid = authResult.uid!;
    const role = authResult.role!;

    const body = await req.json();
    const parseResult = UpdateOrderStatusSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: "Invalid payload format." }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const data = parseResult.data;
    
    const orderRef = adminDb.collection('orders').doc(data.order_id);
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }
    
    const orderData = orderSnap.data()!;
    const previous_status = orderData.status;
    const previous_is_paid = orderData.is_paid;
    const previous_rush_held = orderData.rush_held;
    const previous_rider_id = orderData.rider_id;
    const outlet_id = orderData.outlet || orderData.outlet_id; // Support both just in case
    
    const updatePayload: any = {
      updated_at: Date.now()
    };
    
    const changedFields: Record<string, { from: any, to: any }> = {};
    let isWarningEvent = false;

    // 1. Process Status Transition
    if (data.next_status && data.next_status !== previous_status) {
      const next = data.next_status;
      const isManagerOrAbove = ['manager', 'admin', 'owner'].includes(role);
      const isTerminal = ['cancelled', 'rejected', 'completed', 'delivered'].includes(previous_status);
      const isForward = FORWARD_TRANSITIONS[previous_status]?.includes(next);
      const isRejectionOrCancel = ['cancelled', 'rejected'].includes(next);

      if (isTerminal && !isManagerOrAbove) {
        return NextResponse.json({ success: false, error: "Cannot modify a terminal order state." }, { status: 403 });
      }

      if (!isForward && !isManagerOrAbove && !isRejectionOrCancel) {
         return NextResponse.json({ success: false, error: "Invalid status transition for this role." }, { status: 403 });
      }

      let requiresReason = false;
      if (isTerminal && isManagerOrAbove) requiresReason = true;
      if (!isForward) requiresReason = true;
      if (isRejectionOrCancel) requiresReason = true;

      if (requiresReason && (!data.reason || data.reason.trim() === '')) {
         return NextResponse.json({ success: false, error: "A valid reason is required for this action." }, { status: 400 });
      }

      if (isRejectionOrCancel || (!isForward && isManagerOrAbove)) {
         isWarningEvent = true;
      }

      updatePayload.status = next;
      if (['completed', 'delivered'].includes(next)) {
        updatePayload.completed_at = Date.now();
      }
      changedFields.status = { from: previous_status, to: next };
    }
    
    // 2. Process Payment Status
    if (data.payment_status) {
      const isManagerOrAbove = ['manager', 'admin', 'owner'].includes(role);
      if (!isManagerOrAbove) {
        return NextResponse.json({ success: false, error: "Insufficient permissions to modify payment status." }, { status: 403 });
      }

      const isPaid = data.payment_status === 'paid';
      if (isPaid !== previous_is_paid) {
        updatePayload.is_paid = isPaid;
        changedFields.is_paid = { from: previous_is_paid, to: isPaid };
        
        // Payment modifications are sensitive, log as warning
        isWarningEvent = true;
      }
    }
    
    // 3. Process Rush Held
    if (typeof data.rush_held === 'boolean' && data.rush_held !== previous_rush_held) {
      updatePayload.rush_held = data.rush_held;
      changedFields.rush_held = { from: previous_rush_held, to: data.rush_held };
    }
    
    // 4. Process Rider ID
    if (data.rider_id && data.rider_id !== previous_rider_id) {
      updatePayload.rider_id = data.rider_id;
      changedFields.rider_id = { from: previous_rider_id, to: data.rider_id };
    }
    
    // Ensure we actually have changes
    if (Object.keys(changedFields).length === 0) {
      return NextResponse.json({ success: true, order_id: data.order_id, changed_fields: [] });
    }

    // Execute update
    await orderRef.update(updatePayload);
    
    // Log business event safely without PII
    await logBusinessEvent({
      event_type: 'order_status_changed',
      actor_type: role as ActorType,
      actor_id: uid,
      target_type: 'order',
      target_id: data.order_id,
      order_id: data.order_id,
      ...(outlet_id && { outlet_id }),
      severity: isWarningEvent ? 'warning' : 'info',
      source: 'api',
      metadata: {
        previous_status,
        next_status: updatePayload.status || previous_status,
        changed_fields: changedFields,
        ...(data.reason && { reason: data.reason.trim() }) // safe reason included
      }
    });

    return NextResponse.json({ 
      success: true, 
      order_id: data.order_id, 
      changed_fields: Object.keys(changedFields) 
    });

  } catch (error) {
    console.error("[UPDATE STATUS ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
