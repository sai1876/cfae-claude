'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { mockMenuItems } from '@/lib/mockData';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchOutlets, streamSliderItems, streamUIConfig, streamCalendarEvents } from '@/lib/dbService';
import AuthModal from './AuthModal';
import CustomizationModal from './CustomizationModal';
import SummerCampaignHero from './SummerCampaignHero';
import { MenuItem, Outlet, UIConfig, SliderItem, GridCard } from '@/lib/types';
import { getCalendarEventConfig, DynamicCalendarEvent } from '@/lib/calendarEvents';
import './DynamicSliderHero.css';

const items = [
  {
    id: 'summer_bundle',
    menuItemId: 'summer_bundle',
    tag: 'SUMMER BUNDLE',
    line1: 'Summer Sips',
    line2: 'Collection',
    desc: 'Crispy golden fries with our signature seasoning.', // Keeping to match mockup precisely
    price: 60,
    time: 5,
    theme: 'scorching',
    image_url: '', // Custom rendered
    accentColor: '#FFB703',
    bgColor: 'transparent',
    emoji: '🍹',
    ingredients: []
  },
  {
    id: 's1',
    menuItemId: 'm3',
    tag: 'SUMMER SPECIAL',
    line1: 'Thick',
    line2: 'Shake',
    desc: 'Rich, creamy thickshake topped with premium ingredients. The perfect summer cooler.',
    emoji: '🥤',
    price: 150,
    time: 5,
    theme: 'scorching',
    bgColor: 'radial-gradient(circle at center, #F4A261 0%, #E76F51 100%)',
    image_url: '/thickshake.png',
    ingredients: ['Real Milk', 'Rich Cream', 'Ice Chilled'],
    accentColor: '#F4A261',
  },
  {
    id: 's2',
    menuItemId: 'm2',
    tag: 'REFRESHING CHILL',
    line1: 'Mint',
    line2: 'Mojito',
    desc: 'Ice cold mint mojito with zesty lime and fresh mint leaves. The ultimate thirst quencher.',
    emoji: '🍹',
    price: 120,
    time: 4,
    theme: 'scorching',
    bgColor: 'radial-gradient(circle at center, #06D6A0 0%, #009688 100%)',
    image_url: '/mojito.png',
    ingredients: ['Fresh Mint', 'Zesty Lime', 'Crushed Ice'],
    accentColor: '#06D6A0',
  },
  {
    id: 's3',
    menuItemId: 'm4',
    tag: 'CLASSIC SWEET',
    line1: 'Classic',
    line2: 'Milkshake',
    desc: 'Smooth and classic milkshake blended to perfection with premium ice cream.',
    emoji: '🍦',
    price: 130,
    time: 5,
    theme: 'scorching',
    bgColor: 'radial-gradient(circle at center, #FF9F1C 0%, #D35400 100%)',
    image_url: '/milkshake.png',
    ingredients: ['Ice Cream', 'Fresh Milk', 'Sweet Syrup'],
    accentColor: '#FF9F1C',
  }
];

