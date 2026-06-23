import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

// Firebase Auth API Key for REST credential verification
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export async function POST(request: Request) {
  // Check API Secret Key
  const authHeader = request.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const db = adminDb;
    const auth = adminAuth;

    const body = await request.json();
    const { session, action, password, pointsRedeemed = 0 } = body;

    if (!session) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 1. Fetch the voice order document
    const voiceOrderRef = db.collection('voice_orders').doc(session);
    const voiceOrderSnap = await voiceOrderRef.get();

    if (!voiceOrderSnap.exists) {
      return NextResponse.json({ error: 'Voice order session not found' }, { status: 404 });
    }

    const voiceOrder = voiceOrderSnap.data()!;

    // ----------------------------------------------------
    // ACTION 1: Verify Password (Gate D)
    // ----------------------------------------------------
    if (action === 'verify_password') {
      if (!password) {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 });
      }

      // Lookup user by phone
      const phone = voiceOrder.phone_number;
      const usersSnap = await db.collection('users').where('phone_number', '==', phone).get();
      
      let userDoc = null;
      if (!usersSnap.empty) {
        userDoc = usersSnap.docs[0];
      } else {
        // Fallback checks for phone format variations
        const queryAlt = await db.collection('users').where('phone', '==', phone).get();
        if (!queryAlt.empty) {
          userDoc = queryAlt.docs[0];
        }
      }

      if (!userDoc) {
        return NextResponse.json({ error: 'User profile not found for this order' }, { status: 404 });
      }

      const uid = userDoc.id;
      
      // Get user email from Firebase Auth
      const authUser = await auth.getUser(uid);
      const email = authUser.email;

      if (!email) {
        return NextResponse.json({ error: 'No email registered for this account' }, { status: 400 });
      }

      if (!FIREBASE_API_KEY) {
        console.error('Missing NEXT_PUBLIC_FIREBASE_API_KEY env variable.');
        return NextResponse.json({ error: 'Internal Auth Service error' }, { status: 500 });
      }

      // Call Firebase REST API to verify password
      const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
      const restRes = await fetch(restUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      });

      if (!restRes.ok) {
        const errData = await restRes.json();
        console.warn('REST Auth validation failed:', errData);
        return NextResponse.json({ success: false, error: 'Incorrect credentials' });
      }

      const restData = await restRes.json();
      return NextResponse.json({ success: true, email, uid: restData.localId });
    }

    // ----------------------------------------------------
    // ACTION 2: Soft Delete due to 5-Minute Lifespan Rule
    // ----------------------------------------------------
    if (action === 'soft_delete') {
      const currentTimestamp = admin.firestore.Timestamp.now();
      await voiceOrderRef.update({
        status: 'SOFT_DELETED',
        soft_deleted_at: currentTimestamp
      });
      console.log(`[VOICE ORDER] Soft deleted expired session: ${session}`);
      return NextResponse.json({ success: true, status: 'SOFT_DELETED' });
    }

    // ----------------------------------------------------
    // ACTION 3: Complete Payment & Transition to KDS (Option A & B Checkout)
    // ----------------------------------------------------
    if (action === 'complete_payment') {
      const expiresAtMs = voiceOrder.expires_at.toMillis();
      const currentMs = Date.now();

      if (currentMs > expiresAtMs) {
        // Order expired! Mark soft deleted
        const currentTimestamp = admin.firestore.Timestamp.now();
        await voiceOrderRef.update({
          status: 'SOFT_DELETED',
          soft_deleted_at: currentTimestamp
        });
        return NextResponse.json({ error: 'Session expired, boss. Order not confirmed within the 5-minute break limit.' }, { status: 410 });
      }

      const phone = voiceOrder.phone_number;
      // Get user
      const usersSnap = await db.collection('users').where('phone_number', '==', phone).get();
      let userDoc = null;
      if (!usersSnap.empty) {
        userDoc = usersSnap.docs[0];
      } else {
        const queryAlt = await db.collection('users').where('phone', '==', phone).get();
        if (!queryAlt.empty) {
          userDoc = queryAlt.docs[0];
        }
      }

      if (!userDoc) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }

      const uid = userDoc.id;
      const userData = userDoc.data();
      const estimatedTotal = voiceOrder.estimated_total;

      // Validate 20% Profit Shield coins cap
      const maxAllowedPoints = Math.floor(estimatedTotal * 0.20);
      if (pointsRedeemed > maxAllowedPoints) {
        return NextResponse.json({ error: `You can only use up to 20% of your order total (${maxAllowedPoints} points).` }, { status: 400 });
      }

      // Execute atomic transaction for payment ledger updates, user metrics, and order creation
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let orderId = '';
      for (let i = 0; i < 8; i++) {
        orderId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const orderRef = db.collection('orders').doc(orderId);
      const sequenceRef = db.collection('config').doc('order_sequence');
      const storeConfigRef = db.collection('config').doc('store_settings');
      const userRef = db.collection('users').doc(uid);

      await db.runTransaction(async (transaction) => {
        // 1. Get sequence & KDS settings
        const seqSnap = await transaction.get(sequenceRef);
        let currentSeq = 1;
        const today = new Date().toDateString();

        if (seqSnap.exists) {
          const data = seqSnap.data()!;
          if (data.date === today) {
            currentSeq = (data.last_val || 0) + 1;
          }
        }
        const tokenStr = currentSeq.toString().padStart(4, "0");

        // 2. Fetch KDS settings
        const configSnap = await transaction.get(storeConfigRef);
        const rushModeActive = configSnap.exists ? !!configSnap.data()!.rush_mode_active : false;

        // 3. FIFO Deduct points from ledger
        if (pointsRedeemed > 0) {
          const nowISO = new Date().toISOString();
          const ledgerSnap = await db.collection('point_ledger')
            .where('user_id', '==', uid)
            .get();

          let activePoints: any[] = [];
          ledgerSnap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.amount > 0 && d.expires_at > nowISO && !d.is_expired) {
              activePoints.push({
                id: docSnap.id,
                amount: d.amount,
                expires_at: d.expires_at,
                ref: docSnap.ref
              });
            }
          });

          // Sort ascending (FIFO) by expires_at
          activePoints.sort((a, b) => a.expires_at.localeCompare(b.expires_at));

          let remainingToDeduct = pointsRedeemed;
          for (const entry of activePoints) {
            if (remainingToDeduct <= 0) break;
            const deductAmount = Math.min(entry.amount, remainingToDeduct);
            const newBalance = entry.amount - deductAmount;

            const docRef = db.collection('point_ledger').doc(entry.id);
            transaction.update(docRef, { amount: newBalance });
            remainingToDeduct -= deductAmount;
          }

          // Record transaction debit
          const newDebitRef = db.collection('point_ledger').doc();
          transaction.set(newDebitRef, {
            user_id: uid,
            amount: -pointsRedeemed,
            original_amount: -pointsRedeemed,
            source: 'order',
            is_expired: false,
            created_at: Date.now()
          });
        }

        // 4. Update order history kickbacks
        const totalCompletedOrders = (userData.total_completed_orders || 0) + 1;
        transaction.update(userRef, {
          total_completed_orders: totalCompletedOrders
        });

        // Earn loyalty points (15% for first 3, 10% for orders 4-5, 8% after)
        let kickbackPercent = 0.08;
        if (totalCompletedOrders <= 3) {
          kickbackPercent = 0.15;
          // Grant referrer kickback if referred
          if (userData.referred_by) {
            const referrerQuery = await db.collection('users').where('referral_code', '==', userData.referred_by).get();
            if (!referrerQuery.empty) {
              const referrerDoc = referrerQuery.docs[0];
              const referrerRef = referrerDoc.ref;
              const referrerData = referrerDoc.data();
              const referrerEarned = Math.floor(estimatedTotal * 0.08);

              if (referrerEarned > 0) {
                const exp = new Date();
                exp.setDate(exp.getDate() + 45);
                const referrerPointsRef = db.collection('point_ledger').doc();
                transaction.set(referrerPointsRef, {
                  user_id: referrerDoc.id,
                  amount: referrerEarned,
                  original_amount: referrerEarned,
                  source: 'referral',
                  expires_at: exp.toISOString(),
                  is_expired: false,
                  created_at: Date.now()
                });
              }

              // Voucher Milestones if this is the first order
              if (totalCompletedOrders === 1) {
                const newCount = (referrerData.successful_referrals || 0) + 1;
                transaction.update(referrerRef, { successful_referrals: newCount });

                let itemTypeToUnlock = null;
                if (newCount === 3) itemTypeToUnlock = 'fries';
                if (newCount === 8) itemTypeToUnlock = 'thickshake';
                if (newCount === 15) itemTypeToUnlock = 'popcorn_or_drink';

                if (itemTypeToUnlock) {
                  const voucherRef = db.collection('vouchers').doc();
                  transaction.set(voucherRef, {
                    user_id: referrerDoc.id,
                    item_type: itemTypeToUnlock,
                    created_at: Date.now()
                  });
                }
              }
            }
          }
        } else if (totalCompletedOrders <= 5) {
          kickbackPercent = 0.10;
        }

        const pointsEarned = Math.floor(estimatedTotal * kickbackPercent);
        if (pointsEarned > 0) {
          const exp = new Date();
          exp.setDate(exp.getDate() + 45); // strict 45-day expiration
          const newPointsRef = db.collection('point_ledger').doc();
          transaction.set(newPointsRef, {
            user_id: uid,
            amount: pointsEarned,
            original_amount: pointsEarned,
            source: 'order',
            expires_at: exp.toISOString(),
            is_expired: false,
            created_at: Date.now()
          });
        }

        // 5. Create the standard Order Document
        const newOrder = {
          order_id: orderId,
          token_number: tokenStr,
          user_id: uid,
          gross_amount: estimatedTotal,
          points_redeemed: pointsRedeemed,
          cash_paid: 0,
          order_type: 'pickup',
          outlet: 'HYD CAMPUS', // default
          status: 'preparing',  // straight into preparation state
          estimated_time_mins: 8,
          rush_held: rushModeActive,
          source: 'voice',
          voice_order_id: session,
          items: voiceOrder.items.map((item: any) => ({
            item_id: Math.random().toString(36).substring(7),
            menu_item_id: item.id || '',
            name: item.name,
            quantity: item.qty,
            unit_price: item.unit_price,
            station: 'GRILLED OR STEAMED', // fallback station
            status: 'pending',
            modifiers: []
          })),
          created_at: Date.now(),
          updated_at: Date.now()
        };

        transaction.set(sequenceRef, { date: today, last_val: currentSeq });
        transaction.set(orderRef, newOrder);
        transaction.update(voiceOrderRef, { status: 'PAID_CONFIRMED' });
      });

      console.log(`[VOICE ORDER SUCCESS] Voice order ${session} completed as order ID ${orderId}`);
      return NextResponse.json({ success: true, order_id: orderId, status: 'PAID_CONFIRMED' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('[VOICE ORDER ERROR] API router failed:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
