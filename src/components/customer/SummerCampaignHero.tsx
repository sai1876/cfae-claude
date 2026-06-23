'use client';
import Image from 'next/image';
import { useStore } from '@/store/useStore';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, MessageSquare, Compass, BookOpen, User, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { streamUIConfig } from '@/lib/dbService';
import { UIConfig, MenuItem } from '@/lib/types';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import './SummerCampaignHero.css';

const LogoSprout = () => (
  <svg className="w-5 h-5 text-emerald-700 animate-pulse absolute -top-4 left-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12" />
    <path d="M12 12C12 9.5 9.5 7 7 7" />
    <path d="M12 14C12 11.5 14.5 9 17 9" />
    <path d="M12 12c2.5 0 5 2.5 5 5" />
    <path d="M12 14c-2.5 0-5 2.5-5 5" />
  </svg>
);

export default function SummerCampaignHero() {
  const setActiveCategory = useStore(state => state.setActiveCategory);
  const addToCart = useStore(state => state.addToCart);
  const [uiConfig, setUiConfig] = useState<UIConfig | null>(null);
  const [dbMenuItems, setDbMenuItems] = useState<MenuItem[]>([]);
  const [isMenuLoaded, setIsMenuLoaded] = useState(false);
  
  useEffect(() => {
    const unsubscribe = streamUIConfig(config => {
      setUiConfig(config);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = query(collection(db, 'menu'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbItems: MenuItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.deleted) {
          dbItems.push(data as MenuItem);
        }
      });
      setDbMenuItems(dbItems);
      setIsMenuLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const settings = uiConfig?.summer_campaign_settings;

  // App States
  const [activeSipIndex, setActiveSipIndex] = useState(1);
  const [activeCategory, setLocalActiveCategory] = useState('Refreshers');
  const [mistActive, setMistActive] = useState(true);
  const [mistPuffs, setMistPuffs] = useState<any[]>([]);
  const [iceHealth, setIceHealth] = useState(5);
  const [gameWon, setGameWon] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  const sipsProducts = settings?.drinks && settings.drinks.length > 0 ? settings.drinks : [
    {
      id: 'sip1',
      title: 'Chocolate Milkshake',
      price: 110,
      originalPrice: 150,
      tag: 'Classic Sweet',
      desc: 'Smooth vanilla and rich chocolate blended with thick ice cream.',
      imageUrl: '/milkshake.png',
      imageScale: 1.0,
      menuItemId: 'sip1'
    },
    {
      id: 'sip2',
      title: 'Mint Limeade',
      price: 60,
      originalPrice: 90,
      tag: 'Freshly Spritzed',
      desc: 'Muddled fresh organic garden mint, sweet citrus lime juice, and sparkling soda.',
      imageUrl: '/mojito.png',
      imageScale: 1.0,
      blendMode: 'screen',
      menuItemId: 'sip2'
    },
    {
      id: 'sip3',
      title: 'Mango Thickshake',
      price: 90,
      originalPrice: 120,
      tag: 'Alfonso Delight',
      desc: 'Rich, thick organic yogurt blended with sweet hand-picked Alfonso mango puree.',
      imageUrl: '/thickshake.png',
      imageScale: 1.0,
      menuItemId: 'sip3'
    }
  ];

  const categories = settings?.categories && settings.categories.length > 0 ? settings.categories : [
    { id: 'Refreshers', title: 'Refreshers', iconType: 'emoji', iconValue: '🍹', imageScale: 1.0, redirectCategory: 'Beverages' },
    { id: 'Cool Bites', title: 'Cool Bites', iconType: 'emoji', iconValue: '🌯', imageScale: 1.0, redirectCategory: 'Snacks' },
    { id: 'Ice-Creams', title: 'Ice-Creams', iconType: 'emoji', iconValue: '🍦', imageScale: 1.0, redirectCategory: 'Desserts' },
    { id: 'Meal Bundles', title: 'Meal Bundles', iconType: 'emoji', iconValue: '🍱', imageScale: 1.0, redirectCategory: 'Meals' }
  ];

  const displayedSips = sipsProducts.filter(sip => {
    const activeMenuSource = isMenuLoaded ? dbMenuItems : [];
    return activeMenuSource.some(m => m.item_id === (sip.menuItemId || sip.id));
  });

  // Make sure we have a valid index if the admin removes an item
  const validIndex = activeSipIndex >= displayedSips.length ? 0 : activeSipIndex;
  const activeSipItem = displayedSips[validIndex];

  // Mist effect
  useEffect(() => {
    const newPuffs = Array.from({ length: 12 }).map((_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      scale: 0.6 + Math.random() * 1.6,
      duration: 2.5 + Math.random() * 2.5
    }));
    setMistPuffs(newPuffs);
  }, []);

  const handleCatClick = (cat: any) => {
    setLocalActiveCategory(cat.id);
    setActiveCategory(cat.redirectCategory);
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
  };

  const triggerAddToCart = () => {
    addToCart({
      menuItemId: activeSipItem.menuItemId || activeSipItem.id,
      name: activeSipItem.title,
      price: activeSipItem.price,
      quantity: 1,
      station: 'GRILLED OR STEAMED'
    });
    setToast({ message: `Added ${activeSipItem.title} to your cart! 🍹`, type: 'success' });
  };

  const handleIceTap = () => {
    if (gameWon) return;
    setIceHealth(prev => {
      const next = prev - 1;
      if (next <= 0) {
        setGameWon(true);
        return 0;
      }
      return next;
    });
  };

  const bgGradient = settings?.background_gradient || 'radial-gradient(circle at 20% 10%, rgba(255,243,186,0.55) 0%, rgba(253,186,116,0.2) 50%, transparent 100%)';
  const heroTitle = settings?.hero_title || 'Summer Chill Zone.';
  const heroSubtitle = settings?.hero_subtitle || 'Crispy Golden Fries + Refreshing Cold Drinks = Perfect Summer.';

  if (!activeSipItem) {
    return null;
  }

  return (
    <div className="relative flex-1 w-full h-full flex flex-col text-stone-100 font-sans pb-24">
      
      {/* Absolute top glowing ambient light & Sunrays */}
      <div className="absolute -top-32 left-0 right-0 h-[500px] pointer-events-none z-10" style={{ background: bgGradient }} />
      
      {/* Dynamic Mist Particles */}
      {mistActive && (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
          {mistPuffs.map(puff => (
            <div 
              key={puff.id}
              className="absolute bg-gradient-to-tr from-orange-200/10 via-cyan-100/5 to-transparent rounded-full filter blur-xl animate-pulse"
              style={{
                left: `${puff.left}%`,
                bottom: `-15%`,
                width: `${puff.scale * 120}px`,
                height: `${puff.scale * 120}px`,
                animation: `floatUp ${puff.duration}s ease-out forwards`,
                animationDelay: `${puff.delay}s`
              }}
            />
          ))}
        </div>
      )}

      {/* SCROLL CONTAINER */}
      <div className="flex-1 overflow-y-auto px-4 pb-12 space-y-4 custom-scrollbar z-20 pt-8">

        {/* BEAT THE HEAT HERO TYPOGRAPHY */}
        <div className="text-center py-2 space-y-1">
          <span className="text-[10px] font-black tracking-widest text-[#5c3008] uppercase bg-amber-200/40 px-2 py-0.5 rounded-md inline-block">
            ☀️ Beat the heat!
          </span>
          <h2 className="text-3xl font-serif italic font-black text-[#ffffff] drop-shadow-md tracking-tight">
            {heroTitle}
          </h2>
          <p className="text-[11px] text-orange-100/90 font-medium max-w-[280px] mx-auto leading-tight">
            {heroSubtitle}
          </p>
        </div>

        {/* MAIN SPOTLIGHT: SUMMER SIPS COLLECTION */}
        <section className="bg-gradient-to-b from-white/10 to-black/30 backdrop-blur-md border border-white/10 rounded-[28px] p-4 shadow-xl relative overflow-hidden">
          
          <h3 className="text-center font-serif italic text-lg text-white font-extrabold tracking-wide mb-3">
            Summer Sips Collection
          </h3>

          <div className="grid grid-cols-3 gap-2 items-end justify-center py-2 relative">
            
            {displayedSips.map((sip, idx) => {
              const isActive = validIndex === idx;
              return (
                <div 
                  key={sip.id}
                  onClick={() => setActiveSipIndex(idx)}
                  className={`flex flex-col items-center p-2 rounded-2xl cursor-pointer transition-all relative ${
                    isActive ? 'bg-white/15 border border-amber-300/30 scale-105 shadow-lg shadow-amber-500/10' : 'hover:scale-100'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping opacity-75 z-10" />
                  )}
                  
                  {/* HUGE IMAGE CONTAINER: w-full h-36 instead of w-16 h-28 */}
                  <div className="relative w-full h-36 flex items-center justify-center transition duration-300 pointer-events-none">
                    {/* MIX-BLEND-MODE APPLIED DIRECTLY TO IMAGE + CONDITIONAL OPACITY */}
                    <Image 
                      src={sip.imageUrl} 
                      alt={sip.title} 
                      fill 
                      className="object-contain"
                      style={{ 
                        mixBlendMode: (sip.blendMode as any) || 'normal',
                        opacity: isActive ? 1 : 0.45,
                        transform: `scale(${sip.imageScale || 1.0})`,
                        transition: 'opacity 0.3s, transform 0.3s'
                      }} 
                      sizes="33vw" 
                      priority 
                    />
                  </div>
                  
                  <span className={`backdrop-blur-md text-[9px] font-bold px-2 py-1 rounded-full border mt-2 truncate w-full text-center z-10 relative ${
                    isActive ? 'bg-stone-950/90 text-amber-300 border-amber-400/30' : 'bg-stone-950/80 text-stone-200 border-white/10 opacity-70'
                  }`}>
                    {sip.title}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 text-center space-y-1">
            <span className="text-[9px] font-bold text-amber-300 tracking-widest uppercase bg-black/30 px-2 py-0.5 rounded-md inline-block">
              {activeSipItem?.tag}
            </span>
            <p className="text-xs text-orange-50 font-medium px-4">
              {activeSipItem?.desc}
            </p>
          </div>
        </section>

        {/* ACTIVE PRODUCT TITLE AND PRICE */}
        <div className="text-center py-2">
          <p className="text-xs text-amber-200/90 font-bold font-serif italic">
            Crispy golden fries with our signature seasoning.
          </p>
        </div>

        {/* PRICING AND ACTION ROW */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-inner mb-8 mt-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Spotlight Deal</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-amber-300">₹{activeSipItem?.price}</span>
              <span className="text-xs text-stone-500 line-through">₹{activeSipItem?.originalPrice}</span>
            </div>
          </div>

          <button 
            onClick={triggerAddToCart}
            className="bg-white hover:bg-amber-100 text-[#451a03] font-black text-xs px-6 py-3 rounded-xl tracking-wider uppercase active:scale-95 transition-all shadow-md shadow-white/5"
          >
            Add To Cart
          </button>
        </section>

        {/* ACTIVE CATEGORY SELECTOR SYSTEM */}
        <section className="space-y-2">
          <span className="text-[10px] font-black tracking-wider text-amber-300 uppercase block">
            Explore Summer Menus
          </span>
          
          <div className="grid grid-cols-4 gap-2">
            {categories.map((cat) => (
              <div 
                key={cat.id}
                onClick={() => handleCatClick(cat)}
                className={`p-2.5 rounded-2xl flex flex-col items-center justify-between h-24 cursor-pointer transition-all ${
                  activeCategory === cat.id 
                    ? 'bg-gradient-to-b from-[#fef08a] to-[#f59e0b] text-stone-950 shadow-md scale-105' 
                    : 'bg-[#451a03]/40 border border-white/5 text-stone-200'
                }`}
              >
                {cat.iconType === 'emoji' ? (
                  <span className="text-2xl" style={{ transform: `scale(${cat.imageScale || 1.0})` }}>
                    {cat.iconValue}
                  </span>
                ) : (
                  <div className="relative w-12 h-12 pointer-events-none">
                    <Image 
                      src={cat.iconValue} 
                      alt={cat.title} 
                      fill 
                      className="object-contain" 
                      style={{ 
                        mixBlendMode: (cat as any).blendMode || 'normal',
                        transform: `scale(${cat.imageScale || 1.0})` 
                      }}
                    />
                  </div>
                )}
                <span className="text-[9px] font-black text-center truncate w-full leading-tight">{cat.title}</span>
              </div>
            ))}
          </div>
        </section>

        {/* GAMIFIED ELEMENT: THE ICE FREEZER CHALLENGE */}
        <section className="bg-[#1e140d]/80 border border-cyan-500/15 rounded-2xl p-4 text-center space-y-2 mb-8 mt-4">
          <div className="flex justify-between items-center text-left">
            <h4 className="font-extrabold text-xs text-stone-100 uppercase tracking-wide">Glacier Crack Challenge</h4>
            <span className="bg-cyan-500/20 text-cyan-200 text-[8px] font-bold px-2 py-0.5 rounded-full">₹30 OFF Code</span>
          </div>
          <p className="text-[10px] text-stone-300">Shatter the iceberg block below to unlock premium coupons!</p>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center">
            {gameWon ? (
              <div className="space-y-1 animate-pulse py-2">
                <span className="text-4xl">💎</span>
                <p className="text-[10px] font-bold text-cyan-300">SHATTERED! COUPON:</p>
                <div className="bg-cyan-500/25 border border-cyan-500/40 px-3 py-1 rounded text-cyan-100 font-mono font-bold text-xs">
                  HAUSUMMER30
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleIceTap}>
                <span className="text-4xl transform hover:scale-110 active:scale-95 transition select-none">
                  {iceHealth >= 3 ? '🧊' : '❄️'}
                </span>
                <span className="text-[9px] font-mono text-cyan-300">Crack Progress: {iceHealth}/5 Hits</span>
              </div>
            )}
          </div>
        </section>

      </div>
      
      {/* SYSTEM ANIMATION INJECTOR */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.4;
          }
          85% {
            opacity: 0.15;
          }
          100% {
            transform: translateY(-550px) scale(1.4) rotate(360deg);
            opacity: 0;
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '16px',
              right: '16px',
              maxWidth: '420px',
              margin: '0 auto',
              zIndex: 100000,
              background: 'rgba(20, 16, 11, 0.92)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${
                toast.type === 'success'
                  ? 'rgba(16, 185, 129, 0.4)'
                  : toast.type === 'error'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'rgba(212, 163, 84, 0.4)'
              }`,
              borderRadius: '16px',
              padding: '14px 18px',
              boxShadow: `0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px ${
                toast.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : toast.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(212, 163, 84, 0.15)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {toast.type === 'success' && <CheckCircle2 size={22} color="#10b981" />}
              {toast.type === 'error' && <AlertCircle size={22} color="#ef4444" />}
              {toast.type === 'info' && <Info size={22} color="#d4a354" />}
            </div>
            <div style={{ flex: 1, color: '#fff', fontSize: '13.5px', fontWeight: 500, lineHeight: 1.4 }}>
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


