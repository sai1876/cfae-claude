import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { DailyClosingDocument } from '@/lib/types';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

const CASH_DIFFERENCE_ESCALATION_THRESHOLD = 500;

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['admin', 'owner']);
    if (auth instanceof NextResponse) return auth;
    const { uid, role } = auth;

    if (!adminDb) return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });

    const body = await req.json();
    const { closing_id, decision, founder_review_note } = body;

    if (!closing_id || !decision) {
      return NextResponse.json({ success: false, error: 'closing_id and decision are required' }, { status: 400 });
    }

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json({ success: false, error: 'decision must be approved or rejected' }, { status: 400 });
    }

    // Only owner can approve and lock
    if (decision === 'approved' && role !== 'owner') {
      return NextResponse.json({ success: false, error: 'Only owner can approve and lock daily closings.' }, { status: 403 });
    }

    const closingRef = adminDb.collection('daily_closings').doc(closing_id);
    let updatedClosing: Partial<DailyClosingDocument> = {};
    let status_to_set = '';

    await adminDb.runTransaction(async (t: any) => {
      const closingDoc = await t.get(closingRef);
      if (!closingDoc.exists) {
        throw new Error('Daily closing not found.');
      }

      const data = closingDoc.data() as DailyClosingDocument;

      if (data.status !== 'submitted') {
        throw new Error(`Cannot review closing in status: ${data.status}`);
      }

      // Escalate if difference > 500
      const cash_diff = Math.abs(data.cash_reconciliation?.cash_difference || 0);
      if (decision === 'approved' && cash_diff > CASH_DIFFERENCE_ESCALATION_THRESHOLD && !founder_review_note) {
        throw new Error(`Cash difference is ${cash_diff} (> ${CASH_DIFFERENCE_ESCALATION_THRESHOLD}). Explicit owner note is required to approve.`);
      }

      if (decision === 'approved') {
        status_to_set = 'locked';
        updatedClosing = {
          status: 'locked',
          locked_at: Date.now(),
          approved_by: uid,
          approved_at: Date.now(),
          founder_review_note: founder_review_note || data.founder_review_note,
          updated_at: Date.now()
        };
      } else {
        status_to_set = 'rejected';
        updatedClosing = {
          status: 'rejected',
          founder_review_note: founder_review_note || data.founder_review_note,
          updated_at: Date.now()
        };
      }

      t.set(closingRef, updatedClosing, { merge: true });
    });

    await logBusinessEvent({
      event_type: status_to_set === 'locked' ? 'daily_closing_locked' : 'daily_closing_rejected',
      actor_type: role as any,
      actor_id: uid,
      target_type: 'daily_closing',
      target_id: closing_id,
      severity: 'info',
      source: 'admin_panel',
      metadata: {}
    });

    return NextResponse.json({ success: true, status: status_to_set, updated: updatedClosing });
  } catch (err: any) {
    if (err.message.includes('status:') || err.message.includes('note is required')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
