// [INTERNAL] - Route used by server-to-server or webhook calls
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { 
  downloadMetaMedia, 
  transcribeAudio, 
  matchVoiceOrderToMenu, 
  sendWhatsAppMessage 
} from '@/lib/voiceOrderingService';
import { MenuItem } from '@/lib/types';
import * as admin from 'firebase-admin';
import crypto from 'crypto';
import { maskPhone } from '@/lib/security/maskPii';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';
import { getServerBaseUrl } from '@/lib/security/serverConfig';

// Verify token from environment or fallback
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

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

async function findUserByPhone(
  usersRef: admin.firestore.CollectionReference,
  phone: string
): Promise<admin.firestore.DocumentSnapshot | null> {
  const variations = getPhoneVariations(phone);
  console.log(`[USER LOOKUP] Searching for phone variations...`);
  
  // 1. Try querying 'phone' field
  const queryPhone = await usersRef.where('phone', 'in', variations).limit(1).get();
  if (!queryPhone.empty) {
    return queryPhone.docs[0];
  }
  
  // 2. Try querying 'phone_number' field
  const queryPhoneNumber = await usersRef.where('phone_number', 'in', variations).limit(1).get();
  if (!queryPhoneNumber.empty) {
    return queryPhoneNumber.docs[0];
  }
  
  return null;
}


/**
 * GET - WhatsApp Webhook Verification
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (!VERIFY_TOKEN) {
    console.error('[WHATSAPP WEBHOOK] WHATSAPP_VERIFY_TOKEN is missing');
    return new Response('Internal Server Error', { status: 500 });
  }

  // Accept the strictly defined verify token
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WHATSAPP WEBHOOK] Webhook verified successfully.');
    return new Response(challenge, { status: 200 });
  }

  console.warn('[WHATSAPP WEBHOOK] Webhook verification failed.');
  return new Response('Forbidden', { status: 403 });
}

/**
 * POST - Handle Inbound WhatsApp Webhook Payloads
 */
