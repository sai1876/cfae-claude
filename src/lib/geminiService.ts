/**
 * Gemini AI Service for Hau Hau Cafe Owner Portal
 * Powered by Next.js server-side proxy endpoints to avoid API key exposure
 */

import { AtmosphereConfig, PromoDraft, AISlideDetails, SmartRefillAnalysis } from './types';

// API Secret Key for secure server proxy validation
const API_SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET_KEY || 'OrinSecureAPI_2026';

/**
 * Common fetch helper to call our server-side secure /api/gemini endpoint
 */
async function callGeminiProxy(action: string, payload: any): Promise<any> {
  const url = '/api/gemini';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_SECRET_KEY}`
    },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Gemini proxy request failed');
  }
  return await response.json();
}

// ==========================================
// LOCAL AI FALLBACK GENERATORS (when API quota or proxy is offline)
// ==========================================

function fallbackAtmosphere(userPrompt: string): AtmosphereConfig {
  const prompt = userPrompt.toLowerCase();
  let theme: 'default' | 'exam' | 'raining' | 'fest' | 'night' = 'default';
  let title = 'Your escape from the heat.';
  let sub = 'Mist-cooling and chilled beverages 4 minutes away.';
  let bText = 'Beat the heat — order ready in 8 mins';
  let bColor: 'golden' | 'urgent' | 'success' | 'dark' = 'golden';
  let reason = 'Restored standard campus operational defaults.';

  if (prompt.includes('rain') || prompt.includes('monsoon') || prompt.includes('storm') || prompt.includes('cold') || prompt.includes('weather') || prompt.includes('water')) {
    theme = 'raining';
    title = 'Cozy Up in the Rain.';
    sub = 'Hot tea, steaming momos, and pleasant vibes under our canopies.';
    bText = 'Monsoon Specials Active — orders ready inside 10 mins';
    bColor = 'success';
    reason = 'Detected rainy weather context. Elevated hot teas and momos, color skin shifted to twilight teal.';
  } else if (prompt.includes('exam') || prompt.includes('study') || prompt.includes('test') || prompt.includes('quiz') || prompt.includes('stress') || prompt.includes('caffeine')) {
    theme = 'exam';
    title = 'Fuel Your Study Sessions.';
    sub = 'High caffeine brews and smart snacks to push you past the finish line.';
    bText = 'Quiet study mode in canopy hatches. Free espresso shot with code STUDY_BOOST!';
    bColor = 'urgent';
    reason = 'Captured campus exam stress. Adjusted active_theme to Exam, activated high-caffeine promotional banners.';
  } else if (prompt.includes('diwali') || prompt.includes('fest') || prompt.includes('celebr') || prompt.includes('holi') || prompt.includes('party') || prompt.includes('happy')) {
    theme = 'fest';
    title = 'Celebrate Campus Nights.';
    sub = 'Elevate the moments with Biryanis and festive mocktails.';
    bText = 'Festival Season — Flat 20% discount on Biryani platters!';
    bColor = 'golden';
    reason = 'Captured festive occasion context. Swapped aesthetic to gold-leaf glow mesh, elevated Special Biryani showcase.';
  } else if (prompt.includes('night') || prompt.includes('midnight') || prompt.includes('sleepy') || prompt.includes('dark')) {
    theme = 'night';
    title = 'Your Midnight Savior.';
    sub = 'Late night cravings met with fresh burgers and crispy fries.';
    bText = 'Midnight Canopy operations active until 2:00 AM';
    bColor = 'dark';
    reason = 'Detected late hours prompt. Changed storefront layout skin to deep night violet, enabled late-night pick up times.';
  }

  return {
    active_theme: theme,
    hero_headline: title,
    hero_sub: sub,
    banner_active: true,
    banner_text: bText,
    banner_color: bColor,
    reason: `[AI local backup active] ${reason}`
  };
}

function fallbackMenuDescription(itemName: string, category: string, ingredients: string[]): string {
  const nameLower = itemName.toLowerCase();
  const cleanIngredients = ingredients
    .map(i => i.trim())
    .filter(i => i.length > 0 && !i.toLowerCase().includes('water') && !i.toLowerCase().includes('oil') && !i.toLowerCase().includes('salt'));

  let ingredientDetail = "";
  if (cleanIngredients.length === 1) {
    ingredientDetail = ` elevated with the finest ${cleanIngredients[0]}`;
  } else if (cleanIngredients.length === 2) {
    ingredientDetail = ` beautifully infused with premium ${cleanIngredients[0]} and ${cleanIngredients[1]}`;
  } else if (cleanIngredients.length >= 3) {
    ingredientDetail = ` rich with the delicious notes of ${cleanIngredients[0]}, ${cleanIngredients[1]}, and a touch of ${cleanIngredients[2]}`;
  }

  if (nameLower.includes('waffle') || nameLower.includes('chocolate') || nameLower.includes('crepe') || nameLower.includes('pancake') || nameLower.includes('sweet') || category === 'Waffles') {
    const mainAroma = nameLower.includes('chocolate') ? "decadent cocoa aromas" : "warm vanilla glaze";
    return `Indulge in our exquisite ${itemName}, golden-crisp on the outside and wonderfully fluffy inside,${ingredientDetail || ` crafted with ${mainAroma}`}. A sweet campus sensation that is absolutely irresistible!`;
  }

  if (nameLower.includes('biryani') || nameLower.includes('rice') || nameLower.includes('pulao') || category === 'Biryani') {
    return `Savor the royal heritage of our signature ${itemName}, slow-dum cooked with aromatic basmati rice${ingredientDetail || " and a curated blend of secret spices"}. A majestic, deeply flavorful masterpiece served hot and fresh.`;
  }

  if (nameLower.includes('momo') || nameLower.includes('dumpling') || nameLower.includes('dimsum') || category === 'Momos') {
    return `Delight in our delicate, thin-skinned ${itemName}, handcrafted and steamed to juicy perfection${ingredientDetail || " with fresh herbs"}. Served with our signature fiery house chutney for the ultimate savor!`;
  }

  if (nameLower.includes('burger') || nameLower.includes('sandwich') || nameLower.includes('wrap') || category === 'Burgers') {
    return `Sink your teeth into our gourmet ${itemName}, flame-grilled to sizzling perfection${ingredientDetail || " with crisp greens"}. Stacked high on toasted artisan buns and layered with secret house dressing.`;
  }

  if (nameLower.includes('fry') || nameLower.includes('nugget') || nameLower.includes('roll') || nameLower.includes('snack') || category === 'Snacks') {
    return `Enjoy the satisfying crunch of our freshly seasoned ${itemName}, prepared crisp and hot to order${ingredientDetail || " for the perfect savory bite"}. Ideal for sharing or fueling your study sessions!`;
  }

  if (nameLower.includes('tea') || nameLower.includes('coffee') || nameLower.includes('latte') || nameLower.includes('brew') || nameLower.includes('shake') || nameLower.includes('drink') || nameLower.includes('beverage') || category === 'Beverages') {
    const isHot = nameLower.includes('hot') || nameLower.includes('cappuccino') || nameLower.includes('espresso') || nameLower.includes('chai');
    const tempText = isHot ? "warm, comforting" : "chilled, refreshing";
    return `Rejuvenate your senses with our custom-crafted ${itemName}, a ${tempText} blend${ingredientDetail || " brewed to smooth, aromatic perfection"}. Designed to deliver a premium surge of delicious energy in every sip.`;
  }

  return `Experience the refined flavors of our premium ${itemName}, meticulously prepared by our chefs${ingredientDetail || " using the finest locally sourced ingredients"}. A sophisticated culinary delight designed to wow your palate!`;
}

function fallbackSmartPromo(businessGoal: string): PromoDraft {
  const goal = businessGoal.toLowerCase();
  let code = "CAMPUS_DEAL_15";
  let discount = 15;
  let desc = "AI Drafted campaign deal: Flat 15% discount on hot items.";
  let scope = "All";

  if (goal.includes('waffle') || goal.includes('sweet') || goal.includes('dessert')) {
    code = "WAFFLE_FEAST_20";
    discount = 20;
    desc = "Clear out our fresh waffle grids! Get a gorgeous 20% off all sweet waffles.";
    scope = "Waffles";
  } else if (goal.includes('coffee') || goal.includes('brew') || goal.includes('drink') || goal.includes('chai')) {
    code = "CAFFEINE_BOOST_25";
    discount = 25;
    desc = "Need study energy? Fuel up with a flat 25% off all beverages!";
    scope = "Beverages";
  } else if (goal.includes('biryani') || goal.includes('rice') || goal.includes('lunch')) {
    code = "BIRYANI_FEAST_30";
    discount = 30;
    desc = "Midday hunger? Treat your squad with 30% off aromatic Biryani platters!";
    scope = "Biryani";
  } else if (goal.includes('momo') || goal.includes('steam')) {
    code = "MOMO_MANIA_15";
    discount = 15;
    desc = "Hot steamed Momos are waiting for you with a fresh 15% off coupon.";
    scope = "Momos";
  } else if (goal.includes('burger') || goal.includes('patty') || goal.includes('dinner')) {
    code = "BURGER_CRUSH_20";
    discount = 20;
    desc = "Juicy, flame-grilled goodness is calling. Grab 20% off all burgers!";
    scope = "Burgers";
  }

  return {
    code,
    discountPercent: discount,
    description: `[AI local backup active] ${desc}`,
    categoryScope: scope
  };
}

function fallbackCRMMessage(patronName: string, preferredItem: string, daysAgo: number, tone: 'cozy' | 'exotic' | 'urgent'): string {
  const code = `HAUHAU_${patronName.toUpperCase().replace(/\s+/g, "")}_20`;
  
  if (tone === 'cozy') {
    return `Hey ${patronName}, it's been ${daysAgo} days since your last ${preferredItem}! The canopy is cozy, the mist is chilled, and your favorite table is waiting. Use code ${code} for 20% off!`;
  } else if (tone === 'exotic') {
    return `Escape the campus grind, ${patronName}. Treat yourself to the sensory luxury of a fresh, warm ${preferredItem} under our mist canopies. Save 20% with secret code ${code}.`;
  } else {
    return `Quick, ${patronName}! Our live queue telemetry is completely clear right now. Beat the rush and grab your hot ${preferredItem} in under 4 mins. Use code ${code} within 24h!`;
  }
}

