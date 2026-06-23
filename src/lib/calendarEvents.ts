import { UIConfig, GridCard } from './types';

export interface CalendarEventConfig {
  eventName: string;
  active_theme: UIConfig['active_theme'];
  hero_headline: string;
  hero_sub: string;
  banner_active: boolean;
  banner_text: string;
  banner_color: UIConfig['banner_color'];
  bg_image?: string;
  featuredItemIds?: string[];
  layout_mode?: 'slider' | 'grid_board' | 'summer_sips';
  grid_board_title?: string;
  grid_board_badge_text?: string;
  grid_board_ribbon_text?: string;
  grid_cards?: GridCard[];
  automatic_discount?: {
    discount_percent: number;
    description: string;
  };
  custom_particles?: string;
  particle_count?: number;
  particle_size?: number;
  particle_speed?: number;
  particle_rotation?: number;
  custom_aurora_color?: string;
  custom_bg_color?: string;
  auto_scroll_enabled?: boolean;
  auto_scroll_interval?: number;
}

export interface DynamicCalendarEvent extends CalendarEventConfig {
  id: string;
  startMonth: number; // 0-indexed (0 = Jan, 1 = Feb, ..., 11 = Dec)
  startDay: number;
  endMonth: number;
  endDay: number;
}

export const defaultCalendarEvents: DynamicCalendarEvent[] = [
  {
    id: "valentines",
    eventName: "Valentine's Week",
    active_theme: 'valentines',
    hero_headline: "Celebrate Love & Sweet Cravings",
    hero_sub: "Sweet treats and romantic vibes at Hau Hau.",
    banner_active: true,
    banner_text: "💝 Valentine's Week Specials: Free Pack of Chocolate above ₹999!",
    banner_color: 'urgent',
    bg_image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=1200&q=80',
    featuredItemIds: ['m3', 'm5'],
    layout_mode: 'grid_board',
    grid_board_title: "It's Promise Day!",
    grid_board_badge_text: "SINGLE MODE ON",
    grid_board_ribbon_text: "LONG DISTANCE IS NO EXCUSE 💝 Send sweets & treats to your loved ones!",
    automatic_discount: {
      discount_percent: 10,
      description: "Valentine's Love Discount (10% OFF)"
    },
    startMonth: 1,
    startDay: 7,
    endMonth: 1,
    endDay: 15,
    grid_cards: [
      {
        id: 'v_c1',
        title: "Promise Day Specials",
        subtitle: "Combos for couples",
        price_text: "From ₹249",
        image_url: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Biryani'
      },
      {
        id: 'v_c2',
        title: "Gifts for Her",
        subtitle: "Sweet creamy milkshakes",
        price_text: "Shakes",
        image_url: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Beverages'
      },
      {
        id: 'v_c3',
        title: "Chocolates & Cakes",
        subtitle: "Rich warm waffles",
        price_text: "Desserts",
        image_url: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Waffles'
      },
      {
        id: 'v_c4',
        title: "Gifts for Him",
        subtitle: "Spicy chicken burgers",
        price_text: "Burgers",
        image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Burgers'
      }
    ]
  },
  {
    id: "summer",
    eventName: "Summer Heatwave",
    active_theme: 'scorching',
    hero_headline: "BEAT THE HEAT!",
    hero_sub: "Summer Chill Zone.",
    banner_active: true,
    banner_text: "☀️ Mist-cooling hatches active. Beat the heat!",
    banner_color: 'golden',
    featuredItemIds: ['m1', 'summer_bundle', 'm2'],
    layout_mode: 'summer_sips',
    automatic_discount: {
      discount_percent: 8,
      description: "Summer Beat-The-Heat Offer (8% OFF)"
    },
    startMonth: 4,
    startDay: 20,
    endMonth: 4,
    endDay: 30
  },
  {
    id: "monsoon",
    eventName: "Monsoon Season",
    active_theme: 'raining',
    hero_headline: "Chai, Rain & Sizzling Delights",
    hero_sub: "Warm comfort food and filter coffee for rainy days.",
    banner_active: true,
    banner_text: "🌧️ Monsoon Sizzles: Sizzling hot pakoras & hot filter coffee ready!",
    banner_color: 'success',
    bg_image: 'https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?w=1200&q=80',
    featuredItemIds: ['m1', 'm5', 'm2'],
    layout_mode: 'slider',
    automatic_discount: {
      discount_percent: 10,
      description: "Monsoon Cozy Rain Offer (10% OFF)"
    },
    startMonth: 6,
    startDay: 1,
    endMonth: 7,
    endDay: 10
  },
  {
    id: "halloween",
    eventName: "Spooky Halloween",
    active_theme: 'night',
    hero_headline: "Grave Cravings & Chills",
    hero_sub: "Spooky delights and midnight snacks at Hau Hau.",
    banner_active: true,
    banner_text: "🎃 Spooky Brews & Wicked Treats: Midnight delivery active!",
    banner_color: 'dark',
    bg_image: 'https://images.unsplash.com/photo-1508349937151-22b68b72d5b1?w=1200&q=80',
    featuredItemIds: ['m4', 'm2'],
    layout_mode: 'slider',
    automatic_discount: {
      discount_percent: 12,
      description: "Spooky Midnight Special (12% OFF)"
    },
    startMonth: 9,
    startDay: 24,
    endMonth: 9,
    endDay: 31
  },
  {
    id: "diwali",
    eventName: "Diwali Festival",
    active_theme: 'fest',
    hero_headline: "Sweets, Lights & Festive Bites",
    hero_sub: "Light up your tastebuds with festive specials.",
    banner_active: true,
    banner_text: "🪔 Celebrate Diwali: Free box of festive sweets above ₹1499!",
    banner_color: 'golden',
    bg_image: 'https://images.unsplash.com/photo-1605884705191-450f3b4a2e5d?w=1200&q=80',
    featuredItemIds: ['m1', 'm5'],
    layout_mode: 'grid_board',
    grid_board_title: "Grand Diwali Celebrations",
    grid_board_badge_text: "FESTIVE LIGHTS",
    grid_board_ribbon_text: "🪔 Spread light and joy. Send sweet waffles & hot biryani to your campus friends!",
    automatic_discount: {
      discount_percent: 15,
      description: "Grand Diwali Festivity (15% OFF)"
    },
    startMonth: 10,
    startDay: 1,
    endMonth: 10,
    endDay: 12,
    grid_cards: [
      {
        id: 'd_c1',
        title: "Royal Diwali Feast",
        subtitle: "Dum claypot biryani",
        price_text: "Feast",
        image_url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Biryani'
      },
      {
        id: 'd_c2',
        title: "Festive Sweet Waffles",
        subtitle: "Golden honey waffles",
        price_text: "Sweets",
        image_url: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Waffles'
      },
      {
        id: 'd_c3',
        title: "Snacks & Appetizers",
        subtitle: "Crispy fries & hot momos",
        price_text: "Bites",
        image_url: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Momos'
      },
      {
        id: 'd_c4',
        title: "Chilled Assortments",
        subtitle: "Cold lattes & shakes",
        price_text: "Refresh",
        image_url: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300&q=80",
        redirect_type: 'category',
        redirect_value: 'Beverages'
      }
    ]
  },
  {
    id: "christmas",
    eventName: "Holiday Season",
    active_theme: 'fest',
    hero_headline: "Jingle Bell Brews & Warmth",
    hero_sub: "Cozy winter drinks and delicious holiday waffles.",
    banner_active: true,
    banner_text: "🎄 Warm Winter Cravings: Complimentary Hot Chocolate on all orders!",
    banner_color: 'urgent',
    bg_image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&q=80',
    featuredItemIds: ['m1', 'm3'],
    layout_mode: 'slider',
    automatic_discount: {
      discount_percent: 10,
      description: "Jingle Bell Festive Cheer (10% OFF)"
    },
    startMonth: 11,
    startDay: 20,
    endMonth: 0,
    endDay: 3
  }
];

export function getCalendarEventConfig(date: Date, customEvents?: DynamicCalendarEvent[]): CalendarEventConfig | null {
  const eventsToUse = customEvents && customEvents.length > 0 ? customEvents : defaultCalendarEvents;
  const month = date.getMonth();
  const day = date.getDate();

  for (const event of eventsToUse) {
    const sm = event.startMonth;
    const sd = event.startDay;
    const em = event.endMonth;
    const ed = event.endDay;

    if (sm > em) {
      // Event spans across new year (e.g. Dec 20 to Jan 3)
      if ((month === sm && day >= sd) || (month === em && day <= ed) || (month > sm || month < em)) {
        return event;
      }
    } else {
      if ((month === sm && day >= sd && (sm === em ? day <= ed : true)) ||
          (month === em && day <= ed && (sm === em ? day >= sd : true)) ||
          (month > sm && month < em)) {
        return event;
      }
    }
  }

  return null;
}