export async function POST(request: Request) {
  const secureHeaders = {
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };

  try {
    if (!adminDb) {
      console.error('[WHATSAPP WEBHOOK] Firebase Admin DB not initialized.');
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500, headers: secureHeaders });
    }

    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-hub-signature-256');
    const secret = process.env.WHATSAPP_APP_SECRET;

    if (!secret) {
      console.error('[WHATSAPP WEBHOOK] WHATSAPP_APP_SECRET is not configured.');
      return new NextResponse('Internal Server Error', { status: 500, headers: secureHeaders });
    }
    
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      console.warn('[WHATSAPP WEBHOOK] Missing or malformed signature header.');
      return new NextResponse('Forbidden', { status: 403, headers: secureHeaders });
    }
    
    const signatureHex = signatureHeader.substring(7);
    if (!/^[a-fA-F0-9]{64}$/.test(signatureHex)) {
      console.warn('[WHATSAPP WEBHOOK] Invalid signature length/format.');
      return new NextResponse('Forbidden', { status: 403, headers: secureHeaders });
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'ascii');
    const actualBuffer = Buffer.from(signatureHex, 'ascii');

    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      console.warn('[WHATSAPP WEBHOOK] Signature verification failed.');
      return new NextResponse('Forbidden', { status: 403, headers: secureHeaders });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      console.warn('[WHATSAPP WEBHOOK] Invalid JSON payload.');
      return new NextResponse('Bad Request', { status: 400, headers: secureHeaders });
    }

    let baseUrl: string;
    try {
      baseUrl = getServerBaseUrl();
    } catch (err: any) {
      console.error('[WHATSAPP WEBHOOK] Server config error:', err.message);
      return new NextResponse('Internal Server Error', { status: 500, headers: secureHeaders });
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const metadata = value?.metadata;
    const phoneNumberId = metadata?.phone_number_id;

    if (!message || !phoneNumberId) {
      return NextResponse.json({ success: true, message: 'Status or echo ignored' }, { headers: secureHeaders });
    }

    const safeLog = {
      event_type: message?.type || 'unknown',
      message_id: message?.id,
      masked_from: maskPhone(message?.from)
    };
    console.log('[WHATSAPP WEBHOOK] Webhook payload received (safe):', JSON.stringify(safeLog));

    const fromPhone = message.from; // e.g. "919876543210"
    const normalizedFromPhone = fromPhone.replace(/[^0-9]/g, "");
    const messageId = message.id;
    let dupRef;

    if (messageId) {
      dupRef = adminDb.collection('processed_whatsapp_messages').doc(messageId);
      try {
        const dupResult = await adminDb.runTransaction(async (t) => {
          const snap = await t.get(dupRef!);
          if (snap.exists) {
            const data = snap.data();
            if (data?.status === 'completed') return { status: 'completed' };
            if (data?.status === 'processing') return { status: 'processing' };
            t.update(dupRef!, { status: 'processing', updated_at: admin.firestore.FieldValue.serverTimestamp() });
            return { status: 'retry' };
          }
          t.create(dupRef!, {
            status: 'processing',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            from: maskPhone(fromPhone)
          });
          return { status: 'new' };
        });

        if (dupResult.status === 'completed' || dupResult.status === 'processing') {
          console.log(`[WHATSAPP WEBHOOK] Message ID ${messageId} already processed or processing. Ignoring.`);
          return NextResponse.json({ success: true, message: 'Duplicate message ignored' }, { headers: secureHeaders });
        }
      } catch (err: any) {
        if (err.code === 6) { // ALREADY_EXISTS
          console.log(`[WHATSAPP WEBHOOK] Message ID ${messageId} concurrent creation. Ignoring.`);
          return NextResponse.json({ success: true, message: 'Duplicate message ignored' }, { headers: secureHeaders });
        }
        console.error('[WHATSAPP WEBHOOK] Duplicate check error:', err);
        return new NextResponse('Internal Server Error', { status: 500, headers: secureHeaders });
      }
    }

    try {
      // CASE 1: Voice Note Order Payload (.ogg audio)
      if (message.type === 'audio' && message.audio) {
        const mediaId = message.audio.id;
        const usersRef = adminDb.collection('users');
        const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);

        if (!userDoc || (userDoc.data()?.account_status?.toLowerCase() !== 'active' && userDoc.data()?.status?.toLowerCase() !== 'active')) {
          await sendWhatsAppMessage(phoneNumberId, fromPhone, "Macha! You don't have an active account with Hau Hau yet! 🌟");
          if (dupRef) await dupRef.update({ status: 'completed' });
          return NextResponse.json({ success: true, message: 'Inactive user aborted' }, { headers: secureHeaders });
        }

        await processVoiceOrderInBackground(phoneNumberId, fromPhone, normalizedFromPhone, mediaId, baseUrl);
        
        await logBusinessEvent({
          event_type: 'whatsapp_voice_order_received',
          actor_type: 'webhook',
          actor_id: userDoc.id || 'unknown',
          target_type: 'user',
          target_id: userDoc.id || 'unknown',
          severity: 'info',
          source: 'webhook',
          metadata: { mediaId }
        });
      }
      // CASE 2: Text Verification Code Message Payload (Signup Handshake)
      else if (message.type === 'text' && message.text?.body) {
        const messageText = message.text.body;
        // Strict 32 hex char token match for passwordless login
        const tokenMatch = messageText.match(/(?:LOGINs+)?Ref:s*([A-F0-9]{32})s*$/i);

        if (tokenMatch) {
          const token = tokenMatch[1].toUpperCase();
          await processTextHandshakeInBackground(phoneNumberId, fromPhone, normalizedFromPhone, token, messageId);
        } else {
          const usersRef = adminDb.collection('users');
          const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);
          
          if (!userDoc || (userDoc.data()?.account_status?.toLowerCase() !== 'active' && userDoc.data()?.status?.toLowerCase() !== 'active')) {
            await sendWhatsAppMessage(phoneNumberId, fromPhone, "Macha! You don't have an active account with Hau Hau yet! 🌟");
            if (dupRef) await dupRef.update({ status: 'completed' });
            return NextResponse.json({ success: true, message: 'Inactive user aborted' }, { headers: secureHeaders });
          }

          await processGeneralChatInBackground(phoneNumberId, fromPhone, normalizedFromPhone, messageText, userDoc.data(), userDoc.id, baseUrl);
          
          await logBusinessEvent({
            event_type: 'whatsapp_message_received',
            actor_type: 'webhook',
            actor_id: userDoc.id || 'unknown',
            target_type: 'user',
            target_id: userDoc.id || 'unknown',
            severity: 'info',
            source: 'webhook'
          });
        }
      }
      // CASE 3: Location Message Payload (Sharing Live Location)
      else if (message.type === 'location' && message.location) {
        const loc = message.location;
        const lat = loc.latitude;
        const lng = loc.longitude;
        const usersRef = adminDb.collection('users');
        const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);

        if (!userDoc) {
          await sendWhatsAppMessage(phoneNumberId, fromPhone, "Macha! You don't have an account registered with Hau Hau yet! 🌟");
          if (dupRef) await dupRef.update({ status: 'completed' });
          return NextResponse.json({ success: true, message: 'Unregistered user aborted' }, { headers: secureHeaders });
        }

        await userDoc.ref.update({
          live_location: { lat, lng, updated_at: Date.now() }
        });
        await processLocationMessageInBackground(phoneNumberId, fromPhone, normalizedFromPhone, lat, lng);
        
        await logBusinessEvent({
          event_type: 'whatsapp_location_received',
          actor_type: 'webhook',
          actor_id: userDoc.id || 'unknown',
          target_type: 'user',
          target_id: userDoc.id || 'unknown',
          severity: 'info',
          source: 'webhook'
        });
      }

      if (dupRef) {
        await dupRef.update({ 
          status: 'completed', 
          completed_at: admin.firestore.FieldValue.serverTimestamp() 
        });
      }
      return NextResponse.json({ success: true, message: 'Processed' }, { headers: secureHeaders });

    } catch (processingErr) {
      console.error('[WHATSAPP WEBHOOK ERROR] Processing failed:', processingErr);
      if (dupRef) {
        await dupRef.update({ 
          status: 'failed', 
          updated_at: admin.firestore.FieldValue.serverTimestamp() 
        });
      }
      return new NextResponse('Internal Server Error', { status: 500, headers: secureHeaders });
    }

  } catch (error: any) {
    console.error('[WHATSAPP WEBHOOK ERROR] Webhook POST router failed:', error);
    return new NextResponse('Internal Server Error', { status: 500, headers: secureHeaders });
  }
}
/**
 * Background Asynchronous Pipeline: downloads media, transcribes, parses catalog, stages order, sends link.
 */