function fallbackSlideDetails(itemName: string, category: string, originalDescription: string): AISlideDetails {
  const nameLower = itemName.toLowerCase();
  let tag = "PREMIUM INDULGENCE";
  let desc = originalDescription || `Savor our freshly prepared ${itemName}, crafted to perfection using premium ingredients. It is designed to deliver a delightful surge of culinary satisfaction. A perfect addition to complete your day under our cozy mist canopies.`;
  let tags = ["Chef Special", "Freshly Made", "Premium Vibe"];
  let accentColor = "#f8bc51";
  let bgColor = "radial-gradient(circle at center, #63503B 0%, #2A2118 100%)";

  if (nameLower.includes('waffle') || nameLower.includes('sweet') || category === 'Waffles') {
    tag = "WARM SWEET CRISP DELIGHT";
    desc = desc || "Indulge in our hot, golden Belgian waffles, freshly baked to a crisp finish. Drizzled generously with rich chocolate sauce, sweet maple syrup, and topped with premium chocolate shavings. A comforting sweet treat perfect for campus study breaks or midnight cravings.";
    tags = ["Golden-Crisp", "Warm Waffle Grid", "Rich Chocolate"];
    accentColor = "#D4A832";
    bgColor = "radial-gradient(circle at center, #D4A832 0%, #251B03 100%)";
  } else if (nameLower.includes('biryani') || nameLower.includes('rice') || category === 'Biryani') {
    tag = "ROYAL BASMATI EXCELLENCE";
    desc = desc || "Experience the true royal heritage of our signature Biryani, slow-dum cooked in sealed pots. Fluffy, long-grain basmati rice is layered with rich saffron, fresh mint leaves, and a secret blend of ground spices. Served sizzling hot with premium raita for the ultimate culinary journey.";
    tags = ["Dum Baked", "Saffron Rice", "Mint Leaves"];
    accentColor = "#f8bc51";
    bgColor = "radial-gradient(circle at center, #63503B 0%, #2A2118 100%)";
  } else if (nameLower.includes('momo') || nameLower.includes('dumpling') || category === 'Momos') {
    tag = "STEAMING HOT MOMO MANIA";
    desc = desc || "Delight in our steaming hot, hand-folded momos prepared with a delicate thin wrapper. Stuffed with seasoned, juicy filling and fresh herbs, then steamed to juicy perfection. Accompanied by our signature fiery red chili chutney for a bold kick of authentic flavor.";
    tags = ["Hand-Folded", "Thin Wrapper", "Fiery Red Chutney"];
    accentColor = "#ef4444";
    bgColor = "radial-gradient(circle at center, #E8621A 0%, #1A0A02 100%)";
  } else if (nameLower.includes('burger') || nameLower.includes('sandwich') || category === 'Burgers') {
    tag = "GOURMET FLAME-GRILLED CRUNCH";
    desc = desc || "Sink your teeth into our signature gourmet burger, layered with a double-smashed crispy patty. Stacked high with fresh crisp lettuce, ripe tomatoes, and melted cheese on toasted artisan buns. Finished with a drizzle of our secret house sauce for an explosion of flavors in every bite.";
    tags = ["Flame-Grilled", "Artisan Buns", "Crisp Greens"];
    accentColor = "#E8621A";
    bgColor = "radial-gradient(circle at center, #E8621A 0%, #1A0A02 100%)";
  } else if (nameLower.includes('fry') || nameLower.includes('nugget') || nameLower.includes('snack') || category === 'Snacks') {
    tag = "CRISPY GOLDEN SAVORY BITE";
    desc = desc || "Enjoy the satisfying crunch of our premium golden fries, double-fried to sizzling perfection. Seasoned generously with our signature house blend spices and premium sea salt. The perfect companion for late-night chats under the canopy or quick bites between classes.";
    tags = ["Golden-Crisp", "Freshly Seasoned", "Satisfying Crunch"];
    accentColor = "#D4A832";
    bgColor = "radial-gradient(circle at center, #D4A832 0%, #251B03 100%)";
  } else if (category === 'Beverages' || nameLower.includes('tea') || nameLower.includes('coffee') || nameLower.includes('drink')) {
    tag = "CHILLED REFRESHING BREWS";
    desc = desc || "Rejuvenate your senses with our custom-brewed beverages, prepared fresh to order. A rich blend of premium ground coffee beans, thick chilled milk, and gourmet vanilla cream. Designed to deliver a delightful surge of cool energy to power you through college afternoons.";
    tags = ["Brewed-to-Order", "Ice Chilled", "Premium Aromas"];
    accentColor = "#2E7D5E";
    bgColor = "radial-gradient(circle at center, #2E7D5E 0%, #0B241A 100%)";
  }

  return { tag, desc, tags, accentColor, bgColor };
}

