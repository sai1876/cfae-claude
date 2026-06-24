'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { MenuItem, SliderItem, UIConfig } from '@/lib/types';
import { mockMenuItems } from '@/lib/mockData';
import { ArrowRight, Star } from 'lucide-react';
import './PremiumSaladHero.css';

// Default static items matching the Stitch mockup
const DEFAULT_SALAD_SLIDES: SliderItem[] = [
  {
    id: 'salad_beef_burger',
    menuItemId: 'salad_beef_burger',
    tag: 'GOURMET BURGER',
    line1: 'Gourmet',
    line2: 'Beef Burger',
    desc: 'Experience the ultimate beef burger with melted cheddar, fresh lettuce, and vine-ripened tomatoes on a toasted brioche bun.',
    price: 18.00,
    time: 8,
    image_url: '/images/gourmet_beef_burger_data.png',
    accentColor: '#006e2f',
    bgColor: 'radial-gradient(circle at center, #006e2f 0%, #002109 100%)',
    ingredients: ['Cheddar Cheese', 'Fresh Lettuce', 'Tomato', 'Pickle'],
    sort_order: 1
  },
  {
    id: 'salad_chicken_burger',
    menuItemId: 'salad_chicken_burger',
    tag: 'CRISPY CHICKEN',
    line1: 'Crispy',
    line2: 'Chicken Burger',
    desc: 'Golden, extra-crunchy chicken breast paired with zesty slaw and house-made pickles for the perfect kick in every bite.',
    price: 16.50,
    time: 8,
    image_url: '/images/crispy_chicken_burger.png',
    accentColor: '#28c38a',
    bgColor: 'radial-gradient(circle at center, #006c49 0%, #002113 100%)',
    ingredients: ['Crispy Chicken', 'Zesty Slaw', 'Pickles'],
    sort_order: 2
  },
  {
    id: 'salad_grain_bowl',
    menuItemId: 'salad_grain_bowl',
    tag: 'PREMIUM BOWL',
    line1: 'Premium',
    line2: 'Grain Bowl',
    desc: 'A vibrant, protein-packed bowl featuring roasted seasonal vegetables, chickpeas, and fresh avocado over a bed of fluffy quinoa.',
    price: 22.00,
    time: 8,
    image_url: '/images/premium_grain_bowl.png',
    accentColor: '#006e2f',
    bgColor: 'radial-gradient(circle at center, #006e2f 0%, #002109 100%)',
    ingredients: ['Quinoa', 'Roasted Veggies', 'Avocado', 'Chickpeas'],
    sort_order: 3
  }
];

interface PremiumSaladHeroProps {
  sliderItems?: SliderItem[];
  uiConfig?: UIConfig | null;
  onCustomizeItem?: (item: MenuItem) => void;
}

