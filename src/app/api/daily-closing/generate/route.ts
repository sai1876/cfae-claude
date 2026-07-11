import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { getBusinessWindow } from '@/lib/businessDate';
import { DailyClosingDocument, OrderDocument, RefundRequestDocument, WastageEventDocument, StockMovementDocument } from '@/lib/types';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['manager', 'admin', 'owner']);
    if (auth instanceof NextResponse) return auth;
    const { uid, role } = auth;
    
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });

    const body = await req.json();
    const { outlet_id, business_date, owner_override } = body;

    if (!outlet_id || !business_date) {
      return NextResponse.json({ success: false, error: 'outlet_id and business_date are required' }, { status: 400 });
    }

    // Role check for owner override
    if (owner_override && role !== 'owner') {
      return NextResponse.json({ success: false, error: 'Only owner can override previous day lock' }, { status: 403 });
    }

    const { start_at, end_at, timezone } = getBusinessWindow(business_date);
    const closing_id = `daily_closing_${outlet_id}_${business_date}`;

    // 1. Check for previous unresolved day logic
    // We fetch the most recent closing for this outlet that is NOT the current one
    const previousClosingsSnap = await adminDb.collection('daily_closings')
      .where('outlet_id', '==', outlet_id)
      .where('business_date', '<', business_date)
      .orderBy('business_date', 'desc')
      .limit(1)
      .get();

    if (!previousClosingsSnap.empty) {
      const prevClosing = previousClosingsSnap.docs[0].data() as DailyClosingDocument;
      if (prevClosing.status === 'submitted' && !owner_override) {
        return NextResponse.json({
          success: false,
          error: `Previous day (${prevClosing.business_date}) is submitted but not locked. Please resolve it first.`,
          requires_override: true
        }, { status: 403 });
      }
    }

    // 2. Fetch Orders
    // We only aggregate orders within this exact window
    const ordersSnap = await adminDb.collection('orders')
      .where('outlet', '==', outlet_id)
      .where('created_at', '>=', start_at)
      .where('created_at', '<', end_at)
      .get();

    let gross_sales = 0;
    let discount_amount = 0;
    let net_sales = 0;
    let cash_sales = 0;
    let upi_sales = 0;
    let wallet_sales = 0;
    let unpaid_amount = 0;

    let completed_order_count = 0;
    let cancelled_order_count = 0;

    const orders = ordersSnap.docs.map((d: any) => d.data() as OrderDocument);
    for (const o of orders) {
      if (o.status === 'completed' || o.status === 'delivered') {
        completed_order_count++;
        const oGross = o.gross_amount || 0;
        const oDiscount = 0; // If you have discount field, parse here
        const oNet = oGross - oDiscount;
        
        gross_sales += oGross;
        discount_amount += oDiscount;
        net_sales += oNet;

        // Payment logic assuming cash_paid or payment_status/payment_method exists
        if (o.payment_status === 'paid') {
          // Simplification: if cash_paid matches net, it's cash. Otherwise upi.
          if ((o.cash_paid || 0) >= oNet) {
            cash_sales += oNet;
          } else {
            upi_sales += oNet; // Assume UPI by default if paid but not cash
          }
        } else {
          unpaid_amount += oNet;
        }
      } else if (o.status === 'cancelled' || o.status === 'rejected') {
        cancelled_order_count++;
      }
    }

    // 3. Fetch Refunds
    // We fetch refunds updated or created in this window
    const refundsSnap = await adminDb.collection('refund_requests')
      .where('created_at', '>=', start_at)
      .where('created_at', '<', end_at)
      .get();
    
    // We should also get refunds paid today that might have been created earlier
    const refundsPaidSnap = await adminDb.collection('refund_requests')
      .where('paid_at', '>=', start_at)
      .where('paid_at', '<', end_at)
      .get();

    // Merge and deduplicate
    const refundMap = new Map<string, RefundRequestDocument>();
    refundsSnap.docs.forEach((d: any) => refundMap.set(d.id, d.data() as RefundRequestDocument));
    refundsPaidSnap.docs.forEach((d: any) => refundMap.set(d.id, d.data() as RefundRequestDocument));

    let refund_requests_count = refundMap.size;
    let approved_refunds_count = 0;
    let paid_refunds_count = 0;
    let pending_refund_payments = 0;
    let refund_amount_paid_today = 0;
    let total_refunded_amount_approved = 0;

    Array.from(refundMap.values()).forEach(r => {
      if (r.status === 'approved') {
        approved_refunds_count++;
        total_refunded_amount_approved += (r.requested_amount || 0); // Simplified
      }
      if (r.payment_status === 'paid' && r.paid_at && r.paid_at >= start_at && r.paid_at < end_at) {
        paid_refunds_count++;
        refund_amount_paid_today += (r.requested_amount || 0);
      }
      if (r.payment_status === 'pending' || r.payment_status === ('partial_pending' as any)) {
        pending_refund_payments++;
      }
    });

    // 4. Fetch Wastage
    const wastageSnap = await adminDb.collection('wastage_events')
      .where('created_at', '>=', start_at)
      .where('created_at', '<', end_at)
      .get();
    
    let wastage_events_count = wastageSnap.size;
    let approved_wastage_count = 0;
    let estimated_wastage_cost = 0;
    let remake_count = 0;
    
    wastageSnap.docs.forEach((d: any) => {
      const w = d.data() as WastageEventDocument;
      if (w.status === 'approved') {
        approved_wastage_count++;
      }
      if (w.event_type === 'remake') {
        remake_count++;
      }
      w.items?.forEach(i => {
        estimated_wastage_cost += (i.unit_cost_estimate || 0) * i.quantity;
      });
    });

    // 5. Fetch Stock Movements
    const stockMovSnap = await adminDb.collection('stock_movements')
      .where('created_at', '>=', start_at)
      .where('created_at', '<', end_at)
      .get();
    
    let stock_movements_today = stockMovSnap.size;
    let manual_adjustments_count = 0;
    stockMovSnap.docs.forEach((d: any) => {
      const sm = d.data() as StockMovementDocument;
      if (sm.movement_type === 'manual_adjustment') {
        manual_adjustments_count++;
      }
    });

    // We generate or update the draft document inside a transaction
    const closingRef = adminDb.collection('daily_closings').doc(closing_id);
    
    let draftClosing: DailyClosingDocument | undefined;

    await adminDb.runTransaction(async (t: any) => {
      const closingDoc = await t.get(closingRef);
      if (closingDoc.exists) {
        const data = closingDoc.data() as DailyClosingDocument;
        if (data.status === 'locked') {
          throw new Error('This daily closing is already locked and cannot be regenerated.');
        }
      }

      const expected_cash = cash_sales;
      const expected_upi = upi_sales;

      draftClosing = {
        closing_id,
        outlet_id,
        business_date,
        business_window: { start_at, end_at, timezone },
        status: closingDoc.exists ? (closingDoc.data()?.status || 'draft') : 'draft', // Preserve 'submitted' or 'rejected' if regenerating, but usually this is used on 'draft'
        
        sales_summary: {
          gross_sales,
          net_sales,
          order_count: orders.length,
          completed_order_count,
          cancelled_order_count,
          refunded_amount: total_refunded_amount_approved,
          discount_amount,
          cash_sales,
          upi_sales,
          wallet_sales,
          unpaid_amount
        },

        cash_reconciliation: {
          opening_cash: closingDoc.exists ? (closingDoc.data()?.cash_reconciliation?.opening_cash || 0) : 0,
          expected_cash,
          counted_cash: closingDoc.exists ? (closingDoc.data()?.cash_reconciliation?.counted_cash || 0) : 0,
          cash_difference: closingDoc.exists ? (closingDoc.data()?.cash_reconciliation?.counted_cash || 0) - expected_cash : (0 - expected_cash),
          manager_cash_note: closingDoc.exists ? closingDoc.data()?.cash_reconciliation?.manager_cash_note : undefined,
          cash_proof_photo_urls: closingDoc.exists ? closingDoc.data()?.cash_reconciliation?.cash_proof_photo_urls : []
        },

        payment_reconciliation: {
          expected_upi,
          verified_upi: closingDoc.exists ? (closingDoc.data()?.payment_reconciliation?.verified_upi || 0) : 0,
          upi_difference: closingDoc.exists ? (closingDoc.data()?.payment_reconciliation?.verified_upi || 0) - expected_upi : (0 - expected_upi),
          payment_proof_refs: closingDoc.exists ? closingDoc.data()?.payment_reconciliation?.payment_proof_refs : [],
          manager_payment_note: closingDoc.exists ? closingDoc.data()?.payment_reconciliation?.manager_payment_note : undefined,
        },

        refund_summary: {
          refund_requests_count,
          approved_refunds_count,
          paid_refunds_count,
          pending_refund_payments,
          refund_amount_paid_today
        },

        wastage_summary: {
          wastage_events_count,
          approved_wastage_count,
          estimated_wastage_cost,
          remake_count,
          stock_movements_count: stock_movements_today
        },

        inventory_summary: {
          stock_movements_today,
          negative_stock_alerts: 0,
          low_stock_alerts: 0,
          manual_adjustments_count
        },
        
        created_at: closingDoc.exists ? (closingDoc.data()?.created_at || Date.now()) : Date.now(),
        updated_at: Date.now()
      };

      if (!closingDoc.exists && !draftClosing.opened_at) {
        draftClosing.opened_at = start_at; // approximate logic
      }

      t.set(closingRef, draftClosing, { merge: true });
    });

    await logBusinessEvent({
      event_type: 'daily_closing_generated',
      actor_type: role as any,
      actor_id: uid,
      target_type: 'daily_closing',
      target_id: closing_id,
      outlet_id: outlet_id,
      severity: 'info',
      source: 'admin_panel',
      metadata: {
        business_date
      }
    });

    if (owner_override) {
      await logBusinessEvent({
        event_type: 'daily_closing_owner_override',
        actor_type: 'owner',
        actor_id: uid,
        target_type: 'daily_closing',
        target_id: closing_id,
        outlet_id: outlet_id,
        severity: 'warning',
        source: 'admin_panel',
        metadata: {
          business_date,
          action: 'generate_with_unresolved_previous'
        }
      });
    }

    return NextResponse.json({ success: true, closing: draftClosing });

  } catch (err: any) {
    if (err.message === 'This daily closing is already locked and cannot be regenerated.') {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
