import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { processRefundTransaction } from '@/server/refunds/processRefund';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';

const RefundPaymentSchema = z.object({
  order_id: z.string().min(1),
  refund_scope: z.enum(['full_order', 'items', 'custom_amount']),
  refund_amount: z.number().positive(),
  reason: z.string().min(3).max(300),
  method: z.enum(['cash', 'upi', 'card', 'wallet', 'manual']).optional(),
  items: z.array(z.object({
    item_id: z.string().min(1),
    quantity_refunded: z.number().positive(),
    refund_amount: z.number().positive()
  })).optional()
}).strict().superRefine((data, ctx) => {
  if (data.refund_scope === 'items') {
    if (!data.items || data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "items array is required and must have at least one item for 'items' scope.",
        path: ['items']
      });
    }
  } else {
    if (data.items && data.items.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "items array must not be provided for non-item scopes.",
        path: ['items']
      });
    }
  }
});

export async function POST(req: Request) {
  try {
    const authResult = await requireRole(req, ['manager', 'admin', 'owner']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const uid = authResult.uid!;
    const role = authResult.role!;

    const body = await req.json();
    const parseResult = RefundPaymentSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message || "Invalid payload format." }, { status: 400 });
    }

    const { order_id, refund_scope, refund_amount, reason, method, items } = parseResult.data;
    const actualMethod = method || 'manual';

    const orderRef = adminDb.collection('orders').doc(order_id);
    let refundResult: any;

    try {
      refundResult = await adminDb.runTransaction(async (transaction) => {
        return await processRefundTransaction(transaction, orderRef, {
          refund_scope,
          refund_amount,
          reason,
          method: actualMethod,
          requestItems: items,
          uid
        });
      });
    } catch (txError: any) {
      if (txError.status) {
        return NextResponse.json({ success: false, error: txError.message }, { status: txError.status });
      }
      throw txError;
    }

    // Outside the transaction, log the business event
    await logBusinessEvent({
      event_type: 'refund_processed',
      actor_type: role as ActorType,
      actor_id: uid,
      target_type: 'order',
      target_id: order_id,
      order_id: order_id,
      ...(refundResult.outlet_id && { outlet_id: refundResult.outlet_id }),
      severity: 'warning',
      source: 'api',
      metadata: {
        refund_scope,
        refund_amount,
        refund_status: refundResult.nextRefundStatus,
        refund_method: actualMethod,
        reason: reason.trim(),
        ...(refund_scope === 'items' && { item_count: refundResult.itemCount })
      }
    });

    return NextResponse.json({ 
      success: true, 
      order_id,
      refund_id: refundResult.refundId,
      refunded_amount: refundResult.newRefundedAmount,
      refund_status: refundResult.nextRefundStatus
    });

  } catch (error) {
    console.error("[REFUND PAYMENT ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
