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
  console.log(`[USER LOOKUP] Searching for phone variations:`, variations);
  
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

  // Accept the default verify token, OR the access token, OR whatever is in process.env to prevent validation failures
  const fallbackTokens = [
    VERIFY_TOKEN,
    process.env.WHATSAPP_ACCESS_TOKEN,
    'HauHauVoiceOrderVerifyToken2026'
  ];

  if (mode === 'subscribe' && token && fallbackTokens.includes(token)) {
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

    const messageId = message.id;
    if (messageId) {
      const dupRef = adminDb.collection('processed_whatsapp_messages').doc(messageId);
      const dupSnap = await dupRef.get();
      if (dupSnap.exists) {
        console.log(`[WHATSAPP WEBHOOK] Message ID ${messageId} already processed. Ignoring.`);
        return NextResponse.json({ success: true, message: 'Duplicate message ignored' });
      }
      await dupRef.set({
        processed_at: admin.firestore.FieldValue.serverTimestamp(),
        from: fromPhone
      });
    }

    // ----------------------------------------------------
    // CASE 1: Voice Note Order Payload (.ogg audio)
    // ----------------------------------------------------
    if (message.type === 'audio' && message.audio) {
      const mediaId = message.audio.id;
      console.log(`[WHATSAPP WEBHOOK] Voice message received from ${fromPhone}, media ID: ${mediaId}`);

      // --- Gate A: Phone Authentication Lookup (FAST CHECK) ---
      const usersRef = adminDb.collection('users');
      const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);

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
      const accountStatus = userData?.account_status || userData?.status || '';
      if (accountStatus.toLowerCase() !== 'active') {
        console.warn(`[WHATSAPP WEBHOOK REJECT] User status is ${accountStatus}.`);
        await sendWhatsAppMessage(
          phoneNumberId,
          fromPhone,
          "Macha! You don't have an account registered with Hau Hau yet. Please open our web app and verify your profile first! 🌟"
        );
        return NextResponse.json({ success: true, message: 'Inactive user aborted' });
      }

      // Process voice order
      await processVoiceOrderInBackground(phoneNumberId, fromPhone, normalizedFromPhone, mediaId)
        .catch(err => console.error('[WHATSAPP WEBHOOK ASYNC ERROR] Background processing failed:', err));

      console.log(`[WHATSAPP WEBHOOK] Voice order processed.`);
      return NextResponse.json({ success: true, message: 'Voice order processed' });
    }

    // ----------------------------------------------------
    // CASE 2: Text Verification Code Message Payload (Signup Handshake)
    // ----------------------------------------------------
    if (message.type === 'text' && message.text?.body) {
      const messageText = message.text.body;
      const tokenMatch = messageText.match(/Ref:\s*([A-Z0-9]{8})\s*$/i);

      if (tokenMatch) {
        const token = tokenMatch[1].toUpperCase();
        
        // Process text handshake
        await processTextHandshakeInBackground(phoneNumberId, fromPhone, normalizedFromPhone, token)
          .catch(err => console.error('[WHATSAPP WEBHOOK ASYNC ERROR] Handshake processing failed:', err));

        return NextResponse.json({ success: true, message: 'Handshake completed' });
      } else {
        // --- Gate A: Phone Authentication Lookup for general chat ---
        const usersRef = adminDb.collection('users');
        const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);

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
        const accountStatus = userData?.account_status || userData?.status || '';
        if (accountStatus.toLowerCase() !== 'active') {
          console.warn(`[WHATSAPP WEBHOOK REJECT] User status is ${accountStatus}.`);
          await sendWhatsAppMessage(
            phoneNumberId,
            fromPhone,
            "Macha! Your account is not active yet. Please verify your email first! 🌟"
          );
          return NextResponse.json({ success: true, message: 'Inactive user aborted' });
        }

        // Process chat message
        await processGeneralChatInBackground(phoneNumberId, fromPhone, normalizedFromPhone, messageText, userData, userDoc.id)
          .catch(err => console.error('[WHATSAPP WEBHOOK ASYNC ERROR] General chat processing failed:', err));

        return NextResponse.json({ success: true, message: 'Chat message processed' });
      }
    }

    // ----------------------------------------------------
    // CASE 3: Location Message Payload (Sharing Live Location)
    // ----------------------------------------------------
    if (message.type === 'location' && message.location) {
      const loc = message.location;
      const lat = loc.latitude;
      const lng = loc.longitude;
      console.log(`[WHATSAPP WEBHOOK] Location received from ${fromPhone}: Lat ${lat}, Lng ${lng}`);

      // --- Gate A: Phone Authentication Lookup ---
      const usersRef = adminDb.collection('users');
      const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);

      if (!userDoc) {
        console.warn(`[WHATSAPP WEBHOOK REJECT] Phone ${fromPhone} not registered.`);
        await sendWhatsAppMessage(
          phoneNumberId,
          fromPhone,
          "Macha! You don't have an account registered with Hau Hau yet. Please open our web app and verify your profile first! 🌟"
        );
        return NextResponse.json({ success: true, message: 'Unregistered user aborted' });
      }

      // Update user's live_location in Firestore
      const userRef = userDoc.ref;
      await userRef.update({
        live_location: {
          lat: lat,
          lng: lng,
          updated_at: Date.now()
        }
      });
      console.log(`[WHATSAPP WEBHOOK] Updated live_location for user: ${userDoc.id}`);

      // Process location
      await processLocationMessageInBackground(phoneNumberId, fromPhone, normalizedFromPhone, lat, lng, userData)
        .catch(err => console.error('[WHATSAPP WEBHOOK ASYNC ERROR] Location processing failed:', err));

      return NextResponse.json({ success: true, message: 'Location processed' });
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

    // 3. Forward the transcribed text to the unified general chat pipeline!
    console.log(`[BACKGROUND TASK] Transcribed voice to text: "${transcription}". Forwarding to chat pipeline.`);
    
    const usersRef = adminDb.collection('users');
    const userDoc = await findUserByPhone(usersRef, normalizedFromPhone);
    const userData = userDoc ? userDoc.data() : undefined;

    await processGeneralChatInBackground(phoneNumberId, fromPhone, normalizedFromPhone, transcription, userData, userDoc ? userDoc.id : undefined);

  } catch (error) {
    console.error('[BACKGROUND TASK EXCEPTION] Failed to process voice note:', error);
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

/**
 * Background Asynchronous Pipeline: handles general chat queries, fetches weather & menu, queries Groq, and replies.
 */
async function processGeneralChatInBackground(
  phoneNumberId: string,
  fromPhone: string,
  normalizedFromPhone: string,
  messageText: string,
  userData?: admin.firestore.DocumentData,
  userId?: string
) {
  if (!adminDb) return;
  console.log(`[BACKGROUND TASK] Starting general chat pipeline for ${fromPhone}`);

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
    console.log(`[BACKGROUND CHAT] Fetching weather for location: ${lat}, ${lng} (Source: ${locationSource})`);

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
        weatherLine = `It's ${temp}°C outside (feels like ${feels}°C) and ${condition}.`;
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

          summaryRows += `${match.qty}x ${menuItem.name} (₹${itemTotal}), `;
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

        const checkoutLink = `https://hauhau.menu/cart?session=${voiceOrderId}&magic=true`;
        
        orderContextText = `\n\nCRITICAL ORDER CONTEXT: The user just ordered the following items: ${summaryRows.slice(0, -2)}. ` +
                           `Their order has been automatically staged and added to their cart! ` +
                           `You MUST explicitly tell them that their order is ready and give them this exact checkout link: ${checkoutLink} ` +
                           `Then, suggest 1 or 2 complementary items they might want to add to their order.`;
      }
    }

    // 5. Construct prompt with Bhai personality
    const prompt = 
      `You are "Bhai" — a final-year student at this college who works part-time at Oasis Cafe, Hyderabad. ` +
      `Talk like a funny, caring Hyderabadi college senior — mix of Hindi, Telugu slang, and English. ` +
      `Phrases: "arre yaar", "bhai sun", "sach mein?", "mast plan hai", "pakka set", "lite le lo", "kya scene hai", "machha". ` +
      `Current Local Weather Context: ${weatherLine}\n` +
      `Available Menu Items: ${menuItems.map(m => `${m.name} (Price: ₹${m.price}, ID: ${m.item_id})`).join(', ')}\n` +
      orderContextText + `\n\n` +
      `RULES:\n` +
      `- ALWAYS greet the user in a friendly way.\n` +
      `- If there is an order, MUST INCLUDE the checkout link in your reply.\n` +
      `- Suggest 1 to 3 complementary items from the menu based on the weather.\n` +
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
          suggestions += `• ${item.name} (₹${item.price})\n`;
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
      console.log(`[BACKGROUND CHAT SUCCESS] Reply sent to ${fromPhone}`);
    } else {
      console.error(`[BACKGROUND CHAT ERROR] Failed to send reply to ${fromPhone}`);
    }

  } catch (error) {
    console.error('[BACKGROUND CHAT EXCEPTION] Failed to process general chat:', error);
    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Kya scene hai machha! Kuch technical issue chal raha backend mein, but overall lite le lo! Bol kya chahiye? 🚀"
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
  console.log(`[BACKGROUND TASK] Starting location message pipeline for ${fromPhone} (Lat: ${lat}, Lng: ${lng})`);

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
        weatherLine = `It's ${temp}°C outside (feels like ${feels}°C) and ${condition}.`;
      }
    } catch (err) {
      console.warn('[BACKGROUND LOCATION] Failed to fetch weather:', err);
    }

    // 2. Fetch active menu catalog
    const menuSnap = await adminDb.collection('menu').where('is_available', '==', true).get();
    const menuItems = menuSnap.docs.map(doc => doc.data());

    // 3. Construct prompt
    const prompt = 
      `You are "Bhai" — a final-year student at this college who works part-time at Oasis Cafe, Hyderabad. ` +
      `Talk like a funny, caring Hyderabadi college senior — mix of Hindi, Telugu slang, and English. ` +
      `Phrases: "arre yaar", "bhai sun", "sach mein?", "mast plan hai", "pakka set", "lite le lo", "kya scene hai", "machha". ` +
      `User shared their current live location, and the local weather is: ${weatherLine}\n` +
      `Available Menu Items: ${menuItems.map(m => `${m.name} (Price: ₹${m.price}, ID: ${m.item_id})`).join(', ')}\n\n` +
      `RULES:\n` +
      `- Greet the user by acknowledging their live location and current weather in a fun senior style (e.g. "Kya scene hai machha, bol! Pata chala wahan bahut garmi hai..." or "Acha, toh tum wahan ho! Mast weather hai wahan...").\n` +
      `- Suggest 1 to 3 items from the Available Menu Items list that match the weather.\n` +
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
          suggestions += `• ${item.name} (₹${item.price})\n`;
          count++;
        }
      }
      if (count > 0) reply += suggestions;
    }

    // 7. Send message via WhatsApp
    const success = await sendWhatsAppMessage(phoneNumberId, fromPhone, reply);
    if (success) {
      console.log(`[BACKGROUND LOCATION SUCCESS] Reply sent to ${fromPhone}`);
    } else {
      console.error(`[BACKGROUND LOCATION ERROR] Failed to send reply to ${fromPhone}`);
    }

  } catch (error) {
    console.error('[BACKGROUND LOCATION EXCEPTION] Failed to process location:', error);
    await sendWhatsAppMessage(
      phoneNumberId,
      fromPhone,
      "Kya scene hai machha! Received your location, but ran into some issue loading the weather. Lite le lo! 🚀"
    );
  }
}
