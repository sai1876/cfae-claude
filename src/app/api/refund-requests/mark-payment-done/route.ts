import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';

const MarkPaymentDoneSchema = z.object({
  request_id: z.string().min(1),
  payment_method: z.enum(['cash', 'upi', 'bank_transfer', 'wallet', 'manual']),
  payment_reference: z.string().optional(),
  payment_note: z.string().optional()
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
    const parseResult = MarkPaymentDoneSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message || "Invalid payload." }, { status: 400 });
    }

    const { request_id, payment_method, payment_reference, payment_note } = parseResult.data;

    if (['upi', 'bank_transfer'].includes(payment_method) && !payment_reference) {
      return NextResponse.json({ success: false, error: "payment_reference required for upi or bank_transfer." }, { status: 400 });
    }

    let order_id = '';
    let linked_refund_id = '';

    const db = adminDb!;
    const requestRef = db.collection('refund_requests').doc(request_id);
    let settledAt = 0;

    try {
      await db.runTransaction(async (transaction) => {
        const reqSnap = await transaction.get(requestRef);
        if (!reqSnap.exists) {
          throw { status: 404, message: "Refund request not found." };
        }

        const reqData = reqSnap.data()!;
        if (reqData.status !== 'approved') {
          throw { status: 400, message: `Cannot mark payment done for request with status: ${reqData.status}.` };
        }

        const effectivePaymentStatus = reqData.payment_status || 'pending';

        if (effectivePaymentStatus === 'paid') {
          throw { status: 400, message: "Refund payment already marked paid." };
        }

        if (effectivePaymentStatus !== 'pending') {
          throw { status: 400, message: `Cannot mark payment done when payment_status is ${effectivePaymentStatus}.` };
        }

        if (!reqData.linked_refund_id || !reqData.order_id) {
          throw { status: 400, message: "Missing linked refund or order ID on request." };
        }

        order_id = reqData.order_id;
        linked_refund_id = reqData.linked_refund_id;

        const orderRef = db.collection('orders').doc(order_id);
        const refundLedgerRef = orderRef.collection('refunds').doc(linked_refund_id);
        
        const refundLedgerSnap = await transaction.get(refundLedgerRef);
        if (!refundLedgerSnap.exists) {
          throw { status: 404, message: "Linked refund ledger entry not found." };
        }

        settledAt = Date.now();

        // Update refund_requests
        transaction.update(requestRef, {
          payment_status: 'paid',
          paid_at: settledAt,
          paid_by: uid,
          payment_method,
          ...(payment_reference && { payment_reference: payment_reference.trim() }),
          ...(payment_note && { payment_note: payment_note.trim() }),
          updated_at: settledAt
        });

        // Update ledger
        transaction.update(refundLedgerRef, {
          payment_status: 'paid',
          refund_status: 'paid',
          paid_at: settledAt,
          paid_by: uid,
          payment_method,
          ...(payment_reference && { payment_reference: payment_reference.trim() }),
          ...(payment_note && { payment_note: payment_note.trim() })
        });

        // Update order parent document
        transaction.update(orderRef, {
          last_refund_paid_at: settledAt,
          refund_payment_status: 'paid'
        });
      });
    } catch (txError: any) {
      if (txError.status) {
        return NextResponse.json({ success: false, error: txError.message }, { status: txError.status });
      }
      throw txError;
    }

    await logBusinessEvent({
      event_type: 'refund_payment_marked_done',
      actor_type: role as ActorType,
      actor_id: uid,
      target_type: 'order',
      target_id: order_id,
      order_id: order_id,
      severity: 'warning',
      source: 'api',
      metadata: {
        request_id,
        refund_id: linked_refund_id,
        payment_method,
        has_reference: !!payment_reference
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Payment marked as done.",
      request_id,
      refund_id: linked_refund_id,
      payment_status: 'paid',
      paid_at: settledAt,
      paid_by: uid,
      payment_method,
      payment_reference: payment_reference ? payment_reference.trim() : undefined,
      payment_note: payment_note ? payment_note.trim() : undefined
    }, { status: 200 });
  } catch (error: any) {
    console.error("mark-payment-done error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
