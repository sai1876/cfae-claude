import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import redis from '@/lib/redis';
import redisEmail from '@/lib/redis-email';
import { USERS_COL } from '@/lib/firebase/collections';
import { POINT_LEDGER_EXPIRY_DAYS } from '@/lib/constants';
import { FieldValue } from 'firebase-admin/firestore';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb || !adminAuth) {
      return NextResponse.json({ detail: 'Firebase Admin not configured' }, { status: 500 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ detail: 'Invalid Firebase ID token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const db = adminDb;
    const userRef = db.collection(USERS_COL).doc(userId);
    
    // Read the trusted Firestore profile
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ detail: 'Firestore profile not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const phone = userData.phone;
    const email = userData.email || userData.student_email;
    const referredBy = userData.referred_by;

    // --- SECURE CACHE WRITES ---
    // (Happens outside transaction since it's safe to retry and idempotent)
    try {
      if (phone) {
        const normalizedPhone = phone.replace(/\D/g, '');
        await redis.sadd('registered_phones', normalizedPhone);
      }
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        await redisEmail.sadd('registered_emails', normalizedEmail);
      }
    } catch (cacheErr) {
      console.warn("Failed to update redis caches, continuing to ledger:", cacheErr);
    }

    // --- IDEMPOTENT TRANSACTIONAL REWARDS CREATION ---
    await db.runTransaction(async (transaction) => {
      // 1. Check if welcome bonus already exists
      const welcomeQuery = db.collection('point_ledger')
        .where('user_id', '==', userId)
        .where('source', '==', 'welcome_bonus')
        .limit(1);
      
      const welcomeCheck = await transaction.get(welcomeQuery);

      const expDate = new Date();
      expDate.setDate(expDate.getDate() + POINT_LEDGER_EXPIRY_DAYS);

      if (welcomeCheck.empty) {
        const welcomeLedgerRef = db.collection('point_ledger').doc();
        transaction.set(welcomeLedgerRef, {
          user_id: userId,
          amount: 100,
          original_amount: 100,
          source: 'welcome_bonus',
          expires_at: expDate.toISOString(),
          is_expired: false,
          created_at: Date.now()
        });
      }

      // 2. Process Referral Bonus idempotently
      if (referredBy) {
        let referrerRef = null;
        
        let querySnapshot = await db.collection(USERS_COL).where("referral_code", "==", referredBy).limit(1).get();
        if (querySnapshot.empty && referredBy.startsWith("HAU HAU_")) {
          const fallbackCode = "Hau Hau_" + referredBy.substring(8);
          querySnapshot = await db.collection(USERS_COL).where("referral_code", "==", fallbackCode).limit(1).get();
        } else if (querySnapshot.empty && referredBy.startsWith("HAUHAU_")) {
          const fallbackCode = "Hau Hau_" + referredBy.substring(7);
          querySnapshot = await db.collection(USERS_COL).where("referral_code", "==", fallbackCode).limit(1).get();
        }

        if (!querySnapshot.empty) {
          referrerRef = db.collection(USERS_COL).doc(querySnapshot.docs[0].id);
        }

        if (referrerRef) {
          // Check if referral bonus was already awarded for this SPECIFIC new user
          const referralQuery = db.collection('point_ledger')
            .where('user_id', '==', referrerRef.id)
            .where('source', '==', 'referral_bonus')
            .where('referred_user_id', '==', userId)
            .limit(1);

          const referralCheck = await transaction.get(referralQuery);

          if (referralCheck.empty) {
            // Safely increment referrer points using FieldValue
            transaction.update(referrerRef, { 
              points: FieldValue.increment(50) 
            });

            // Create ledger entry
            const referrerLedgerRef = db.collection('point_ledger').doc();
            transaction.set(referrerLedgerRef, {
              user_id: referrerRef.id,
              referred_user_id: userId,
              amount: 50,
              original_amount: 50,
              source: 'referral_bonus',
              expires_at: expDate.toISOString(),
              is_expired: false,
              created_at: Date.now()
            });
          }
        }
      }
    });

    await logBusinessEvent({
      event_type: 'signup_finalized',
      actor_type: 'customer',
      actor_id: userId,
      target_type: 'user',
      target_id: userId,
      severity: 'info',
      source: 'api',
      metadata: {
        cacheCleared: true
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Finalize signup cache error:", error);
    return NextResponse.json({ detail: 'Internal server error processing finalization' }, { status: 500 });
  }
}