export default function PremiumSaladHero({ sliderItems = [], uiConfig, onCustomizeItem }: PremiumSaladHeroProps) {
  const { addToCart } = useStore();
  
  // Choose source of slides: database slider items, or default premium salad items if database is empty/uncostumized
  const activeSlides = sliderItems.length > 0 
    ? sliderItems 
    : DEFAULT_SALAD_SLIDES;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animState, setAnimState] = useState<'normal' | 'out' | 'start'>('normal');
  const [toast, setToast] = useState<string | null>(null);

  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);
  const heroMainRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  // Sync index if activeSlides changes and current index is out of bounds
  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(0);
    }
  }, [activeSlides, currentIndex]);

  const activeItem = activeSlides[currentIndex] || DEFAULT_SALAD_SLIDES[0];

  // Resolve custom editor settings for Premium Salad
  const settings = uiConfig?.premium_salad_settings;
  const backgroundGradient = settings?.background_gradient || 'radial-gradient(circle at 20% 10%, rgba(217, 230, 221, 0.55) 0%, rgba(25, 41, 30, 0.2) 50%, transparent 100%)';
  const spriteImage = settings?.ingredients_sprite_url || '/images/ingredients_sprite.png';
  const item1Name = settings?.item1_name || 'Cheddar Cheese';
  const item2Name = settings?.item2_name || 'Lettuce';
  const item3Name = settings?.item3_name || 'Tomato';
  const item4Name = settings?.item4_name || 'Pickle';

  const switchSlideToIndex = (index: number) => {
    if (index === currentIndex || isAnimating) return;
    setIsAnimating(true);
    setAnimState('out');

    // Trigger state changes after fade/out transition completes (600ms)
    setTimeout(() => {
      setCurrentIndex(index);
      setAnimState('start');
      
      // Reset to normal animated state in the next frame
      setTimeout(() => {
        setAnimState('normal');
        
        // Lock animations for standard timeout (1.2s total transition ease-in-out)
        setTimeout(() => {
          setIsAnimating(false);
        }, 1200);
      }, 50);
    }, 600);
  };

  // Start auto scroll timer
  useEffect(() => {
    const isAutoScroll = uiConfig?.auto_scroll_enabled ?? true;
    const intervalTime = uiConfig?.auto_scroll_interval ?? 8000;

    if (isAutoScroll && activeSlides.length > 1) {
      autoScrollTimer.current = setInterval(() => {
        if (!isAnimating) {
          const nextIndex = (currentIndex + 1) % activeSlides.length;
          switchSlideToIndex(nextIndex);
        }
      }, intervalTime);
    }

    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [currentIndex, isAnimating, activeSlides.length, uiConfig]);

  // Touch & Scroll navigation listeners
  useEffect(() => {
    const heroMain = heroMainRef.current;
    if (!heroMain) return;

    let scrollDebounce: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      if (isAnimating) return;
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => {
        if (Math.abs(e.deltaY) > 30) {
          const dir = e.deltaY > 0 ? 1 : -1;
          const nextIndex = (currentIndex + dir + activeSlides.length) % activeSlides.length;
          switchSlideToIndex(nextIndex);
        }
      }, 100);
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isAnimating) return;
      const touchEndX = e.changedTouches[0].screenX;
      const diffX = touchStartX.current - touchEndX;
      const threshold = 50;
      if (Math.abs(diffX) > threshold) {
        const dir = diffX > 0 ? 1 : -1;
        const nextIndex = (currentIndex + dir + activeSlides.length) % activeSlides.length;
        switchSlideToIndex(nextIndex);
      }
    };

    heroMain.addEventListener('wheel', handleWheel, { passive: true });
    heroMain.addEventListener('touchstart', handleTouchStart, { passive: true });
    heroMain.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      heroMain.removeEventListener('wheel', handleWheel);
      heroMain.removeEventListener('touchstart', handleTouchStart);
      heroMain.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentIndex, isAnimating, activeSlides.length]);

  const handleOrderNowClick = () => {
    if (onCustomizeItem) {
      // Look up in database menu items
      const targetItemId = activeItem.menuItemId;
      const databaseItem = mockMenuItems.find(m => m.item_id === targetItemId);
      if (databaseItem) {
        onCustomizeItem({ ...databaseItem, price: activeItem.price });
      } else {
        // Direct addition fallback
        addToCart({
          menuItemId: activeItem.menuItemId || activeItem.id,
          name: `${activeItem.line1} ${activeItem.line2}`.trim(),
          price: activeItem.price,
          quantity: 1,
          station: 'GRILLED OR STEAMED'
        });
        showLocalToast(`Added ${activeItem.line1} to Cart!`);
      }
    } else {
      addToCart({
        menuItemId: activeItem.menuItemId || activeItem.id,
        name: `${activeItem.line1} ${activeItem.line2}`.trim(),
        price: activeItem.price,
        quantity: 1,
        station: 'GRILLED OR STEAMED'
      });
      showLocalToast(`Added ${activeItem.line1} to Cart!`);
    }
  };

  const showLocalToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Setup animated class helpers
  const getBowlClass = () => {
    if (animState === 'out') return 'salad-bowl-anim-out';
    if (animState === 'start') return 'salad-bowl-anim-start';
    return 'salad-bowl-anim';
  };

  const getTextClass = () => {
    if (animState === 'out') return 'salad-text-transition-out';
    if (animState === 'start') return 'salad-text-transition-start';
    return 'salad-text-transition';
  };

  return (
    <div 
      ref={heroMainRef}
      className="relative flex-grow flex items-center justify-center pb-20 pt-8 md:py-20 overflow-hidden w-full select-none"
      style={{ minHeight: 'calc(100svh - 64px)' }}
    >
      {/* Background shape gradient */}
      <div 
        className="absolute top-0 right-0 w-[150%] md:w-[60%] h-full bg-[#d9e6dd]/15 rounded-l-[100px] -z-10 translate-x-1/4 md:translate-x-0 hidden md:block transition-all duration-1000"
        style={{ background: backgroundGradient }}
      />

      {/* Floating Leafs */}
      <div className="absolute top-[10%] left-[5%] text-[#006e2f]/20 salad-float-leaf-1 z-0 w-8 h-8 pointer-events-none">
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8.16 20C14 20 18 16 18 10C18 9.32 17.93 8.65 17.78 8H17ZM16 10C16 14.42 12.87 18 8.16 18C7.6 18 7.07 17.9 6.56 17.74L11.75 4.54C14.16 5.34 16 7.45 16 10Z"></path></svg>
      </div>
      <div className="absolute bottom-[20%] left-[15%] text-[#28c38a]/15 salad-float-leaf-3 z-0 w-12 h-12 pointer-events-none">
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8.16 20C14 20 18 16 18 10C18 9.32 17.93 8.65 17.78 8H17Z"></path></svg>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center w-full relative z-10">
        
        {/* Mobile View Spotlight Image */}
        <div className="md:hidden relative w-full aspect-square max-w-[340px] mx-auto flex items-center justify-center my-4">
          <div className="absolute inset-0 bg-[#22c55e]/10 rounded-full scale-90" />
          <img 
            alt={activeItem.line1} 
            className={`w-[85%] h-[85%] object-cover rounded-full z-20 relative ${getBowlClass()}`} 
            src={activeItem.image_url} 
            style={{ filter: 'drop-shadow(rgba(0, 0, 0, 0.12) 0px 20px 20px)' }}
          />
          <div className={`absolute bottom-[10%] left-[5%] z-30 inline-flex items-center bg-[#22c55e] text-white font-bold text-lg px-5 py-2 rounded-xl shadow-lg ${getTextClass()}`}>
            ₹{activeItem.price}
          </div>
        </div>

        {/* Text Details Panel */}
        <div className="flex flex-col gap-6 items-center md:items-start text-center md:text-left order-2 md:order-1">
          <h1 className={`text-4xl md:text-5xl font-black text-[#121c2a] leading-tight ${getTextClass()}`}>
            {activeItem.line1} <br className="hidden md:block" /> {activeItem.line2}
          </h1>

          {/* Interactive slide selectors */}
          <div className="flex items-center justify-center md:justify-start gap-3 my-2 z-30">
            {activeSlides.map((slide, idx) => (
              <button 
                key={slide.id} 
                aria-label={`Switch to ${slide.line1}`} 
                onClick={() => switchSlideToIndex(idx)}
                className={`w-14 h-14 rounded-full border-2 overflow-hidden hover:scale-105 transition-all duration-300 shadow-sm cursor-pointer border-transparent ${
                  currentIndex === idx ? 'border-[#006e2f] scale-105 shadow-md' : 'hover:border-[#006e2f]/50'
                }`}
              >
                <img alt={slide.line1} className="w-full h-full object-cover pointer-events-none" src={slide.image_url} />
              </button>
            ))}
          </div>

          <p className={`text-base text-[#3d4a3d] max-w-md ${getTextClass()}`}>
            {activeItem.desc}
          </p>

          <div className="w-full max-w-xs mt-2 z-30">
            <button 
              onClick={handleOrderNowClick}
              className="w-full bg-[#006e2f] hover:bg-[#005321] text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-98 salad-shimmer-btn transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              Order Now for ₹{activeItem.price}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Desktop Presentation Pane */}
        <div className="hidden md:flex relative w-full h-[520px] items-center justify-center order-1 md:order-2">
          <div className="absolute inset-0 bg-[#22c55e]/5 rounded-full scale-[0.85] z-0" />
          
          {/* Orbiting ring */}
          <div className="absolute inset-0 scale-[0.95] salad-orbit-path z-10 flex items-center justify-center pointer-events-none">
            {/* Top Ingredient: Cheese */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-lg salad-orbit-item overflow-hidden border-2 border-white pointer-events-auto group">
              <img alt={item1Name} className="salad-quadrant-image salad-quad-tl" src={spriteImage} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[7px] text-white font-bold text-center px-0.5 leading-tight">{item1Name}</span>
              </div>
            </div>
            {/* Right Ingredient: Lettuce */}
            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-lg salad-orbit-item overflow-hidden border-2 border-white pointer-events-auto group">
              <img alt={item2Name} className="salad-quadrant-image salad-quad-tr" src={spriteImage} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[7px] text-white font-bold text-center px-0.5 leading-tight">{item2Name}</span>
              </div>
            </div>
            {/* Bottom Ingredient: Tomato */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-lg salad-orbit-item overflow-hidden border-2 border-white pointer-events-auto group">
              <img alt={item3Name} className="salad-quadrant-image salad-quad-bl" src={spriteImage} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[7px] text-white font-bold text-center px-0.5 leading-tight">{item3Name}</span>
              </div>
            </div>
            {/* Left Ingredient: Pickle */}
            <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-lg salad-orbit-item overflow-hidden border-2 border-white pointer-events-auto group">
              <img alt={item4Name} className="salad-quadrant-image salad-quad-br" src={spriteImage} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[7px] text-white font-bold text-center px-0.5 leading-tight">{item4Name}</span>
              </div>
            </div>
          </div>

          {/* Main transparent product image */}
          <img 
            alt={activeItem.line1} 
            className={`w-[72%] h-[72%] object-contain rounded-full z-20 relative ${getBowlClass()}`} 
            src={activeItem.image_url} 
            style={{ filter: 'drop-shadow(rgba(0, 0, 0, 0.15) 0px 25px 25px)' }}
          />

          {/* Floating Price Badge */}
          <div className={`absolute left-[5%] z-30 inline-flex items-center bg-[#22c55e] text-white font-black text-xl px-6 py-2.5 rounded-xl shadow-lg bottom-[10%] ${getTextClass()}`}>
            ₹{activeItem.price}
          </div>

          {/* Floating Review Badge */}
          <div className="absolute bottom-[20%] right-[10%] z-30 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-md border border-[#bccbb9]/20 animate-pulse">
            <div className="flex items-center gap-1 text-[#55615a] text-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold">4.9</span>
            </div>
          </div>
        </div>

      </div>

      {/* Local Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#121c2a] text-white text-xs px-4 py-2.5 rounded-full shadow-lg border border-white/10 z-50 animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