async function processVoiceOrderInBackground(
  phoneNumberId: string,
  fromPhone: string,
  normalizedFromPhone: string,
  mediaId: string,
  baseUrl: string
) {
  if (!adminDb) return;
  console.log(`[BACKGROUND TASK] Starting pipeline for ${maskPhone(fromPhone)}, Media: ${mediaId}`);

  try {
    // 1. Download Media File
    let audioBuffer: Buffer;
    try {
      audioBuffer = await downloadMetaMedia(mediaId);
    } catch (err) {
      console.error('[BACKGROUND TASK ERROR] Meta media download failed:', err);
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Macha! We couldn't fetch your voice note from WhatsApp. Please try sending it again! ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â"
      );
      return;
    }

    // 2. Transcribe Audio via Whisper
    let transcription = '';
    try {
      transcription = await transcribeAudio(audioBuffer);
    } catch (err) {
      console.error('[BACKGROUND TASK ERROR] Transcription failed:', err);
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Macha! We had trouble transcribing your voice note. Please try speaking clearly and resubmit! ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â"
      );
      return;
    }

    if (!transcription.trim()) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Sorry, boss! I couldn't get what you said. Please try recording again! ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â"
      );
      return;
    }

    // 3. Forward the transcribed text to the unified general chat pipeline!
    console.log(`[BACKGROUND TASK] Transcribed voice to text: "${transcription}". Forwarding to chat pipeline.`);
    
    const usersRef = adminDb.collection('users');
    const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);
    const userData = userDoc ? userDoc.data() : undefined;

    await processGeneralChatInBackground(phoneNumberId, fromPhone, normalizedFromPhone, transcription, userData, userDoc ? userDoc.id : undefined, baseUrl);

  } catch (error) {
    console.error('[BACKGROUND TASK EXCEPTION] Failed to process voice note:', error);
    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Ustaad! We ran into an unexpected issue processing your voice note. Please try ordering again or type your request. ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬"
    );
  }
}