function ThemeDecorations({ theme, eventName }: { theme: string; eventName: string }) {
  if (theme === 'valentines') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Hanging rose petals / heart strings */}
        <div className="absolute left-2 top-0 flex flex-col items-center gap-1 opacity-70">
          <span className="text-[10px] animate-bounce" style={{ animationDelay: '0.1s' }}>💗</span>
          <span className="text-[9px]">❤️</span>
          <span className="text-[8px]">💖</span>
        </div>
        <div className="absolute right-2 top-0 flex flex-col items-center gap-1 opacity-70">
          <span className="text-[10px] animate-bounce" style={{ animationDelay: '0.4s' }}>💖</span>
          <span className="text-[9px]">❤️</span>
          <span className="text-[8px]">💗</span>
        </div>
        <div className="absolute inset-x-0 top-0 flex justify-between px-6 pt-1 text-[7px] opacity-40">
          <span>❤️</span><span>💖</span><span>💗</span><span>💖</span><span>❤️</span>
        </div>
      </div>
    );
  }

  if (theme === 'fest') {
    const isDiwali = eventName.toLowerCase().includes('diwali');
    if (isDiwali) {
      return (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {/* Diwali Marigold Hanging toran (marigold strings + bells) */}
          <div className="absolute left-[8px] top-0 flex flex-col items-center gap-0.5 opacity-85">
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟠</span>
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟡</span>
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟠</span>
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟡</span>
            <span className="text-[10px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] animate-pulse">🔔</span>
          </div>
          <div className="absolute right-[8px] top-0 flex flex-col items-center gap-0.5 opacity-85">
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟡</span>
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟠</span>
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟡</span>
            <span className="text-[8px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🟠</span>
            <span className="text-[10px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] animate-pulse">🔔</span>
          </div>
          <div className="absolute inset-x-0 top-0 flex justify-between px-6 pt-0.5 text-[7px] opacity-75">
            <span>🟠</span><span>🟡</span><span>🍃</span><span>🟡</span><span>🟠</span><span>🍃</span><span>🟠</span><span>🟡</span><span>🍃</span><span>🟡</span><span>🟠</span>
          </div>
        </div>
      );
    } else {
      // Christmas
      return (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {/* Christmas pine branch & bauble strings */}
          <div className="absolute left-2 top-0 flex flex-col items-center gap-1 opacity-80">
            <span className="text-[10px]">🎄</span>
            <span className="text-[8px]">🔴</span>
            <span className="text-[9px]">🔔</span>
          </div>
          <div className="absolute right-2 top-0 flex flex-col items-center gap-1 opacity-80">
            <span className="text-[10px]">🎄</span>
            <span className="text-[8px]">⚪</span>
            <span className="text-[9px]">🔔</span>
          </div>
          <div className="absolute inset-x-0 top-0 flex justify-between px-6 pt-1 text-[7px] opacity-60">
            <span>🌿</span><span>🔴</span><span>🔔</span><span>🎄</span><span>⚪</span><span>🔴</span>
          </div>
        </div>
      );
    }
  }

  if (theme === 'raining') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Monsoon rain clouds at top */}
        <div className="absolute left-3 top-0 flex flex-col items-center opacity-70">
          <span className="text-[11px] animate-pulse">🌧️</span>
          <span className="text-[7px]">💧</span>
        </div>
        <div className="absolute right-3 top-0 flex flex-col items-center opacity-70">
          <span className="text-[11px] animate-pulse">🌧️</span>
          <span className="text-[7px]">💧</span>
        </div>
        <div className="absolute inset-x-0 top-0 flex justify-between px-10 pt-1 text-[8px] opacity-55">
          <span>☁️</span><span>💧</span><span>☁️</span><span>💧</span><span>☁️</span>
        </div>
      </div>
    );
  }

  if (theme === 'night') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Halloween webs & bats */}
        <div className="absolute left-1 top-0 flex flex-col items-start opacity-75">
          <span className="text-[12px] leading-none">🕸️</span>
          <span className="text-[9px] translate-x-2 animate-bounce">🦇</span>
        </div>
        <div className="absolute right-1 top-0 flex flex-col items-end opacity-75">
          <span className="text-[12px] leading-none">🕸️</span>
          <span className="text-[9px] -translate-x-2 animate-pulse">🎃</span>
        </div>
      </div>
    );
  }

  if (theme === 'scorching') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Summer palm branches & sun */}
        <div className="absolute left-2 top-0 flex flex-col items-center opacity-70">
          <span className="text-[12px] animate-pulse">🌿</span>
          <span className="text-[8px]">🌴</span>
        </div>
        <div className="absolute right-2 top-0 flex flex-col items-center opacity-70">
          <span className="text-[12px] animate-pulse">☀️</span>
          <span className="text-[8px]">🍹</span>
        </div>
      </div>
    );
  }

  if (theme === 'exam') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Exam study logs */}
        <div className="absolute left-2 top-0 flex flex-col items-center opacity-70">
          <span className="text-[10px]">📚</span>
          <span className="text-[8px]">📝</span>
        </div>
        <div className="absolute right-2 top-0 flex flex-col items-center opacity-70">
          <span className="text-[10px]">☕</span>
          <span className="text-[8px]">📝</span>
        </div>
      </div>
    );
  }

  return null;
}