// ==========================================
// EXPORTED CLIENT ENDPOINTS (SECURELY PROXIED)
// ==========================================

export async function adjustAtmosphere(userPrompt: string): Promise<AtmosphereConfig> {
  try {
    return await callGeminiProxy('adjustAtmosphere', { userPrompt });
  } catch (e) {
    console.warn("Gemini atmosphere proxy failed, using offline fallback:", e);
    return fallbackAtmosphere(userPrompt);
  }
}

export async function generateMenuDescription(itemName: string, category: string, ingredients: string[]): Promise<string> {
  try {
    const res = await callGeminiProxy('generateMenuDescription', { itemName, category, ingredients });
    return res.description;
  } catch (e) {
    console.warn("Gemini description writer proxy failed, using offline fallback:", e);
    return fallbackMenuDescription(itemName, category, ingredients);
  }
}

export async function generateSmartPromo(businessGoal: string): Promise<PromoDraft> {
  try {
    return await callGeminiProxy('generateSmartPromo', { businessGoal });
  } catch (e) {
    console.warn("Gemini smart promo proxy failed, using offline fallback:", e);
    return fallbackSmartPromo(businessGoal);
  }
}

export async function generateCRMMessage(patronName: string, preferredItem: string, daysAgo: number, tone: 'cozy' | 'exotic' | 'urgent'): Promise<string> {
  try {
    const res = await callGeminiProxy('generateCRMMessage', { patronName, preferredItem, daysAgo, tone });
    return res.message;
  } catch (e) {
    console.warn("Gemini CRM writer proxy failed, using offline fallback:", e);
    return fallbackCRMMessage(patronName, preferredItem, daysAgo, tone);
  }
}

