import { MenuItem } from './types';

/**
 * Helper to retrieve all configured Groq API keys for rotation
 */
function getGroqKeys(): string[] {
  const keysStr = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
  return keysStr.split(',').map(k => k.trim()).filter(Boolean);
}

/**
 * Helper to retrieve all configured Gemini API keys for rotation
 */
function getGeminiKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysStr.split(',').map(k => k.trim()).filter(Boolean);
}

/**
 * Downloads audio binary data from Meta's media server
 */
export async function downloadMetaMedia(mediaId: string): Promise<Buffer> {
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!whatsappToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not configured in environment variables.");
  }

  try {
    console.log(`[META MEDIA] Retrieving media metadata for ID: ${mediaId}`);
    const metaUrl = `https://graph.facebook.com/v19.0/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
      headers: {
        'Authorization': `Bearer ${whatsappToken}`
      }
    });

    if (!metaRes.ok) {
      const errBody = await metaRes.text();
      throw new Error(`Failed to retrieve media metadata: ${metaRes.statusText}. Response: ${errBody}`);
    }

    const metadata = await metaRes.json();
    const downloadUrl = metadata.url;

    if (!downloadUrl) {
      throw new Error("No download URL found in Meta media metadata response.");
    }

    console.log(`[META MEDIA] Downloading media binary from URL`);
    const mediaRes = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${whatsappToken}`
      }
    });

    if (!mediaRes.ok) {
      throw new Error(`Failed to download binary: ${mediaRes.statusText}`);
    }

    const arrayBuffer = await mediaRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error(`[META MEDIA ERROR] Media ingestion failed:`, error);
    throw new Error(`Media download error: ${error.message || error}`);
  }
}

/**
 * Transcribes audio buffer using Groq Whisper API (with automated key rotation fallback)
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    throw new Error("GROQ_API_KEY or GROQ_API_KEYS is not configured in environment variables.");
  }

  // Iterate over keys to handle rate limiting (429) fallback
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      console.log(`[GROQ WHISPER] Transcribing audio via whisper-large-v3 (Key index: ${i})...`);
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' });
      formData.append('file', blob, 'voice.ogg');
      formData.append('model', 'whisper-large-v3');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`
        },
        body: formData
      });

      if (res.status === 429) {
        console.warn(`[GROQ RATE LIMIT] Key index ${i} rate limited (429). Attempting rotation...`);
        continue; // Try next key
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq Whisper error: ${res.statusText}. Details: ${errText}`);
      }

      const data = await res.json();
      const transcription = data.text || '';
      console.log(`[GROQ WHISPER SUCCESS] Transcription: "${transcription}"`);
      return transcription;
    } catch (error: any) {
      console.error(`[GROQ WHISPER ERROR] Key index ${i} failed:`, error.message || error);
      if (i === keys.length - 1) {
        // Last key failed, bubble up error
        throw error;
      }
    }
  }

  throw new Error("All Groq API keys in pool were exhausted or rate-limited.");
}

/**
 * Matches transcription text to active menu items using Gemini AI (with automated key rotation fallback)
 */
export async function matchVoiceOrderToMenu(
  transcription: string,
  menuItems: MenuItem[]
): Promise<{ id: string; qty: number }[]> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    console.error("[GEMINI MATCH] No Gemini API keys found.");
    return [];
  }

  const availableCatalog = menuItems
    .filter(item => item.is_available)
    .map(item => ({
      item_id: item.item_id,
      name: item.name,
      category: item.category,
      price: item.price
    }));

  const systemInstruction = `You are a strict conversational dining parser for the "Hau Hau" campus cafeteria.
You are given a list of available menu items:
${JSON.stringify(availableCatalog, null, 2)}

Your task is to analyze the student's voice transcription and extract the items they want to order, along with their quantities.
Match the items mentioned to the closest available item in the catalog.
Only return items that have a high-confidence match. If an item is mentioned but not in the catalog, ignore it.

You must return a raw JSON array matching this exact schema:
[
  { "id": "matched_menu_item_id", "qty": number_of_pieces }
]

Do not return any other text, markdown blocks, formatting, or commentary. Only return the valid JSON array.
If no items can be matched, return an empty array: []`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `Transcription to parse: "${transcription}"` }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  // Iterate over keys to handle rate limiting (429) fallback
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;

    try {
      console.log(`[GEMINI MATCH] Matching transcription to catalog (Key index: ${i})...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 429) {
        console.warn(`[GEMINI RATE LIMIT] Key index ${i} rate limited (429). Attempting rotation...`);
        continue; // Try next key
      }

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.statusText}`);
      }

      const responseData = await res.json();
      const resultText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      console.log(`[GEMINI MATCH SUCCESS] Result raw: ${resultText.trim()}`);

      const matched = JSON.parse(resultText.trim());
      if (Array.isArray(matched)) {
        return matched as { id: string; qty: number }[];
      }
      return [];
    } catch (error: any) {
      console.error(`[GEMINI MATCH ERROR] Key index ${i} failed:`, error.message || error);
      if (i === keys.length - 1) {
        return [];
      }
    }
  }

  return [];
}

/**
 * Sends a text message back to the user via Meta Graph API
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  toPhone: string,
  message: string
): Promise<boolean> {
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!whatsappToken) {
    console.warn("WHATSAPP_ACCESS_TOKEN is not configured. Skipping WhatsApp message send.");
    return false;
  }

  try {
    console.log(`[WHATSAPP MESSAGE] Sending message to ${toPhone}`);
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "text",
      text: {
        preview_url: true,
        body: message
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${whatsappToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[WHATSAPP MESSAGE ERROR] Send failed: ${res.statusText}. Details: ${errText}`);
      return false;
    }

    console.log(`[WHATSAPP MESSAGE SUCCESS] Message sent to ${toPhone}`);
    return true;
  } catch (error) {
    console.error(`[WHATSAPP MESSAGE ERROR] Network error:`, error);
    return false;
  }
}
