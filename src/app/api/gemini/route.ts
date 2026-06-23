import { NextResponse } from 'next/server';

// Disable static rendering
export const dynamic = 'force-dynamic';

function getGeminiKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysStr.split(',').map(k => k.trim()).filter(Boolean);
}

async function generateWithGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured on server.");
  }

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
    ...(systemInstruction ? {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    } : {})
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[attempt];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.status === 429) {
        const waitMs = (attempt + 1) * 1500;
        console.warn(`Gemini API key index ${attempt} rate limited, retrying with next key in ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Gemini API request failed");
      }

      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return resultText.trim();
    } catch (error: any) {
      console.error(`Gemini API key index ${attempt} invocation failed:`, error);
      if (attempt === keys.length - 1) {
        throw error;
      }
    }
  }
  throw new Error("All Gemini API keys were exhausted or rate-limited.");
}

export async function POST(req: Request) {
  // Enforce API secret authorization check
  const authHeader = req.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    if (action === 'adjustAtmosphere') {
      const systemInstruction = 
        `You are the Hau Hau Cafe Atmospheric AI Engine. Based on a weather condition, event, occasion, or time described by the user, you must output a valid JSON configuration representing the storefront atmosphere.\n` +
        `Themes available: 'default' (standard), 'exam' (studies, quiet), 'raining' (rainy, monsoon, cozy), 'fest' (diwali, festival, party), 'night' (late night, midnight).\n` +
        `Banner colors available: 'golden', 'urgent', 'success', 'dark'.\n` +
        `Your response must be a single, raw, valid JSON object strictly matching this typescript type: \n` +
        `{\n` +
        `  "active_theme": "default" | "exam" | "raining" | "fest" | "night",\n` +
        `  "hero_headline": "string (appetizing or atmospheric short header)",\n` +
        `  "hero_sub": "string (atmospheric subtitle)",\n` +
        `  "banner_active": boolean,\n` +
        `  "banner_text": "string (promotional banner ticker text matching mood)",\n` +
        `  "banner_color": "golden" | "urgent" | "success" | "dark",\n` +
        `  "reason": "string (very short 1-sentence summary explanation of changes)"\n` +
        `}\n` +
        `Do not wrap in markdown tags like \`\`\`json. Return only the raw JSON.`;

      const text = await generateWithGemini(payload.userPrompt, systemInstruction);
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(cleaned));
    }

    if (action === 'generateMenuDescription') {
      const { itemName, category, ingredients } = payload;
      const systemInstruction = 
        "You are a premium culinary copywriter for Hau Hau Cafe. Craft an extremely appealing, mouth-watering description of a dish in 2 sentences max. Keep it sophisticated and gourmet, yet appealing to students and campus crowds. Do not use generic copy; highlight the specific ingredients if provided. Prioritize the item name and key ingredients over the administrative category if they seem to describe a completely different kind of dish.";
      
      const prompt = `Write a description for "${itemName}". This item is administratively filed under the "${category}" category. It contains: ${ingredients.length > 0 ? ingredients.join(", ") : "premium gourmet ingredients"}. Focus entirely on describing "${itemName}" and its delicious ingredients. Do NOT describe the item as a "${category}" unless it matches.`;

      const text = await generateWithGemini(prompt, systemInstruction);
      return NextResponse.json({ description: text });
    }

    if (action === 'generateSmartPromo') {
      const systemInstruction = 
        `You are the Hau Hau Cafe Smart Campaign Builder. Based on the business goal (e.g., clearing waffle stock, boosting coffee sales in exams), generate a custom promotional coupon.\n` +
        `Discount percentage should be an integer between 5 and 35.\n` +
        `The coupon code should be all caps and use underscores instead of spaces, e.g. WAFFLE_BUFFET_20.\n` +
        `The Category Scope must be one of: 'All', 'Biryani', 'Momos', 'Burgers', 'Waffles', 'Snacks', 'Beverages'.\n` +
        `Your response must be a single, raw, valid JSON object matching this schema:\n` +
        `{\n` +
        `  "code": "PROMO_CODE",\n` +
        `  "discountPercent": number,\n` +
        `  "description": "string (appetizing user-facing tagline, explaining campaign)",\n` +
        `  "categoryScope": "All" | "Biryani" | "Momos" | "Burgers" | "Waffles" | "Snacks" | "Beverages"\n` +
        `}\n` +
        `Do not wrap in markdown tags like \`\`\`json. Return only the raw JSON.`;

      const text = await generateWithGemini(payload.businessGoal, systemInstruction);
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(cleaned));
    }

    if (action === 'generateCRMMessage') {
      const { patronName, preferredItem, daysAgo, tone } = payload;
      const systemInstruction = 
        `You are the Hau Hau Cafe Smart Retention Specialist. Write a short, highly personalized 160-character marketing text message targeting a customer to get them to visit our hatches again.\n` +
        `Do NOT write placeholder text or brackets. Complete all details.\n` +
        `Use these tone guidelines:\n` +
        `- Cozy: warm, hospitable, referencing warm tea/waffles and community.\n` +
        `- Exotic: premium retreat, escape the daily grind, luxury treat, sensory experience.\n` +
        `- Urgent: flash countdown (valid for 24h only), queue telemetry is clear right now, speed.\n` +
        `Include a custom coupon code formatted as HAUHAU_[NAME]_[DISCOUNT] (e.g. HAUHAU_CHERU_20).`;

      const prompt = `Write a SMS/message draft for a customer named ${patronName} who hasn't visited in ${daysAgo} days. Their favorite menu item is ${preferredItem}. Tone should be: ${tone}.`;
      
      const text = await generateWithGemini(prompt, systemInstruction);
      return NextResponse.json({ message: text });
    }

    if (action === 'analyzeSmartRefill') {
      const { ingredient, baselineUsage, localWeatherContext } = payload;
      const systemInstruction = 
        `You are the Hau Hau Cafe AI Inventory Predictor.\n` +
        `Your job is to analyze historical ingredient consumption and upcoming local weather to recommend an exact refill amount.\n` +
        `Output MUST be valid JSON with the structure: { "suggested_refill_amount": number, "reasoning": "string" }\n` +
        `Rules:\n` +
        `- Cold weather / Rain usually increases hot beverage (coffee, tea, milk) and hot food (momos) demand by 20-30%.\n` +
        `- Hot weather increases cold beverage (syrups, ice) demand by 20-30%.\n` +
        `- "reasoning" should be a single, short, punchy sentence explaining the adjustment.\n` +
        `- "suggested_refill_amount" should be an integer or one decimal place.`;

      const prompt = `Ingredient: ${ingredient}\nBaseline 7-Day Usage: ${baselineUsage} units\nLocal Weather Context: ${localWeatherContext}\nBased on this, what is the optimal refill order amount?`;

      const text = await generateWithGemini(prompt, systemInstruction);
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(cleaned));
    }

    if (action === 'generateSlideDetails') {
      const { itemName, category, originalDescription } = payload;
      const systemInstruction = 
        `You are the Hau Hau Cafe Carousel Presentation Designer.\n` +
        `Your job is to generate visually stunning and copy-optimized carousel slide properties for a given menu item.\n` +
        `You will receive the item name, category, and its original description.\n` +
        `Based on this, you must output a valid JSON configuration representing the slide details.\n` +
        `Your response must be a single, raw, valid JSON object strictly matching this typescript type: \n` +
        `{\n` +
        `  "tag": "string (a premium highlight tag in all caps, e.g. 'AROMATIC BASMATI EXCELLENCE', 'CRISPY GOLDEN INDULGENCE', 'FRESH BREWED ENERGY')",\n` +
        `  "desc": "string (an extremely appetizing, mouth-watering description, exactly 3 to 4 engaging sentences, appealing to college students)",\n` +
        `  "tags": ["string (3 custom short highlight tags for visual pills, e.g. 'Saffron Rice', 'Mint Leaves', 'Dum Baked')"],\n` +
        `  "accentColor": "string (a hex color code that matches the food's palette e.g. '#f8bc51' for amber/waffles/biryani, '#2E7D5E' for mint/veggies, '#ef4444' for hot momos/spicy, '#7C3AED' for berries/midnight vibes)",\n` +
        `  "bgColor": "string (a CSS radial gradient matching the accent color. Pick one of: \n` +
        `              'radial-gradient(circle at center, #63503B 0%, #2A2118 100%)' (Amber Brown),\n` +
        `              'radial-gradient(circle at center, #E8621A 0%, #1A0A02 100%)' (Sunset Orange),\n` +
        `              'radial-gradient(circle at center, #2E7D5E 0%, #0B241A 100%)' (Forest Teal),\n` +
        `              'radial-gradient(circle at center, #D4A832 0%, #251B03 100%)' (Lemon Gold),\n` +
        `              'radial-gradient(circle at center, #7C3AED 0%, #1F0A42 100%)' (Midnight Purple))\n` +
        `}\n` +
        `Do not wrap in markdown tags like \`\`\`json. Return only the raw JSON.`;

      const prompt = `Item Name: ${itemName}\nCategory: ${category}\nOriginal Description: ${originalDescription}`;

      const text = await generateWithGemini(prompt, systemInstruction);
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(cleaned));
    }

    if (action === 'generateStressBusterResponse') {
      const { userMessage, chatHistory, menuItems } = payload;
      const menuContext = menuItems.length > 0
        ? `\n\nAVAILABLE MENU ITEMS (use these real item IDs when recommending):\n` +
          menuItems.map((i: any) => `- ID: "${i.id}" | Name: "${i.name}" | Category: ${i.category} | ₹${i.price}`).join('\n')
        : '';

      const systemInstruction =
        `You are "Bhai" — a final-year student at this college who works part-time at Oasis Cafe and knows EVERYONE on campus. ` +
        `You talk exactly like a funny, caring Hyderabadi college senior — a mix of Hindi, Telugu slang, and English like real students actually speak. ` +
        `\n\nYOUR PERSONALITY:` +
        `\n- You roast the student a little but always mean well, like a real bhai/didi would.` +
        `\n- You're NOT formal. You say things like "arre yaar", "bhai sun", "sach mein?", "isko dekho", "mast plan hai", "pakka set", "tu toh full gone hai mamu".` +
        `\n- You give your own opinion, like "mera scene tha bhi aise, chill kar" or "ek kaam kar, aa ja oasis pe".` +
        `\n- You sometimes tease them but always follow up with something genuinely helpful.` +
        `\n- You know the campus, you know the vibe, you know the food — you're THE guy to ask.` +
        `\n\n🎯 WHAT YOU DO:` +
        `\n1. First check the student's MOOD — not exams specifically, mood overall. People have bad days for many reasons.` +
        `\n2. NEVER assume they have exams. Ask "kya scene hai?" or "kya chal raha hai?" casually.` +
        `\n3. Match your energy to theirs — if they're chill, be chill. If they're upset, be a bit more caring but still funny.` +
        `\n4. If they want food — recommend immediately from the menu like a friend would ("bhai biryani le, guaranteed mood fix hai").` +
        `\n5. If they seem genuinely low — be warmer, give a short pep talk, THEN recommend comfort food.` +
        `\n6. Always end with something actionable — a food rec, a joke, or a follow-up question. Never leave them hanging.` +
        `${menuContext}` +
        `\n\n⚠️ OUTPUT FORMAT — return ONLY this raw JSON, no markdown:` +
        `\n{` +
        `\n  "message": "Your response as Bhai — casual, funny, Hyderabadi college senior tone",` +
        `\n  "recommendedMenuItemIds": ["exact_item_id_from_menu"],` +
        `\n  "is_highly_stressed": boolean` +
        `\n}` +
        `\nSet "is_highly_stressed" true if student mood is genuinely very low (sad, crying, overwhelmed, exhausted).` +
        `\nMax 3 sentences. Sound human. Sound like a bhai, not a bot.`;

      const prompt = `Conversation so far:\n${chatHistory.map((m: any) => `${m.role === 'bot' ? 'Bhai' : 'Student'}: ${m.content}`).join('\n')}\n\nStudent just said: "${userMessage}"\n\nBhai responds:`;

      const text = await generateWithGemini(prompt, systemInstruction);
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(cleaned));
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

  } catch (error: any) {
    console.error('Gemini proxy API route failed:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
