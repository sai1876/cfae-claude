// [PUBLIC] - Passwordless login initiation
import { NextResponse } from 'next/server';
import { distributedRateLimit } from '@/lib/security/distributedRateLimit';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import crypto from 'crypto';
import { maskPhone } from '@/lib/security/maskPii';
import * as admin from 'firebase-admin';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

const passwordlessSchema = z.object({
  phone: z.string().min(10, "Invalid phone number format"),
});

function getPhoneVariations(phone: string): string[] {
  const digits = phone.replace(/[^0-9]/g, "");
  const variations = new Set<string>([digits, `+${digits}`]);
  
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    variations.add(last10);
    variations.add(`+${last10}`);
    variations.add(`+91${last10}`);
    variations.add(`91${last10}`);
  } else if (digits.length === 10) {
    variations.add(`+${digits}`);
    variations.add(`+91${digits}`);
    variations.add(`91${digits}`);
  }
  
  return Array.from(variations);
}

export async function POST(req: Request) {
  const secureHeaders = {
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };

  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await req.json();
    const result = passwordlessSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, detail: "Invalid credentials" }, { status: 401, headers: secureHeaders });
    }

    const { phone } = result.data;
    const maskedPhone = maskPhone(phone);
    const variations = getPhoneVariations(phone);

    // Optional: hash the phone for verification in webhook if we want
    let phoneHash = undefined;
    const secret = process.env.AUTH_HASH_SECRET;
    if (secret) {
      phoneHash = crypto.createHmac('sha256', secret).update(phone).digest('hex');
    }

    // Rate Limit
    const rlKey = phoneHash || crypto.createHash('sha256').update(phone).digest('hex');
    const phoneRl = await distributedRateLimit('pwl_phone', rlKey, 3, 15 * 60 * 1000); // 3 per 15 mins
    if (!phoneRl.success) {
      return NextResponse.json({ success: false, detail: "Too many requests" }, { status: 429, headers: secureHeaders });
    }

    const ipRl = await distributedRateLimit('pwl_ip', ip, 10, 15 * 60 * 1000); // 10 per 15 mins
    if (!ipRl.success) {
      return NextResponse.json({ success: false, detail: "Too many requests" }, { status: 429, headers: secureHeaders });
    }

    // 1. Lookup user in Firestore
    if (!adminDb) {
      return NextResponse.json({ success: false, detail: "Internal Server Error" }, { status: 500, headers: secureHeaders });
    }
    const usersRef = adminDb.collection('users');
    let userDoc: admin.firestore.DocumentSnapshot | null = null;
    
    const queryPhone = await usersRef.where('phone', 'in', variations).limit(1).get();
    if (!queryPhone.empty) {
      userDoc = queryPhone.docs[0];
    } else {
      const queryPhoneNumber = await usersRef.where('phone_number', 'in', variations).limit(1).get();
      if (!queryPhoneNumber.empty) {
        userDoc = queryPhoneNumber.docs[0];
      }
    }

    if (!userDoc) {
      await logBusinessEvent({
        event_type: 'passwordless_login_failed',
        actor_type: 'system',
        actor_id: 'system',
        target_type: 'system',
        target_id: 'system',
        severity: 'warning',
        source: 'api',
        metadata: { masked_phone: maskedPhone, reason: "user_not_found" }
      });
      return NextResponse.json({ success: false, detail: "Invalid credentials" }, { status: 401, headers: secureHeaders });
    }

    const userData = userDoc.data();
    const uid = userDoc.id;
    const accountStatus = userData?.account_status || userData?.status || 'active';

    if (accountStatus.toLowerCase() !== 'active') {
      await logBusinessEvent({
        event_type: 'passwordless_login_failed',
        actor_type: 'system',
        actor_id: uid,
        target_type: 'user',
        target_id: uid,
        severity: 'warning',
        source: 'api',
        metadata: { masked_phone: maskedPhone, reason: "account_inactive" }
      });
      return NextResponse.json({ success: false, detail: "Invalid credentials" }, { status: 401, headers: secureHeaders });
    }

    // 2. Generate 32-character hex token (128-bit)
    const token = crypto.randomBytes(16).toString('hex').toUpperCase();

    // 3. Store in auth_handshakes
    const handshakeRef = adminDb.collection('auth_handshakes').doc(token);
    await handshakeRef.set({
      uid: uid,
      masked_phone: maskedPhone,
      ...(phoneHash && { phone_hash: phoneHash }),
      purpose: "passwordless_login",
      expires_at: Date.now() + 5 * 60 * 1000, // 5 minutes
      is_verified: false,
      used: false,
      consume_state: "pending",
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    await logBusinessEvent({
      event_type: 'passwordless_login_requested',
      actor_type: 'system',
      actor_id: uid,
      target_type: 'customer',
      target_id: uid,
      severity: 'info',
      source: 'api',
      metadata: { masked_phone: maskedPhone, token_id: token.substring(0, 4) + '****' }
    });

    // 4. Build WhatsApp URL
    const rawBotNumber = process.env.WHATSAPP_BOT_NUMBER || process.env.WHATSAPP_BUSINESS_NUMBER || '';
    const botNumber = rawBotNumber.replace(/\D/g, ''); // strip all non-digits

    if (!botNumber || botNumber.length < 10) {
      console.error("[AUTH] WHATSAPP_BOT_NUMBER missing or invalid");
      return NextResponse.json({ success: false, detail: "Internal Server Error" }, { status: 500, headers: secureHeaders });
    }

    const redirectText = `Hey Hau Hau! 🌟\n\nI want to log in securely to my account.\n\nLOGIN Ref: ${token}`;
    const encodedText = encodeURIComponent(redirectText);
    const whatsappUrl = `https://wa.me/${botNumber}?text=${encodedText}`;

    // redirect_url can just be whatsappUrl
    return NextResponse.json({ 
      success: true, 
      token, 
      redirect_url: whatsappUrl, 
      whatsapp_url: whatsappUrl 
    }, { headers: secureHeaders });
    
  } catch (err: any) {
    console.error("Passwordless login error:", err);
    return NextResponse.json({ success: false, detail: "Internal Server Error" }, { status: 500, headers: secureHeaders });
  }
}
