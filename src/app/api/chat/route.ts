import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';

// Zod schema for input validation
const chatRequestSchema = z.object({
  userMessage: z.string().min(1).max(1000),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'bot']),
    content: z.string().max(2000)
  })).max(20),
  menuContext: z.string().optional()
});

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (10 requests per minute per user IP)
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const { success: rateLimitSuccess } = rateLimit(`chat:${ip}`, 10, 60 * 1000);
    if (!rateLimitSuccess) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    // 2. Input Validation and Sanitization
    const body = await req.json();
    const result = chatRequestSchema.safeParse(body);
    if (!result.success) {
      // Fixed: use result.error.issues to solve the compile error
      return NextResponse.json({ error: 'Invalid Request', details: result.error.issues }, { status: 400 });
    }

    const { userMessage, chatHistory, menuContext } = result.data;

    // 3. System Prompt Construction
    const systemPrompt =
      `You are "Bhai" — a final-year student at this college who works part-time at Oasis Cafe, Hyderabad. You know EVERYONE on campus. ` +
      `Talk like a funny, caring Hyderabadi college senior — mix of Hindi, Telugu slang, and English like real students speak. ` +
      `Phrases: "arre yaar", "bhai sun", "sach mein?", "mast plan hai", "pakka set", "tu toh full gone hai mamu", "lite le lo", "kya scene hai". ` +
      `\n\nRULES:` +
      `\n- Roast a little but always help. Give your own opinion like a bhai would.` +
      `\n- Check MOOD first — never assume exams. Ask "kya scene hai?" casually.` +
      `\n- Food request → recommend from menu immediately like a friend.` +
      `\n- If genuinely sad/stressed → short pep talk then comfort food.` +
      `\n- Max 2-3 sentences. Sound human, NOT like a bot.` +
      `${menuContext || ''}` +
      `\n\nIMPORTANT: Sometimes (not always) include 2-3 short follow-up "choices" the student can tap — like contextual quick replies relevant to what was just said. E.g. if recommending food: ["Add to cart", "Suggest something else", "Koi aur option?"] or for mood: ["Haan yaar 😔", "Nahi, thak gaya", "Actually khush hoon 😄"]. Keep choices SHORT (max 4 words each).` +
      `\n\nReturn ONLY valid raw JSON (no markdown):\n{"message":"...","recommendedMenuItemIds":["id1"],"is_highly_stressed":false,"choices":["option1","option2"]}` +
      `\nInclude choices only when they add value. Omit if not useful.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: userMessage }
    ];

    // 4. Server-Side LLM Call with Key Rotation Pool
    const keysStr = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);

    if (keys.length === 0) {
      console.error("GROQ_API_KEY is missing from environment variables.");
      return NextResponse.json({ error: 'LLM Configuration Error' }, { status: 500 });
    }

    let response: Response | null = null;
    
    // Rotate keys on rate limit (429) errors
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        console.log(`[CHAT API] Calling Groq llama3-8b-8192 (Key index: ${i})...`);
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages,
            temperature: 0.7,
            max_tokens: 400, // Token budget limit to prevent runaway costs
            response_format: { type: "json_object" }
          }),
        });

        if (response.status === 429) {
          console.warn(`[CHAT API RATE LIMIT] Key index ${i} rate limited (429). Rotating...`);
          continue;
        }

        if (response.ok) {
          break; // Success!
        }
      } catch (err) {
        console.error(`[CHAT API ERROR] Key index ${i} failed:`, err);
      }
    }

    if (!response || !response.ok) {
      console.error("All Groq API keys in pool were exhausted or rate-limited in Chat API.");
      return NextResponse.json({ error: 'LLM Generation Failed' }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
