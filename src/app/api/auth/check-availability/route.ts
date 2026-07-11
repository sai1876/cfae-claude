// [PUBLIC] - Browser-callable route without strict token requirements
import { NextResponse } from 'next/server';
import redis from '@/lib/redis';
import redisEmail from '@/lib/redis-email';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { USERS_COL } from '@/lib/firebase/collections';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, email } = body;

    if (!phone && !email) {
      return NextResponse.json({ detail: "Must provide phone or email" }, { status: 400 });
    }

    if (phone) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const existsInCache = await redis.sismember('registered_phones', normalizedPhone);
      
      if (existsInCache) {
        return NextResponse.json({ available: false, reason: 'phone_taken' }, { status: 200 });
      }

      // Cache miss. Verify against Firebase Auth to self-heal cache.
      if (adminAuth) {
        try {
          const userRecord = await adminAuth.getUserByPhoneNumber(`+${normalizedPhone}`);
          if (userRecord) {
            // User exists in Auth but missed cache. Backfill and reject.
            await redis.sadd('registered_phones', normalizedPhone);
            return NextResponse.json({ available: false, reason: 'phone_taken' }, { status: 200 });
          }
        } catch (authErr: any) {
          // 'auth/user-not-found' is expected if available
          if (authErr.code !== 'auth/user-not-found') {
            console.error("Firebase Auth phone lookup error:", authErr);
          }
        }
      }
      
      // Also check Firestore just in case Auth record is missing but DB exists
      if (adminDb) {
        const q1 = await adminDb.collection(USERS_COL).where("phone", "==", normalizedPhone).limit(1).get();
        const q2 = await adminDb.collection(USERS_COL).where("phone_number", "==", normalizedPhone).limit(1).get();
        if (!q1.empty || !q2.empty) {
          await redis.sadd('registered_phones', normalizedPhone);
          return NextResponse.json({ available: false, reason: 'phone_taken' }, { status: 200 });
        }
      }
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existsInCache = await redisEmail.sismember('registered_emails', normalizedEmail);
      
      if (existsInCache) {
        return NextResponse.json({ available: false, reason: 'email_taken' }, { status: 200 });
      }

      // Cache miss. Verify against Firebase Auth to self-heal cache.
      if (adminAuth) {
        try {
          const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
          if (userRecord) {
            await redisEmail.sadd('registered_emails', normalizedEmail);
            return NextResponse.json({ available: false, reason: 'email_taken' }, { status: 200 });
          }
        } catch (authErr: any) {
          if (authErr.code !== 'auth/user-not-found') {
            console.error("Firebase Auth email lookup error:", authErr);
          }
        }
      }
      
      // Check Firestore
      if (adminDb) {
        const q = await adminDb.collection(USERS_COL).where("email", "==", normalizedEmail).limit(1).get();
        if (!q.empty) {
          await redisEmail.sadd('registered_emails', normalizedEmail);
          return NextResponse.json({ available: false, reason: 'email_taken' }, { status: 200 });
        }
      }
    }

    return NextResponse.json({ available: true }, { status: 200 });

  } catch (error: any) {
    console.error("Check availability error:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}