/**
 * Background Asynchronous Pipeline: verifies signup token handshake.
 */
async function processTextHandshakeInBackground(
  phoneNumberId: string,
  fromPhone: string,
  normalizedFromPhone: string,
  token: string
) {
  if (!adminDb) return;
  console.log(`[BACKGROUND TASK] Verifying Signup Token for ${maskPhone(fromPhone)}`);

  try {
    const handshakeRef = adminDb.collection('auth_handshakes').doc(token);
    const handshakeSnap = await handshakeRef.get();

    if (!handshakeSnap.exists) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Macha! This verification link or code is invalid or expired. Please retry from the web app."
      );
      return;
    }

    const handshakeData = handshakeSnap.data()!;
    const expiresAt = handshakeData.expires_at;

    if (Date.now() > expiresAt) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Macha! This verification link or code is invalid or expired. Please retry from the web app."
      );
      return;
    }

    if (handshakeData.used) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Macha! This verification link has already been used. Please request a new one."
      );
      return;
    }

    // Determine purpose (default to signup/phone_verification for backward compatibility)
    const purpose = handshakeData.purpose || 'phone_verification';

    if (purpose === 'passwordless_login') {
      // For passwordless login, we must use the UID to look up the user profile,
      // because we only store masked_phone in the handshake to avoid leaking PII.
      const userRef = adminDb.collection('users').doc(handshakeData.uid);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        await sendWhatsAppMessage(
          phoneNumberId,
          fromPhone,
          "Macha! We couldn't find your account. Please sign up first."
        );
        return;
      }

      const userProfile = userSnap.data()!;
      const registeredPhone = (userProfile.phone || userProfile.phone_number || '').replace(/[^0-9]/g, "");
      const webhookSuffix = normalizedFromPhone.slice(-10);
      const registeredSuffix = registeredPhone.slice(-10);

      if (!registeredSuffix || webhookSuffix !== registeredSuffix) {
        await logBusinessEvent({
          event_type: 'passwordless_login_failed',
          actor_type: 'webhook',
          actor_id: handshakeData.uid,
          target_type: 'user',
          target_id: handshakeData.uid,
          severity: 'warning',
          source: 'webhook',
          metadata: { masked_phone: maskPhone(normalizedFromPhone), reason: "sender_mismatch" }
        });

        await sendWhatsAppMessage(
          phoneNumberId,
          fromPhone,
          "Macha! This login failed. The WhatsApp sender number must match your registered account number."
        );
        return;
      }

      // Token matches! Update handshake state
      await handshakeRef.update({
        is_verified: true,
        verified_at: Date.now()
        // Do not mark used: true here, the polling endpoint will consume it and mark it used.
      });

      console.log(`[BACKGROUND TASK SUCCESS] Passwordless login verified for: ${token.substring(0, 4)}****`);
      
      await logBusinessEvent({
        event_type: 'passwordless_login_verified',
        actor_type: 'webhook',
        actor_id: handshakeData.uid,
        target_type: 'user',
        target_id: handshakeData.uid,
        severity: 'info',
        source: 'webhook',
        metadata: { masked_phone: maskPhone(normalizedFromPhone), token_id: token.substring(0, 4) + '****' }
      });

      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Ustaad! Your login is verified. Please return to the web app to continue! 🚀"
      );
      return;
    }

    // Existing Signup / phone_verification flow
    const registeredPhone = handshakeData.phone ? handshakeData.phone.replace(/[^0-9]/g, "") : "";
    const webhookSuffix = normalizedFromPhone.slice(-10);
    const registeredSuffix = registeredPhone.slice(-10);

    if (webhookSuffix !== registeredSuffix) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Macha! This verification request failed. The WhatsApp sender number must match the phone number you entered on signup."
      );
      return;
    }

    // Token matches! Update handshake state
    await handshakeRef.update({
      is_verified: true,
      verified_at: Date.now()
    });

    console.log(`[BACKGROUND TASK SUCCESS] Signup handshake verified for: ${token}`);
    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Ustaad! Your phone number is verified. Please return to the web app screen to complete your profile! ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬"
    );

  } catch (error) {
    console.error('[BACKGROUND TASK EXCEPTION] Handshake verification error:', error);
  }
}

