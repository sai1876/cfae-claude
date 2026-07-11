// [PUBLIC] - Polling status for authentication
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token.toUpperCase();
    
    if (!/^[A-F0-9]{32}$/.test(token) && !/^[A-Z0-9]{8}$/.test(token)) {
      return NextResponse.json({ is_phone_verified: false, error: "Invalid token format." });
    }
    
    if (!adminDb) {
      return NextResponse.json({ is_phone_verified: false, error: "Database connection uninitialized." }, { status: 500 });
    }
    
    const handshakeRef = adminDb.collection('auth_handshakes').doc(token);
    
    // Transactional reservation
    const reservationResult = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(handshakeRef);
      if (!snap.exists) return { success: false, error: "Handshake token not found." };
      
      const data = snap.data()!;
      const purpose = data.purpose || "phone_verification";
      const uid = data.uid;
      
      if (purpose === "passwordless_login" && token.length !== 32) {
        return { success: false, error: "Legacy 8-character tokens are not supported for passwordless login.", purpose, uid };
      }
      
      if (Date.now() > (data.expires_at || 0)) return { success: false, error: "Handshake token expired.", purpose, uid };
      
      const isVerified = data.is_verified || false;
      if (!isVerified) return { success: false, pending: true, purpose, uid };
      
      const used = data.used || false;
      const consumeState = data.consume_state || "pending";
      
      if (used || ["consuming", "consumed", "consume_failed"].includes(consumeState)) {
        return { success: false, error: "Token already used or invalid state.", purpose, uid };
      }
      
      t.update(handshakeRef, { consume_state: "consuming" });
      return { success: true, data };
    });
    
    if (!reservationResult.success || !reservationResult.data) {
      if (reservationResult.purpose === "passwordless_login" && !reservationResult.pending) {
        await logBusinessEvent({
          event_type: 'passwordless_login_poll_failed',
          actor_type: 'system',
          actor_id: reservationResult.uid || 'system',
          target_type: 'auth_handshake',
          target_id: `${token.substring(0, 4)}****`,
          severity: 'warning',
          source: 'api',
          metadata: { error: reservationResult.error }
        });
      }
      if (reservationResult.pending) {
        return NextResponse.json({ is_phone_verified: false });
      }
      return NextResponse.json({ is_phone_verified: false, error: reservationResult.error });
    }
    
    const data = reservationResult.data;
    const response: any = { is_phone_verified: true };
    const purpose = data.purpose || "phone_verification";
    
    if (purpose === "passwordless_login") {
      const uid = data.uid;
      if (uid) {
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data()!;
          response.user_profile = {
            uid: uid,
            name: userData.name || userData.display_name || "",
            role: userData.role || "customer",
            account_status: userData.account_status || userData.status || "active",
            points: userData.points || 0
          };
          
          try {
            const customToken = await getAuth().createCustomToken(uid);
            response.custom_token = customToken;
            
            await handshakeRef.update({
              used: true,
              consume_state: "consumed",
              used_at: Date.now()
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
          } catch (e) {
            console.error(`[POLL STATUS ERROR] token: ${token.substring(0, 4)}****`, e);
            await handshakeRef.update({ consume_state: "consume_failed" });
            
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
            return NextResponse.json({ is_phone_verified: false, error: "Authentication failed securely." });
          }
        }
      } else {
        await handshakeRef.update({ consume_state: "consume_failed" });
        await logBusinessEvent({
          event_type: 'passwordless_login_consume_failed',
          actor_type: 'system',
          actor_id: uid || 'system',
          target_type: 'auth_handshake',
          target_id: `${token.substring(0, 4)}****`,
          severity: 'critical',
          source: 'api',
          metadata: { error: "User ID missing from handshake" }
        });
        return NextResponse.json({ is_phone_verified: false, error: "User ID missing from handshake." });
      }
    } else {
      // phone_verification
      await handshakeRef.update({
        used: true,
        consume_state: "consumed",
        used_at: Date.now()
      });
    }
    
    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Poll status error:", err);
    return NextResponse.json({ is_phone_verified: false, error: "Internal Server Error" }, { status: 500 });
  }
}
