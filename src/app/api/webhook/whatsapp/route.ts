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

// Verify token from environment or fallback
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'HauHauVoiceOrderVerifyToken2026';

/**
 * GET - WhatsApp Webhook Verification
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

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
  try {
    if (!adminDb) {
      console.error('[WHATSAPP WEBHOOK] Firebase Admin DB not initialized.');
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const payload = await request.json();
    console.log('[WHATSAPP WEBHOOK] Webhook payload received:', JSON.stringify(payload));

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const metadata = value?.metadata;
    const phoneNumberId = metadata?.phone_number_id;

    if (!message || !phoneNumberId) {
      return NextResponse.json({ success: true, message: 'Status or echo ignored' });
    }

    const fromPhone = message.from; // e.g. "919876543210"
    const normalizedFromPhone = fromPhone.replace(/[^0-9]/g, "");

    // ----------------------------------------------------
    // CASE 1: Voice Note Order Payload (.ogg audio)
    // ----------------------------------------------------
    if (message.type === 'audio' && message.audio) {
      const mediaId = message.audio.id;
      console.log(`[WHATSAPP WEBHOOK] Voice message received from ${fromPhone}, media ID: ${mediaId}`);

      // --- Gate A: Phone Authentication Lookup (FAST CHECK) ---
      const usersRef = adminDb.collection('users');
      let userDoc: any = null;

      // Check variations of phone numbers in Firestore
      const queryPhoneDirect = await usersRef.where('phone', '==', normalizedFromPhone).get();
      if (!queryPhoneDirect.empty) {
        userDoc = queryPhoneDirect.docs[0];
      } else {
        const queryPhonePlus = await usersRef.where('phone', '==', `+${normalizedFromPhone}`).get();
        if (!queryPhonePlus.empty) {
          userDoc = queryPhonePlus.docs[0];
        } else if (normalizedFromPhone.length > 10) {
          const localDigits = normalizedFromPhone.slice(-10);
          const queryPhoneSuffix = await usersRef.where('phone', '==', localDigits).get();
          if (!queryPhoneSuffix.empty) {
            userDoc = queryPhoneSuffix.docs[0];
          } else {
            const queryPhoneSuffixPlus = await usersRef.where('phone', '==', `+91${localDigits}`).get();
            if (!queryPhoneSuffixPlus.empty) {
              userDoc = queryPhoneSuffixPlus.docs[0];
            }
          }
        }
      }

      if (!userDoc) {
        console.warn(`[WHATSAPP WEBHOOK REJECT] Phone ${fromPhone} not registered.`);
        await sendWhatsAppMessage(
          phoneNumberId,
          fromPhone,
          "Macha! You don't have an account registered with Hau Hau yet. Please open our web app and verify your profile first! 🌟"
        );
        return NextResponse.json({ success: true, message: 'Unregistered user aborted' });
      }

      const userData = userDoc.data();
      const accountStatus = userData.account_status || userData.status || '';
      if (accountStatus.toLowerCase() !== 'active') {
        console.warn(`[WHATSAPP WEBHOOK REJECT] User status is ${accountStatus}.`);
        await sendWhatsAppMessage(
          phoneNumberId,
          fromPhone,
          "Macha! You don't have an account registered with Hau Hau yet. Please open our web app and verify your profile first! 🌟"
        );
        return NextResponse.json({ success: true, message: 'Inactive user aborted' });
      }

      // --- ASYNCHRONOUS PIPELINE TRIGGER (SUB-100MS WEBHOOK ACK) ---
      // We start the background processing task and return 200 OK immediately.
      // This prevents WhatsApp from timing out and sending duplicate webhook retries.
      processVoiceOrderInBackground(phoneNumberId, fromPhone, normalizedFromPhone, mediaId)
        .catch(err => console.error('[WHATSAPP WEBHOOK ASYNC ERROR] Background processing failed:', err));

      console.log(`[WHATSAPP WEBHOOK] Voice order accepted. Delegating to background thread.`);
      return NextResponse.json({ success: true, message: 'Voice order queued' });
    }

    // ----------------------------------------------------
    // CASE 2: Text Verification Code Message Payload (Signup Handshake)
    // ----------------------------------------------------
    if (message.type === 'text' && message.text?.body) {
      const messageText = message.text.body;
      const tokenMatch = messageText.match(/Ref:\s*([A-Z0-9]{8})\s*$/i);

      if (tokenMatch) {
        const token = tokenMatch[1].toUpperCase();
        
        // Immediate background processing for text handshake as well
        processTextHandshakeInBackground(phoneNumberId, fromPhone, normalizedFromPhone, token)
          .catch(err => console.error('[WHATSAPP WEBHOOK ASYNC ERROR] Handshake processing failed:', err));

        return NextResponse.json({ success: true, message: 'Handshake queued' });
      }
    }

    return NextResponse.json({ success: true, message: 'Unhandled webhook event' });

  } catch (error: any) {
    console.error('[WHATSAPP WEBHOOK ERROR] Webhook POST router failed:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * Background Asynchronous Pipeline: downloads media, transcribes, parses catalog, stages order, sends link.
 */
