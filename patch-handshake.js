const fs = require('fs');
const file = 'src/app/api/webhook/whatsapp/route.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /\/\*\*\s*\*\s*Background Asynchronous Pipeline: verifies signup token handshake\.\s*\*\/\s*async function processTextHandshakeInBackground\([\s\S]*?\n\}\n(?=\/\*\*|\n\n|export)/m;

const newCode = `/**
 * Background Asynchronous Pipeline: verifies signup token handshake.
 */
async function processTextHandshakeInBackground(
  phoneNumberId: string,
  fromPhone: string,
  normalizedFromPhone: string,
  token: string,
  messageId?: string
) {
  if (!adminDb) return;
  console.log(\`[BACKGROUND TASK] Verifying Token for \${maskPhone(fromPhone)}\`);

  try {
    const handshakeRef = adminDb.collection('auth_handshakes').doc(token);
    
    const result = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(handshakeRef);
      if (!snap.exists) return { success: false, error: 'invalid' };
      
      const data = snap.data()!;
      if (data.purpose !== 'passwordless_login') return { success: false, error: 'invalid_purpose' };
      if (!/^[A-F0-9]{32}$/i.test(token)) return { success: false, error: 'invalid_format' };
      if (data.consume_state !== 'pending') return { success: false, error: 'invalid_state' };
      if (Date.now() > (data.expires_at || 0)) return { success: false, error: 'expired' };
      if (data.is_verified || data.used) return { success: false, error: 'already_used' };
      
      // User Check
      const userRef = adminDb.collection('users').doc(data.uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) return { success: false, error: 'user_not_found' };
      
      const userProfile = userSnap.data()!;
      if (userProfile.account_status?.toLowerCase() !== 'active' && userProfile.status?.toLowerCase() !== 'active') {
        return { success: false, error: 'user_inactive' };
      }

      const registeredPhone = (userProfile.phone || userProfile.phone_number || '').replace(/[^0-9]/g, "");
      const webhookSuffix = normalizedFromPhone.slice(-10);
      const registeredSuffix = registeredPhone.slice(-10);

      if (!registeredSuffix || webhookSuffix !== registeredSuffix) {
        return { success: false, error: 'sender_mismatch', uid: data.uid };
      }

      t.update(handshakeRef, {
        is_verified: true,
        verified_at: admin.firestore.FieldValue.serverTimestamp(),
        verified_by_message_id: messageId || 'unknown',
        verification_method: 'whatsapp_webhook'
      });

      return { success: true, uid: data.uid };
    });

    if (!result.success) {
      if (result.error === 'sender_mismatch') {
        await logBusinessEvent({
          event_type: 'passwordless_login_failed',
          actor_type: 'webhook',
          actor_id: result.uid || 'unknown',
          target_type: 'user',
          target_id: result.uid || 'unknown',
          severity: 'warning',
          source: 'webhook',
          metadata: { masked_phone: maskPhone(normalizedFromPhone), reason: "sender_mismatch" }
        });
        await sendWhatsAppMessage(phoneNumberId, fromPhone, "Macha! This login failed. The WhatsApp sender number must match your registered account number.");
      } else {
        await sendWhatsAppMessage(phoneNumberId, fromPhone, "Macha! This verification request is invalid, expired, or already used. Please request a new one from the web app.");
      }
      return;
    }

    console.log(\`[BACKGROUND TASK SUCCESS] Passwordless login verified for: \${token.substring(0, 4)}****\`);
    
    await logBusinessEvent({
      event_type: 'passwordless_login_verified',
      actor_type: 'webhook',
      actor_id: result.uid,
      target_type: 'user',
      target_id: result.uid,
      severity: 'info',
      source: 'webhook',
      metadata: { masked_phone: maskPhone(normalizedFromPhone), token_id: token.substring(0, 4) + '****' }
    });

    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Ustaad! Your login is verified. Please return to the web app to continue! 🚀"
    );

  } catch (error) {
    console.error('[BACKGROUND TASK EXCEPTION] Handshake verification error:', error);
    throw error; // Let the webhook caller know it failed
  }
}
`;

if (code.match(regex)) {
  code = code.replace(regex, newCode);
  fs.writeFileSync(file, code);
  console.log('Successfully patched processTextHandshakeInBackground');
} else {
  console.log('Could not find processTextHandshakeInBackground using regex.');
}
