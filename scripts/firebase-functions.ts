/**
 /**
 * HAU HAU PORTAL - FIREBASE CLOUD FUNCTIONS GEN 2 REFERENCE TEMPLATE
 * 
 * This file provides a clean, production-grade template for deploying
 * the WhatsApp Webhook and Sweeper Cron Jobs as standalone Cloud Functions
 * using the Firebase CLI and Cloud Functions Gen 2.
 * 
 * To deploy:
 * 1. Initialize a Firebase Functions directory: `firebase init functions` (choose TypeScript).
 * 2. Install dependencies: `npm install firebase-admin firebase-functions dotenv openai @google/generative-ai`
 * 3. Copy these functions into your `functions/src/index.ts` file.
 * 4. Deploy using: `firebase deploy --only functions`
 */

import { onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { OpenAI } from 'openai';
import { GoogleGenAI } from '@google/generative-ai';
import crypto from 'crypto';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// ----------------------------------------------------
// INITIALIZE API CLIENTS
// ----------------------------------------------------
// These expect environment variables configured in Firebase:
// firebase functions:secrets:set OPENAI_API_KEY GEMINI_API_KEY WHATSAPP_ACCESS_TOKEN
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'HauHauVoiceOrderVerifyToken2026';
const BOT_NUMBER_ID = process.env.WHATSAPP_BOT_NUMBER_ID || 'YOUR_BOT_NUMBER_ID';

// Helper to normalize phone numbers to digits only
function normalizePhone(phone: str): str {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Helper to reply to students over Meta Graph API
 */
async function sendWhatsAppMessage(toPhone: string, message: string) {
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!whatsappToken) {
    console.warn("WHATSAPP_ACCESS_TOKEN not configured. Skipping WhatsApp message send.");
    return;
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${BOT_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'text',
        text: { preview_url: true, body: message }
      })
    });

    if (!response.ok) {
      console.error(`WhatsApp send failed: ${response.statusText}`, await response.text());
    }
  } catch (error) {
    console.error("WhatsApp send network error:", error);
  }
}