function ThemeParticles({ theme, customParticles, pCount = 15, pSize = 10, pSpeed = 10, pRot = 360 }: { theme: string; customParticles?: string; pCount?: number; pSize?: number; pSpeed?: number; pRot?: number; }) {
  const [particles, setParticles] = useState<{ id: number; char: string; size: number; left: number; delay: number; duration: number; rotation: number; }[]>([]);

  useEffect(() => {
    let char = '';
    let customChars: string[] = [];

    if (customParticles) {
      customChars = customParticles.split(',').map(s => s.trim()).filter(Boolean);
      char = 'custom';
    } else if (theme === 'valentines') {
      char = '💞 🌸';
    } else if (theme === 'raining') {
      char = '💧';
    } else if (theme === 'fest') {
      char = '✨';
    } else if (theme === 'night') {
      char = '🌌';
    } else if (theme === 'exam') {
      char = '📚';
    } else if (theme === 'scorching') {
      char = '☀️🍉';
    }

    if (!char || (char === 'custom' && customChars.length === 0)) {
      setParticles([]);
      return;
    }

    const list = Array.from({ length: pCount }).map((_, i) => ({
      id: i,
      char: char === 'custom' ? customChars[Math.floor(Math.random() * customChars.length)] :
            char === '✨' ? (Math.random() > 0.5 ? '✨' : '⭐') : 
            char === '🌌' ? (Math.random() > 0.6 ? '🌌' : Math.random() > 0.3 ? '🌠' : '💫') : 
            char === '☀️🍉' ? (Math.random() > 0.5 ? '☀️🍉' : '🍉☀️') : char,
      size: Math.random() * 14 + pSize,
      left: Math.random() * 90 + 5,
      delay: Math.random() * 5,
      duration: Math.random() * 6 + pSpeed,
      rotation: Math.random() > 0.5 ? pRot : -pRot,
    }));
    setParticles(list);
  }, [theme, customParticles, pCount, pSize, pSpeed, pRot]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-[-50px] select-none opacity-40 filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.15)]"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
          }}
          initial={{ y: 0, opacity: 0, scale: 0.3 }}
          animate={{
            y: 900,
            opacity: [0, 0.6, 0.6, 0],
            scale: [0.3, 1, 1, 0.6],
            rotate: [0, p.rotation],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        >
          {p.char}
        </motion.span>
      ))}
    </div>
  );
}

