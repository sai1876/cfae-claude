'use server';

export const askStaffCopilotAction = async (message: string, context: string): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY_CHAT;
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are the Hau Hau Cafe Staff Copilot, a highly intelligent and concise AI assistant for cafe operations. 
Your job is to answer questions from the staff (Admin, Manager, Chefs) about operations, Standard Operating Procedures (SOPs), recipes, and cafe policies.
Keep your answers brief, professional, and actionable.

Current Context/SOPs: ${context}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.5,
        max_tokens: 500
      })
    });
    
    if (!res.ok) {
      throw new Error(`Groq API error: ${res.status}`);
    }
    
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Staff Copilot Error:", error);
    return "I am currently disconnected from the central server. Please check your network or try again later.";
  }
}

export const getInventoryForecastAction = async (ingredient: string, currentQty: number, unit: string, recentUsage: number, weatherContext: string): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY_OPS;
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are the Hau Hau Cafe AI Inventory Manager. Provide a very brief, concise 1-2 sentence stock prediction. 
Analyze the current stock, past 7 days usage, and weather conditions to suggest if we should restock now or wait, and roughly how much to order.
Do not use markdown formatting. Be direct.`
          },
          {
            role: 'user',
            content: `Ingredient: ${ingredient}
Current Stock: ${currentQty} ${unit}
Usage (last 7 days): ${recentUsage} ${unit}
Context/Weather: ${weatherContext}`
          }
        ],
        temperature: 0.4,
        max_tokens: 150
      })
    });
    
    if (!res.ok) {
      throw new Error(`Groq API error: ${res.status}`);
    }
    
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Inventory Forecast Error:", error);
    return "Unable to generate forecast at this time. Network error.";
  }
}

export const autoScheduleAction = async (staffData: any[], peakHours: string): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY_OPS;
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are an expert Cafe Operations Manager AI. 
Generate a concise, optimized daily shift schedule based on the staff available and the predicted peak hours.
Assign roles logically. Output the schedule in a short, clean format without heavy markdown. Keep it under 150 words.`
          },
          {
            role: 'user',
            content: `Staff Available: ${JSON.stringify(staffData.map(s => ({ name: s.name, role: s.role, status: s.status })))}
Predicted Peak Hours: ${peakHours}
Generate schedule:`
          }
        ],
        temperature: 0.6,
        max_tokens: 300
      })
    });
    
    if (!res.ok) {
      throw new Error(`Groq API error: ${res.status}`);
    }
    
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Schedule Generation Error:", error);
    return "Unable to generate schedule at this time. Network error.";
  }
}

export const getYieldPromosAction = async (overstockedItems: any[]): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY_OPS;
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are the Hau Hau Cafe AI Yield Manager. 
You are given a list of overstocked inventory items and a specific business goal.
Your job is to invent exactly ONE creative promo code that satisfies the business goal. 

CRITICAL INSTRUCTIONS:
1. If the business goal is highly specific (e.g. clearing veg burger patties, selling iced tea, boosting cold coffees), prioritizing and targeting this goal is MANDATORY. Create a promo code and descriptive tagline directly targeted at that specific item/goal (e.g. if the goal is clearing burger patties, create a burger promotion code like VEGBURGER25 with a tagline and categoryScope for "Burgers"!).
2. If the business goal is generic (e.g., "Clear overstocked items"), focus on clearing the provided overstocked inventory items.
3. Your promo code must be highly appetizing, creative, and optimized to drive orders.

Return ONLY a valid JSON object with the following fields: 
- "code" (string, uppercase, no spaces e.g. EXTRACHEESE20)
- "discountPercent" (number, between 5 and 30)
- "description" (string, short appetizing catchphrase)
- "categoryScope" (string, category name like "Biryani", "Waffles", "Beverages", "Burgers", "Momos", "Snacks", or "All")
- "imagePrompt" (string, detailed descriptive prompt for a food image generator, e.g. "A close up photo of sizzling chicken wings served with dipping sauce, warm lighting, food photography style")
Do not output any markdown formatting, just the raw JSON object.`
          },
          {
            role: 'user',
            content: `Business Goal: ${overstockedItems[0]?.goal || 'Clear overstocked items'}
Overstocked Inventory List: ${JSON.stringify(overstockedItems.map(i => i.name || i))}
Generate JSON:`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
        max_tokens: 200
      })
    });
    
    if (!res.ok) {
      throw new Error(`Groq API error: ${res.status}`);
    }
    
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Yield Promos Error:", error);
    return "Unable to generate yield promotions at this time. Network error.";
  }
}