export async function fetchLocalizedWeather(latitude: number, longitude: number): Promise<string> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API failed");
    const data = await res.json();
    
    const temp = data.current.temperature_2m;
    const precip = data.current.precipitation;
    const maxTempNextDay = data.daily.temperature_2m_max[1];
    const precipNextDay = data.daily.precipitation_sum[1];
    
    return `Current: ${temp}°C, Precipitation: ${precip}mm. Tomorrow's forecast: High of ${maxTempNextDay}°C, Precipitation: ${precipNextDay}mm.`;
  } catch (e) {
    console.warn("Weather fetch failed, falling back to generic seasonal context.", e);
    return "Weather data unavailable. Assume generic seasonal average conditions.";
  }
}

export async function analyzeSmartRefill(ingredient: string, baselineUsage: number, localWeatherContext: string): Promise<SmartRefillAnalysis> {
  try {
    return await callGeminiProxy('analyzeSmartRefill', { ingredient, baselineUsage, localWeatherContext });
  } catch (e) {
    console.warn("Gemini smart refill prediction proxy failed, using fallback:", e);
    return {
      suggested_refill_amount: baselineUsage,
      reasoning: "AI prediction offline. Showing baseline historical average."
    };
  }
}

export async function generateSlideDetails(itemName: string, category: string, originalDescription: string): Promise<AISlideDetails> {
  try {
    return await callGeminiProxy('generateSlideDetails', { itemName, category, originalDescription });
  } catch (e) {
    console.warn("Gemini slide details generation proxy failed, using fallback:", e);
    return fallbackSlideDetails(itemName, category, originalDescription);
  }
}

export interface StressBusterResponse {
  message: string;
  recommendedMenuItemIds?: string[];
  is_highly_stressed: boolean;
}

export async function generateStressBusterResponse(userMessage: string, chatHistory: {role: string, content: string}[], menuItems: {id: string, name: string, category: string, price: number}[] = []): Promise<StressBusterResponse> {
  try {
    return await callGeminiProxy('generateStressBusterResponse', { userMessage, chatHistory, menuItems });
  } catch (e) {
    console.warn("Gemini stress buster proxy failed, using fallback:", e);
    return {
      message: "Arey kya haal hai mamu? Lagta tu thoda pareshan hai, lite le lo! Exam vagera sab pass ho jayega, abhi ek mast chai peele dimag set ho jayega. Bol kitne baje soya kal?",
      recommendedMenuItemIds: [], 
      is_highly_stressed: false
    };
  }
}
