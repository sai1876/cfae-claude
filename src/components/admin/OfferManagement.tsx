'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Sparkles, Plus, Trash2, RefreshCw, CheckCircle, Percent } from 'lucide-react';
import { getYieldPromosAction } from '@/app/_actions/groqActions';
import { fetchStocks, fetchOffers, saveOffer, deleteOffer } from '@/lib/dbService';

interface Offer {
  code: string;
  discountPercent: number;
  description: string;
  categoryScope: string;
  isActive: boolean;
  expiryDate: string;
  imageUrl?: string;
}

export default function OfferManagement() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // Conversational smart coupon builder state
  const [smartGoal, setSmartGoal] = useState('');
  const [generating, setGenerating] = useState(false);
  const [smartCouponDraft, setSmartCouponDraft] = useState<Offer | null>(null);

  // Normal Form State
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [description, setDescription] = useState('');
  const [categoryScope, setCategoryScope] = useState('All');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    fetchOffers()
      .then((data) => {
        setOffers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load offers:", err);
        setLoading(false);
      });
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountPercent) return;

    // Generate a default dynamic food photo or placeholder if manual
    const fallbackImagePrompt = `A delicious professional banner of ${categoryScope === 'All' ? 'gourmet cafe food' : categoryScope} in a dark theme, warm light, culinary photography style`;
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackImagePrompt)}?width=512&height=512&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    const newOffer: Offer = {
      code: code.toUpperCase().replace(/\s+/g, '_'),
      discountPercent: parseFloat(discountPercent),
      description,
      categoryScope,
      isActive: true,
      expiryDate: expiryDate || '2026-12-31',
      imageUrl,
    };

    try {
      await saveOffer(newOffer);
      setOffers([...offers, newOffer]);
      setCode('');
      setDiscountPercent('');
      setDescription('');
    } catch (err) {
      console.error("Failed to save offer manually:", err);
      alert("Failed to save offer. Please try again.");
    }
  };

  const handleGenerateSmartCoupon = async () => {
    if (!smartGoal) return;
    setGenerating(true);

    try {
      // 1. Fetch current stock to identify overstocked items (mocked as > 50 for now if actual data is low)
      const allStocks = await fetchStocks();
      const overstocked = allStocks.filter((s: any) => s.current_quantity > s.low_threshold * 2).slice(0, 5);
      
      // Pass goal in first item for prompt context
      const payload = overstocked.length > 0 ? overstocked : [{ name: 'Assorted Items', goal: smartGoal }];
      if (payload[0]) (payload[0] as any).goal = smartGoal;

      // 2. Call Groq API
      const resultJsonStr = await getYieldPromosAction(payload);
      const result = JSON.parse(resultJsonStr);

      // 3. Generate image dynamic URL using Pollinations
      const imagePrompt = result.imagePrompt || `Gourmet delicious food promo for ${result.categoryScope || 'cafe food'}`;
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=512&height=512&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

      setSmartCouponDraft({
        code: result.code || 'AI_PROMO',
        discountPercent: result.discountPercent || 15,
        description: `✨ AI-Generated: ${result.description || 'Dynamic promo based on your goal.'}`,
        categoryScope: result.categoryScope || 'All',
        isActive: true,
        expiryDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0], // 3 days expiry
        imageUrl,
      });
    } catch (err) {
      console.error("Failed to generate smart coupon:", err);
      // Fallback
      setSmartCouponDraft({
        code: 'CAMPUS_ESCAPE_15',
        discountPercent: 15,
        description: '✨ AI-Generated: Dynamic escape deal to drive order queues!',
        categoryScope: 'All',
        isActive: true,
        expiryDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
        imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent("A premium sizzling chocolate lava waffle desert, food photography style, dark background, warm lighting")}?width=512&height=512&model=flux&nologo=true&seed=99`
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptSmartCoupon = async () => {
    if (!smartCouponDraft) return;
    try {
      await saveOffer(smartCouponDraft);
      setOffers([...offers, smartCouponDraft]);
      setSmartCouponDraft(null);
      setSmartGoal('');
    } catch (err) {
      console.error("Failed to accept smart coupon:", err);
      alert("Failed to save smart coupon.");
    }
  };

  const toggleCoupon = async (itemCode: string) => {
    const target = offers.find(o => o.code === itemCode);
    if (!target) return;
    const updated = { ...target, isActive: !target.isActive };
    try {
      await saveOffer(updated);
      setOffers(offers.map(o => o.code === itemCode ? updated : o));
    } catch (err) {
      console.error("Failed to toggle coupon status:", err);
    }
  };

  const deleteCoupon = async (itemCode: string) => {
    try {
      await deleteOffer(itemCode);
      setOffers(offers.filter(o => o.code !== itemCode));
    } catch (err) {
      console.error("Failed to delete coupon:", err);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[#f7dec4]">
      {/* Coupons Registry List */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h2 className="font-serif italic text-2xl text-white">Offers & Promotions Manager</h2>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Campaign Thresholds and Coupon Scope</p>
            </div>
            <span className="bg-[#302117]/50 text-[#f8bc51] px-3 py-1.5 rounded-full border border-[#302117] font-mono text-[10px] flex items-center gap-1">
              <Percent size={12} />
              {offers.length} Promo Codes Active
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="text-center py-6 text-[#d4c4b0]/40 font-mono text-xs animate-pulse">Loading active campaigns...</div>
            ) : offers.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#302117] rounded-2xl text-[#d4c4b0]/40 font-mono text-xs">No active campaign offers. Use the forms to create one!</div>
            ) : (
              offers.map((offer) => (
                <div
                  key={offer.code}
                  className={`bg-[#070402]/30 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${offer.isActive ? 'border-[#302117]' : 'border-[#302117]/40 opacity-60'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-0.5 rounded-xl border w-12 h-12 flex-shrink-0 flex items-center justify-center overflow-hidden ${offer.isActive ? 'bg-[#f8bc51]/10 border-[#f8bc51]/20 text-[#f8bc51]' : 'bg-[#302117]/30 border-[#302117]/60 text-[#d4c4b0]/40'}`}>
                      {offer.imageUrl ? (
                        <img src={offer.imageUrl} alt={offer.code} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Tag size={16} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-mono text-sm text-white font-bold leading-tight flex items-center gap-2">
                        {offer.code}
                        <span className="bg-[#302117] text-[#f8bc51] border border-[#302117] px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider font-bold">
                          {offer.discountPercent}% Off
                        </span>
                      </h4>
                      <p className="text-xs text-[#d4c4b0]/70 mt-1.5">{offer.description}</p>
                      <div className="flex items-center gap-2.5 font-mono text-[9px] text-[#d4c4b0]/40 uppercase mt-1">
                        <span>Scope: {offer.categoryScope}</span>
                        <span>&bull;</span>
                        <span>Expires: {offer.expiryDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3.5 border-t sm:border-t-0 border-[#302117]/30 pt-3 sm:pt-0">
                    <button
                      onClick={() => toggleCoupon(offer.code)}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[10px] uppercase tracking-wider font-bold border transition-colors ${
                        offer.isActive
                          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/25'
                          : 'bg-[#e8621a]/15 text-[#e8621a] border-[#e8621a]/30 hover:bg-[#e8621a]/25'
                      }`}
                    >
                      {offer.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteCoupon(offer.code)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Column - AI Smart Promo Generator & Normal Create Form */}
      <div className="flex flex-col gap-6">
        {/* AI Promo Generator */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-20%] w-32 h-32 bg-[#f8bc51]/5 rounded-full filter blur-xl" />

          <div className="flex items-center justify-between border-b border-[#302117]/60 pb-2">
            <h3 className="font-serif italic text-lg text-white">AI Smart Promo Generator</h3>
            <Sparkles size={14} className="text-[#f8bc51]" />
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Describe business goal</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Too much waffle stock, create a deal to clear it."
                value={smartGoal}
                onChange={(e) => setSmartGoal(e.target.value)}
                className="flex-1 bg-[#070402] border border-[#302117] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
              />
              <button
                onClick={handleGenerateSmartCoupon}
                disabled={generating || !smartGoal}
                className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-4 rounded-xl font-mono text-xs uppercase font-bold transition-all"
              >
                {generating ? <RefreshCw size={12} className="animate-spin" /> : 'Formulate'}
              </button>
            </div>

            <AnimatePresence>
              {smartCouponDraft && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#f8bc51]/5 border border-[#f8bc51]/20 rounded-2xl p-4 mt-2 flex flex-col gap-3.5"
                >
                  <span className="font-mono text-[9px] text-[#f8bc51] font-bold uppercase tracking-wider">AI Generated Campaign Draft:</span>
                  
                  {smartCouponDraft.imageUrl && (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-[#f8bc51]/20 bg-[#070402]">
                      <img 
                        src={smartCouponDraft.imageUrl} 
                        alt="Promo Banner" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                        <span className="bg-[#f8bc51] text-[#0A0604] px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider">
                          {smartCouponDraft.discountPercent}% OFF
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="font-mono text-xs text-white">
                    <p className="font-bold text-[#f8bc51] text-sm">{smartCouponDraft.code}</p>
                    <p className="text-[10px] text-[#d4c4b0] mt-1">{smartCouponDraft.description}</p>
                    <p className="text-[9px] text-[#d4c4b0]/50 mt-1">Discount: {smartCouponDraft.discountPercent}% | Target: {smartCouponDraft.categoryScope}</p>
                  </div>

                  <button
                    onClick={handleAcceptSmartCoupon}
                    className="w-full bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] rounded-xl py-2.5 font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle size={12} />
                    Approve and Deploy Coupon
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Normal Promo Creator Form */}
        <form
          onSubmit={handleCreateCoupon}
          className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4"
        >
          <h3 className="font-serif italic text-lg text-white border-b border-[#302117]/60 pb-2">Manual Campaign Builder</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Promo Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. COFFEE_BUZZ"
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Discount % *</label>
              <input
                type="number"
                required
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="Percentage"
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Category Scope</label>
              <select
                value={categoryScope}
                onChange={(e) => setCategoryScope(e.target.value)}
                className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-mono"
              >
                <option value="All">All Items Scope</option>
                <option value="Biryani">Biryani</option>
                <option value="Momos">Momos</option>
                <option value="Burgers">Burgers</option>
                <option value="Waffles">Waffles</option>
                <option value="Snacks">Snacks</option>
                <option value="Beverages">Beverages</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Campaign Expiration</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Campaign Tagline</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Double points and free delivery"
              className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 mt-2"
          >
            <Plus size={14} />
            Create Campaign
          </button>
        </form>
      </div>
    </div>
  );
}
