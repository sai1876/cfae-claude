import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { DailyClosingDocument } from '@/lib/types';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

const CASH_DIFFERENCE_NOTE_THRESHOLD = 100;

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['manager', 'admin', 'owner']);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    if (!adminDb) return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });

    const body = await req.json();
    const { 
      closing_id, 
      counted_cash, 
      manager_cash_note, 
      cash_proof_photo_urls,
      verified_upi,
      manager_payment_note,
      payment_proof_refs,
      manager_notes
    } = body;

    if (!closing_id || counted_cash === undefined || verified_upi === undefined) {
      return NextResponse.json({ success: false, error: 'closing_id, counted_cash, and verified_upi are required' }, { status: 400 });
    }

    const closingRef = adminDb.collection('daily_closings').doc(closing_id);
    let updatedClosing: Partial<DailyClosingDocument> = {};

    await adminDb.runTransaction(async (t: any) => {
      const closingDoc = await t.get(closingRef);
      
      if (!closingDoc.exists) {
        throw new Error('Daily closing not found.');
      }

      const data = closingDoc.data() as DailyClosingDocument;

      if (data.status !== 'draft' && data.status !== 'rejected') {
        throw new Error(`Cannot submit closing in status: ${data.status}`);
      }

      const expected_cash = data.cash_reconciliation.expected_cash || 0;
      const cash_difference = counted_cash - expected_cash;

      if (Math.abs(cash_difference) > CASH_DIFFERENCE_NOTE_THRESHOLD && !manager_cash_note) {
        throw new Error(`Cash difference is ${Math.abs(cash_difference)} which exceeds threshold of ${CASH_DIFFERENCE_NOTE_THRESHOLD}. A manager note is required.`);
      }

      const expected_upi = data.payment_reconciliation?.expected_upi || 0;
      const upi_difference = verified_upi - expected_upi;

      updatedClosing = {
        status: 'submitted',
        cash_reconciliation: {
          ...data.cash_reconciliation,
          counted_cash,
          cash_difference,
          manager_cash_note: manager_cash_note || data.cash_reconciliation.manager_cash_note,
          cash_proof_photo_urls: cash_proof_photo_urls || data.cash_reconciliation.cash_proof_photo_urls
        },
        payment_reconciliation: {
          ...data.payment_reconciliation,
          verified_upi,
          upi_difference,
          manager_payment_note: manager_payment_note || data.payment_reconciliation?.manager_payment_note,
          payment_proof_refs: payment_proof_refs || data.payment_reconciliation?.payment_proof_refs
        },
        manager_notes: manager_notes || data.manager_notes,
        updated_at: Date.now()
      };

      t.set(closingRef, updatedClosing, { merge: true });
    });

    await logBusinessEvent({
      event_type: 'daily_closing_submitted',
      actor_type: 'manager',
      actor_id: uid,
      target_type: 'daily_closing',
      target_id: closing_id,
      severity: 'info',
      source: 'admin_panel',
      metadata: {}
    });

    return NextResponse.json({ success: true, updated: updatedClosing });

  } catch (err: any) {
    if (err.message.includes('threshold') || err.message.includes('status:')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