// ----------------------------------------------------
// CLOUD FUNCTION 1: Meta WhatsApp Webhook Router
// ----------------------------------------------------
export const inboundWhatsAppWebhook = onRequest(
  { secrets: ["OPENAI_API_KEY", "GEMINI_API_KEY", "WHATSAPP_ACCESS_TOKEN"] },
  async (req, res) => {
    // 1. GET - Webhook subscription verification
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified successfully.');
        res.status(200).send(challenge);
        return;
      }
      res.status(403).send('Forbidden');
      return;
    }

    // 2. POST - Handle message events
    if (req.method === 'POST') {
      try {
        const payload = req.body;
        const entry = payload.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const message = value?.messages?.[0];

        if (!message) {
          res.status(200).json({ success: true, message: 'Status updates ignored' });
          return;
        }

        const fromPhone = message.from;
        const normalizedFromPhone = normalizePhone(fromPhone);

        // ----------------------------------------------------
        // CASE 1: Voice Note Order Payload (.ogg audio)
        // ----------------------------------------------------
        if (message.type === 'audio' && message.audio) {
          const mediaId = message.audio.id;

          // Gate A: User Lookup and active checks
          const usersRef = db.collection('users');
          let userDoc = null;

          const queryPhone = await usersRef.where('phone', '==', normalizedFromPhone).get();
          if (!queryPhone.empty) {
            userDoc = queryPhone.docs[0];
          } else if (normalizedFromPhone.length > 10) {
            const localDigits = normalizedFromPhone.slice(-10);
            const queryPhoneAlt = await usersRef.where('phone', '==', `+91${localDigits}`).get();
            if (!queryPhoneAlt.empty) {
              userDoc = queryPhoneAlt.docs[0];
            }
          }

          if (!userDoc) {
            await sendWhatsAppMessage(
              fromPhone,
              "Macha! You don't have an account registered with Hau Hau yet. Please open our web app and verify your profile first! 🌟"
            );
            res.status(200).json({ success: true, message: 'Unregistered user aborted' });
            return;
          }

          const userData = userDoc.data();
          const accountStatus = userData.account_status || userData.status || '';
          if (accountStatus.toLowerCase() !== 'active') {
            await sendWhatsAppMessage(
              fromPhone,
              "Macha! You don't have an account registered with Hau Hau yet. Please open our web app and verify your profile first! 🌟"
            );
            res.status(200).json({ success: true, message: 'Inactive user aborted' });
            return;
          }

          // Gate B: Media Ingestion & Whisper Transcribing
          let audioBuffer: Buffer;
          try {
            // Retrieve Meta download URL
            const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
              headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
            });
            const metadata = await metaRes.json();
            const mediaFileRes = await fetch(metadata.url, {
              headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
            });
            audioBuffer = Buffer.from(await mediaFileRes.arrayBuffer());
          } catch (err) {
            await sendWhatsAppMessage(
              fromPhone,
              "Macha! We couldn't fetch your voice note from WhatsApp. Please try sending it again! 🎙️"
            );
            res.status(200).json({ success: false, error: 'Audio download failed' });
            return;
          }

          // Transcribe via OpenAI Whisper
          let transcription = '';
          try {
            const file = await OpenAI.toFile(audioBuffer, 'voice.ogg', { type: 'audio/ogg' });
            const whisperRes = await openai.audio.transcriptions.create({
              file: file,
              model: 'whisper-1',
            });
            transcription = whisperRes.text;
          } catch (err) {
            await sendWhatsAppMessage(
              fromPhone,
              "Macha! We had trouble transcribing your voice note. Please try speaking clearly and resubmit! 🎙️"
            );
            res.status(200).json({ success: false, error: 'Whisper transcription failed' });
            return;
          }

          if (!transcription.trim()) {
            await sendWhatsAppMessage(
              fromPhone,
              "Sorry, boss! I couldn't get what you said. Please try recording again! 🎙️"
            );
            res.status(200).json({ success: true });
            return;
          }

          // Fetch active menu catalog
          const menuSnap = await db.collection('menu').where('is_available', '==', true).get();
          const menuCatalog = menuSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            price: doc.data().price
          }));

          // Match items via Gemini AI
          const prompt = `Match items from transcription to closest catalog items.
Available Catalog: ${JSON.stringify(menuCatalog)}
Transcription: "${transcription}"
Return raw JSON array: [{"id": "menu_item_id", "qty": number_of_pieces}]`;

          let matched: any[] = [];
          try {
            const geminiModel = ai.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
            const result = await geminiModel.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            });
            matched = JSON.parse(result.response.text());
          } catch (err) {
            console.error("Gemini parse error:", err);
          }

          if (matched.length === 0) {
            await sendWhatsAppMessage(
              fromPhone,
              "Sorry, boss! I couldn't match any items in your voice note with our menu. Could you try speaking a bit clearer, or specify the item names? 🍗"
            );
            res.status(200).json({ success: true });
            return;
          }

          // Compile pricing details (Standard Catalog Prices directly)
          let estimatedTotal = 0;
          let summaryRows = '';
          const matchedDetails = [];

          for (const match of matched) {
            const docSnap = menuSnap.docs.find(d => d.id === match.id);
            if (docSnap) {
              const itemData = docSnap.data();
              const unitPrice = itemData.price;
              const itemTotal = unitPrice * match.qty;
              estimatedTotal += itemTotal;

              matchedDetails.push({
                name: itemData.name,
                qty: match.qty,
                unit_price: unitPrice
              });

              summaryRows += `• ${match.qty}x ${itemData.name}: ₹${itemTotal}\n`;
            }
          }

          const voiceOrderId = crypto.randomUUID();
          const now = admin.firestore.Timestamp.now();
          const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);

          // Write voice order staging document
          await db.collection('voice_orders').doc(voiceOrderId).set({
            id: voiceOrderId,
            phone_number: normalizedFromPhone,
            items: matchedDetails,
            estimated_total: estimatedTotal,
            status: 'PENDING',
            created_at: now,
            expires_at: expiresAt,
            soft_deleted_at: null
          });

          // Gate C: Send outbound verification link
          const checkoutLink = `https://hauhau.menu/checkout/voice?session=${voiceOrderId}`;
          const messageText = `Got your voice order, Ustaad! 🔥\n\n${summaryRows}Estimated Total: ₹${estimatedTotal}\n\nClick this secure link to view your cart, enter your account password, and confirm payment within 5 minutes: ${checkoutLink}`;

          await sendWhatsAppMessage(fromPhone, messageText);
          res.status(200).json({ success: true, voice_order_id: voiceOrderId });
          return;
        }

        // ----------------------------------------------------
        // CASE 2: Text Verification Code Message Payload (Signup Handshake)
        // ----------------------------------------------------
        if (message.type === 'text' && message.text?.body) {
          const bodyText = message.text.body;
          const tokenMatch = bodyText.match(/Ref:\s*([A-Z0-9]{8})$/i);

          if (tokenMatch) {
            const token = tokenMatch[1].toUpperCase();
            const handshakeRef = db.collection('auth_handshakes').doc(token);
            const handshakeSnap = await handshakeRef.get();

            if (handshakeSnap.exists) {
              const handshakeData = handshakeSnap.data()!;
              const registeredPhone = normalizePhone(handshakeData.phone);
              
              if (handshakeData.expires_at > Date.now() && fromPhone.endsWith(registeredPhone.slice(-10))) {
                await handshakeRef.update({
                  is_verified: true,
                  verified_at: Date.now()
                });
                await sendWhatsAppMessage(
                  fromPhone,
                  "Ustaad! Your phone number is verified. Please return to the web app screen to complete your profile! 🚀"
                );
              } else {
                await sendWhatsAppMessage(
                  fromPhone,
                  "Macha! This verification request failed. The token is either expired or sender number mismatch."
                );
              }
            }
          }
        }

        res.status(200).send('OK');
      } catch (error: any) {
        console.error("Webhook processing error:", error);
        res.status(500).send("Internal Server Error");
      }
    }
  }
);