/**
 * Background Asynchronous Pipeline: handles general chat queries, fetches weather & menu, queries Groq, and replies.
 */
async function processGeneralChatInBackground(
  phoneNumberId: string,
  fromPhone: string,
  normalizedFromPhone: string,
  messageText: string,
  userData?: admin.firestore.DocumentData,
  userId?: string,
  baseUrl: string = 'https://hauhaucafe.vercel.app'
) {
  if (!adminDb) return;
  console.log(`[BACKGROUND TASK] Starting general chat pipeline for ${maskPhone(fromPhone)}`);

  try {
    // 1. Fetch Coordinates from user's address if available, else fallback to outlet coordinates
    let lat = 17.3850;
    let lng = 78.4867;
    let locationSource = 'default (Hyderabad)';

    const userAddress = userData?.addresses?.[0];
    if (userAddress?.coordinates?.lat && userAddress?.coordinates?.lng) {
      lat = Number(userAddress.coordinates.lat);
      lng = Number(userAddress.coordinates.lng);
      locationSource = `user saved address (${userAddress.label || 'Home'})`;
    } else if (userAddress?.coordinates?.latitude && userAddress?.coordinates?.longitude) {
      lat = Number(userAddress.coordinates.latitude);
      lng = Number(userAddress.coordinates.longitude);
      locationSource = `user saved address (${userAddress.label || 'Home'})`;
    } else {
      try {
        const outletsSnap = await adminDb.collection('outlets').limit(1).get();
        if (!outletsSnap.empty) {
          const outletData = outletsSnap.docs[0].data();
          if (outletData.coordinates?.latitude) {
            lat = Number(outletData.coordinates.latitude);
            lng = Number(outletData.coordinates.longitude);
            locationSource = `outlet (${outletData.name})`;
          } else if (outletData.coordinates?.lat) {
            lat = Number(outletData.coordinates.lat);
            lng = Number(outletData.coordinates.lng);
            locationSource = `outlet (${outletData.name})`;
          }
        }
      } catch (err) {
        console.warn('[BACKGROUND CHAT] Failed to fetch outlet coordinates, defaulting:', err);
      }
    }
    console.log(`[BACKGROUND CHAT] Fetching weather (Source: ${locationSource})`);

    // 2. Fetch current weather from Open-Meteo API
    let weatherLine = 'Weather unknown.';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
      
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,apparent_temperature&timezone=auto`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (wRes.ok) {
        const wData = await wRes.json();
        const temp = Math.round(wData.current.temperature_2m);
        const feels = Math.round(wData.current.apparent_temperature);
        const code = wData.current.weathercode;
        let condition = 'clear';
        if (code === 0) condition = 'sunny and clear';
        else if (code <= 3) condition = 'partly cloudy';
        else if (code <= 48) condition = 'foggy';
        else if (code <= 67) condition = 'rainy';
        else if (code <= 77) condition = 'snowy';
        else if (code <= 99) condition = 'thunderstormy';
        weatherLine = `It's ${temp}Ãƒâ€šÃ‚Â°C outside (feels like ${feels}Ãƒâ€šÃ‚Â°C) and ${condition}.`;
      }
    } catch (err) {
      console.warn('[BACKGROUND CHAT] Failed to fetch weather (Timeout or Error):', err);
    }

    // 3. Fetch active menu catalog
    const menuSnap = await adminDb.collection('menu').where('is_available', '==', true).get();
    const menuItems = menuSnap.docs.map(doc => doc.data() as MenuItem);

    // 4. Attempt to extract menu items from the message text
    const matches = await matchVoiceOrderToMenu(messageText, menuItems);
    let orderContextText = '';
    
    if (matches.length > 0) {
      const matchedItemsWithDetails = [];
      let estimatedTotal = 0;
      let summaryRows = '';

      for (const match of matches) {
        const menuItem = menuItems.find(m => m.item_id === match.id);
        if (menuItem) {
          const unitPrice = menuItem.price;
          const itemTotal = unitPrice * match.qty;
          estimatedTotal += itemTotal;

          matchedItemsWithDetails.push({
            name: menuItem.name,
            qty: match.qty,
            unit_price: unitPrice
          });

          summaryRows += `${match.qty}x ${menuItem.name} (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹${itemTotal}), `;
        }
      }

      if (matchedItemsWithDetails.length > 0) {
        // Stage the order in Firestore
        const voiceOrderId = crypto.randomUUID();
        const now = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000); // 15 min expiry for magic link

        await adminDb.collection('voice_orders').doc(voiceOrderId).set({
          user_phone: normalizedFromPhone,
          user_id: userData?.user_id || userId || '',
          items: matchedItemsWithDetails,
          estimated_total: estimatedTotal,
          status: 'staged',
          created_at: now,
          expires_at: expiresAt
        });

        const checkoutLink = `${baseUrl}/cart?session=${voiceOrderId}&magic=true`;
        
        orderContextText = `\n\nCRITICAL ORDER CONTEXT: The user just ordered the following items: ${summaryRows.slice(0, -2)}. ` +
                           `Their order has been automatically staged and added to their cart! ` +
                           `You MUST explicitly tell them that their order is ready and give them this exact checkout link: ${checkoutLink} `;
      }
    }

    // 5. Construct prompt with Bhai personality
    const prompt = 
      `You are "Bhai" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a final-year student at this college who works part-time at Oasis Cafe, Hyderabad. ` +
      `Talk like a funny, caring Hyderabadi college senior ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mix of Hindi, Telugu slang, and English. ` +
      `Phrases: "arre yaar", "bhai sun", "sach mein?", "mast plan hai", "pakka set", "lite le lo", "kya scene hai", "machha". ` +
      `Current Local Weather Context: ${weatherLine}\n` +
      `Available Menu Items: ${menuItems.map(m => `${m.name} (Price: ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹${m.price}, ID: ${m.item_id})`).join(', ')}\n` +
      orderContextText + `\n\n` +
      `RULES:\n` +
      `- ALWAYS greet the user in a friendly way.\n` +
      `- If there is an order, MUST INCLUDE the checkout link in your reply.\n` +
      `- Choose 1 to 3 complementary items from the menu based on the weather and put their IDs in the \`suggested_items\` array.\n` +
      `- CRITICAL: DO NOT mention or ask about these suggested items in your conversational \`message\` string. The system will automatically append them for you.\n` +
      `- Keep your response brief (max 2-3 sentences total).\n\n` +
      `Return ONLY a raw valid JSON object (no markdown block formatting like \`\`\`json):` +
      `{"message": "your chat response text including links", "suggested_items": ["item_id_1", "item_id_2"]}`;

    // 5. Query LLM via Groq with rotating key fallback
    const keysStr = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);

    if (keys.length === 0) {
      throw new Error("GROQ_API_KEY is not configured.");
    }

    let responseText = '';
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        console.log(`[BACKGROUND CHAT] Requesting chat completions (Key index: ${i})...`);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: messageText }
            ],
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" }
          })
        });

        if (res.status === 429) {
          console.warn(`[BACKGROUND CHAT RATE LIMIT] Key index ${i} rate limited. Rotating...`);
          continue;
        }

        if (!res.ok) {
          throw new Error(`Groq API error status: ${res.status}`);
        }

        const data = await res.json();
        responseText = data.choices[0].message.content;
        break; // Success
      } catch (err) {
        console.error(`[BACKGROUND CHAT ERROR] Key index ${i} failed:`, err);
      }
    }

    if (!responseText) {
      throw new Error("All Groq API keys failed or rate limited.");
    }

    // 6. Parse JSON response and build reply
    const parsed = JSON.parse(responseText);
    let reply = parsed.message || "Bol machha! Kya scene hai?";

    // 7. Append menu items suggestions
    if (parsed.suggested_items && parsed.suggested_items.length > 0) {
      let suggestions = '\n\nBhai suggests ordering these comfort items, machha:\n';
      let count = 0;
      for (const itemId of parsed.suggested_items) {
        const item = menuItems.find(m => m.item_id === itemId);
        if (item) {
          suggestions += `ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${item.name} (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹${item.price})\n`;
          count++;
        }
      }
      if (count > 0) {
        reply += suggestions;
      }
    }

    // 8. Send message via WhatsApp
    const success = await sendWhatsAppMessage(phoneNumberId, fromPhone, reply);
    if (success) {
      console.log(`[BACKGROUND CHAT SUCCESS] Reply sent to ${maskPhone(fromPhone)}`);
    } else {
      console.error(`[BACKGROUND CHAT ERROR] Failed to send reply to ${maskPhone(fromPhone)}`);
    }

  } catch (error) {
    console.error('[BACKGROUND CHAT EXCEPTION] Failed to process general chat:', error);
    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Kya scene hai machha! Kuch technical issue chal raha backend mein, but overall lite le lo! Bol kya chahiye? ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬"
    );
  }
}

