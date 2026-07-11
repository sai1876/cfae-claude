import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { USERS_COL } from '@/lib/firebase/collections';
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
    const decodedEmail = decodedToken.email?.toLowerCase().trim();
    
    const body = await req.json();
    
    // Only accept strictly safe fields from the client
    const { phone, name, email, referredBy, handshakeToken } = body;

    if (!handshakeToken || typeof handshakeToken !== 'string') {
      return NextResponse.json({ detail: 'Missing WhatsApp handshake proof' }, { status: 400 });
    }

    const normalizedPhone = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
    if (normalizedPhone.length < 10) {
      return NextResponse.json({ detail: 'Valid phone is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ detail: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail !== decodedEmail) {
      return NextResponse.json({ detail: 'Email mismatch' }, { status: 403 });
    }

    const db = adminDb;
    
    // --- Verify WhatsApp Handshake ---
    const handshakeRef = db.collection('auth_handshakes').doc(handshakeToken);
    const handshakeDoc = await handshakeRef.get();
    
    if (!handshakeDoc.exists) {
      return NextResponse.json({ detail: 'Invalid or missing handshake' }, { status: 403 });
    }

    const handshakeData = handshakeDoc.data()!;
    if (handshakeData.is_verified !== true) {
      return NextResponse.json({ detail: 'Handshake not verified' }, { status: 403 });
    }
    if (handshakeData.phone !== normalizedPhone) {
      return NextResponse.json({ detail: 'Phone mismatch' }, { status: 403 });
    }
    if (handshakeData.expires_at < Date.now()) {
      return NextResponse.json({ detail: 'Handshake expired' }, { status: 403 });
    }
    if (handshakeData.consumed === true) {
      return NextResponse.json({ detail: 'Handshake already consumed' }, { status: 403 });
    }
    const userRef = db.collection(USERS_COL).doc(userId);
    
    // Check if profile already exists
    const existingDoc = await userRef.get();
    if (existingDoc.exists) {
      return NextResponse.json({ detail: 'Profile already exists' }, { status: 409 });
    }

    // Generate strict server-side defaults
    const referralCode = `Hau Hau_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newProfile = {
      user_id: userId,
      phone: normalizedPhone,
      name: name || "",
      student_email: normalizedEmail,
      email: normalizedEmail,
      email_verified: false,
      points: 100, // Hardcoded on server. Client cannot override.
      referral_code: referralCode,
      referred_by: referredBy || "",
      account_status: "inactive",
      status: "inactive",
      is_active: false,
      is_email_verified: false,
      created_at: Date.now()
    };

    // Use adminDb to bypass firestore.rules restrictions securely
    await userRef.set(newProfile);

    // Consume the handshake so it cannot be reused
    await handshakeRef.update({
      consumed: true,
      consumed_by: userId,
      consumed_at: Date.now()
    });

    await logBusinessEvent({
      event_type: 'profile_created',
      actor_type: 'customer',
      actor_id: userId,
      target_type: 'user',
      target_id: userId,
      severity: 'info',
      source: 'api',
      metadata: {
        hasReferredBy: !!referredBy
      }
    });

    return NextResponse.json(newProfile, { status: 200 });
  } catch (error: any) {
    console.error("Create profile error:", error);
    return NextResponse.json({ detail: 'Internal server error processing profile creation' }, { status: 500 });
  }
}
