'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Image as ImageIcon, 
  CheckCircle, 
  RefreshCw, 
  Upload, 
  Sunset, 
  Save, 
  Smartphone, 
  X, 
  Utensils,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  Tag,
  Calendar
} from 'lucide-react';
import { 
  streamUIConfig, 
  saveUIConfig, 
  fetchMenuItems, 
  streamSliderItems, 
  saveSliderItem, 
  deleteSliderItem,
  streamCalendarEvents,
  saveCalendarEvent,
  deleteCalendarEvent
} from '@/lib/dbService';
import { adjustAtmosphere, generateSlideDetails } from '@/lib/geminiService';
import { MenuItem, UIConfig, SliderItem, GridCard, SummerDrinkItem, SummerCategoryItem } from '@/lib/types';
import { getCalendarEventConfig, DynamicCalendarEvent, defaultCalendarEvents } from '@/lib/calendarEvents';
import ResizableImage from './ResizableImage';

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

export default function UIAtmosphereManager() {
  // Store settings state
  const [activeTheme, setActiveTheme] = useState<'default' | 'exam' | 'raining' | 'fest' | 'night' | 'valentines' | 'scorching' | 'custom'>('default');
  const [autoCalendarMode, setAutoCalendarMode] = useState(false);
  const [mockDateStr, setMockDateStr] = useState('');
  const [globalAutoScrollEnabled, setGlobalAutoScrollEnabled] = useState(false);
  const [globalAutoScrollInterval, setGlobalAutoScrollInterval] = useState(5000);
  const [headline, setHeadline] = useState('Your escape from the heat.');
  const [subText, setSubText] = useState('Mist-cooling and chilled vibes.');
  const [bannerActive, setBannerActive] = useState(true);
  const [bannerText, setBannerText] = useState('Beat the heat — order ready in 8 mins');
  const [bannerColor, setBannerColor] = useState<'golden' | 'urgent' | 'success' | 'dark'>('golden');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [socialStats, setSocialStats] = useState<{value: string; label: string}[]>([
    { value: '3,600+', label: 'Students' },
    { value: '8 min', label: 'Avg Pickup' },
    { value: '₹15', label: 'Delivery Fee' }
  ]);
  const [socialStatsActive, setSocialStatsActive] = useState(true);

  const [isInitialized, setIsInitialized] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dynamic Seasonal Campaign state
  const [calendarEvents, setCalendarEvents] = useState<DynamicCalendarEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<DynamicCalendarEvent | null>(null);
  const [isEditingEventOpen, setIsEditingEventOpen] = useState(false);
  
  // Event Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartMonth, setEventStartMonth] = useState(0);
  const [eventStartDay, setEventStartDay] = useState(1);
  const [eventEndMonth, setEventEndMonth] = useState(0);
  const [eventEndDay, setEventEndDay] = useState(1);
  const [eventTheme, setEventTheme] = useState<UIConfig['active_theme']>('default');
  const [eventLayoutMode, setEventLayoutMode] = useState<UIConfig['layout_mode']>('slider');
  const [eventHeadline, setEventHeadline] = useState('');
  const [eventSubText, setEventSubText] = useState('');
  const [eventBannerActive, setEventBannerActive] = useState(true);
  const [eventBannerText, setEventBannerText] = useState('');
  const [eventBannerColor, setEventBannerColor] = useState<UIConfig['banner_color']>('golden');
  const [eventBgImage, setEventBgImage] = useState('');
  const [eventDiscountPercent, setEventDiscountPercent] = useState(0);
  const [eventDiscountDesc, setEventDiscountDesc] = useState('');
  const [eventFeaturedItemIds, setEventFeaturedItemIds] = useState<string[]>([]);

  // Advanced Custom Particles State
  const [eventCustomParticles, setEventCustomParticles] = useState('');
  const [eventParticleCount, setEventParticleCount] = useState(15);
  const [eventParticleSize, setEventParticleSize] = useState(10);
  const [eventParticleSpeed, setEventParticleSpeed] = useState(10);
  const [eventParticleRotation, setEventParticleRotation] = useState(360);
  const [eventCustomAuroraColor, setEventCustomAuroraColor] = useState('#f8bc51');
  const [eventCustomBgColor, setEventCustomBgColor] = useState('#0A0604');
  const [eventAutoScrollEnabled, setEventAutoScrollEnabled] = useState(false);
  const [eventAutoScrollInterval, setEventAutoScrollInterval] = useState(5000);

  // Menu items list
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // Hero Slider collection list
  const [sliderItems, setSliderItems] = useState<SliderItem[]>([]);
  const [editingSlide, setEditingSlide] = useState<SliderItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Slide Form state
  const [slideMenuItemId, setSlideMenuItemId] = useState('');
  const [slideTag, setSlideTag] = useState('');
  const [slideLine1, setSlideLine1] = useState('');
  const [slideLine2, setSlideLine2] = useState('');
  const [slideDesc, setSlideDesc] = useState('');
  const [slideImageUrl, setSlideImageUrl] = useState('');
  const [slideBlendMode, setSlideBlendMode] = useState<'normal' | 'screen' | 'multiply'>('normal');
  const [slidePrice, setSlidePrice] = useState(100);
  const [slideTime, setSlideTime] = useState(8);
  const [slideTagsText, setSlideTagsText] = useState(''); // comma-separated
  const [slideAccentColor, setSlideAccentColor] = useState('#f8bc51');
  const [slideBgColor, setSlideBgColor] = useState('radial-gradient(circle at center, #63503B 0%, #2A2118 100%)');
  const [slideSortOrder, setSlideSortOrder] = useState(1);

  // Image tab selector ('storefront' = general background, 'slide' = slide transparent png, 'grid_card' = grid board promotional banner)
  const [imageTab, setImageTab] = useState<'storefront' | 'slide' | 'grid_card' | 'summer_drink' | 'summer_cat'>('storefront');

  // Campaign Grid Layout Settings state
  const [layoutMode, setLayoutMode] = useState<'slider' | 'grid_board' | 'summer_sips'>('slider');
  const [gridBoardTitle, setGridBoardTitle] = useState('Featured Specials');
  const [gridBoardBadgeText, setGridBoardBadgeText] = useState('');
  const [gridBoardRibbonText, setGridBoardRibbonText] = useState('');
  const [gridCards, setGridCards] = useState<GridCard[]>([]);

  // Summer Campaign Settings State
  const [summerBgGradient, setSummerBgGradient] = useState('radial-gradient(circle at 20% 10%, rgba(255,243,186,0.55) 0%, rgba(253,186,116,0.2) 50%, transparent 100%)');
  const [summerHeroTitle, setSummerHeroTitle] = useState('Summer Chill Zone.');
  const [summerHeroSub, setSummerHeroSub] = useState('Crispy Golden Fries + Refreshing Cold Drinks = Perfect Summer.');
  const [summerDrinks, setSummerDrinks] = useState<SummerDrinkItem[]>([]);
  const [summerCategories, setSummerCategories] = useState<SummerCategoryItem[]>([]);

  // Summer Drinks Form state
  const [editingDrink, setEditingDrink] = useState<SummerDrinkItem | null>(null);
  const [isAddingDrink, setIsAddingDrink] = useState(false);
  const [drinkTitle, setDrinkTitle] = useState('');
  const [drinkSubtitle, setDrinkSubtitle] = useState('');
  const [drinkPrice, setDrinkPrice] = useState(100);
  const [drinkOriginalPrice, setDrinkOriginalPrice] = useState(150);
  const [drinkTag, setDrinkTag] = useState('');
  const [drinkDesc, setDrinkDesc] = useState('');
  const [drinkImageUrl, setDrinkImageUrl] = useState('');
  const [drinkBlendMode, setDrinkBlendMode] = useState<'normal' | 'screen' | 'multiply'>('normal');
  const [drinkMenuItemId, setDrinkMenuItemId] = useState('');

  // Summer Categories Form state
  const [editingCat, setEditingCat] = useState<SummerCategoryItem | null>(null);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [catTitle, setCatTitle] = useState('');
  const [catIconType, setCatIconType] = useState<'emoji'|'image'>('emoji');
  const [catIconValue, setCatIconValue] = useState('');
  const [catRedirectCategory, setCatRedirectCategory] = useState('');
  const [catBlendMode, setCatBlendMode] = useState<'normal' | 'screen' | 'multiply'>('normal');

  // Grid Card Form state
  const [editingGridCard, setEditingGridCard] = useState<GridCard | null>(null);
  const [isAddingGridCard, setIsAddingGridCard] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [cardSubtitle, setCardSubtitle] = useState('');
  const [cardPriceText, setCardPriceText] = useState('');
  const [cardImageUrl, setCardImageUrl] = useState('');
  const [cardRedirectType, setCardRedirectType] = useState<'category' | 'item'>('category');
  const [cardRedirectValue, setCardRedirectValue] = useState('');
  const [cardBlendMode, setCardBlendMode] = useState<'normal' | 'screen' | 'multiply'>('normal');

  // Conversational prompt input
  const [atmospherePrompt, setAtmospherePrompt] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [generatingSlideAI, setGeneratingSlideAI] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // File Upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Live Preview Navigation index
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  const startEditEvent = (ev: DynamicCalendarEvent) => {
    setEditingEvent(ev);
    setIsEditingEventOpen(true);
    setEventTitle(ev.eventName);
    setEventStartMonth(ev.startMonth);
    setEventStartDay(ev.startDay);
    setEventEndMonth(ev.endMonth);
    setEventEndDay(ev.endDay);
    setEventTheme(ev.active_theme);
    setEventLayoutMode(ev.layout_mode || 'slider');
    setEventHeadline(ev.hero_headline);
    setEventSubText(ev.hero_sub);
    setEventBannerActive(ev.banner_active);
    setEventBannerText(ev.banner_text);
    setEventBannerColor(ev.banner_color || 'golden');
    setEventBgImage(ev.bg_image || '');
    setEventDiscountPercent(ev.automatic_discount?.discount_percent || 0);
    setEventDiscountDesc(ev.automatic_discount?.description || '');
    setEventFeaturedItemIds(ev.featuredItemIds || []);
    setEventCustomParticles(ev.custom_particles || '');
    setEventParticleCount(ev.particle_count || 15);
    setEventParticleSize(ev.particle_size || 10);
    setEventParticleSpeed(ev.particle_speed || 10);
    setEventParticleRotation(ev.particle_rotation || 360);
    setEventCustomAuroraColor(ev.custom_aurora_color || '#f8bc51');
    setEventCustomBgColor(ev.custom_bg_color || '#0A0604');
    setEventAutoScrollEnabled(ev.auto_scroll_enabled || false);
    setEventAutoScrollInterval(ev.auto_scroll_interval || 5000);
  };

  const startAddEvent = () => {
    const newId = `campaign_${Date.now()}`;
    const newEv: DynamicCalendarEvent = {
      id: newId,
      eventName: "New Campaign",
      startMonth: new Date().getMonth(),
      startDay: new Date().getDate(),
      endMonth: new Date().getMonth(),
      endDay: new Date().getDate(),
      active_theme: "default",
      layout_mode: "slider",
      hero_headline: "Amazing Offers",
      hero_sub: "Don't miss out",
      banner_active: false,
      banner_text: "",
      banner_color: "golden",
      custom_aurora_color: "#f8bc51",
      custom_bg_color: "#0A0604",
      auto_scroll_enabled: false,
      auto_scroll_interval: 5000,
    };
    startEditEvent(newEv);
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm("Are you sure you want to delete this campaign?")) {
      await deleteCalendarEvent(id);
      setIsEditingEventOpen(false);
      setEditingEvent(null);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    const updatedData: Partial<DynamicCalendarEvent> = {
      eventName: eventTitle,
      startMonth: Number(eventStartMonth),
      startDay: Number(eventStartDay),
      endMonth: Number(eventEndMonth),
      endDay: Number(eventEndDay),
      active_theme: eventTheme,
      layout_mode: eventLayoutMode,
      hero_headline: eventHeadline,
      hero_sub: eventSubText,
      banner_active: eventBannerActive,
      banner_text: eventBannerText,
      banner_color: eventBannerColor,
      bg_image: eventBgImage,
      featuredItemIds: eventFeaturedItemIds,
      custom_particles: eventCustomParticles,
      particle_count: Number(eventParticleCount),
      particle_size: Number(eventParticleSize),
      particle_speed: Number(eventParticleSpeed),
      particle_rotation: Number(eventParticleRotation),
      custom_aurora_color: eventCustomAuroraColor,
      custom_bg_color: eventCustomBgColor,
      auto_scroll_enabled: eventAutoScrollEnabled,
      auto_scroll_interval: Number(eventAutoScrollInterval),
      automatic_discount: eventDiscountPercent > 0 ? {
        discount_percent: Number(eventDiscountPercent),
        description: eventDiscountDesc || `${eventTitle} Discount`
      } : null as any
    };

    await saveCalendarEvent(editingEvent.id, updatedData);
    setIsEditingEventOpen(false);
    setEditingEvent(null);
  };

  // Load configuration from Firestore on mount
  useEffect(() => {
    const unsubscribeConfig = streamUIConfig((config) => {
      if (!isInitialized) {
        setActiveTheme(config.active_theme || 'default');
        setHeadline(config.hero_headline || '');
        setSubText(config.hero_sub || '');
        setBannerActive(config.banner_active ?? true);
        setBannerText(config.banner_text || '');
        setBannerColor(config.banner_color || 'golden');
        setHeroImageUrl(config.hero_image || '');
        if (config.social_stats) setSocialStats(config.social_stats);
        setSocialStatsActive(config.social_stats_active ?? true);
        setAutoCalendarMode(config.auto_calendar_mode ?? false);
        setMockDateStr(config.mock_date || '');
        setGlobalAutoScrollEnabled(config.auto_scroll_enabled || false);
        setGlobalAutoScrollInterval(config.auto_scroll_interval || 5000);
        
        // Campaign Grid Layout Settings
        setLayoutMode(config.layout_mode || 'slider');
        setGridBoardTitle(config.grid_board_title || 'Featured Specials');
        setGridBoardBadgeText(config.grid_board_badge_text || '');
        setGridBoardRibbonText(config.grid_board_ribbon_text || '');
        setGridCards(config.grid_cards || []);
        
        // Summer Campaign Settings
        if (config.summer_campaign_settings) {
          setSummerBgGradient(config.summer_campaign_settings.background_gradient);
          setSummerHeroTitle(config.summer_campaign_settings.hero_title);
          setSummerHeroSub(config.summer_campaign_settings.hero_subtitle);
          setSummerDrinks(config.summer_campaign_settings.drinks);
          setSummerCategories(config.summer_campaign_settings.categories);
        } else {
          // Defaults if null
          setSummerDrinks([
            { id: 'sip1', title: 'Chocolate Milkshake', imageUrl: '/milkshake.png', imageScale: 1.0, price: 110, originalPrice: 150, tag: 'Classic Sweet', desc: 'Smooth vanilla and rich chocolate blended with thick ice cream.', menuItemId: 'sip1' },
            { id: 'sip2', title: 'Mint Limeade', imageUrl: '/mojito.png', imageScale: 1.0, price: 60, originalPrice: 90, tag: 'Freshly Spritzed', desc: 'Muddled fresh organic garden mint, sweet citrus lime juice, and sparkling soda.', menuItemId: 'sip2' },
            { id: 'sip3', title: 'Mango Thickshake', imageUrl: '/thickshake.png', imageScale: 1.0, price: 90, originalPrice: 120, tag: 'Alfonso Delight', desc: 'Rich, thick organic yogurt blended with sweet hand-picked Alfonso mango puree.', menuItemId: 'sip3' }
          ]);
          setSummerCategories([
            { id: 'Refreshers', title: 'Refreshers', iconType: 'emoji', iconValue: '🍹', imageScale: 1.0, redirectCategory: 'Beverages' },
            { id: 'Cool Bites', title: 'Cool Bites', iconType: 'emoji', iconValue: '🌯', imageScale: 1.0, redirectCategory: 'Snacks' },
            { id: 'Ice-Creams', title: 'Ice-Creams', iconType: 'emoji', iconValue: '🍦', imageScale: 1.0, redirectCategory: 'Desserts' },
            { id: 'Meal Bundles', title: 'Meal Bundles', iconType: 'emoji', iconValue: '🍱', imageScale: 1.0, redirectCategory: 'Meals' }
          ]);
        }
        
        setIsInitialized(true);
      }
    });

    const unsubscribeSlider = streamSliderItems((items) => {
      setSliderItems(items);
    });

    const unsubscribeEvents = streamCalendarEvents((events) => {
      setCalendarEvents(events as DynamicCalendarEvent[]);
      if (events.length === 0) {
        defaultCalendarEvents.forEach((ev) => {
          saveCalendarEvent(ev.id, ev);
        });
      }
    });

    fetchMenuItems().then((items) => {
      setMenuItems(items);
    });

    return () => {
      unsubscribeConfig();
      unsubscribeSlider();
      unsubscribeEvents();
    };
  }, [isInitialized]);

  // Handle direct file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setUploadSuccess(false);
    }
  };

  // Upload image to Cloudinary
  const handleImageUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    const cloudName = localStorage.getItem('Hau Hau_cloudinary_cloud_name') || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const uploadPreset = localStorage.getItem('Hau Hau_cloudinary_upload_preset') || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

    if (!cloudName || !uploadPreset) {
      alert('Cloudinary credentials are not configured. Please set them in your API Cloud Config at the bottom of the sidebar.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', imageTab === 'storefront' ? 'hero-section' : 'menu-catalog');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();

      if (response.ok) {
        const uploadedUrl = data.secure_url;
        setUploadSuccess(true);
        setUploadFile(null);

        if (imageTab === 'storefront') {
          setHeroImageUrl(uploadedUrl);
        } else if (imageTab === 'slide') {
          setSlideImageUrl(uploadedUrl);
        } else if (imageTab === 'grid_card') {
          setCardImageUrl(uploadedUrl);
        } else if (imageTab === 'summer_drink') {
          setDrinkImageUrl(uploadedUrl);
        } else if (imageTab === 'summer_cat') {
          setCatIconValue(uploadedUrl);
        }
      } else {
        alert('Upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network upload error.');
    } finally {
      setUploading(false);
    }
  };

  // Remove storefront background image URL
  const handleRemoveStorefrontImage = () => {
    setHeroImageUrl('');
    setUploadSuccess(false);
  };

  // Save manual storefront controls to Firestore
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      await saveUIConfig({
        active_theme: activeTheme,
        hero_headline: headline,
        hero_sub: subText,
        banner_active: bannerActive,
        banner_text: bannerText,
        banner_color: bannerColor,
        hero_image: heroImageUrl,
        social_stats: socialStats,
        social_stats_active: socialStatsActive,
        auto_calendar_mode: autoCalendarMode,
        mock_date: mockDateStr,
        auto_scroll_enabled: globalAutoScrollEnabled,
        auto_scroll_interval: Number(globalAutoScrollInterval),
        
        // Campaign Grid Layout Settings
        layout_mode: layoutMode,
        grid_board_title: gridBoardTitle,
        grid_board_badge_text: gridBoardBadgeText,
        grid_board_ribbon_text: gridBoardRibbonText,
        grid_cards: gridCards,
        
        summer_campaign_settings: {
          background_gradient: summerBgGradient,
          hero_title: summerHeroTitle,
          hero_subtitle: summerHeroSub,
          drinks: summerDrinks,
          categories: summerCategories
        }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save storefront settings:', err);
      alert('Failed to save storefront settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Apply atmosphere adjustments from Gemini API
  const handleApplyAtmosphere = async () => {
    if (!atmospherePrompt) return;
    setAdjusting(true);
    setAiReport(null);

    try {
      const config = await adjustAtmosphere(atmospherePrompt);
      setActiveTheme(config.active_theme);
      setHeadline(config.hero_headline);
      setSubText(config.hero_sub);
      setBannerActive(config.banner_active);
      setBannerText(config.banner_text);
      setBannerColor(config.banner_color);
      if (config.social_stats) setSocialStats(config.social_stats);
      if (config.social_stats_active !== undefined) setSocialStatsActive(config.social_stats_active);
      
      setAiReport(`✨ Gemini applied adjustments: ${config.reason}`);
    } catch (err: any) {
      console.error(err);
      setAiReport(`❌ AI adjustment failed. Using standard local parser.`);
    } finally {
      setAdjusting(false);
    }
  };

  // Slide CRUD Actions
  const startEditSlide = (slide: SliderItem) => {
    setEditingSlide(slide);
    setIsAddingNew(false);
    setImageTab('slide');
    setSlideMenuItemId(slide.menuItemId);
    setSlideTag(slide.tag);
    setSlideLine1(slide.line1);
    setSlideLine2(slide.line2);
    setSlideDesc(slide.desc);
    setSlideImageUrl(slide.image_url);
    setSlideBlendMode(slide.blendMode || 'normal');
    setSlidePrice(slide.price);
    setSlideTime(slide.time);
    setSlideTagsText(slide.ingredients.join(', '));
    setSlideAccentColor(slide.accentColor);
    setSlideBgColor(slide.bgColor);
    setSlideSortOrder(slide.sort_order || 1);
    setUploadFile(null);
    setUploadSuccess(false);
  };

  const startAddNewSlide = () => {
    setEditingSlide(null);
    setIsAddingNew(true);
    setImageTab('slide');
    setSlideMenuItemId('');
    setSlideTag('');
    setSlideLine1('');
    setSlideLine2('');
    setSlideDesc('');
    setSlideImageUrl('');
    setSlideBlendMode('normal');
    setSlidePrice(100);
    setSlideTime(8);
    setSlideTagsText('');
    setSlideAccentColor('#f8bc51');
    setSlideBgColor('radial-gradient(circle at center, #63503B 0%, #2A2118 100%)');
    setSlideSortOrder(sliderItems.length + 1);
    setUploadFile(null);
    setUploadSuccess(false);
  };

  const handleSelectMenuItemForSlide = (itemId: string) => {
    setSlideMenuItemId(itemId);
    const item = menuItems.find(m => m.item_id === itemId);
    if (item) {
      setSlidePrice(item.price);
      setSlideDesc(item.description);
      // Auto-split name for line1 and line2
      const nameParts = item.name.split(' ');
      if (nameParts.length > 1) {
        setSlideLine1(nameParts.slice(0, -1).join(' '));
        setSlideLine2(nameParts[nameParts.length - 1]);
      } else {
        setSlideLine1(item.name);
        setSlideLine2('');
      }
      setSlideTag(item.category.toUpperCase());
    }
  };

  const handleGenerateAIDetails = async () => {
    if (!slideMenuItemId) {
      alert('Please select a linked menu item first.');
      return;
    }
    const item = menuItems.find(m => m.item_id === slideMenuItemId);
    if (!item) return;

    setGeneratingSlideAI(true);
    try {
      const details = await generateSlideDetails(item.name, item.category, item.description || '');
      setSlideTag(details.tag);
      setSlideDesc(details.desc);
      setSlideTagsText(details.tags.join(', '));
      setSlideAccentColor(details.accentColor);
      setSlideBgColor(details.bgColor);
    } catch (err) {
      console.error('Failed to generate slide details using AI:', err);
      alert('Failed to generate slide details using AI. Standard fallbacks applied.');
    } finally {
      setGeneratingSlideAI(false);
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideMenuItemId) {
      alert('Please select a linked menu item.');
      return;
    }
    if (!slideImageUrl) {
      alert('Please upload a transparent PNG image first.');
      return;
    }

    const slideId = editingSlide ? editingSlide.id : `s_${Math.random().toString(36).substring(7)}`;

    const newSlide: SliderItem = {
      id: slideId,
      menuItemId: slideMenuItemId,
      tag: slideTag || 'HIGHLIGHT',
      line1: slideLine1 || 'Title Line 1',
      line2: slideLine2 || 'Title Line 2',
      desc: slideDesc || 'Description text here...',
      image_url: slideImageUrl,
      blendMode: slideBlendMode,
      price: Number(slidePrice),
      time: Number(slideTime),
      ingredients: slideTagsText.split(',').map(s => s.trim()).filter(Boolean),
      accentColor: slideAccentColor,
      bgColor: slideBgColor,
      sort_order: Number(slideSortOrder)
    };

    try {
      await saveSliderItem(newSlide);
      alert(editingSlide ? 'Slide updated successfully!' : 'Slide added successfully!');
      setEditingSlide(null);
      setIsAddingNew(false);
      setUploadFile(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save slide.');
    }
  };

  const handleDeleteSlide = async (id: string) => {
    if (!confirm('Are you sure you want to delete this slide from the storefront carousel?')) return;
    try {
      await deleteSliderItem(id);
      if (editingSlide?.id === id) {
        setEditingSlide(null);
      }
      // Adjust preview index if out of bounds
      if (previewSlideIndex >= sliderItems.length - 1 && previewSlideIndex > 0) {
        setPreviewSlideIndex(previewSlideIndex - 1);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete slide.');
    }
  };

  // Grid Card Actions
  const startEditGridCard = (card: GridCard) => {
    setEditingGridCard(card);
    setIsAddingGridCard(false);
    setImageTab('grid_card');
    setCardTitle(card.title);
    setCardSubtitle(card.subtitle || '');
    setCardPriceText(card.price_text || '');
    setCardImageUrl(card.image_url);
    setCardBlendMode(card.blendMode || 'normal');
    setCardRedirectType(card.redirect_type);
    setCardRedirectValue(card.redirect_value);
    setUploadFile(null);
    setUploadSuccess(false);
  };

  const startAddNewGridCard = () => {
    setEditingGridCard(null);
    setIsAddingGridCard(true);
    setImageTab('grid_card');
    setCardTitle('');
    setCardSubtitle('');
    setCardPriceText('');
    setCardImageUrl('');
    setCardBlendMode('normal');
    setCardRedirectType('category');
    setCardRedirectValue('');
    setUploadFile(null);
    setUploadSuccess(false);
  };

  const updateGridCardScale = (id: string, scale: number) => {
    setGridCards(prev => prev.map(c => c.id === id ? { ...c, imageScale: scale } : c));
  };

  const updateSliderItemScale = async (id: string, scale: number) => {
    // Optimistic update for the array
    setSliderItems(prev => prev.map(item => item.id === id ? { ...item, imageScale: scale } : item));
    const item = sliderItems.find(i => i.id === id);
    if (item && !isAddingNew) {
      await saveSliderItem({ ...item, imageScale: scale });
    }
  };

  const updateSummerDrinkScale = (id: string, scale: number) => {
    setSummerDrinks(prev => prev.map(d => d.id === id ? { ...d, imageScale: scale } : d));
  };

  const updateSummerCategoryScale = (id: string, scale: number) => {
    setSummerCategories(prev => prev.map(c => c.id === id ? { ...c, imageScale: scale } : c));
  };

  const handleSaveGridCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim()) {
      alert('Please enter a card title.');
      return;
    }
    if (!cardImageUrl.trim()) {
      alert('Please upload or specify a promotional graphic image.');
      return;
    }
    if (!cardRedirectValue.trim()) {
      alert('Please choose or enter a redirect target value.');
      return;
    }

    const cardId = editingGridCard ? editingGridCard.id : `c_${Math.random().toString(36).substring(7)}`;
    const newCard: GridCard = {
      id: cardId,
      title: cardTitle,
      subtitle: cardSubtitle || undefined,
      price_text: cardPriceText || undefined,
      image_url: cardImageUrl,
      blendMode: cardBlendMode,
      redirect_type: cardRedirectType,
      redirect_value: cardRedirectValue,
    };

    let updatedCards: GridCard[];
    if (editingGridCard) {
      updatedCards = gridCards.map(c => c.id === cardId ? newCard : c);
    } else {
      updatedCards = [...gridCards, newCard];
    }

    setGridCards(updatedCards);
    setEditingGridCard(null);
    setIsAddingGridCard(false);
  };

  const handleDeleteGridCard = (id: string) => {
    if (!confirm('Are you sure you want to remove this promo card?')) return;
    setGridCards(gridCards.filter(c => c.id !== id));
  };

  // Summer Drinks Actions
  const startEditDrink = (drink: SummerDrinkItem) => {
    setEditingDrink(drink);
    setIsAddingDrink(false);
    setImageTab('summer_drink');
    setDrinkTitle(drink.title);
    setDrinkSubtitle(drink.subtitle || '');
    setDrinkPrice(drink.price);
    setDrinkOriginalPrice(drink.originalPrice);
    setDrinkTag(drink.tag);
    setDrinkDesc(drink.desc);
    setDrinkImageUrl(drink.imageUrl);
    setDrinkBlendMode(drink.blendMode || 'normal');
    setDrinkMenuItemId(drink.menuItemId || '');
  };

  const startAddNewDrink = () => {
    setIsAddingDrink(true);
    setEditingDrink(null);
    setImageTab('summer_drink');
    setDrinkTitle('');
    setDrinkSubtitle('');
    setDrinkPrice(100);
    setDrinkOriginalPrice(150);
    setDrinkTag('New');
    setDrinkDesc('');
    setDrinkImageUrl('');
    setDrinkBlendMode('normal');
    setDrinkMenuItemId('');
  };

  const handleSaveDrink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drinkImageUrl) {
      alert("Please provide an image for the drink.");
      return;
    }

    const newDrink: SummerDrinkItem = {
      id: editingDrink ? editingDrink.id : Date.now().toString(),
      title: drinkTitle,
      subtitle: drinkSubtitle,
      price: drinkPrice,
      originalPrice: drinkOriginalPrice,
      tag: drinkTag,
      desc: drinkDesc,
      imageUrl: drinkImageUrl,
      imageScale: editingDrink?.imageScale || 1.0,
      blendMode: drinkBlendMode,
      menuItemId: drinkMenuItemId,
    };

    if (editingDrink) {
      setSummerDrinks(summerDrinks.map(d => d.id === editingDrink.id ? newDrink : d));
    } else {
      setSummerDrinks([...summerDrinks, newDrink]);
    }

    setIsAddingDrink(false);
    setEditingDrink(null);
  };

  const handleDeleteDrink = (id: string) => {
    if (confirm('Are you sure you want to delete this summer drink?')) {
      setSummerDrinks(summerDrinks.filter(d => d.id !== id));
    }
  };

  const updateDrinkScale = (id: string, scale: number) => {
    setSummerDrinks(prev => prev.map(d => d.id === id ? { ...d, imageScale: scale } : d));
  };

  // Summer Category Actions
  const startEditCat = (cat: SummerCategoryItem) => {
    setEditingCat(cat);
    setIsAddingCat(false);
    setImageTab('summer_cat');
    setCatTitle(cat.title);
    setCatIconType(cat.iconType);
    setCatIconValue(cat.iconValue);
    setCatRedirectCategory(cat.redirectCategory);
    setCatBlendMode(cat.blendMode || 'normal');
  };

  const startAddNewCat = () => {
    setIsAddingCat(true);
    setEditingCat(null);
    setImageTab('summer_cat');
    setCatTitle('');
    setCatIconType('emoji');
    setCatIconValue('??');
    setCatRedirectCategory('');
    setCatBlendMode('normal');
  };

  const handleSaveCat = (e: React.FormEvent) => {
    e.preventDefault();

    const newCat: SummerCategoryItem = {
      id: editingCat ? editingCat.id : Date.now().toString(),
      title: catTitle,
      iconType: catIconType,
      iconValue: catIconValue,
      imageScale: editingCat?.imageScale || 1.0,
      blendMode: catBlendMode,
      redirectCategory: catRedirectCategory,
    };

    if (editingCat) {
      setSummerCategories(summerCategories.map(c => c.id === editingCat.id ? newCat : c));
    } else {
      setSummerCategories([...summerCategories, newCat]);
    }

    setIsAddingCat(false);
    setEditingCat(null);
  };

  const handleDeleteCat = (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      setSummerCategories(summerCategories.filter(c => c.id !== id));
    }
  };

  const updateCatScale = (id: string, scale: number) => {
    setSummerCategories(prev => prev.map(c => c.id === id ? { ...c, imageScale: scale } : c));
  };

  // Active calendar event configuration
  const activeDate = mockDateStr ? new Date(mockDateStr) : new Date();
  const calendarEvent = getCalendarEventConfig(activeDate, calendarEvents);

  const effectiveTheme = autoCalendarMode && calendarEvent ? calendarEvent.active_theme : activeTheme;
  const effectiveBannerActive = autoCalendarMode && calendarEvent ? calendarEvent.banner_active : bannerActive;
  const effectiveBannerText = autoCalendarMode && calendarEvent ? calendarEvent.banner_text : bannerText;

  // Resolve Campaign Grid Layout options
  const effectiveLayoutMode = autoCalendarMode && calendarEvent?.layout_mode ? calendarEvent.layout_mode : layoutMode;
  const effectiveGridTitle = autoCalendarMode && calendarEvent?.grid_board_title ? calendarEvent.grid_board_title : gridBoardTitle;
  const effectiveGridBadgeText = autoCalendarMode && calendarEvent?.grid_board_badge_text ? calendarEvent.grid_board_badge_text : gridBoardBadgeText;
  const effectiveGridRibbonText = autoCalendarMode && calendarEvent?.grid_board_ribbon_text ? calendarEvent.grid_board_ribbon_text : gridBoardRibbonText;
  const effectiveGridCards = autoCalendarMode && calendarEvent?.grid_cards ? calendarEvent.grid_cards : gridCards;

  // Helper for rendering theme background in live preview
  const getThemeBackgroundStyles = () => {
    switch (effectiveTheme) {
      case 'raining':
        return 'radial-gradient(circle at center, #1b2f2b 0%, #060e0c 100%)';
      case 'exam':
        return 'radial-gradient(circle at center, #1e1d33 0%, #080712 100%)';
      case 'fest':
        return 'radial-gradient(circle at center, #4d3615 0%, #170f03 100%)';
      case 'night':
        return 'radial-gradient(circle at center, #23122c 0%, #09030c 100%)';
      case 'valentines':
        return 'radial-gradient(circle at center, #570f24 0%, #1f030a 100%)';
      case 'scorching':
        return 'radial-gradient(circle at center, #6e350f 0%, #210e03 100%)';
      default:
        return 'radial-gradient(circle at center, #2e1c10 0%, #0a0604 100%)';
    }
  };

  // Helper for rendering banner background colors in live preview
  const getBannerBgClass = () => {
    const colorToUse = autoCalendarMode && calendarEvent ? calendarEvent.banner_color : bannerColor;
    switch (colorToUse) {
      case 'urgent': return 'bg-red-950/80 border-red-500/30 text-red-400';
      case 'success': return 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400';
      case 'dark': return 'bg-stone-950/90 border-stone-800 text-stone-400';
      default: return 'bg-[#f8bc51]/10 border-[#f8bc51]/20 text-[#f8bc51]';
    }
  };

  const getBannerDotColor = () => {
    const colorToUse = autoCalendarMode && calendarEvent ? calendarEvent.banner_color : bannerColor;
    switch (colorToUse) {
      case 'urgent': return '#ef4444';
      case 'success': return '#10b981';
      case 'dark': return '#78716c';
      default: return '#f8bc51';
    }
  };

  // Filter preview slides list based on mock/active calendar campaign featured items
  const displayPreviewSlides = (() => {
    if (autoCalendarMode && calendarEvent?.featuredItemIds && calendarEvent.featuredItemIds.length > 0) {
      const filtered = sliderItems.filter(slide => 
        calendarEvent.featuredItemIds!.includes(slide.menuItemId)
      );
      if (filtered.length > 0) return filtered;
    }
    return sliderItems;
  })();

  // Constrain preview slide index inside filtered boundaries
  useEffect(() => {
    if (displayPreviewSlides.length > 0 && previewSlideIndex >= displayPreviewSlides.length) {
      setPreviewSlideIndex(displayPreviewSlides.length - 1);
    }
  }, [displayPreviewSlides, previewSlideIndex]);

  // Determine active slide in mobile preview
  const getActivePreviewSlide = () => {
    if (editingSlide || isAddingNew) {
      return {
        id: editingSlide ? editingSlide.id : 'new',
        tag: slideTag || 'HIGHLIGHT',
        line1: slideLine1 || 'Title Line 1',
        line2: slideLine2 || 'Title Line 2',
        desc: slideDesc || 'Description text here...',
        image_url: slideImageUrl || '',
        imageScale: 1.0,
        blendMode: slideBlendMode,
        price: slidePrice,
        time: slideTime,
        ingredients: slideTagsText.split(',').map(s => s.trim()).filter(Boolean),
        accentColor: slideAccentColor,
        bgColor: slideBgColor,
      };
    }
    if (displayPreviewSlides.length > 0) {
      const active = displayPreviewSlides[previewSlideIndex] || displayPreviewSlides[0];
      return active ? {
        id: active.id,
        tag: active.tag,
        line1: active.line1,
        line2: active.line2,
        desc: active.desc,
        image_url: active.image_url,
        imageScale: active.imageScale || 1.0,
        blendMode: active.blendMode || 'normal',
        price: active.price,
        time: active.time,
        ingredients: active.ingredients,
        accentColor: active.accentColor,
        bgColor: active.bgColor,
      } : null;
    }
    return {
      id: 'default',
      tag: 'AROMATIC BASMATI EXCELLENCE',
      line1: 'Nizami Canopy',
      line2: 'Biryani',
      desc: 'Premium long-grain saffron basmati layered with mint leaves...',
      image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
      imageScale: 1.0,
      blendMode: 'normal',
      price: 150,
      time: 8,
      ingredients: ['Dum Baked', 'Saffron Rice', 'Mint Leaves'],
      accentColor: '#f8bc51',
      bgColor: 'radial-gradient(circle at center, #63503B 0%, #2A2118 100%)',
    };
  };

  const previewSlide = getActivePreviewSlide();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 text-[#f7dec4] w-full">
      
      {/* Column 1 & 2: Controls and Carousel Slide Editor */}
      <div className="xl:col-span-2 flex flex-col gap-6">
        
        {/* AI Atmosphere Adjuster */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-[-30%] left-[-20%] w-48 h-48 bg-[#f8bc51]/5 rounded-full filter blur-xl" />

          <div className="flex items-center justify-between border-b border-[#302117]/60 pb-3">
            <div>
              <h2 className="font-serif italic text-2xl text-white">AI Atmosphere Adjuster</h2>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Gemini Conversational Environmental Controller</p>
            </div>
            <Sparkles size={16} className="text-[#f8bc51]" />
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Describe Campus Atmosphere</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. It is raining heavily outside, make the cafe feel warm, cozy, and highlight chai."
                value={atmospherePrompt}
                onChange={(e) => setAtmospherePrompt(e.target.value)}
                className="flex-1 bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#f8bc51] transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyAtmosphere();
                }}
              />
              <button
                onClick={handleApplyAtmosphere}
                disabled={adjusting || !atmospherePrompt}
                className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-5 rounded-xl font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0"
              >
                {adjusting ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  'Apply'
                )}
              </button>
            </div>

            <AnimatePresence>
              {aiReport && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#f8bc51]/10 border border-[#f8bc51]/20 rounded-xl p-3.5 mt-2 flex items-start gap-2.5 font-mono text-[10px] text-[#f8bc51] leading-relaxed"
                >
                  <Sunset size={14} className="shrink-0 mt-0.5" />
                  <span>{aiReport}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Storefront Layout Controls */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-5">
          <h3 className="font-serif italic text-lg text-white border-b border-[#302117]/60 pb-2">Manual Storefront Controls</h3>

          {/* Auto-Calendar Mode Switch */}
          <div className="bg-[#1c120c]/60 border border-[#f8bc51]/20 rounded-2xl p-4 flex flex-col gap-3.5 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-[#f8bc51] animate-pulse" />
                <div>
                  <span className="font-serif italic font-bold text-white text-sm">Auto-Calendar Campaign Mode</span>
                  <p className="text-[10px] text-[#d4c4b0]/60 font-mono">Automatically adjusts storefront theme by calendar occasion (Swiggy/Blinkit style)</p>
                </div>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCalendarMode}
                  onChange={(e) => setAutoCalendarMode(e.target.checked)}
                  className="sr-only peer"
                  id="auto-calendar-toggle"
                />
                <label htmlFor="auto-calendar-toggle" className="w-11 h-6 bg-stone-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-stone-400 after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f8bc51] peer-checked:after:bg-[#0A0604] peer-checked:after:border-[#f8bc51] cursor-pointer" />
              </div>
            </div>

            {autoCalendarMode && (
              <div className="bg-[#f8bc51]/5 border border-[#f8bc51]/15 rounded-xl p-3 flex flex-col gap-2 font-mono text-xs">
                <div className="flex justify-between items-center text-[10px] uppercase text-[#d4c4b0]/40">
                  <span>Active Calendar Event Status</span>
                  <span className="text-[#f8bc51] font-bold">Campaign Enabled</span>
                </div>
                {calendarEvent ? (
                  <div className="flex flex-col gap-1 text-[#f8bc51]">
                    <span className="font-bold text-sm">📅 {calendarEvent.eventName} Active</span>
                    <p className="text-[10px] text-[#d4c4b0]/80 normal-case leading-relaxed">
                      Theme override is active. Today's theme: <strong className="text-white uppercase font-mono">{calendarEvent.active_theme}</strong>.
                      Manual inputs are currently bypassed and locked.
                    </p>
                  </div>
                ) : (
                  <span className="text-[#d4c4b0]/65 text-[10px]">
                    No calendar campaign event active for today. Storefront falls back to manual settings.
                  </span>
                )}

                {/* Mock Testing Date input */}
                <div className="mt-2 border-t border-[#302117]/30 pt-2.5 flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/55">Mock System Date (For Testing Campaigns):</label>
                  <div className="flex gap-2">
                    <select
                      value={mockDateStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMockDateStr(val);
                        saveUIConfig({ mock_date: val });
                      }}
                      className="flex-1 bg-[#070402] border border-[#302117] rounded-lg px-2 py-1 text-2xs text-white focus:outline-none"
                    >
                      <option value="">Use Current Date</option>
                      {calendarEvents.map(ev => {
                        const yr = new Date().getFullYear();
                        const paddedMonth = String(ev.startMonth + 1).padStart(2, '0');
                        const paddedDay = String(ev.startDay).padStart(2, '0');
                        const dateStr = `${yr}-${paddedMonth}-${paddedDay}`;
                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        return (
                          <option key={ev.id} value={dateStr}>
                            {ev.eventName} ({monthNames[ev.startMonth]} {ev.startDay})
                          </option>
                        );
                      })}
                    </select>
                    {mockDateStr && (
                      <button
                        type="button"
                        onClick={() => {
                          setMockDateStr('');
                          saveUIConfig({ mock_date: '' });
                        }}
                        className="text-[9px] bg-[#302117]/60 px-2 rounded-lg text-[#d4c4b0]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Active Dynamic Theme</label>
              <select
                value={autoCalendarMode && calendarEvent ? calendarEvent.active_theme : activeTheme}
                onChange={(e) => setActiveTheme(e.target.value as any)}
                disabled={autoCalendarMode && !!calendarEvent}
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="default">Default Amber Glow</option>
                <option value="raining">Twilight Raining Teal</option>
                <option value="exam">Studious Espresso Indigo</option>
                <option value="fest">Gold-Leaf Festive Mesh</option>
                <option value="night">Obsidian Midnight Purple</option>
                <option value="valentines">Sweet Valentine's Pink</option>
                <option value="scorching">Scorching Summer Orange</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Storefront Hero Layout Mode</label>
              <select
                value={autoCalendarMode && calendarEvent ? calendarEvent.layout_mode || 'slider' : layoutMode}
                onChange={(e) => setLayoutMode(e.target.value as any)}
                disabled={autoCalendarMode && !!calendarEvent}
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="slider">Platter Slider (Default)</option>
                <option value="grid_board">Campaign Grid Board (Blinkit Grid)</option>
                <option value="summer_sips">Summer Sips Mockup</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Banner Urgency Color</label>
              <select
                value={autoCalendarMode && calendarEvent ? calendarEvent.banner_color : bannerColor}
                onChange={(e) => setBannerColor(e.target.value as any)}
                disabled={autoCalendarMode && !!calendarEvent}
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="golden">Golden Accents</option>
                <option value="urgent">Urgent Coral Red</option>
                <option value="success">Success Mint Green</option>
                <option value="dark">Basalt Obsidian</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Storefront Headline</label>
            <input
              type="text"
              value={autoCalendarMode && calendarEvent ? calendarEvent.hero_headline : headline}
              onChange={(e) => setHeadline(e.target.value)}
              disabled={autoCalendarMode && !!calendarEvent}
              className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Subtext Subtitle</label>
            <input
              type="text"
              value={autoCalendarMode && calendarEvent ? calendarEvent.hero_sub : subText}
              onChange={(e) => setSubText(e.target.value)}
              disabled={autoCalendarMode && !!calendarEvent}
              className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-3.5 border-t border-[#302117]/30 pt-4 mt-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#d4c4b0] font-semibold">Active Operational Banner</span>
              <input
                type="checkbox"
                checked={autoCalendarMode && calendarEvent ? calendarEvent.banner_active : bannerActive}
                onChange={(e) => setBannerActive(e.target.checked)}
                disabled={autoCalendarMode && !!calendarEvent}
                className="accent-[#f8bc51] w-4 h-4 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              />
            </div>
            
            {/* Global Auto Scroll Toggle */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
                <div className="flex items-center justify-between p-3 bg-[#120a06] border border-[#302117] rounded-xl opacity-90 hover:opacity-100 transition-opacity">
                  <div>
                    <p className="text-sm font-semibold text-white font-serif italic">Global Auto Horizontal Scroll</p>
                    <p className="text-[10px] text-[#d4c4b0] font-mono uppercase tracking-widest mt-0.5">Applies when no campaign overrides it</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={globalAutoScrollEnabled}
                      onChange={(e) => setGlobalAutoScrollEnabled(e.target.checked)}
                      disabled={autoCalendarMode && !!calendarEvent}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#302117] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#d4c4b0] peer-checked:after:bg-[#0A0604] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f8bc51] peer-disabled:opacity-50"></div>
                  </label>
                </div>
                {globalAutoScrollEnabled && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Scroll Interval (ms)</label>
                    <input
                      type="number"
                      value={globalAutoScrollInterval}
                      onChange={(e) => setGlobalAutoScrollInterval(Number(e.target.value))}
                      disabled={autoCalendarMode && !!calendarEvent}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                      min="1000"
                      step="500"
                    />
                  </div>
                )}
            </div>
            
            {(autoCalendarMode && calendarEvent ? calendarEvent.banner_active : bannerActive) && (
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Banner Message Text</label>
                <input
                  type="text"
                  value={autoCalendarMode && calendarEvent ? calendarEvent.banner_text : bannerText}
                  onChange={(e) => setBannerText(e.target.value)}
                  disabled={autoCalendarMode && !!calendarEvent}
                  className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Social Proof Statistics Section */}
          <div className="border-t border-[#302117]/30 pt-6 mt-2">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0] flex items-center gap-2">
                <Sparkles size={12} className="text-[#f8bc51]" />
                Store Statistics (Social Proof)
              </h4>
              <button
                type="button"
                onClick={() => setSocialStatsActive(!socialStatsActive)}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${socialStatsActive ? 'bg-[#f8bc51]' : 'bg-[#302117]'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${socialStatsActive ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {socialStatsActive ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {socialStats.map((stat, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 bg-[#070402]/60 border border-[#302117] rounded-xl relative group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-mono text-[#d4c4b0]/60 uppercase">Stat {i + 1}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Large Value</label>
                    <input
                      type="text"
                      value={stat.value}
                      onChange={(e) => {
                        const newStats = [...socialStats];
                        newStats[i].value = e.target.value;
                        setSocialStats(newStats);
                      }}
                      placeholder="e.g. 3,600+"
                      className="bg-[#0A0604] border border-[#302117] rounded-lg px-3 py-1.5 text-xs text-[#f8bc51] font-bold focus:outline-none focus:border-[#f8bc51]/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Bottom Label</label>
                    <input
                      type="text"
                      value={stat.label}
                      onChange={(e) => {
                        const newStats = [...socialStats];
                        newStats[i].label = e.target.value;
                        setSocialStats(newStats);
                      }}
                      placeholder="e.g. Students"
                      className="bg-[#0A0604] border border-[#302117] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51]/50"
                    />
                  </div>
                </div>
              ))}
            </div>
            ) : null}
          </div>

          <div className="border-t border-[#302117]/30 pt-4 mt-2 flex items-center justify-between gap-4 flex-wrap">
            {/* Storefront Background Image Uploader */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setImageTab('storefront');
                  setUploadFile(null);
                  setUploadSuccess(false);
                  setIsAddingNew(false);
                  setEditingSlide(null);
                  // Scroll to media uploader
                  const el = document.getElementById('media-hub-uploader');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-[#302117]/40 hover:bg-[#302117]/80 border border-[#302117] text-[#d4c4b0] px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <ImageIcon size={12} className="text-[#f8bc51]" />
                Manage Storefront Bg
              </button>
              {heroImageUrl && (
                <span className="text-[9px] font-mono text-[#10b981] flex items-center gap-1">
                  <CheckCircle size={10} /> Active Bg
                </span>
              )}
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] rounded-xl py-3 px-6 font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
            >
              {savingSettings ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle size={14} />
              ) : (
                <Save size={14} />
              )}
              Save Storefront Settings
            </button>
          </div>
        </div>

        {/* Dynamic Seasonal Campaign Manager */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h3 className="font-serif italic text-xl text-white">📅 Dynamic Seasonal Campaign Manager</h3>
              <p className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase tracking-wider mt-0.5">Edit dates, layouts, themes, discounts and featured items for seasonal events</p>
            </div>
            <button
              onClick={startAddEvent}
              className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-4 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shrink-0"
            >
              + Add Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calendarEvents.map((ev) => {
              const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              return (
                <div 
                  key={ev.id} 
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    editingEvent?.id === ev.id 
                      ? 'bg-[#f8bc51]/10 border-[#f8bc51]/45 shadow-lg shadow-[#f8bc51]/5' 
                      : 'bg-[#070402]/30 border-[#302117] hover:border-[#f8bc51]/30'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div>
                      <h4 className="font-serif italic font-bold text-white text-base">{ev.eventName}</h4>
                      <p className="text-[10px] font-mono text-[#d4c4b0]/65 uppercase tracking-wider mt-0.5">
                        🗓️ {monthsList[ev.startMonth]} {ev.startDay} - {monthsList[ev.endMonth]} {ev.endDay}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditEvent(ev)}
                      className="bg-[#f8bc51]/10 hover:bg-[#f8bc51] text-[#f8bc51] hover:text-[#0A0604] px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-bold shrink-0"
                    >
                      <Edit2 size={10} /> Edit Campaign
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#302117]/30">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[#d4c4b0]/40 uppercase">Theme</span>
                      <span className="text-2xs text-[#f8bc51] uppercase font-mono truncate">{ev.active_theme}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[#d4c4b0]/40 uppercase">Layout</span>
                      <span className="text-2xs text-white uppercase font-mono truncate">{ev.layout_mode || 'slider'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-mono text-[#d4c4b0]/40 uppercase">Discount</span>
                      <span className="text-2xs text-emerald-400 font-mono truncate">
                        {ev.automatic_discount ? `${ev.automatic_discount.discount_percent}% OFF` : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {isEditingEventOpen && editingEvent && (
              <motion.form
                key="event-edit-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleSaveEvent}
                className="flex flex-col gap-4 bg-[#070402]/30 border border-[#f8bc51]/20 rounded-2xl p-5 mt-2"
              >
                <div className="flex justify-between items-center border-b border-[#302117]/30 pb-2">
                  <span className="font-mono text-xs text-[#f8bc51] uppercase font-bold tracking-wider">
                    ✍️ Editing Campaign: {editingEvent.eventName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingEventOpen(false);
                      setEditingEvent(null);
                    }}
                    className="text-[#d4c4b0]/60 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Campaign Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Campaign Event Name *</label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                      required
                    />
                  </div>

                  {/* Dynamic Theme selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Active Campaign Theme</label>
                    <select
                      value={eventTheme}
                      onChange={(e) => setEventTheme(e.target.value as any)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                    >
                      <option value="default">Default Amber Glow</option>
                      <option value="raining">Twilight Raining Teal</option>
                      <option value="exam">Studious Espresso Indigo</option>
                      <option value="fest">Gold-Leaf Festive Mesh</option>
                      <option value="night">Obsidian Midnight Purple</option>
                      <option value="valentines">Sweet Valentine's Pink</option>
                      <option value="scorching">Scorching Summer Orange</option>
                      <option value="custom">✨ Custom DIY Theme</option>
                    </select>
                  </div>

                  {/* Custom DIY Theme Colors */}
                  {eventTheme === 'custom' && (
                    <div className="flex flex-col gap-1.5 md:col-span-2 bg-[#120a06]/40 border border-[#f8bc51]/30 rounded-xl p-4">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#f8bc51] mb-2 inline-block">✨ Custom Theme Colors</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/60">Custom Glowing Aurora Hex</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={eventCustomAuroraColor}
                              onChange={(e) => setEventCustomAuroraColor(e.target.value)}
                              className="w-10 h-10 rounded-lg cursor-pointer bg-[#070402] border border-[#302117]"
                            />
                            <input
                              type="text"
                              value={eventCustomAuroraColor}
                              onChange={(e) => setEventCustomAuroraColor(e.target.value)}
                              placeholder="#f8bc51"
                              className="bg-[#070402] border border-[#302117] rounded-lg px-3 flex-1 text-sm font-mono focus:outline-none focus:border-[#f8bc51]"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/60">Custom Deep Background Hex</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={eventCustomBgColor}
                              onChange={(e) => setEventCustomBgColor(e.target.value)}
                              className="w-10 h-10 rounded-lg cursor-pointer bg-[#070402] border border-[#302117]"
                            />
                            <input
                              type="text"
                              value={eventCustomBgColor}
                              onChange={(e) => setEventCustomBgColor(e.target.value)}
                              placeholder="#0A0604"
                              className="bg-[#070402] border border-[#302117] rounded-lg px-3 flex-1 text-sm font-mono focus:outline-none focus:border-[#f8bc51]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Campaign Schedule Dates */}
                  <div className="flex flex-col gap-1.5 md:col-span-2 bg-[#0A0604]/60 border border-[#302117] rounded-xl p-4">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#f8bc51] mb-2 inline-block">Campaign Active Schedule</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Start Month</label>
                        <select
                          value={eventStartMonth}
                          onChange={(e) => setEventStartMonth(Number(e.target.value))}
                          className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                        >
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => (
                            <option key={idx} value={idx}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Start Day</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={eventStartDay}
                          onChange={(e) => setEventStartDay(Number(e.target.value))}
                          className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">End Month</label>
                        <select
                          value={eventEndMonth}
                          onChange={(e) => setEventEndMonth(Number(e.target.value))}
                          className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                        >
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => (
                            <option key={idx} value={idx}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">End Day</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={eventEndDay}
                          onChange={(e) => setEventEndDay(Number(e.target.value))}
                          className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Headline & Subtitle */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Storefront Headline</label>
                    <input
                      type="text"
                      value={eventHeadline}
                      onChange={(e) => setEventHeadline(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Storefront Subtitle</label>
                    <input
                      type="text"
                      value={eventSubText}
                      onChange={(e) => setEventSubText(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                      required
                    />
                  </div>

                  {/* Layout Mode selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Storefront Hero Layout Mode</label>
                    <select
                      value={eventLayoutMode}
                      onChange={(e) => setEventLayoutMode(e.target.value as any)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                    >
                      <option value="slider">Platter Slider (Default)</option>
                      <option value="grid_board">Campaign Grid Board (Blinkit Grid)</option>
                      <option value="summer_sips">Summer Sips Mockup</option>
                    </select>
                  </div>

                  {/* Auto Scroll Toggle */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <div className="flex items-center justify-between p-3 bg-[#120a06] border border-[#302117] rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-white font-serif italic">Auto Horizontal Scroll</p>
                        <p className="text-[10px] text-[#d4c4b0] font-mono uppercase tracking-widest mt-0.5">Automatically cycles through items</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eventAutoScrollEnabled}
                          onChange={(e) => setEventAutoScrollEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#302117] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#d4c4b0] peer-checked:after:bg-[#0A0604] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f8bc51]"></div>
                      </label>
                    </div>
                    {eventAutoScrollEnabled && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Scroll Interval (ms)</label>
                        <input
                          type="number"
                          value={eventAutoScrollInterval}
                          onChange={(e) => setEventAutoScrollInterval(Number(e.target.value))}
                          className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                          min="1000"
                          step="500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Background graphic cover url */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Background Campaign Cover URL</label>
                    <input
                      type="url"
                      value={eventBgImage}
                      onChange={(e) => setEventBgImage(e.target.value)}
                      placeholder="https://..."
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51] font-mono"
                    />
                  </div>

                  {/* Discount percent and description */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Automatic Discount (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={eventDiscountPercent}
                      onChange={(e) => setEventDiscountPercent(Number(e.target.value))}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51] font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Discount Description</label>
                    <input
                      type="text"
                      value={eventDiscountDesc}
                      onChange={(e) => setEventDiscountDesc(e.target.value)}
                      placeholder="e.g. Monsoon Cozy Rain Offer"
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                    />
                  </div>

                  {/* Banner Active toggle & Text */}
                  <div className="flex flex-col gap-1.5 md:col-span-2 border-t border-[#302117]/30 pt-3.5 mt-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-2xs uppercase tracking-wider text-[#d4c4b0] font-semibold">Active Operational Banner</span>
                      <input
                        type="checkbox"
                        checked={eventBannerActive}
                        onChange={(e) => setEventBannerActive(e.target.checked)}
                        className="accent-[#f8bc51] w-4 h-4 cursor-pointer"
                      />
                    </div>
                    {eventBannerActive && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Banner Message Text</label>
                          <input
                            type="text"
                            value={eventBannerText}
                            onChange={(e) => setEventBannerText(e.target.value)}
                            className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f8bc51]"
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Banner Color</label>
                          <select
                            value={eventBannerColor}
                            onChange={(e) => setEventBannerColor(e.target.value as any)}
                            className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                          >
                            <option value="golden">Golden Accents</option>
                            <option value="urgent">Urgent Coral Red</option>
                            <option value="success">Success Mint Green</option>
                            <option value="dark">Basalt Obsidian</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Featured Items Multiselect Capsules */}
                  <div className="flex flex-col gap-1.5 md:col-span-2 border-t border-[#302117]/30 pt-3.5 mt-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0] mb-1 block">Featured Campaign Menu Items</label>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-[#070402]/60 border border-[#302117] rounded-xl custom-scrollbar">
                      {menuItems.map((item) => {
                        const isFeatured = eventFeaturedItemIds.includes(item.item_id);
                        return (
                          <button
                            type="button"
                            key={item.item_id}
                            onClick={() => {
                              if (isFeatured) {
                                setEventFeaturedItemIds(eventFeaturedItemIds.filter(id => id !== item.item_id));
                              } else {
                                setEventFeaturedItemIds([...eventFeaturedItemIds, item.item_id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full font-mono text-2xs uppercase tracking-wider border transition-all ${
                              isFeatured
                                ? 'bg-[#f8bc51] border-[#f8bc51] text-[#0A0604] font-bold'
                                : 'bg-[#070402]/30 border-[#302117] text-[#d4c4b0]/70 hover:border-[#f8bc51]/40'
                            }`}
                          >
                            {item.name} ({item.category})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Advanced Particle Overrides */}
                  <div className="flex flex-col gap-1.5 md:col-span-2 border-t border-[#302117]/30 pt-3.5 mt-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0] mb-1 block">Advanced Floating Animation Overrides</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Custom Falling Emojis (Comma Separated)</label>
                        <input
                          type="text"
                          value={eventCustomParticles}
                          onChange={(e) => setEventCustomParticles(e.target.value)}
                          placeholder="e.g. 🌹,🌸,🎇,🔔"
                          className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f8bc51]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Particle Count (Density)</label>
                        <input
                          type="number"
                          value={eventParticleCount}
                          onChange={(e) => setEventParticleCount(Number(e.target.value))}
                          placeholder="Default 15"
                          className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f8bc51]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Base Size (Scale Factor)</label>
                        <input
                          type="number"
                          value={eventParticleSize}
                          onChange={(e) => setEventParticleSize(Number(e.target.value))}
                          placeholder="Default 10"
                          className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f8bc51]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Base Speed (Duration in Secs)</label>
                        <input
                          type="number"
                          value={eventParticleSpeed}
                          onChange={(e) => setEventParticleSpeed(Number(e.target.value))}
                          placeholder="Default 10"
                          className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f8bc51]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/40">Base Rotation (Degrees)</label>
                        <input
                          type="number"
                          value={eventParticleRotation}
                          onChange={(e) => setEventParticleRotation(Number(e.target.value))}
                          placeholder="Default 360"
                          className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f8bc51]"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                <div className="flex justify-between items-center pt-3 border-t border-[#302117]/30 mt-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEvent.id)}
                    className="bg-red-900/20 hover:bg-red-900/40 border border-red-900/40 text-red-400 px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-colors"
                  >
                    Delete Campaign
                  </button>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingEventOpen(false);
                        setEditingEvent(null);
                      }}
                      className="bg-[#302117]/40 hover:bg-[#302117]/80 border border-[#302117] text-[#d4c4b0] px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-5 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Save size={12} /> Save Campaign
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Campaign Grid Board CMS Manager */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-5">

          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h3 className="font-serif italic text-xl text-white">Campaign Grid Board CMS</h3>
              <p className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase tracking-wider mt-0.5">Manage grid promotional cards, banner ribbons and badges</p>
            </div>
            {!isAddingGridCard && !editingGridCard && (
              <button
                type="button"
                onClick={startAddNewGridCard}
                className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-4 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
              >
                <Plus size={12} /> Add Grid Card
              </button>
            )}
          </div>

          {effectiveLayoutMode !== 'grid_board' && (
            <div className="bg-[#f8bc51]/5 border border-[#f8bc51]/10 rounded-xl p-3 text-[10px] text-[#f8bc51]/70 leading-relaxed font-mono">
              ⚠️ Note: Storefront Hero Layout Mode is currently set to <strong>"{effectiveLayoutMode}"</strong>. To display this Grid Board, switch Layout Mode to <strong>"Campaign Grid Board"</strong> above or adjust the mock date to an active grid board campaign.
            </div>
          )}

          {/* Grid Board Global Settings */}
          {!isAddingGridCard && !editingGridCard && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-[#302117]/30 pb-4 mb-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Grid Board Title</label>
                <input
                  type="text"
                  placeholder="e.g. Featured Specials"
                  value={autoCalendarMode && calendarEvent ? calendarEvent.grid_board_title : gridBoardTitle}
                  onChange={(e) => setGridBoardTitle(e.target.value)}
                  disabled={autoCalendarMode && !!calendarEvent}
                  className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#f8bc51] transition-colors disabled:opacity-40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Badge / Toggle Text</label>
                <input
                  type="text"
                  placeholder="e.g. SINGLE MODE"
                  value={autoCalendarMode && calendarEvent ? calendarEvent.grid_board_badge_text : gridBoardBadgeText}
                  onChange={(e) => setGridBoardBadgeText(e.target.value)}
                  disabled={autoCalendarMode && !!calendarEvent}
                  className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#f8bc51] transition-colors disabled:opacity-40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Ribbon Ticker Text</label>
                <input
                  type="text"
                  placeholder="e.g. LONG DISTANCE IS NO EXCUSE 💝"
                  value={autoCalendarMode && calendarEvent ? calendarEvent.grid_board_ribbon_text : gridBoardRibbonText}
                  onChange={(e) => setGridBoardRibbonText(e.target.value)}
                  disabled={autoCalendarMode && !!calendarEvent}
                  className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#f8bc51] transition-colors disabled:opacity-40"
                />
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {(isAddingGridCard || editingGridCard) ? (
              <motion.form
                key="grid-card-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleSaveGridCard}
                className="flex flex-col gap-4 bg-[#070402]/30 border border-[#302117] rounded-2xl p-5"
              >
                <div className="flex justify-between items-center border-b border-[#302117]/30 pb-2">
                  <span className="font-mono text-xs text-[#f8bc51] uppercase font-bold tracking-wider">
                    {editingGridCard ? 'Edit Grid Card Tile' : 'Add New Grid Card Tile'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingGridCard(false);
                      setEditingGridCard(null);
                    }}
                    className="text-[#d4c4b0]/60 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card Title */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Card Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Promise Day Specials"
                      value={cardTitle}
                      onChange={(e) => setCardTitle(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                      required
                    />
                  </div>

                  {/* Card Subtitle */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Card Subtitle (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Gifts for Her"
                      value={cardSubtitle}
                      onChange={(e) => setCardSubtitle(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                    />
                  </div>

                  {/* Price/Badge text */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Card Price Badge / Tag Text</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹699 or Gifts"
                      value={cardPriceText}
                      onChange={(e) => setCardPriceText(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                    />
                  </div>

                  {/* Redirect Type selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Action Click Redirect Target *</label>
                    <select
                      value={cardRedirectType}
                      onChange={(e) => {
                        setCardRedirectType(e.target.value as any);
                        setCardRedirectValue('');
                      }}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                    >
                      <option value="category">Scroll to Category</option>
                      <option value="item">Open Catalog Customization Sheet</option>
                    </select>
                  </div>

                  {/* Redirect Value selector */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Redirect Target Value *</label>
                    {cardRedirectType === 'category' ? (
                      <select
                        value={cardRedirectValue}
                        onChange={(e) => setCardRedirectValue(e.target.value)}
                        className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                        required
                      >
                        <option value="">-- Select Category --</option>
                        <option value="Biryani">Biryani</option>
                        <option value="Momos">Momos</option>
                        <option value="Burgers">Burgers</option>
                        <option value="Waffles">Waffles</option>
                        <option value="Snacks">Snacks</option>
                        <option value="Beverages">Beverages</option>
                      </select>
                    ) : (
                      <select
                        value={cardRedirectValue}
                        onChange={(e) => setCardRedirectValue(e.target.value)}
                        className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                        required
                      >
                        <option value="">-- Select Catalog Menu Item --</option>
                        {menuItems.map(item => (
                          <option key={item.item_id} value={item.item_id}>
                            {item.name} ({item.category} - ₹{item.price})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Card Image URL with Quick upload button */}
                  <div className="flex flex-col gap-2 md:col-span-2 pt-2 border-t border-[#302117]/30">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Grid Card Promotional Graphic Cover *</label>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <div className="flex-1 w-full">
                        <input
                          type="url"
                          placeholder="Image URL (Upload or paste Canva design link)"
                          value={cardImageUrl}
                          onChange={(e) => setCardImageUrl(e.target.value)}
                          className="w-full bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#f8bc51] font-mono"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImageTab('grid_card');
                          setUploadFile(null);
                          setUploadSuccess(false);
                          const el = document.getElementById('media-hub-uploader');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="bg-[#302117]/40 hover:bg-[#302117]/80 border border-[#302117] text-[#d4c4b0] px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <Upload size={12} className="text-[#f8bc51]" />
                        Upload via Hub
                      </button>
                    </div>
                    {cardImageUrl && (
                      <div className="w-16 h-16 rounded-lg border border-[#302117] bg-[#070402] flex items-center justify-center p-1.5 mt-1">
                        <img src={cardImageUrl} alt="Card Thumbnail" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                  </div>

                  {/* Blend Mode Selector */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Image Blend Mode</label>
                    <select
                      value={cardBlendMode}
                      onChange={(e) => setCardBlendMode(e.target.value as any)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                    >
                      <option value="normal">Normal (Best for Transparent PNGs)</option>
                      <option value="screen">Screen (Hides black backgrounds)</option>
                      <option value="multiply">Multiply (Hides white backgrounds)</option>
                    </select>
                    <p className="text-[9px] text-[#d4c4b0]/50 mt-1">
                      If your image has a transparent background, use "Normal". If it has a solid black background, use "Screen" to make the black transparent.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#302117]/30">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingGridCard(false);
                      setEditingGridCard(null);
                    }}
                    className="bg-transparent border border-[#302117] hover:bg-[#302117]/30 text-[#d4c4b0] px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-5 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle size={12} /> {editingGridCard ? 'Update Card' : 'Add Card to Grid'}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="grid-cards-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                {gridCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 border border-[#302117] border-dashed rounded-2xl text-center gap-2">
                    <Utensils className="text-[#d4c4b0]/25 w-8 h-8" />
                    <p className="text-xs text-[#d4c4b0]/45">No custom grid promo cards configured yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {gridCards.map((card) => (
                        <div
                          key={card.id}
                          className="bg-[#070402]/30 border border-[#302117] hover:border-[#302117]/90 rounded-2xl p-4 flex gap-4 transition-all relative group"
                        >
                          <div className="w-16 h-16 rounded-xl border border-white/5 bg-[#070402]/60 flex items-center justify-center p-1.5 shrink-0 self-center overflow-hidden">
                            <img src={card.image_url} alt={card.title} className="max-h-full max-w-full object-contain" />
                          </div>

                          <div className="flex-1 flex flex-col min-w-0 justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[8px] text-[#f8bc51] font-bold uppercase tracking-wider">
                                  {card.redirect_type === 'category' ? `Category: ${card.redirect_value}` : 'Action: Open Customizer'}
                                </span>
                              </div>
                              <h4 className="font-serif italic font-bold text-white text-sm truncate mt-0.5">
                                {card.title}
                              </h4>
                              {card.subtitle && (
                                <p className="text-[10px] text-[#d4c4b0]/60 truncate mt-0.5">
                                  {card.subtitle}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between border-t border-[#302117]/30 pt-2 mt-2">
                              <span className="font-mono text-[9px] text-[#e8621a] font-bold">
                                {card.price_text || 'Promo Link'}
                              </span>
                              
                              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => startEditGridCard(card)}
                                  className="p-1.5 text-sky-400 hover:bg-sky-400/10 rounded-lg transition-colors"
                                  title="Edit card"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGridCard(card.id)}
                                  className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                                  title="Delete card"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-[9px] text-[#d4c4b0]/40 font-mono italic mt-1 text-center">
                      💡 Tip: Standard Blinkit layouts work best with exactly 4 promotional cards in a 2x2 grid. Remember to click "Save Storefront Settings" to publish.
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Summer Sips CMS Manager */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h3 className="font-serif italic text-xl text-white">Summer Sips CMS</h3>
              <p className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase tracking-wider mt-0.5">Manage summer drinks, categories, and backgrounds</p>
            </div>
            <div className="flex gap-2">
              {!isAddingCat && !editingCat && (
                <button
                  type="button"
                  onClick={startAddNewCat}
                  className="bg-[#0A0604] border border-[#f8bc51] text-[#f8bc51] hover:bg-[#f8bc51]/10 px-4 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                >
                  <Plus size={12} /> Add Category
                </button>
              )}
              {!isAddingDrink && !editingDrink && (
                <button
                  type="button"
                  onClick={startAddNewDrink}
                  className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-4 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                >
                  <Plus size={12} /> Add Drink
                </button>
              )}
            </div>
          </div>

          {effectiveLayoutMode !== 'summer_sips' && (
            <div className="bg-[#f8bc51]/5 border border-[#f8bc51]/10 rounded-xl p-3 text-[10px] text-[#f8bc51]/70 leading-relaxed font-mono">
              ☀️ Note: Storefront Hero Layout Mode is currently set to <strong>"{effectiveLayoutMode}"</strong>. To display the Summer Sips campaign, switch Layout Mode to <strong>"Summer Sips"</strong> above.
            </div>
          )}

          {/* Global Summer Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#302117]/30 pb-4 mb-2">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Hero Title</label>
              <input
                type="text"
                placeholder="e.g. Summer Chill Zone."
                value={summerHeroTitle}
                onChange={(e) => setSummerHeroTitle(e.target.value)}
                className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#f8bc51] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Hero Subtitle</label>
              <input
                type="text"
                placeholder="e.g. Refreshing Cold Drinks = Perfect Summer."
                value={summerHeroSub}
                onChange={(e) => setSummerHeroSub(e.target.value)}
                className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#f8bc51] transition-colors"
              />
            </div>
          </div>

          {/* Drink Form */}
          <AnimatePresence mode="wait">
            {(isAddingDrink || editingDrink) && (
              <motion.form
                key="drink-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleSaveDrink}
                className="flex flex-col gap-4 bg-[#070402]/30 border border-[#302117] rounded-2xl p-5 mb-4"
              >
                <div className="flex justify-between items-center border-b border-[#302117]/30 pb-2">
                  <span className="font-mono text-xs text-[#f8bc51] uppercase font-bold tracking-wider">
                    {editingDrink ? 'Edit Summer Drink' : 'Add New Drink'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingDrink(false);
                      setEditingDrink(null);
                    }}
                    className="text-[#d4c4b0]/60 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Drink Name *</label>
                    <input type="text" value={drinkTitle} onChange={e => setDrinkTitle(e.target.value)} required className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Subtitle</label>
                    <input type="text" value={drinkSubtitle} onChange={e => setDrinkSubtitle(e.target.value)} className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Price (₹) *</label>
                    <input type="number" value={drinkPrice} onChange={e => setDrinkPrice(Number(e.target.value))} required className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Original Price (₹)</label>
                    <input type="number" value={drinkOriginalPrice} onChange={e => setDrinkOriginalPrice(Number(e.target.value))} className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Tag / Badge *</label>
                    <input type="text" value={drinkTag} onChange={e => setDrinkTag(e.target.value)} required className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Description *</label>
                    <input type="text" value={drinkDesc} onChange={e => setDrinkDesc(e.target.value)} required className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Drink Image URL *</label>
                    <div className="flex gap-2">
                      <input type="url" value={drinkImageUrl} onChange={e => setDrinkImageUrl(e.target.value)} required className="flex-1 bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                      <button type="button" onClick={() => { setImageTab('summer_drink'); const el = document.getElementById('media-hub-uploader'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="bg-[#302117]/40 px-4 rounded-xl text-[10px] uppercase font-mono border border-[#302117]">Hub</button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Image Blend Mode</label>
                    <select value={drinkBlendMode} onChange={e => setDrinkBlendMode(e.target.value as any)} className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white">
                      <option value="normal">Normal (Transparent PNG)</option>
                      <option value="screen">Screen (Black Bg)</option>
                      <option value="multiply">Multiply (White Bg)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button type="button" onClick={() => { setIsAddingDrink(false); setEditingDrink(null); }} className="px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider border border-[#302117]">Cancel</button>
                  <button type="submit" className="bg-[#f8bc51] text-[#0A0604] px-5 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider">{editingDrink ? 'Update Drink' : 'Add Drink'}</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Category Form */}
          <AnimatePresence mode="wait">
            {(isAddingCat || editingCat) && (
              <motion.form
                key="cat-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleSaveCat}
                className="flex flex-col gap-4 bg-[#070402]/30 border border-[#302117] rounded-2xl p-5 mb-4"
              >
                <div className="flex justify-between items-center border-b border-[#302117]/30 pb-2">
                  <span className="font-mono text-xs text-[#f8bc51] uppercase font-bold tracking-wider">
                    {editingCat ? 'Edit Category' : 'Add New Category'}
                  </span>
                  <button type="button" onClick={() => { setIsAddingCat(false); setEditingCat(null); }} className="text-[#d4c4b0]/60"><X size={16} /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Category Title *</label>
                    <input type="text" value={catTitle} onChange={e => setCatTitle(e.target.value)} required className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Redirect ID *</label>
                    <input type="text" value={catRedirectCategory} onChange={e => setCatRedirectCategory(e.target.value)} required className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Icon Type</label>
                    <select value={catIconType} onChange={e => setCatIconType(e.target.value as 'emoji'|'image')} className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm">
                      <option value="emoji">Emoji 🌴</option>
                      <option value="image">Image URL</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Icon Value *</label>
                    <div className="flex gap-2">
                      <input type="text" value={catIconValue} onChange={e => setCatIconValue(e.target.value)} placeholder={catIconType === 'emoji' ? 'e.g. 🍹' : 'https://...'} required className="flex-1 bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm" />
                      {catIconType === 'image' && (
                        <button type="button" onClick={() => { setImageTab('summer_cat'); const el = document.getElementById('media-hub-uploader'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="bg-[#302117]/40 px-4 rounded-xl text-[10px] uppercase font-mono border border-[#302117] text-[#d4c4b0] hover:bg-[#302117]/80 hover:text-white transition-all">Hub</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button type="button" onClick={() => { setIsAddingCat(false); setEditingCat(null); }} className="px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider border border-[#302117]">Cancel</button>
                  <button type="submit" className="bg-[#f8bc51] text-[#0A0604] px-5 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider">{editingCat ? 'Update Category' : 'Add Category'}</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Drinks */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]/50 mb-3">Active Drinks</h4>
            {summerDrinks.length === 0 ? (
              <div className="p-4 border border-dashed border-[#302117] rounded-xl text-center text-xs text-[#d4c4b0]/40">No drinks configured.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summerDrinks.map(drink => (
                  <div key={drink.id} className="bg-[#070402]/30 border border-[#302117] rounded-xl p-3 flex gap-3 items-center group">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden relative border border-white/5">
                      <img src={drink.imageUrl} alt={drink.title} className="max-w-full max-h-full object-contain" style={{ mixBlendMode: drink.blendMode || 'normal' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-sm text-white truncate">{drink.title}</h5>
                      <p className="text-[10px] text-[#f8bc51] font-mono">₹{drink.price}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEditDrink(drink)} className="p-1.5 text-sky-400 hover:bg-sky-400/10 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={() => handleDeleteDrink(drink.id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* List of Categories */}
          <div className="mt-2">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]/50 mb-3">Active Categories</h4>
            {summerCategories.length === 0 ? (
              <div className="p-4 border border-dashed border-[#302117] rounded-xl text-center text-xs text-[#d4c4b0]/40">No categories configured.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {summerCategories.map(cat => (
                  <div key={cat.id} className="bg-[#070402]/30 border border-[#302117] rounded-xl p-2 flex items-center justify-between group">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {cat.iconType === 'emoji' ? <span className="text-lg">{cat.iconValue}</span> : <img src={cat.iconValue} className="w-6 h-6 object-contain" style={{ mixBlendMode: cat.blendMode || 'normal' }}/>}
                      <span className="font-bold text-[10px] text-white truncate">{cat.title}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditCat(cat)} className="p-1 text-sky-400 hover:bg-sky-400/10 rounded"><Edit2 size={10} /></button>
                      <button onClick={() => handleDeleteCat(cat.id)} className="p-1 text-rose-400 hover:bg-rose-400/10 rounded"><Trash2 size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


        {/* Hero Slider CMS Manager */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h3 className="font-serif italic text-xl text-white">Hero Carousel Slides CMS</h3>
              <p className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase tracking-wider mt-0.5">Manage premium customer landing scroller items</p>
            </div>
            {!isAddingNew && !editingSlide && (
              <button
                onClick={startAddNewSlide}
                className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-4 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
              >
                <Plus size={12} /> Add New Slide
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* Displaying Add/Edit Form */}
            {(isAddingNew || editingSlide) ? (
              <motion.form
                key="slide-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleSaveSlide}
                className="flex flex-col gap-4 bg-[#070402]/30 border border-[#302117] rounded-2xl p-5"
              >
                <div className="flex justify-between items-center border-b border-[#302117]/30 pb-2">
                  <span className="font-mono text-xs text-[#f8bc51] uppercase font-bold tracking-wider">
                    {generatingSlideAI ? (
                      <span className="flex items-center gap-1.5 text-[#f8bc51] animate-pulse">
                        <Sparkles size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
                        Hau Hau AI is crafting slide details...
                      </span>
                    ) : (
                      editingSlide ? 'Editing Slide parameters' : 'New Slide parameters'
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingSlide(null);
                    }}
                    className="text-[#d4c4b0]/60 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Linked Menu Item Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Link Menu Item *</label>
                    <div className="flex gap-2">
                      <select
                        value={slideMenuItemId}
                        onChange={(e) => handleSelectMenuItemForSlide(e.target.value)}
                        className="flex-1 bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                      >
                        <option value="">-- Choose Item --</option>
                        {menuItems.map((item) => (
                          <option key={item.item_id} value={item.item_id}>
                            {item.name} (₹{item.price})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleGenerateAIDetails}
                        disabled={generatingSlideAI || !slideMenuItemId}
                        className="bg-[#f8bc51]/10 border border-[#f8bc51]/25 hover:border-[#f8bc51]/40 hover:bg-[#f8bc51]/20 text-[#f8bc51] disabled:opacity-30 disabled:pointer-events-none rounded-xl px-4 flex items-center justify-center gap-1.5 transition-all text-[10px] font-mono tracking-widest uppercase font-bold shrink-0 active:scale-95 shadow-inner"
                        title="AI Craft description, tags, accents, & backgrounds"
                      >
                        {generatingSlideAI ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} className="text-[#f8bc51] animate-pulse" />
                        )}
                        <span>AI Craft</span>
                      </button>
                    </div>
                  </div>

                  {/* Highlight/Category Tag */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Category Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. AROMATIC BASMATI EXCELLENCE"
                      value={slideTag}
                      onChange={(e) => setSlideTag(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                    />
                  </div>

                  {/* Title Line 1 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Title Line 1</label>
                    <input
                      type="text"
                      placeholder="e.g. Nizami Canopy"
                      value={slideLine1}
                      onChange={(e) => setSlideLine1(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Title Line 2 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Title Line 2</label>
                    <input
                      type="text"
                      placeholder="e.g. Biryani"
                      value={slideLine2}
                      onChange={(e) => setSlideLine2(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Wait Time */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Base Wait Time (mins)</label>
                    <input
                      type="number"
                      value={slideTime}
                      onChange={(e) => setSlideTime(Number(e.target.value))}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono"
                    />
                  </div>

                  {/* Price Override */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Slide Price Override (₹)</label>
                    <input
                      type="number"
                      value={slidePrice}
                      onChange={(e) => setSlidePrice(Number(e.target.value))}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono"
                    />
                  </div>

                  {/* Highlights/Tags */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Slide Highlight Tags (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Dum Baked, Saffron Rice, Mint Leaves"
                      value={slideTagsText}
                      onChange={(e) => setSlideTagsText(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Interesting Description */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Interesting Custom Description</label>
                    <textarea
                      rows={3}
                      placeholder="Write an extremely appetizing copy describing the item..."
                      value={slideDesc}
                      onChange={(e) => setSlideDesc(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#f8bc51]"
                    />
                  </div>

                  {/* Accent Color */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Accent Highlight Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={slideAccentColor}
                        onChange={(e) => setSlideAccentColor(e.target.value)}
                        className="w-10 h-10 bg-transparent border-0 cursor-pointer rounded"
                      />
                      <input
                        type="text"
                        value={slideAccentColor}
                        onChange={(e) => setSlideAccentColor(e.target.value)}
                        className="flex-1 bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Sort Order */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Sort Order / Priority</label>
                    <input
                      type="number"
                      value={slideSortOrder}
                      onChange={(e) => setSlideSortOrder(Number(e.target.value))}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm focus:outline-none font-mono"
                    />
                  </div>

                  {/* Background Gradient selector */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Background Radial Gradient</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2 font-mono text-[8px] uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => setSlideBgColor('radial-gradient(circle at center, #63503B 0%, #2A2118 100%)')}
                        className={`p-2 border rounded-lg text-center ${slideBgColor.includes('#63503B') ? 'border-[#f8bc51] text-[#f8bc51] bg-[#f8bc51]/5' : 'border-[#302117]'}`}
                      >
                        Amber Brown
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideBgColor('radial-gradient(circle at center, #E8621A 0%, #1A0A02 100%)')}
                        className={`p-2 border rounded-lg text-center ${slideBgColor.includes('#E8621A') ? 'border-[#f8bc51] text-[#f8bc51] bg-[#f8bc51]/5' : 'border-[#302117]'}`}
                      >
                        Sunset Orange
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideBgColor('radial-gradient(circle at center, #2E7D5E 0%, #0B241A 100%)')}
                        className={`p-2 border rounded-lg text-center ${slideBgColor.includes('#2E7D5E') ? 'border-[#f8bc51] text-[#f8bc51] bg-[#f8bc51]/5' : 'border-[#302117]'}`}
                      >
                        Forest Teal
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideBgColor('radial-gradient(circle at center, #D4A832 0%, #251B03 100%)')}
                        className={`p-2 border rounded-lg text-center ${slideBgColor.includes('#D4A832') ? 'border-[#f8bc51] text-[#f8bc51] bg-[#f8bc51]/5' : 'border-[#302117]'}`}
                      >
                        Lemon Gold
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideBgColor('radial-gradient(circle at center, #7C3AED 0%, #1F0A42 100%)')}
                        className={`p-2 border rounded-lg text-center ${slideBgColor.includes('#7C3AED') ? 'border-[#f8bc51] text-[#f8bc51] bg-[#f8bc51]/5' : 'border-[#302117]'}`}
                      >
                        Midnight Purple
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="radial-gradient(circle at center, #color1 0%, #color2 100%)"
                      value={slideBgColor}
                      onChange={(e) => setSlideBgColor(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs focus:outline-none font-mono"
                    />
                  </div>

                  {/* Transparent PNG uploader connector */}
                  <div className="flex flex-col gap-2 md:col-span-2 pt-2 border-t border-[#302117]/30">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Slide Transparent PNG Photo *</label>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      {slideImageUrl && (
                        <div className="w-20 h-20 rounded-full border border-[#f8bc51]/20 bg-[#070402] flex items-center justify-center p-2 shrink-0">
                          <img src={slideImageUrl} alt="Slide preview" className="w-16 h-16 object-contain" />
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => {
                          setImageTab('slide');
                          setUploadFile(null);
                          setUploadSuccess(false);
                          const el = document.getElementById('media-hub-uploader');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="bg-[#302117]/40 hover:bg-[#302117]/80 border border-[#302117] text-[#d4c4b0] px-4 py-3 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 w-full justify-center"
                      >
                        <Upload size={14} className="text-[#f8bc51]" />
                        {slideImageUrl ? 'Upload replacement transparent PNG' : 'Upload transparent PNG'}
                      </button>
                    </div>
                  </div>

                  {/* Blend Mode Selector for Slide */}
                  <div className="flex flex-col gap-1.5 md:col-span-2 mt-2">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Image Blend Mode</label>
                    <select
                      value={slideBlendMode}
                      onChange={(e) => setSlideBlendMode(e.target.value as any)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] font-mono"
                    >
                      <option value="normal">Normal (Best for Transparent PNGs)</option>
                      <option value="screen">Screen (Hides black backgrounds)</option>
                      <option value="multiply">Multiply (Hides white backgrounds)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#302117]/30">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingSlide(null);
                    }}
                    className="bg-transparent border border-[#302117] hover:bg-[#302117]/30 text-[#d4c4b0] px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-5 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle size={12} /> Save Slide Parameters
                  </button>
                </div>
              </motion.form>
            ) : (
              /* Displaying list of existing slides */
              <motion.div
                key="slide-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                {sliderItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 border border-[#302117] border-dashed rounded-2xl text-center gap-2">
                    <Utensils className="text-[#d4c4b0]/25 w-8 h-8" />
                    <p className="text-xs text-[#d4c4b0]/45">No custom carousel slides exist. Rendering defaults on storefront.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sliderItems.map((slide) => {
                      const linkedItem = menuItems.find(m => m.item_id === slide.menuItemId);
                      return (
                        <div
                          key={slide.id}
                          className="bg-[#070402]/30 border border-[#302117] hover:border-[#302117]/90 rounded-2xl p-4 flex gap-4 transition-all relative group"
                        >
                          {/* Slide transparent PNG preview */}
                          <div className="w-16 h-16 rounded-full border border-white/5 bg-[#070402]/60 flex items-center justify-center p-2 shrink-0 self-center">
                            <img src={slide.image_url} alt={slide.line1} className="w-12 h-12 object-contain" />
                          </div>

                          <div className="flex-1 flex flex-col min-w-0 justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[8px] text-[#f8bc51] font-bold uppercase tracking-wider">{slide.tag}</span>
                                <span className="font-mono text-[8px] text-[#d4c4b0]/40">Order: {slide.sort_order}</span>
                              </div>
                              <h4 className="font-serif italic font-bold text-white text-sm truncate mt-0.5">
                                {slide.line1} {slide.line2}
                              </h4>
                              <p className="text-[10px] text-[#d4c4b0]/60 truncate mt-1">
                                {slide.desc}
                              </p>
                            </div>

                            <div className="flex items-center justify-between border-t border-[#302117]/30 pt-2 mt-2">
                              <span className="font-mono text-[10px] text-white">
                                ₹{slide.price} <span className="text-[#d4c4b0]/40 text-[8px] font-normal">({slide.time}m)</span>
                              </span>
                              
                              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEditSlide(slide)}
                                  className="p-1.5 text-sky-400 hover:bg-sky-400/10 rounded-lg transition-colors"
                                  title="Edit slide"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSlide(slide.id)}
                                  className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                                  title="Delete slide"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Column 3: Media Upload Hub & Live Preview */}
      <div className="flex flex-col gap-6">
        
        {/* Media Hub Uploader box */}
        <div 
          id="media-hub-uploader"
          className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4"
        >
          <h3 className="font-serif italic text-lg text-white border-b border-[#302117]/60 pb-2">Atmosphere Media Uploader</h3>

          <div className="grid grid-cols-3 bg-[#070402] border border-[#302117] rounded-xl p-1 text-center font-mono text-[9.5px] uppercase tracking-wider gap-0.5">
            <button
              type="button"
              onClick={() => {
                setImageTab('storefront');
                setUploadFile(null);
                setUploadSuccess(false);
              }}
              className={`py-1.5 rounded-lg transition-all ${imageTab === 'storefront' ? 'bg-[#f8bc51] text-[#0A0604] font-bold' : 'text-[#d4c4b0] hover:text-white'}`}
            >
              Bg Cover
            </button>
            <button
              type="button"
              onClick={() => {
                setImageTab('slide');
                setUploadFile(null);
                setUploadSuccess(false);
              }}
              className={`py-1.5 rounded-lg transition-all ${imageTab === 'slide' ? 'bg-[#f8bc51] text-[#0A0604] font-bold' : 'text-[#d4c4b0] hover:text-white'}`}
            >
              Slide png
            </button>
            <button
              type="button"
              onClick={() => {
                setImageTab('grid_card');
                setUploadFile(null);
                setUploadSuccess(false);
              }}
              className={`py-1.5 rounded-lg transition-all ${imageTab === 'grid_card' ? 'bg-[#f8bc51] text-[#0A0604] font-bold' : 'text-[#d4c4b0] hover:text-white'}`}
            >
              Grid Tile
            </button>
            <button
              type="button"
              onClick={() => {
                setImageTab('summer_drink');
                setUploadFile(null);
                setUploadSuccess(false);
              }}
              className={`py-1.5 px-2 rounded-lg transition-all ${imageTab === 'summer_drink' ? 'bg-[#f8bc51] text-[#0A0604] font-bold' : 'text-[#d4c4b0] hover:text-white'}`}
            >
              Drink
            </button>
            <button
              type="button"
              onClick={() => {
                setImageTab('summer_cat');
                setUploadFile(null);
                setUploadSuccess(false);
              }}
              className={`py-1.5 px-2 rounded-lg transition-all ${imageTab === 'summer_cat' ? 'bg-[#f8bc51] text-[#0A0604] font-bold' : 'text-[#d4c4b0] hover:text-white'}`}
            >
              Cat Icon
            </button>
          </div>

          <div className="flex flex-col gap-4">
            
            <form onSubmit={handleImageUpload} className="flex flex-col gap-4">
              
              {/* Drag-and-drop / upload file input */}
              <div className="relative group border-2 border-dashed border-[#302117] hover:border-[#f8bc51] rounded-2xl p-6 cursor-pointer text-center bg-[#070402]/30 min-h-[140px] flex items-center justify-center transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {uploadFile ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <ImageIcon className="text-[#f8bc51] w-7 h-7" />
                    <p className="text-white text-xs truncate max-w-[180px] font-semibold">{uploadFile.name}</p>
                    <p className="text-[9px] text-[#d4c4b0]/40 font-mono">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload className="text-[#d4c4b0] w-7 h-7 group-hover:text-[#f8bc51] transition-colors" />
                    <div>
                      <p className="text-white text-xs font-semibold">
                        {imageTab === 'storefront' 
                          ? 'Upload background cover' 
                          : imageTab === 'slide' 
                            ? 'Upload transparent PNG'
                            : 'Upload Grid Promo Tile'}
                      </p>
                      <p className="text-[9px] text-[#d4c4b0]/50 mt-0.5 font-mono">Click or drag image here</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload action button */}
              <button
                type="submit"
                disabled={!uploadFile || uploading}
                className="w-full bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] disabled:bg-[#302117] disabled:text-[#d4c4b0]/30 rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-md"
              >
                {uploading ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Uploading to Cloudinary...
                  </>
                ) : (
                  imageTab === 'storefront' 
                    ? 'Upload Background URL' 
                    : imageTab === 'slide'
                      ? 'Upload Slide Photo'
                      : imageTab === 'grid_card'
                        ? 'Upload Grid Tile Graphic'
                        : imageTab === 'summer_drink'
                          ? 'Upload Drink Image'
                          : 'Upload Category Icon'
                )}
              </button>

              {/* Thumbnail Previews depending on active tab */}
              {imageTab === 'storefront' && heroImageUrl && (
                <div className="bg-[#070402]/60 border border-[#302117] rounded-xl p-3.5 flex flex-col gap-2 relative">
                  <span className="font-mono text-[9px] text-[#f8bc51] font-bold uppercase tracking-widest">Active Cover Image</span>
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[#302117]">
                    <img src={heroImageUrl} alt="Storefront Bg" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveStorefrontImage}
                      className="absolute top-2 right-2 bg-[#0A0604]/80 text-[#f7dec4] hover:bg-[#ffb4ab] hover:text-[#690005] p-1.5 rounded-full border border-[#302117] transition-all"
                      title="Remove image URL"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}

              {imageTab === 'slide' && slideImageUrl && (
                <div className="bg-[#070402]/60 border border-[#302117] rounded-xl p-3.5 flex flex-col gap-2">
                  <span className="font-mono text-[9px] text-[#f8bc51] font-bold uppercase tracking-widest">Uploaded Slide Image</span>
                  <div className="flex items-center justify-center p-4 bg-[#0A0604] border border-[#302117] rounded-lg">
                    <div className="relative w-28 h-28 flex items-center justify-center rounded-full bg-gradient-to-br from-[#1c1512] to-[#0A0604] border border-[#f8bc51]/10">
                      <img src={slideImageUrl} alt="Slide Preview" className="w-24 h-24 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" />
                    </div>
                  </div>
                </div>
              )}

              {imageTab === 'grid_card' && cardImageUrl && (
                <div className="bg-[#070402]/60 border border-[#302117] rounded-xl p-3.5 flex flex-col gap-2">
                  <span className="font-mono text-[9px] text-[#f8bc51] font-bold uppercase tracking-widest">Uploaded Grid Tile Image</span>
                  <div className="flex items-center justify-center p-4 bg-[#0A0604] border border-[#302117] rounded-lg">
                    <div className="relative w-full h-32 flex items-center justify-center bg-[#1c1512] border border-[#f8bc51]/10 rounded-lg overflow-hidden">
                      <img src={cardImageUrl} alt="Grid Tile Preview" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                </div>
              )}

              {imageTab === 'summer_drink' && drinkImageUrl && (
                <div className="bg-[#070402]/60 border border-[#302117] rounded-xl p-3.5 flex flex-col gap-2">
                  <span className="font-mono text-[9px] text-[#f8bc51] font-bold uppercase tracking-widest">Uploaded Drink Image</span>
                  <div className="flex items-center justify-center p-4 bg-[#0A0604] border border-[#302117] rounded-lg">
                    <div className="relative w-full h-32 flex items-center justify-center bg-[#1c1512] border border-[#f8bc51]/10 rounded-lg overflow-hidden">
                      <img src={drinkImageUrl} alt="Drink Preview" className="max-w-full max-h-full object-contain" style={{ mixBlendMode: drinkBlendMode || 'normal' }} />
                    </div>
                  </div>
                </div>
              )}

              {imageTab === 'summer_cat' && catIconValue && (
                <div className="bg-[#070402]/60 border border-[#302117] rounded-xl p-3.5 flex flex-col gap-2">
                  <span className="font-mono text-[9px] text-[#f8bc51] font-bold uppercase tracking-widest">Uploaded Category Icon</span>
                  <div className="flex items-center justify-center p-4 bg-[#0A0604] border border-[#302117] rounded-lg">
                    <div className="relative w-16 h-16 flex items-center justify-center bg-[#1c1512] border border-[#f8bc51]/10 rounded-lg overflow-hidden">
                      <img src={catIconValue} alt="Category Icon Preview" className="max-w-full max-h-full object-contain" style={{ mixBlendMode: catBlendMode || 'normal' }} />
                    </div>
                  </div>
                </div>
              )}

              {uploadSuccess && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-3 flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#10B981] font-bold uppercase">
                    <CheckCircle size={10} />
                    Success!
                  </span>
                  <p className="text-[8px] text-[#d4c4b0]/60 font-mono leading-relaxed">
                    {imageTab === 'storefront' 
                      ? 'Storefront Background registered. Click "Save Storefront Settings" on left to publish.'
                      : imageTab === 'slide'
                        ? 'Slide image uploaded. Continue completing the slide details on the left and save.'
                        : imageTab === 'grid_card'
                          ? 'Grid Tile image uploaded. Continue editing card details in the layout panel and save.'
                          : 'Image uploaded. Return to the form on the left to save.'}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Live Mobile Storefront Preview Panel */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="flex items-center gap-2 pb-2 border-b border-[#302117]/60">
            <Smartphone size={16} className="text-[#f8bc51]" />
            <h3 className="font-serif italic text-lg text-white">Live Storefront Preview</h3>
          </div>

          {/* 📱 Simulated Smartphone Viewport */}
          <div className="relative mx-auto w-full max-w-[280px] h-[480px] rounded-[36px] border-[6px] border-[#221710] bg-[#0A0604] overflow-hidden shadow-2xl flex flex-col justify-between select-none">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-4.5 bg-[#221710] rounded-b-2xl z-40 flex items-center justify-between px-4">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]/40" />
              <div className="w-8 h-1 bg-[#101010] rounded-full" />
            </div>

            {/* Simulated background styling from Theme / Cover Image */}
            <div className="absolute inset-0 z-0 opacity-40" style={{ background: getThemeBackgroundStyles() }} />
            
            {heroImageUrl && (
              <div className="absolute inset-0 z-0">
                <img src={heroImageUrl} alt="Hero Background" className="w-full h-full object-cover opacity-25" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0604] via-transparent to-[#0A0604]" />
              </div>
            )}

            {/* Smartphone screen contents */}
            <div className="relative z-10 flex flex-col h-full justify-between p-4 pt-8 pb-5">
              <ThemeDecorations theme={effectiveTheme} eventName={calendarEvent?.eventName || ''} />
              
              {/* Header/Nav bar */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[9px] font-mono text-[#d4c4b0]/70 uppercase tracking-wider">
                <span className="font-serif italic text-xs font-bold text-[#f8bc51]">Hau Hau.</span>
                <span className="bg-[#f8bc51]/10 text-[#f8bc51] border border-[#f8bc51]/25 px-1.5 py-0.5 rounded text-[7px] font-bold">HYD CAMPUS</span>
              </div>

              {/* Dynamic Banner Ticker */}
              <div className="mt-2.5">
                {effectiveBannerActive ? (
                  <div className={`border rounded-xl px-2.5 py-1.5 text-[8px] font-mono flex items-center gap-1.5 ${getBannerBgClass()}`}>
                    <div 
                      className="w-1 h-1 rounded-full shrink-0 animate-pulse" 
                      style={{ backgroundColor: getBannerDotColor(), boxShadow: `0 0 6px ${getBannerDotColor()}` }}
                    />
                    <span className="truncate">{effectiveBannerText || 'No promo message set...'}</span>
                  </div>
                ) : (
                  <div className="border border-[#302117] bg-[#070402]/60 rounded-xl px-2.5 py-1.5 text-[8px] font-mono text-[#d4c4b0]/30 flex items-center justify-center">
                    Banner Deactivated
                  </div>
                )}
              </div>

              {/* Center Slider Platter Showcase Mockup */}
              {/* Campaign Layout switching inside preview */}
              {effectiveLayoutMode === 'grid_board' ? (
                <div className="flex-1 flex flex-col justify-start rounded-2xl p-2 my-2 relative overflow-y-auto border border-white/5 shadow-inner bg-black/40 backdrop-blur-md max-h-[290px] scrollbar-thin select-none">
                  {/* Grid Board Header */}
                  <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-white/5">
                    <div className="flex flex-col text-left">
                      <h4 className="text-[9.5px] font-serif italic text-white font-bold leading-tight">{effectiveGridTitle}</h4>
                      {subText && <p className="text-[7px] text-[#d4c4b0]/50 font-mono scale-95 origin-left">{subText}</p>}
                    </div>
                    {effectiveGridBadgeText && (
                      <span className="bg-[#f8bc51] text-[#0A0604] font-mono font-bold text-[6px] px-1 py-0.2 rounded-full uppercase scale-90">
                        {effectiveGridBadgeText}
                      </span>
                    )}
                  </div>

                  {/* 2x2 grid */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {effectiveGridCards.map((card) => (
                      <div
                        key={card.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-1.5 flex flex-col items-center justify-between text-center relative overflow-hidden"
                      >
                        <div className="w-full h-11 relative flex items-center justify-center bg-stone-900/30 rounded overflow-hidden">
                          {card.image_url ? (
                            <ResizableImage 
                              initialScale={card.imageScale || 1.0}
                              onScaleChange={(scale) => updateGridCardScale(card.id, scale)}
                            >
                              <img src={card.image_url} alt={card.title} className="max-h-full max-w-full object-contain pointer-events-none" style={{ mixBlendMode: card.blendMode || 'normal' }} />
                            </ResizableImage>
                          ) : (
                            <ImageIcon size={10} className="text-white/15" />
                          )}
                        </div>
                        <span className="text-[7px] font-bold text-white truncate w-full mt-1">{card.title}</span>
                        {card.subtitle && <span className="text-[5.5px] text-[#d4c4b0]/50 truncate w-full">{card.subtitle}</span>}
                        {card.price_text && (
                          <span className="bg-[#e8621a]/15 text-[#e8621a] border border-[#e8621a]/30 font-mono text-[5.5px] font-bold px-1 rounded mt-1">
                            {card.price_text}
                          </span>
                        )}
                      </div>
                    ))}
                    {effectiveGridCards.length === 0 && (
                      <div className="col-span-2 py-4 text-center text-[8px] text-[#d4c4b0]/30 border border-dashed border-[#302117] rounded-xl">
                        No grid items configured
                      </div>
                    )}
                  </div>

                  {/* Bottom Ribbon */}
                  {effectiveGridRibbonText && (
                    <div className="bg-[#f8bc51]/10 border-y border-[#f8bc51]/15 py-0.5 text-center font-mono text-[5.5px] tracking-widest text-[#f8bc51] uppercase mt-2.5 overflow-hidden whitespace-nowrap">
                      <span className="block animate-pulse">{effectiveGridRibbonText}</span>
                    </div>
                  )}
                </div>
              ) : effectiveLayoutMode === 'summer_sips' ? (
                <div className="flex-1 flex flex-col items-center justify-center rounded-2xl p-2 my-2 relative overflow-y-auto border border-white/5 shadow-inner bg-black/40 backdrop-blur-md max-h-[290px] scrollbar-thin select-none">
                  <h4 className="text-[10px] font-bold text-amber-400 mb-2 font-serif italic uppercase tracking-widest">{summerHeroTitle || 'Summer Chill Zone'}</h4>
                  <div className="flex gap-2 w-full justify-center">
                    {summerDrinks.map((drink: any) => (
                      <div key={drink.id} className="w-16 h-20 bg-white/5 border border-amber-500/20 rounded-xl relative flex flex-col items-center overflow-hidden">
                        <div className="absolute inset-0">
                           <ResizableImage initialScale={drink.imageScale || 1.0} onScaleChange={(sc) => updateSummerDrinkScale(drink.id, sc)}>
                             <img src={drink.imageUrl} className="w-full h-full object-contain pointer-events-none" style={{ mixBlendMode: drink.blendMode || 'normal' }} />
                           </ResizableImage>
                        </div>
                        <span className="mt-auto mb-1 text-[5px] text-white bg-black/70 px-1 rounded truncate w-14 z-10 backdrop-blur-sm">{drink.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3 w-full justify-center">
                    {summerCategories.map((cat: any) => (
                      <div key={cat.id} className="w-10 h-10 bg-white/5 border border-amber-500/20 rounded-xl relative flex flex-col items-center overflow-hidden">
                        <div className="absolute inset-0">
                           <ResizableImage initialScale={cat.imageScale || 1.0} onScaleChange={(sc) => updateSummerCategoryScale(cat.id, sc)}>
                             {cat.iconType === 'emoji' ? 
                               <div className="w-full h-full flex items-center justify-center text-lg pointer-events-none">{cat.iconValue}</div> :
                               <img src={cat.iconValue} className="w-full h-full object-contain pointer-events-none" style={{ mixBlendMode: cat.blendMode || 'normal' }} />
                             }
                           </ResizableImage>
                        </div>
                        <span className="mt-auto mb-0.5 text-[4px] text-white bg-black/70 px-1 rounded z-10 backdrop-blur-sm truncate w-8 text-center">{cat.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                previewSlide && (
                  <div 
                    className="flex-1 flex flex-col justify-center items-center rounded-2xl p-3 my-3 relative overflow-hidden border border-white/5 shadow-inner"
                    style={{ background: previewSlide.bgColor }}
                  >
                    <span className="font-mono text-[7px] font-bold tracking-widest text-[#f8bc51] uppercase mb-1">{previewSlide.tag}</span>
                    
                    <h4 className="text-[12px] font-serif italic text-white leading-tight font-bold text-center">
                      <span className="block text-[#f8bc51]">{previewSlide.line1}</span>
                      <span className="block text-white">{previewSlide.line2}</span>
                    </h4>

                    {/* Platter and transparent PNG */}
                    <div className="relative w-24 h-24 flex items-center justify-center my-2">
                      <div 
                        className="absolute inset-0 rounded-full border border-dashed opacity-10 animate-[spin_30s_linear_infinite]"
                        style={{ borderColor: previewSlide.accentColor }}
                      />
                      <div className="absolute w-20 h-20 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 shadow-2xl flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full border border-dashed border-[#f8bc51]/15" />
                      </div>
                      {previewSlide.image_url ? (
                        <div className="absolute inset-0 z-20 flex items-center justify-center p-2">
                          <ResizableImage 
                            initialScale={previewSlide.imageScale || 1.0}
                            onScaleChange={(scale) => updateSliderItemScale(previewSlide.id, scale)}
                          >
                            <img src={previewSlide.image_url} alt="Platter" className="max-w-[120%] max-h-[120%] object-contain pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" style={{ mixBlendMode: (previewSlide.blendMode as any) || 'normal' }} />
                          </ResizableImage>
                        </div>
                      ) : (
                        <Utensils size={16} className="text-white/20 z-10" />
                      )}
                    </div>

                    {/* Highlights pills */}
                    <div className="flex gap-1 justify-center max-w-full overflow-hidden mb-1 font-mono text-[6px] tracking-wide text-white/80">
                      {previewSlide.ingredients.slice(0, 2).map((ing, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded-full border border-[#f8bc51]/20 bg-[#070402]/80">
                          ✦ {ing}
                        </span>
                      ))}
                    </div>

                    <p className="text-[7.5px] text-[#d4c4b0]/70 text-center leading-tight max-w-[180px] line-clamp-4 my-0.5">
                      {previewSlide.desc}
                    </p>

                    <div className="w-full flex items-center justify-between mt-1 px-1">
                      <span className="font-mono text-[10px] text-[#f8bc51] font-bold">₹{previewSlide.price}</span>
                      <span className="bg-white text-[#0A0604] px-2 py-0.5 rounded-full font-mono text-[6px] font-bold uppercase tracking-wider">
                        Add to Cart
                      </span>
                    </div>
                  </div>
                )
              )}

              {/* Slider Dots Navigator Inside Preview */}
              {effectiveLayoutMode !== 'grid_board' && !isAddingNew && !editingSlide && displayPreviewSlides.length > 1 && (
                <div className="flex gap-1 items-center justify-center mb-1">
                  {displayPreviewSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPreviewSlideIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${previewSlideIndex === idx ? 'bg-[#f8bc51] w-3' : 'bg-white/20'}`}
                    />
                  ))}
                </div>
              )}

              {/* Footer CTA mockup */}
              <div className="flex flex-col gap-1 pb-1">
                <div className="text-[6px] text-[#d4c4b0]/30 font-mono text-center uppercase tracking-widest">
                  Estimated pick up in ~{previewSlide?.time || 8} mins
                </div>
              </div>

            </div>

            {/* Bottom Bar */}
            <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-[#221710] rounded-full z-40" />
          </div>
        </div>

      </div>
    </div>
  );
}