/**
 * Background Asynchronous Pipeline: handles location updates, fetches weather, queries Groq, and replies.
 */
async function processLocationMessageInBackground(
  phoneNumberId: string,
  fromPhone: string,
  normalizedFromPhone: string,
  lat: number,
  lng: number
) {
  if (!adminDb) return;
  console.log(`[BACKGROUND TASK] Starting location message pipeline for ${maskPhone(fromPhone)}`);

  try {
    // 1. Fetch current weather from Open-Meteo API
    let weatherLine = 'Weather unknown.';
    try {
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,apparent_temperature&timezone=auto`
      );
      if (wRes.ok) {
        const wData = await wRes.json();
        const temp = Math.round(wData.current.temperature_2m);
        const feels = Math.round(wData.current.apparent_temperature);
        const code = wData.current.weathercode;
        let condition = 'clear';
        if (code === 0) condition = 'sunny and clear';
        else if (code <= 3) condition = 'partly cloudy';
        else if (code <= 48) condition = 'foggy';
        else if (code <= 67) condition = 'rainy';
        else if (code <= 77) condition = 'snowy';
        else if (code <= 99) condition = 'thunderstormy';
        weatherLine = `It's ${temp}Ãƒâ€šÃ‚Â°C outside (feels like ${feels}Ãƒâ€šÃ‚Â°C) and ${condition}.`;
      }
    } catch (err) {
      console.warn('[BACKGROUND LOCATION] Failed to fetch weather:', err);
    }

    // 2. Fetch active menu catalog
    const menuSnap = await adminDb.collection('menu').where('is_available', '==', true).get();
    const menuItems = menuSnap.docs.map(doc => doc.data());

    // 3. Construct prompt
    const prompt = 
      `You are "Bhai" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a final-year student at this college who works part-time at Oasis Cafe, Hyderabad. ` +
      `Talk like a funny, caring Hyderabadi college senior ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mix of Hindi, Telugu slang, and English. ` +
      `Phrases: "arre yaar", "bhai sun", "sach mein?", "mast plan hai", "pakka set", "lite le lo", "kya scene hai", "machha". ` +
      `User shared their current live location, and the local weather is: ${weatherLine}\n` +
      `Available Menu Items: ${menuItems.map(m => `${m.name} (Price: ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹${m.price}, ID: ${m.item_id})`).join(', ')}\n\n` +
      `RULES:\n` +
      `- Greet the user by acknowledging their live location and current weather in a fun senior style (e.g. "Kya scene hai machha, bol! Pata chala wahan bahut garmi hai..." or "Acha, toh tum wahan ho! Mast weather hai wahan...").\n` +
      `- Choose 1 to 3 items from the Available Menu Items list that match the weather and put their IDs in the \`suggested_items\` array.\n` +
      `- CRITICAL: DO NOT mention or ask about these suggested items in your conversational \`message\` string. The system will automatically append them for you.\n` +
      `- Keep your response extremely brief (max 2-3 sentences total).\n\n` +
      `Return ONLY a raw valid JSON object (no markdown block formatting like \`\`\`json):` +
      `{"message": "your chat response text here", "suggested_items": ["item_id_1", "item_id_2"]}`;

    // 4. Query LLM via Groq
    const keysStr = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    let responseText = '';
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: "Here is my location" }
            ],
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" }
          })
        });

        if (res.status === 429) continue;
        if (!res.ok) throw new Error(`Groq API error status: ${res.status}`);

        const data = await res.json();
        responseText = data.choices[0].message.content;
        break;
      } catch (err) {
        console.error(`[BACKGROUND LOCATION ERROR] Key index ${i} failed:`, err);
      }
    }

    if (!responseText) throw new Error("All Groq API keys failed.");

    // 5. Parse response and build reply
    const parsed = JSON.parse(responseText);
    let reply = parsed.message || "Bol machha! Kya scene hai wahan?";

    // 6. Append suggestions
    if (parsed.suggested_items && parsed.suggested_items.length > 0) {
      let suggestions = '\n\nBhai suggests ordering these comfort items, machha:\n';
      let count = 0;
      for (const itemId of parsed.suggested_items) {
        const item = menuItems.find(m => m.item_id === itemId);
        if (item) {
          suggestions += `ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${item.name} (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹${item.price})\n`;
          count++;
        }
      }
      if (count > 0) reply += suggestions;
    }

    // 7. Send message via WhatsApp
    const success = await sendWhatsAppMessage(phoneNumberId, fromPhone, reply);
    if (success) {
      console.log(`[BACKGROUND LOCATION SUCCESS] Reply sent to ${maskPhone(fromPhone)}`);
    } else {
      console.error(`[BACKGROUND LOCATION ERROR] Failed to send reply to ${maskPhone(fromPhone)}`);
    }

  } catch (error) {
    console.error('[BACKGROUND LOCATION EXCEPTION] Failed to process location:', error);
    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Kya scene hai machha! Received your location, but ran into some issue loading the weather. Lite le lo! ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬"
    );
  }
}
