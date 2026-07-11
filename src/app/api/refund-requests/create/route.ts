import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';
import { RefundRequestDocument } from '@/lib/types';

const CreateRefundRequestSchema = z.object({
  order_id: z.string().min(1),
  request_scope: z.enum(['full_order', 'items', 'custom_amount']),
  requested_amount: z.number().positive().optional(),
  reason_category: z.enum(['wrong_item', 'missing_item', 'bad_quality', 'late_order', 'cancelled_order', 'payment_issue', 'other']),
  customer_note: z.string().min(5).max(500),
  items: z.array(z.object({
    item_id: z.string().min(1),
    quantity: z.number().positive(),
    requested_amount: z.number().positive().optional()
  })).optional()
}).strict().superRefine((data, ctx) => {
  if (data.request_scope === 'items') {
    if (!data.items || data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "items array is required for 'items' scope.",
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
    const authResult = await requireRole(req, ['customer', 'staff', 'manager', 'admin', 'owner']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const uid = authResult.uid!;

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const body = await req.json();
    const parseResult = CreateRefundRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message || "Invalid payload." }, { status: 400 });
    }

    const { order_id, request_scope, requested_amount, reason_category, customer_note, items } = parseResult.data;

    let requestId = '';

    try {
      await adminDb.runTransaction(async (transaction) => {
        const db = adminDb!;
    const orderRef = db.collection('orders').doc(order_id);
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists) {
          throw { status: 404, message: "Order not found." };
        }

        const orderData = orderSnap.data()!;
        
        if (orderData.user_id !== uid) {
          throw { status: 403, message: "Forbidden: You can only request refunds for your own orders." };
        }

        const isPaid = orderData.is_paid === true || orderData.payment_status === 'paid' || (orderData.cash_paid && orderData.cash_paid > 0);
        if (!isPaid) {
          throw { status: 400, message: "Cannot request refund for an unpaid order." };
        }

        // Check for duplicate pending requests
        const existingRequestsSnap = await transaction.get(
          db.collection('refund_requests')
            .where('order_id', '==', order_id)
            .where('status', '==', 'pending')
        );
        if (!existingRequestsSnap.empty) {
          throw { status: 400, message: "An active refund request already exists for this order." };
        }

        const orderTotal = orderData.gross_amount ?? orderData.total_amount_after_points ?? orderData.total_amount ?? 0;
        const currentRefunded = orderData.refunded_amount || 0;
        const remainingRefundable = orderTotal - currentRefunded;

        if (remainingRefundable <= 0) {
          throw { status: 400, message: "Order is already fully refunded." };
        }

        if (requested_amount && requested_amount > remainingRefundable + 0.01) {
          throw { status: 400, message: `Requested amount exceeds remaining refundable amount (${remainingRefundable}).` };
        }

        if (request_scope === 'items' && items) {
          const orderItems = orderData.items || [];
          let totalItemsRequestedAmt = 0;

          for (const reqItem of items) {
            const dbItem = orderItems.find((i: any) => i.item_id === reqItem.item_id);
            if (!dbItem) {
              throw { status: 400, message: `Item ID ${reqItem.item_id} not found in order.` };
            }

            const alreadyRefundedQty = dbItem.refunded_quantity || 0;
            const remainingQty = dbItem.quantity - alreadyRefundedQty;
            if (reqItem.quantity > remainingQty) {
              throw { status: 400, message: `Requested quantity for item ${reqItem.item_id} exceeds available refundable quantity.` };
            }

            if (reqItem.requested_amount) {
              const alreadyRefundedAmt = dbItem.refunded_amount || 0;
              const remainingAmt = (dbItem.unit_price * dbItem.quantity) - alreadyRefundedAmt;
              if (reqItem.requested_amount > remainingAmt + 0.01) {
                throw { status: 400, message: `Requested amount for item ${reqItem.item_id} exceeds remaining refundable amount for this line.` };
              }
              totalItemsRequestedAmt += reqItem.requested_amount;
            }
          }

          if (requested_amount && totalItemsRequestedAmt > 0 && Math.abs(requested_amount - totalItemsRequestedAmt) > 0.01) {
            throw { status: 400, message: "Total requested_amount does not match sum of item requested_amounts." };
          }
        }

        requestId = uuidv4();
        const db2 = adminDb!;
        const requestRef = db2.collection('refund_requests').doc(requestId);

        const requestDoc: RefundRequestDocument = {
          request_id: requestId,
          order_id,
          user_id: uid,
          request_scope,
          ...(requested_amount !== undefined && { requested_amount }),
          reason_category,
          customer_note: customer_note.trim(),
          ...(items && items.length > 0 && { items_requested: items }),
          status: 'pending',
          created_at: Date.now(),
          updated_at: Date.now()
        };

        transaction.set(requestRef, requestDoc);
      });
    } catch (txError: any) {
      if (txError.status) {
        return NextResponse.json({ success: false, error: txError.message }, { status: txError.status });
      }
      throw txError;
    }

    await logBusinessEvent({
      event_type: 'refund_request_created',
      actor_type: 'customer',
      actor_id: uid,
      target_type: 'order',
      target_id: order_id,
      order_id: order_id,
      severity: 'info',
      source: 'api',
      metadata: {
        action: 'refund_request_created',
        request_id: requestId,
        request_scope,
        reason_category,
        ...(requested_amount && { requested_amount })
      }
    });

    return NextResponse.json({ success: true, request_id: requestId });

  } catch (error) {
    console.error("[REFUND REQUEST CREATE ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
