// [PUBLIC] - Accessible by unauthenticated users to perform login
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { USERS_COL } from '@/lib/firebase/collections';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';
import { z } from 'zod';
import { maskPhone } from '@/lib/security/maskPii';

const loginSchema = z.object({
  phone: z.string().min(10, "Invalid phone number format"),
  password: z.string().min(6, "Invalid password format")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }
    
    const { phone, password } = result.data;
    const cleanPhone = phone.replace(/\D/g, '');
    const maskedPhone = maskPhone(cleanPhone);
    
    let variations = [cleanPhone, `+${cleanPhone}`];
    if (cleanPhone.length === 10) {
      variations.push(`+91${cleanPhone}`);
      variations.push(`91${cleanPhone}`);
    }
    
    if (!adminDb || !adminAuth) {
      console.error("Firebase Admin not initialized.");
      return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }

    // Find user profile
    const q1 = await adminDb.collection(USERS_COL).where("phone", "in", variations).limit(1).get();
    let userDoc = !q1.empty ? q1.docs[0] : null;
    if (!userDoc) {
      const q2 = await adminDb.collection(USERS_COL).where("phone_number", "in", variations).limit(1).get();
      if (!q2.empty) userDoc = q2.docs[0];
    }
    
    if (!userDoc) {
      await logBusinessEvent({
        event_type: "phone_password_login_failed" as any,
        actor_type: "system",
        actor_id: "unknown",
        target_type: "auth",
        target_id: "phone_password_login",
        severity: "warning",
        source: "api",
        metadata: { masked_phone: maskedPhone, reason: "user_not_found" }
      });
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }
    
    const userProfile = userDoc.data();
    const emailAddress = userProfile.email || userProfile.student_email;
    
    if (!emailAddress) {
      await logBusinessEvent({
        event_type: "phone_password_login_failed" as any,
        actor_type: "system",
        actor_id: "unknown",
        target_type: "auth",
        target_id: "phone_password_login",
        severity: "warning",
        source: "api",
        metadata: { masked_phone: maskedPhone, reason: "no_email_on_profile" }
      });
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }
    
    // Check if account is active
    const isActive = userProfile.is_active || userProfile.status === 'active' || userProfile.account_status === 'active';
    if (!isActive) {
      return NextResponse.json({ success: false, error: "Account inactive.", lockout: true }, { status: 403 });
    }
    
    // Verify password via REST API
    const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("Missing Firebase API key for password verification.");
      return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }

    // TODO: Add robust rate limiting using Redis
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailAddress, password, returnSecureToken: true })
    });
    
    if (!verifyRes.ok) {
      await logBusinessEvent({
        event_type: "phone_password_login_failed" as any,
        actor_type: "system",
        actor_id: "unknown",
        target_type: "auth",
        target_id: "phone_password_login",
        severity: "warning",
        source: "api",
        metadata: { masked_phone: maskedPhone, reason: "invalid_password" }
      });
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }
    
    const verifyData = await verifyRes.json();
    const uid = verifyData.localId;
    
    // Generate custom token
    const customToken = await adminAuth.createCustomToken(uid);
    
    await logBusinessEvent({
      event_type: "phone_password_login_success" as any,
      actor_type: "customer",
      actor_id: uid,
      target_type: "user",
      target_id: uid,
      severity: "info",
      source: "api",
      metadata: { login_method: "phone_password" }
    });
    
    return NextResponse.json({ 
      success: true, 
      custom_token: customToken, 
      user_profile: {
        uid: userProfile.uid || uid,
        name: userProfile.name || userProfile.display_name || '',
        role: userProfile.role || 'customer',
        account_status: userProfile.account_status || userProfile.status || 'active',
        points: userProfile.points || 0
      }
    });
    
  } catch (err: any) {
    console.error("Login-by-phone error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