// ----------------------------------------------------
// CLOUD FUNCTION 2: 60-Second Soft-Delete Sweeper (Tier 1)
// ----------------------------------------------------
export const softDeleteExpiredVoiceOrders = onSchedule('every 1 minutes', async (event) => {
  const now = admin.firestore.Timestamp.now();
  console.log('Sweeping collections for expired pending voice orders...');

  try {
    const expiredSnap = await db.collection('voice_orders')
      .where('status', '==', 'PENDING')
      .where('expires_at', '<=', now)
      .get();

    if (expiredSnap.empty) {
      console.log('No expired pending orders found.');
      return;
    }

    const batch = db.batch();
    expiredSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'SOFT_DELETED',
        soft_deleted_at: now
      });
    });

    await batch.commit();
    console.log(`Soft deleted ${expiredSnap.size} expired voice orders.`);
  } catch (error) {
    console.error("Soft-delete sweeper error:", error);
  }
});

// ----------------------------------------------------
// CLOUD FUNCTION 3: Daily Hard-Delete Purge Sweeper (Tier 2)
// ----------------------------------------------------
export const hardDeleteOldVoiceOrders = onSchedule('every 24 hours', async (event) => {
  console.log('Sweeping collections for old soft-deleted orders...');
  const fortyFiveDaysMs = 45 * 24 * 60 * 60 * 1000;
  const thresholdDate = new Date(Date.now() - fortyFiveDaysMs);
  const thresholdTimestamp = admin.firestore.Timestamp.fromDate(thresholdDate);

  try {
    const purgeSnap = await db.collection('voice_orders')
      .where('status', '==', 'SOFT_DELETED')
      .where('soft_deleted_at', '<=', thresholdTimestamp)
      .get();

    if (purgeSnap.empty) {
      console.log('No junk orders found to delete.');
      return;
    }

    const batch = db.batch();
    purgeSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Hard deleted ${purgeSnap.size} outdated voice order documents from storage.`);
  } catch (error) {
    console.error("Hard-delete sweeper error:", error);
  }
});