async function processVoiceOrderInBackground(
  phoneNumberId: string,
  fromPhone: string,
  normalizedFromPhone: string,
  mediaId: string
) {
  if (!adminDb) return;
  console.log(`[BACKGROUND TASK] Starting pipeline for ${fromPhone}, Media: ${mediaId}`);

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
        "Macha! We couldn't fetch your voice note from WhatsApp. Please try sending it again! 🎙️"
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
        "Macha! We had trouble transcribing your voice note. Please try speaking clearly and resubmit! 🎙️"
      );
      return;
    }

    if (!transcription.trim()) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Sorry, boss! I couldn't get what you said. Please try recording again! 🎙️"
      );
      return;
    }

    // 3. Fetch active menu catalog
    const menuSnap = await adminDb.collection('menu').where('is_available', '==', true).get();
    const menuItems: MenuItem[] = menuSnap.docs.map(doc => doc.data() as MenuItem);

    // 4. Match items via Gemini AI (with automated rotating key fallback)
    const matches = await matchVoiceOrderToMenu(transcription, menuItems);
    if (matches.length === 0) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Sorry, boss! I couldn't match any items in your voice note with our menu. Could you try speaking a bit clearer, or specify the item names? 🍗"
      );
      return;
    }

    // 5. Calculate totals and compile structural rows
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

        summaryRows += `• ${match.qty}x ${menuItem.name}: ₹${itemTotal}\n`;
      }
    }

    if (matchedItemsWithDetails.length === 0) {
      await sendWhatsAppMessage(
        phoneNumberId,
        fromPhone,
        "Sorry, boss! I couldn't match any items in your voice note with our menu. Could you try speaking a bit clearer, or specify the item names? 🍗"
      );
      return;
    }

    // 6. Generate UUID and stage order in Firestore
    const voiceOrderId = crypto.randomUUID();
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000); // 5 min expiry

    const voiceOrderDoc = {
      id: voiceOrderId,
      phone_number: normalizedFromPhone,
      items: matchedItemsWithDetails,
      estimated_total: estimatedTotal,
      status: 'PENDING',
      created_at: now,
      expires_at: expiresAt,
      soft_deleted_at: null
    };

    await adminDb.collection('voice_orders').doc(voiceOrderId).set(voiceOrderDoc);
    console.log(`[BACKGROUND TASK SUCCESS] Voice order created: ${voiceOrderId}`);

    // 7. Send checkout details and link
    const checkoutLink = `https://hauhau.menu/checkout/voice?session=${voiceOrderId}`;
    const confirmationText = `Got your voice order, Ustaad! 🔥\n\n${summaryRows}Estimated Total: ₹${estimatedTotal}\n\nClick this secure link to view your cart, enter your account password, and confirm payment within 5 minutes: ${checkoutLink}`;

    await sendWhatsAppMessage(phoneNumberId, fromPhone, confirmationText);

  } catch (error) {
    console.error('[BACKGROUND TASK EXCEPTION] Failed to process voice order:', error);
    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Ustaad! We ran into an unexpected issue processing your voice note. Please try ordering again or type your request. 🚀"
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
  console.log(`[BACKGROUND TASK] Verifying Signup Token: ${token} for ${fromPhone}`);

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

    const registeredPhone = handshakeData.phone.replace(/[^0-9]/g, "");
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
      "Ustaad! Your phone number is verified. Please return to the web app screen to complete your profile! 🚀"
    );

  } catch (error) {
    console.error('[BACKGROUND TASK EXCEPTION] Handshake verification error:', error);
  }
}