export default function DynamicSliderHero() {
  const { user, userProfile, cart, addToCart, activeOrders, customerOutlet, setCustomerOutlet, setActiveCategory } = useStore();
  
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [sliderItems, setSliderItems] = useState<SliderItem[]>(items as SliderItem[]);
  const [dbMenuItems, setDbMenuItems] = useState<MenuItem[]>([]);
  const [isMenuLoaded, setIsMenuLoaded] = useState(false);
  const [uiConfig, setUiConfig] = useState<UIConfig | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<DynamicCalendarEvent[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsubscribe = streamCalendarEvents((events) => {
      setCalendarEvents(events as DynamicCalendarEvent[]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchOutlets().then(setOutlets);
  }, []);

  // Load UIConfig in real-time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsubscribe = streamUIConfig((config) => {
      setUiConfig(config);
    });
    return () => unsubscribe();
  }, []);

  // Stream custom slider items from Firestore in real-time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsubscribe = streamSliderItems((dbSlides) => {
      if (dbSlides.length > 0) {
        setSliderItems(dbSlides);
      } else {
        // Fall back to default hardcoded slider items if collection is empty
        setSliderItems(items);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load all menu items to resolve cart items
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

  // Synchronize dynamic weather theme with store
  const setTheme = useStore(s => s.setTheme);
  useEffect(() => {
    if (uiConfig) {
      if (uiConfig.auto_calendar_mode) {
        const activeDate = uiConfig.mock_date ? new Date(uiConfig.mock_date) : new Date();
        const calendarConfig = getCalendarEventConfig(activeDate, calendarEvents);
        if (calendarConfig) {
          setTheme(calendarConfig.active_theme);
          return;
        }
      }
      if (uiConfig.active_theme) {
        setTheme(uiConfig.active_theme as any);
      }
    }
  }, [uiConfig, setTheme, calendarEvents]);

  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [changing, setChanging] = useState(false);

  // Filter slider items automatically by campaign occasion
  const displaySlides = (() => {
    const activeDate = uiConfig?.mock_date ? new Date(uiConfig.mock_date) : new Date();
    const calendarEvent = uiConfig?.auto_calendar_mode ? getCalendarEventConfig(activeDate, calendarEvents) : null;
    
    let slides = sliderItems;
    if (uiConfig?.auto_calendar_mode) {
      const activeDate = uiConfig.mock_date ? new Date(uiConfig.mock_date) : new Date();
      const calendarEvent = getCalendarEventConfig(activeDate, calendarEvents);
      if (calendarEvent?.featuredItemIds && calendarEvent.featuredItemIds.length > 0) {
        const filtered = sliderItems.filter(slide => 
          calendarEvent.featuredItemIds!.includes(slide.menuItemId)
        );
        if (filtered.length > 0) slides = filtered;
      }
    }

    const activeMenuSource = isMenuLoaded ? dbMenuItems : [];
    const filteredSlides = slides.filter(slide => 
      activeMenuSource.some(m => m.item_id === slide.menuItemId)
    );

    if (filteredSlides.length > 0) {
      return filteredSlides;
    }

    // Dynamic Fallback: If no slider items match any active menu items, dynamically generate slides
    return activeMenuSource.slice(0, 3).map((item, idx) => {
      const bgColors = [
        'radial-gradient(circle at center, #F4A261 0%, #E76F51 100%)',
        'radial-gradient(circle at center, #06D6A0 0%, #009688 100%)',
        'radial-gradient(circle at center, #FF9F1C 0%, #D35400 100%)'
      ];
      const nameParts = item.name.split(' ');
      return {
        id: `dyn_${item.item_id}`,
        menuItemId: item.item_id,
        tag: 'FEATURED ITEM',
        line1: nameParts.slice(0, 2).join(' '),
        line2: nameParts.slice(2).join(' ') || 'Special',
        desc: item.description,
        price: item.price,
        time: 8,
        theme: 'default',
        image_url: item.image_url || '',
        accentColor: idx === 0 ? '#F4A261' : idx === 1 ? '#06D6A0' : '#FF9F1C',
        bgColor: bgColors[idx % bgColors.length],
        emoji: item.category.toLowerCase().includes('bev') ? '🍹' : '🍽️',
        ingredients: []
      } as unknown as SliderItem;
    });
  })();

  // Constrain active index inside slider items boundaries (handles deletions in real-time)
  useEffect(() => {
    if (displaySlides.length > 0 && current >= displaySlides.length) {
      setCurrent(displaySlides.length - 1);
    }
  }, [displaySlides, current]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);

  // Zustand Store
  
  // Real-Time Queue Telemetry
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Listen to incomplete orders to calculate dynamic queue load
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'preparing'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveOrdersCount(snapshot.size);
    }, (error) => {
      console.warn("Telemetry listener offline, falling back to cached statistics:", error);
    });

    return () => unsubscribe();
  }, []);

  // Compute active campaign overrides
  const activeDate = uiConfig?.mock_date ? new Date(uiConfig.mock_date) : new Date();
  const calendarEvent = uiConfig?.auto_calendar_mode ? getCalendarEventConfig(activeDate, calendarEvents) : null;
  const effectiveTheme = calendarEvent ? calendarEvent.active_theme : (uiConfig?.active_theme || 'default');
  const effectiveHeadline = calendarEvent ? calendarEvent.hero_headline : (uiConfig?.hero_headline || 'Your escape from the heat.');
  const effectiveSubText = calendarEvent ? calendarEvent.hero_sub : (uiConfig?.hero_sub || 'Mist-cooling and chilled vibes.');
  const effectiveBannerActive = calendarEvent ? calendarEvent.banner_active : (uiConfig?.banner_active ?? true);
  const effectiveBannerText = calendarEvent ? calendarEvent.banner_text : (uiConfig?.banner_text || '');
  const effectiveBannerColor = calendarEvent ? calendarEvent.banner_color : (uiConfig?.banner_color || 'golden');

  // Compute wait delays based on queue busy metrics
  const activeItem = displaySlides[current] || displaySlides[0];
  const queueDelay = activeOrdersCount <= 2 ? 0 : activeOrdersCount <= 5 ? 2 : 4;
  
  const baseWait = uiConfig ? uiConfig.pickup_time_mins : (activeItem?.time || 8);
  const estimatedWaitTime = baseWait + queueDelay;

  const getQueueStatus = () => {
    if (activeOrdersCount <= 2) {
      return { label: 'Light Load', color: '#10B981' }; // Emerald Green
    }
    if (activeOrdersCount <= 5) {
      return { label: 'Moderate Load', color: '#F59E0B' }; // Amber Yellow
    }
    return { label: 'Heavy Load (Busy)', color: '#EF4444' }; // Rose Red
  };

  const queueStatus = getQueueStatus();

  // 3D Card Hover Perspective Parallax Math
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs to solve browser render repaint bugs on hover and provide elegant, premium fluid rotation
  const springX = useSpring(mouseX, { stiffness: 150, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 25 });

  const rotateX = useTransform(springY, [-200, 200], [4, -4]);
  const rotateY = useTransform(springX, [-200, 200], [-4, 4]);

  // Platter 3D offsets for realistic floating separation
  const platterTranslateX = useTransform(springX, [-200, 200], [-10, 10]);
  const platterTranslateY = useTransform(springY, [-200, 200], [-10, 10]);
  
  // Floating ingredients micro-parallax offsets
  const ingTranslateX = useTransform(springX, [-200, 200], [-18, 18]);
  const ingTranslateY = useTransform(springY, [-200, 200], [-18, 18]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const card = event.currentTarget.getBoundingClientRect();
    const width = card.width;
    const height = card.height;
    const x = event.clientX - card.left - width / 2;
    const y = event.clientY - card.top - height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) return;
    const touch = event.touches[0];
    const card = event.currentTarget.getBoundingClientRect();
    const width = card.width;
    const height = card.height;
    const x = touch.clientX - card.left - width / 2;
    const y = touch.clientY - card.top - height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleTouchEnd = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const switchTo = (idx: number) => {
    if (idx === current || animating) return;
    setAnimating(true);
    setChanging(true);

    setTimeout(() => {
      setCurrent(idx);
      setTimeout(() => {
        setChanging(false);
        setAnimating(false);
      }, 50);
    }, 250);
  };

  // Auto Horizontal Scroll logic
  useEffect(() => {
    const isAutoScroll = calendarEvent?.auto_scroll_enabled ?? uiConfig?.auto_scroll_enabled ?? false;
    const scrollInterval = calendarEvent?.auto_scroll_interval ?? uiConfig?.auto_scroll_interval ?? 5000;
    
    if (!isAutoScroll || displaySlides.length <= 1) return;

    const timer = setInterval(() => {
      if (!animating) {
        let nextIdx = current + 1;
        if (nextIdx >= displaySlides.length) nextIdx = 0;
        
        setAnimating(true);
        setChanging(true);

        setTimeout(() => {
          setCurrent(nextIdx);
          setTimeout(() => {
            setChanging(false);
            setAnimating(false);
          }, 50);
        }, 250);
      }
    }, scrollInterval);

    return () => clearInterval(timer);
  }, [current, animating, displaySlides.length, calendarEvent?.auto_scroll_enabled, calendarEvent?.auto_scroll_interval, uiConfig?.auto_scroll_enabled, uiConfig?.auto_scroll_interval]);

  if (!activeItem) {
    return null;
  }

  const triggerAddToCart = () => {
    // Find the corresponding database MenuItem
    const databaseItem = dbMenuItems.find(m => m.item_id === activeItem.menuItemId) || mockMenuItems.find(m => m.item_id === activeItem.menuItemId);
    if (databaseItem) {
      // Set the MenuItem price override if Biryani (150 instead of 180) to align with Image 2 perfectly
      const customizedItem = { ...databaseItem, price: activeItem.price };
      setCustomizingItem(customizedItem);
    }
  };

  const effectiveLayoutMode = calendarEvent?.layout_mode || uiConfig?.layout_mode || 'slider';
  const effectiveGridTitle = calendarEvent?.grid_board_title || uiConfig?.grid_board_title || 'Special Collections';
  const effectiveGridBadgeText = calendarEvent?.grid_board_badge_text || uiConfig?.grid_board_badge_text || '';
  const effectiveGridRibbonText = calendarEvent?.grid_board_ribbon_text || uiConfig?.grid_board_ribbon_text || '';
  const effectiveGridCards = calendarEvent?.grid_cards || uiConfig?.grid_cards || [];

  const handleGridCardClick = (card: GridCard) => {
    if (card.redirect_type === 'category') {
      setActiveCategory(card.redirect_value);
      const el = document.getElementById('menu') || document.getElementById('menu-preview-section') || document.getElementById('menu-catalog');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 800, behavior: 'smooth' });
      }
    } else if (card.redirect_type === 'item') {
      const databaseItem = dbMenuItems.find(m => m.item_id === card.redirect_value) || mockMenuItems.find(m => m.item_id === card.redirect_value);
      if (databaseItem) {
        setCustomizingItem({ ...databaseItem });
      }
    }
  };

  console.log("STOREFRONT DEBUG:", {
    uiConfig,
    calendarEvent,
    effectiveTheme,
    effectiveHeadline,
    effectiveSubText,
    effectiveBannerText,
    displaySlidesLength: displaySlides.length,
    activeItem
  });

  return (
      <div 
        className="showcase-outer-shell"
        style={{
          backgroundImage: calendarEvent?.bg_image
            ? `url(${calendarEvent.bg_image})`
            : uiConfig?.hero_image 
              ? `url(${uiConfig.hero_image})`
              : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
      {/* 📱 DESIGNER MOBILE VIEWPORT FRAME */}
      <div className={`showcase-phone-frame theme-${effectiveTheme}`}>
        <div className="phone-screen-glare" />
        <div className="phone-notch" />
        <div className="phone-home-indicator" />

        <div className="showcase-viewport-content" style={
          effectiveLayoutMode === 'summer_sips' ? { background: 'linear-gradient(to bottom, #e6a024, #7d3b0d, #120803)' } : 
          (effectiveTheme === 'custom' && calendarEvent?.custom_bg_color) ? { background: `radial-gradient(circle at center, ${calendarEvent.custom_bg_color} 0%, #050201 100%)` } : 
          undefined
        }>
          <ThemeDecorations theme={effectiveTheme} eventName={calendarEvent?.eventName || ''} />
          
          {/* Global Theme Particle Overlays (Custom Falling Emojis) */}
          <ThemeParticles 
            theme={effectiveTheme} 
            customParticles={calendarEvent?.custom_particles}
            pCount={calendarEvent?.particle_count}
            pSize={calendarEvent?.particle_size}
            pSpeed={calendarEvent?.particle_speed}
            pRot={calendarEvent?.particle_rotation}
          />
          
          {/* 1. PREMIUM HEADER / TOP NAVIGATION (Matches Image 2 Perfect Nav) */}
          <header className="showcase-top-nav">
            <div className="flex items-center gap-3">
              <span className="showcase-brand-logo font-serif">Hau Hau.</span>
                <div className="showcase-location-badge flex items-center gap-1">
                  <span className="location-pulse" />
                  <select 
                    value={customerOutlet} 
                    onChange={(e) => setCustomerOutlet(e.target.value)}
                    className="bg-transparent text-[#e8621a] font-mono text-xs font-bold uppercase tracking-widest outline-none cursor-pointer appearance-none"
                    style={{ width: '100px' }}
                  >
                    <option value="HYD CAMPUS" className="bg-[#060403] text-white">HYD CAMPUS</option>
                    {outlets.filter(o => o.name !== 'HYD CAMPUS').map(o => (
                      <option key={o.id} value={o.name} className="bg-[#060403] text-white">
                        {o.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
            </div>

            <div className="flex items-center gap-3">
              {userProfile ? (
                <Link href="/profile" className="hover:opacity-80 transition-opacity">
                  <span className="points-pill">{userProfile.points} pts</span>
                </Link>
              ) : (
                <button 
                  onClick={() => setIsAuthOpen(true)}
                  className="showcase-login-btn animate-glow"
                >
                  Login
                </button>
              )}
            </div>
          </header>

                    {/* 2. DYNAMIC FLOATING TELEMETRY STATUS BAR (High-Tech Translucent Glassmorphic Dock) */}
          {effectiveBannerActive && (
            <div className="showcase-telemetry-dock-wrapper">
              <div className="showcase-telemetry-dock backdrop-blur-md">
                <div 
                  className="border-beam" 
                  style={{ 
                    background: `linear-gradient(to right, transparent, ${
                      effectiveBannerColor === 'urgent' ? '#ef4444' : effectiveBannerColor === 'success' ? '#10b981' : effectiveBannerColor === 'dark' ? '#78716c' : '#f8bc51'
                    }, transparent)` 
                  }} 
                />
                
                <div className="flex items-center gap-2">
                  <span 
                    className="status-pulse-dot" 
                    style={{ 
                      backgroundColor: effectiveBannerColor === 'urgent' ? '#ef4444' : effectiveBannerColor === 'success' ? '#10b981' : effectiveBannerColor === 'dark' ? '#78716c' : '#f8bc51',
                      boxShadow: `0 0 10px ${
                        effectiveBannerColor === 'urgent' ? '#ef4444' : effectiveBannerColor === 'success' ? '#10b981' : effectiveBannerColor === 'dark' ? '#78716c' : '#f8bc51'
                      }`
                    }} 
                  />
                  <span className="status-banner-text font-mono text-[10px]" style={{ color: effectiveBannerColor === 'dark' ? '#a8a29e' : '#b6e8d3' }}>
                    {effectiveBannerText}
                  </span>
                </div>

                <div className="queue-speedometer-wrapper">
                  <svg className="speedometer-ring" width="22" height="22">
                    <circle className="ring-track" cx="11" cy="11" r="9" />
                    <circle 
                      className="ring-progress" 
                      cx="11" 
                      cy="11" 
                      r="9" 
                      style={{
                        stroke: queueStatus.color,
                        strokeDasharray: '56',
                        strokeDashoffset: 56 - (56 * Math.min(activeOrdersCount, 10)) / 10
                      }}
                    />
                  </svg>
                  <span className="speedometer-label font-mono text-[9px] font-bold">{estimatedWaitTime}m</span>
                </div>
              </div>
            </div>
          )}

          {effectiveLayoutMode === 'summer_sips' ? (
            <SummerCampaignHero />
          ) : effectiveLayoutMode === 'grid_board' ? (
            <div className="grid-board-scrollable">
              {/* Header Title section */}
              <div className="grid-board-header">
                <div className="grid-board-title-group">
                  <h2 className="grid-board-headline">{effectiveGridTitle}</h2>
                  {effectiveSubText && <p className="grid-board-sub">{effectiveSubText}</p>}
                </div>
                {effectiveGridBadgeText && (
                  <span className="grid-board-toggle-badge animate-pulse">
                    {effectiveGridBadgeText}
                  </span>
                )}
              </div>

              {/* 2x2 Grid of Cards */}
              <div className="grid-board-cards-grid">
                {effectiveGridCards.map((card: GridCard) => (
                  <div
                    key={card.id}
                    onClick={() => handleGridCardClick(card)}
                    className="grid-card-tile"
                  >
                    <div className="grid-card-image-wrap">
                      <img
                        src={card.image_url}
                        alt={card.title}
                        className="grid-card-img"
                        style={{ 
                          mixBlendMode: card.blendMode || 'normal',
                          transform: `scale(${card.imageScale || 1.0})`,
                          transition: 'transform 0.3s ease'
                        }}
                      />
                    </div>
                    <div className="grid-card-content">
                      <span className="grid-card-title">{card.title}</span>
                      {card.subtitle && <span className="grid-card-subtitle">{card.subtitle}</span>}
                      {card.price_text && <span className="grid-card-price-badge">{card.price_text}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Wide Ticker Ribbon */}
              {effectiveGridRibbonText && (
                <div className="grid-ribbon-ticker">
                  <span className="grid-ribbon-text">
                    {effectiveGridRibbonText}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 3 & 4. PREMIUM CARD SHOWCASE WITH 3D HOVER PARALLAX (Exceeds Image 2 Visual Depth) */}
              <motion.div 
                className={`showcase-card-container ${changing ? 'switching-item' : ''}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onTouchMove={handleTouchMove}
                onTouchStart={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  rotateX: rotateX,
                  rotateY: rotateY,
                  overflow: 'visible'
                }}
              >
                {/* Clipped background, glows, and shimmers wrapper to respect card border radius */}
                <div 
                  className="absolute inset-0 overflow-hidden pointer-events-none z-0"
                  style={{ background: activeItem.bgColor, borderRadius: '48px' }}
                >
                  {/* Ambient Mesh Drifting Auroras */}
                  <div className="mesh-aurora-container">
                    <div 
                      className="mesh-aurora-blob blob-1" 
                      style={{ 
                        background: effectiveTheme === 'custom' && calendarEvent?.custom_aurora_color ? calendarEvent.custom_aurora_color :
                                    effectiveTheme === 'raining' ? '#00d2c4' : 
                                    effectiveTheme === 'exam' ? '#7c77eb' : 
                                    effectiveTheme === 'fest' ? '#f8bc51' : 
                                    effectiveTheme === 'night' ? '#c084fc' : 
                                    effectiveTheme === 'valentines' ? '#ff4b81' : 
                                    effectiveTheme === 'scorching' ? '#ff6a00' : 
                                    activeItem.accentColor 
                      }} 
                    />
                    <div className="mesh-aurora-blob blob-2" style={{ background: '#000000' }} />
                    <div 
                      className="mesh-aurora-blob blob-3" 
                      style={{ 
                        background: effectiveTheme === 'custom' && calendarEvent?.custom_aurora_color ? calendarEvent.custom_aurora_color :
                                    effectiveTheme === 'raining' ? '#00d2c4' : 
                                    effectiveTheme === 'exam' ? '#7c77eb' : 
                                    effectiveTheme === 'fest' ? '#f8bc51' : 
                                    effectiveTheme === 'night' ? '#c084fc' : 
                                    effectiveTheme === 'valentines' ? '#ff4b81' : 
                                    effectiveTheme === 'scorching' ? '#ff6a00' : 
                                    activeItem.accentColor 
                      }} 
                    />
                  </div>

                  {/* Specular Shimmer Diagonal Sweep */}
                  <div className="card-shimmer-sweep" />

                  {/* Atmospheric Overlay Blends */}
                  <div className="card-atmospheric-glow" />
                  <div className="card-radial-shade" />
                </div>

                <div className="showcase-card-content">
                  
                  {/* Category tag */}
                  <div className={`showcase-category-tag ${changing ? 'fade-out' : 'fade-in'}`}>
                    {activeItem.tag}
                  </div>

                  {/* Title Section */}
                  <h1 className={`showcase-item-title font-serif italic ${changing ? 'fade-out' : 'fade-in'}`}>
                    <span className="line-first metallic-title-text">{activeItem.line1}</span>
                    <span className="line-second text-white">{activeItem.line2}</span>
                  </h1>

                  {/* Platter Area (Now completely transparent to show only the food) */}
                  <motion.div 
                    className="showcase-platter-area animate-float" 
                    style={{ 
                      translateX: platterTranslateX,
                      translateY: platterTranslateY
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeItem.id}
                        initial={{ opacity: 0, scale: 0.8, rotate: -15, y: 10 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, rotate: 15, y: -10 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        className="showcase-food-display"
                      >
                        {activeItem.image_url ? (
                          <Image
                            src={activeItem.image_url}
                            alt={activeItem.line1}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="food-photo-rendered object-contain"
                            style={{ 
                              mixBlendMode: activeItem.blendMode || 'normal', 
                              transform: `scale(${activeItem.imageScale || 1.0})`,
                              transition: 'transform 0.3s ease-out'
                            }}
                            priority
                          />
                        ) : (
                          <div className="w-full h-full bg-transparent" />
                        )}
                        <div className="food-emoji-fallback">{activeItem.emoji}</div>
                      </motion.div>
                    </AnimatePresence>

                    {/* Floating Ingredient Micro-Badges inside Platter Vector Grid */}
                    <div className="floating-ingredients-container">
                        {activeItem.ingredients?.map((ing, i) => {
                          const positions = [
                            { top: '18%', left: '-15%', delay: 0 },
                            { top: '85%', left: '-5%', delay: 0.3 },
                            { top: '55%', right: '-18%', delay: 0.6 },
                          ];
                          const pos = positions[i] || { top: '0%', left: '0%', delay: 0 };
                        return (
                          <motion.div
                            key={`${activeItem.id}-ing-${i}`}
                            initial={{ opacity: 0, scale: 0.6, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: 0.5 + i * 0.1, type: 'spring' }}
                            className="floating-ingredient-pill font-mono backdrop-blur-md"
                            style={{
                              position: 'absolute',
                              ...pos,
                              translateX: ingTranslateX,
                              translateY: ingTranslateY,
                            }}
                          >
                            <span className="star-sparkle text-amber-400">✦</span>
                            <span>{ing}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Description - Grid Layout to dynamically size to largest description */}
                  <div style={{ display: 'grid', width: '100%', placeItems: 'center' }}>
                    {displaySlides.map((item, idx) => (
                      <p 
                        key={`desc-${item.id}`}
                        className={`showcase-item-desc ${current === idx ? (changing ? 'fade-out' : 'fade-in') : ''}`}
                        style={{
                          gridArea: '1 / 1 / 2 / 2',
                          opacity: current === idx ? undefined : 0,
                          visibility: current === idx ? 'visible' : 'hidden',
                          pointerEvents: current === idx ? 'auto' : 'none',
                        }}
                      >
                        {item.desc}
                      </p>
                    ))}
                  </div>

                  {/* Bottom Action Row (Price & Add to Cart capsule) */}
                  <div className={`showcase-action-row ${changing ? 'fade-out' : 'fade-in'}`}>
                    <div className="showcase-price-tag font-syne">
                      ₹{activeItem.price}
                    </div>
                    <button 
                      onClick={triggerAddToCart}
                      className="showcase-add-cart-btn font-semibold"
                    >
                      ADD TO CART
                    </button>
                  </div>

                </div>

                {/* 5. BOTTOM SELECTION CATEGORY WHEEL (Slides categories smoothly inside card) */}
                <div className="showcase-thumbnails-bar">
                  <div className="thumbnails-scroll-container">
                    {displaySlides.map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => switchTo(idx)}
                        className={`thumb-circle-btn overflow-visible ${current === idx ? 'selected' : ''}`}
                        title={item.line1}
                      >
                        {current === idx && (
                          <motion.div 
                            layoutId="activeThumbBorder" 
                            className="thumb-active-glowing-ring" 
                            transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                          />
                        )}
                        {item.image_url ? (
                          <div className="relative w-[42px] h-[42px] rounded-full overflow-hidden flex items-center justify-center border border-white/5">
                            <Image
                              src={item.image_url}
                              alt={item.line1}
                              fill
                              sizes="42px"
                              style={{
                                mixBlendMode: item.blendMode || 'normal',
                                transform: `scale(${item.imageScale || 1.0})`
                              }}
                              className="object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <span className="thumb-emoji">{item.emoji}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Bottom horizontal slider indicators */}
                  <div className="thumb-indicator-track">
                    {displaySlides.map((_, idx) => (
                      <div
                        key={idx}
                        onClick={() => switchTo(idx)}
                        className={`thumb-dot-indicator ${current === idx ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                </div>

              </motion.div>

              {/* Swipe indicator helper */}
              <div className="showcase-swipe-hint">
                <span>Scroll down to refresh the oasis</span>
              </div>
            </>
          )}

        </div>
      </div>

      {/* 🔑 OTP Auth Modal Gate */}
      {isAuthOpen && (
        <AuthModal 
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={() => setIsAuthOpen(false)}
        />
      )}

      {/* 🎨 Customized Food modifiers sheet */}
      {customizingItem && (
        <CustomizationModal
          item={customizingItem}
          isOpen={customizingItem !== null}
          onClose={() => setCustomizingItem(null)}
          onConfirm={(customized) => {
            addToCart({
              menuItemId: customized.menuItemId,
              name: customized.name,
              price: customized.price,
              quantity: customized.quantity,
              station: customized.station,
              modifiers: customized.modifiers,
            });
            setCustomizingItem(null);
          }}
        />
      )}

    </div>
  );
}

