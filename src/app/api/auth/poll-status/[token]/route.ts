// [PUBLIC] - Polling status for authentication
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';
import { distributedRateLimit } from '@/lib/security/distributedRateLimit';
import crypto from 'crypto';

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const secureHeaders = {
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };

  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const token = params.token.toUpperCase();
    
    if (!/^[A-F0-9]{32}$/.test(token)) {
      const invalidIpRl = await distributedRateLimit('pwl_invalid_ip', ip, 20, 15 * 60 * 1000);
      if (!invalidIpRl.success) {
        return NextResponse.json({ is_phone_verified: false, error: "Too many requests." }, { status: 429, headers: secureHeaders });
      }
      
      await logBusinessEvent({
        event_type: 'suspicious_activity_detected',
        actor_type: 'system',
        actor_id: ip,
        target_type: 'auth_handshake',
        target_id: 'unknown',
        severity: 'critical',
        source: 'api',
        metadata: {
          reason: token.length !== 32 
            ? `token.length !== 32. Legacy 8-character tokens are not supported.` 
            : 'invalid_token_format'
        }
      });
      
      return NextResponse.json({ is_phone_verified: false, error: "Authentication failed." }, { headers: secureHeaders });
    }

    // Rate Limit polling
    const secret = process.env.AUTH_HASH_SECRET || process.env.API_SECRET_KEY || 'default_dev_secret';
    const tokenHash = crypto.createHmac('sha256', secret).update(token).digest('hex');
    
    const tokenRl = await distributedRateLimit('pwl_poll_token', tokenHash, 30, 5 * 60 * 1000); // 30 req / 5 mins per token
    if (!tokenRl.success) {
      return NextResponse.json({ is_phone_verified: false, error: "Too many requests." }, { status: 429, headers: secureHeaders });
    }

    const ipRl = await distributedRateLimit('pwl_poll_ip', ip, 60, 5 * 60 * 1000);
    if (!ipRl.success) {
      return NextResponse.json({ is_phone_verified: false, error: "Too many requests." }, { status: 429, headers: secureHeaders });
    }
    
    if (!adminDb) {
      return NextResponse.json({ is_phone_verified: false, error: "Internal Server Error" }, { status: 500, headers: secureHeaders });
    }
    
    const handshakeRef = adminDb.collection('auth_handshakes').doc(token);
    
    // Transactional reservation
    const reservationResult = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(handshakeRef);
      if (!snap.exists) return { success: false, error: "Authentication failed." }; // Generic error
      
      const data = snap.data()!;
      const purpose = data.purpose || "phone_verification";
      const uid = data.uid;
      
      if (purpose !== "passwordless_login") {
        return { success: false, error: "Authentication failed.", purpose, uid };
      }
      
      if (Date.now() > (data.expires_at || 0)) return { success: false, error: "Authentication failed.", purpose, uid }; // expired
      
      const isVerified = data.is_verified || false;
      if (!isVerified) return { success: false, pending: true, purpose, uid };
      
      const used = data.used || false;
      const consumeState = data.consume_state || "pending";
      
      if (used || consumeState !== "pending") {
        return { success: false, error: "Authentication failed.", purpose, uid };
      }
      
      t.update(handshakeRef, { consume_state: "issuing", used: true, issuance_started_at: Date.now() });
      return { success: true, data };
    });
    
    if (!reservationResult.success || !reservationResult.data) {
      if (reservationResult.pending) {
        return NextResponse.json({ is_phone_verified: false }, { headers: secureHeaders });
      }
      return NextResponse.json({ is_phone_verified: false, error: reservationResult.error }, { headers: secureHeaders });
    }
    
    const data = reservationResult.data;
    const uid = data.uid;
    
    if (!uid) {
      await handshakeRef.update({ consume_state: "pending", used: false }); // Revert
      await logBusinessEvent({
        event_type: 'passwordless_login_consume_failed',
        actor_type: 'system',
        actor_id: 'system',
        target_type: 'auth_handshake',
        target_id: `${token.substring(0, 4)}****`,
        severity: 'critical',
        source: 'api',
        metadata: { error: "User ID missing from handshake" }
      });
      return NextResponse.json({ is_phone_verified: false, error: "Authentication failed." }, { headers: secureHeaders });
    }

    try {
      const customToken = await getAuth().createCustomToken(uid);
      
      await handshakeRef.update({
        consume_state: "consumed",
        consumed_at: Date.now()
      });
      
      await logBusinessEvent({
        event_type: 'passwordless_login_consumed',
        actor_type: 'customer',
        actor_id: uid,
        target_type: 'auth_handshake',
        target_id: `${token.substring(0, 4)}****`,
        severity: 'info',
        source: 'api',
        metadata: {}
      });

      return NextResponse.json({ is_phone_verified: true, custom_token: customToken }, { headers: secureHeaders });

    } catch (e) {
      console.error(`[POLL STATUS ERROR] token: ${token.substring(0, 4)}****`, e);
      // Revert so client can retry
      await handshakeRef.update({ consume_state: "pending", used: false });
      
      await logBusinessEvent({
        event_type: 'passwordless_login_consume_failed',
        actor_type: 'system',
        actor_id: uid,
        target_type: 'auth_handshake',
        target_id: `${token.substring(0, 4)}****`,
        severity: 'critical',
        source: 'api',
        metadata: { error: "Failed to create custom token" }
      });
      return NextResponse.json({ is_phone_verified: false, error: "Internal Server Error" }, { status: 500, headers: secureHeaders });
    }
  } catch (err: any) {
    console.error("Poll status error:", err);
    return NextResponse.json({ is_phone_verified: false, error: "Internal Server Error" }, { status: 500, headers: secureHeaders }); // Must fallback to headers: secureHeaders if err doesn't already have it
  }
}
