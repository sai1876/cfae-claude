import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import redis from '@/lib/redis';
import redisEmail from '@/lib/redis-email';
import { USERS_COL } from '@/lib/firebase/collections';
import { requireRole } from '@/server/auth/requireRole';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

export async function POST(req: Request) {
  try {
    // Secure Role-Based Authentication
    const authContext = await requireRole(req, ['owner', 'admin']);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const { uid: adminUid, role: adminRole } = authContext;

    const { email, phone, userId } = await req.json();

    if (!email && !phone && !userId) {
      return NextResponse.json({ detail: 'Must provide email, phone, or userId' }, { status: 400 });
    }

    let uid = userId;
    let targetEmail = email;
    let targetPhone = phone;

    // 1. Resolve UID if only email or phone was provided
    if (!uid) {
      try {
        const auth = adminAuth!;
        if (email) {
          const userRecord = await auth.getUserByEmail(email);
          uid = userRecord.uid;
        } else if (phone) {
          const userRecord = await auth.getUserByPhoneNumber(phone);
          uid = userRecord.uid;
        }
      } catch (err: any) {
        // user not found in Auth, but we might still need to clear caches and Firestore
        console.warn("User not found in Firebase Auth directly.", err.message);
      }
    }

    // 2. Fetch full profile from Firestore to ensure we have BOTH phone and email for caching
    let profileDoc;
    if (uid) {
      const db = adminDb!;
      const docSnap = await db.collection(USERS_COL).doc(uid).get();
      if (docSnap.exists) {
        profileDoc = docSnap.data();
        if (profileDoc?.email) targetEmail = profileDoc.email;
        if (profileDoc?.phone) targetPhone = profileDoc.phone;
      }
    } else {
      // If we couldn't find UID, try finding by phone or email in Firestore
      const db = adminDb!;
      let q;
      if (email) {
        q = db.collection(USERS_COL).where('email', '==', email);
      } else if (phone) {
        q = db.collection(USERS_COL).where('phone', '==', phone);
      }
      
      if (q) {
        const querySnap = await q.get();
        if (!querySnap.empty) {
          profileDoc = querySnap.docs[0].data();
          uid = querySnap.docs[0].id;
          if (profileDoc?.email) targetEmail = profileDoc.email;
          if (profileDoc?.phone) targetPhone = profileDoc.phone;
        }
      }
    }

    // 3. Delete from Firebase Auth
    if (uid) {
      try {
        const auth = adminAuth!;
        await auth.deleteUser(uid);
      } catch (err: any) {
        console.warn("Failed to delete from Auth (might not exist):", err.message);
      }
      
      // 4. Delete from Firestore
      try {
        const db = adminDb!;
        await db.collection(USERS_COL).doc(uid).delete();
      } catch (err: any) {
        console.warn("Failed to delete from Firestore:", err.message);
      }
    }

    // 5. Delete from Redis Phone Cache
    if (targetPhone) {
      const normalizedPhone = targetPhone.replace(/\D/g, '');
      await redis.srem('registered_phones', normalizedPhone);
    }

    // 6. Delete from Redis Email Cache
    if (targetEmail) {
      await redisEmail.srem('registered_emails', targetEmail.toLowerCase());
    }

    // 7. Audit Log - PII Masking
    const maskedPhone = targetPhone ? targetPhone.slice(-4).padStart(targetPhone.length, '*') : null;
    const maskedEmail = targetEmail ? targetEmail.substring(0, 2).padEnd(targetEmail.indexOf('@'), '*') + targetEmail.substring(targetEmail.indexOf('@')) : null;

    console.log(`[AUDIT] USER DELETED | Timestamp: ${new Date().toISOString()} | Target UID: ${uid} | Phone: ${maskedPhone} | Email: ${maskedEmail} | Deleted By: ${adminUid} (${adminRole})`);

    await logBusinessEvent({
      event_type: 'admin_user_deleted',
      actor_type: adminRole as any,
      actor_id: adminUid,
      target_type: 'user',
      target_id: uid || 'unknown',
      severity: 'warning',
      source: 'admin_panel',
      metadata: {
        targetPhone: targetPhone || null,
        targetEmail: targetEmail || null,
        cacheCleared: true
      }
    });

    return NextResponse.json({ 
      status: 'ok', 
      message: 'Successfully deleted user and cleared caches.',
      deleted_uid: uid || null,
      cache_cleared: true,
      masked_phone: maskedPhone || null,
      masked_email: maskedEmail || null
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[AUDIT] Admin Delete User Error at ${new Date().toISOString()}:`, error);
    // Do not expose internal error details to client
    return NextResponse.json({ detail: 'Internal server error processing deletion' }, { status: 500 });
  }
}
