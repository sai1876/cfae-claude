import { MenuItem, UIConfig, SliderItem } from './types';

export const mockMenuItems: MenuItem[] = [
  {
    item_id: 'm1',
    name: 'Hau Hau Special Biryani',
    description: 'Aromatic basmati rice cooked with secret spices and tender chicken.',
    price: 180,
    category: 'Biryani',
    station: 'FASTFOOD & BIRYANI',
    is_available: true,
    is_featured: true,
    sort_order: 1,
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
  },
  {
    item_id: 'm2',
    name: 'Classic Fries',
    description: 'Crispy golden fries with our signature seasoning.',
    price: 60,
    category: 'Snacks',
    station: 'FRYER',
    is_available: true,
    is_featured: false,
    sort_order: 2,
    image_url: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=800&q=80',
  },
  {
    item_id: 'm3',
    name: 'Iced Latte',
    description: 'Chilled espresso over milk and ice.',
    price: 90,
    category: 'Beverages',
    station: 'BREWER',
    is_available: true,
    is_featured: true,
    sort_order: 3,
    image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80',
  },
  {
    item_id: 'm4',
    name: 'Spicy Chicken Burger',
    description: 'Crispy fried chicken patty with spicy mayo.',
    price: 120,
    category: 'Burgers',
    station: 'FRYER',
    is_available: true,
    is_featured: false,
    sort_order: 4,
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  },
  {
    item_id: 'm5',
    name: 'Steamed Chicken Momos',
    description: '6 pieces of delicate chicken momos with spicy chutney.',
    price: 80,
    category: 'Momos',
    station: 'GRILLED OR STEAMED',
    is_available: true,
    is_featured: true,
    sort_order: 5,
    image_url: 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=800&q=80',
  }
];

export const mockSliderItems = [
  {
    id: 's1',
    name: 'Classic Chicken Burger',
    subtitle: 'The Flavor Bomb',
    description: 'Crispy fried chicken patty, fresh lettuce, and our secret sauce.',
    bgColor: '#c8922a', // amber
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&transparent=true', // placeholder
  },
  {
    id: 's2',
    name: 'Loaded French Fries',
    subtitle: 'The Golden Crunch',
    description: 'Crispy golden fries smothered in cheese and herbs.',
    bgColor: '#f8bc51', // primary/gold
    image_url: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=800&q=80&transparent=true',
  },
  {
    id: 's3',
    name: 'Spicy Garlic Noodles',
    subtitle: 'The Wok Wonder',
    description: 'Wok-tossed noodles with chili garlic sauce and fresh veggies.',
    bgColor: '#afd0a1', // bamboo
    image_url: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&q=80&transparent=true',
  },
  {
    id: 's4',
    name: 'Midnight Masala Maggie',
    subtitle: 'The Late Night Savior',
    description: 'Comforting masala maggie cooked to perfection.',
    bgColor: '#504536', // outline-variant (earthy)
    image_url: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=800&q=80&transparent=true',
  },
  {
    id: 's5',
    name: 'Iced Vanilla Latte',
    subtitle: 'The Cool Buzz',
    description: 'Chilled espresso over milk, ice, and sweet vanilla.',
    bgColor: '#b3ccc0', // water (cool)
    image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80&transparent=true',
  },
  {
    id: 's6',
    name: 'Thick Chocolate Shake',
    subtitle: 'The Cocoa Cloud',
    description: 'Rich, creamy chocolate blended with premium ice cream.',
    bgColor: '#413220', // surface-container-highest (dark brown)
    image_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80&transparent=true',
  }
];

export const mockUIConfig: UIConfig & { hero_image?: string } = {
  active_theme: 'default',
  hero_headline: 'Your escape from the heat\nis 4 minutes away.',
  hero_sub: 'Hau Hau Cafe. Order. Earn. Escape.',
  hero_image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=2000',
  banner_active: true,
  banner_text: 'Beat the heat — order pickup ready in 8 min',
  banner_color: 'golden',
  pickup_time_mins: 8,
  delivery_time_mins: 15,
  is_open: true,
  delivery_available: true,
  featured_items: ['m1', 'm3', 'm5'],
  updated_at: Date.now(),
};

export const mockActiveOrders = [
  {
    order_id: 'ord_1',
    token_number: '047',
    order_type: 'dine-in',
    hatch: 'OASIS',
    status: 'preparing',
    created_at: Date.now() - 4 * 60000, // 4 mins ago
    items: [
      { item_id: 'i1', menu_item_id: 'm2', name: 'Classic Fries', quantity: 2, station: 'FRYER', status: 'pending' },
      { item_id: 'i2', menu_item_id: 'm5', name: 'Steamed Chicken Momos', quantity: 1, station: 'GRILLED OR STEAMED', status: 'pending' }
    ]
  },
  {
    order_id: 'ord_2',
    token_number: '048',
    order_type: 'pickup',
    status: 'preparing',
    created_at: Date.now() - 8 * 60000, // 8 mins ago
    items: [
      { item_id: 'i3', menu_item_id: 'm1', name: 'Hau Hau Special Biryani', quantity: 1, station: 'FASTFOOD & BIRYANI', status: 'pending' },
      { item_id: 'i4', menu_item_id: 'm3', name: 'Iced Latte', quantity: 2, station: 'BREWER', status: 'pending' }
    ]
  },
  {
    order_id: 'ord_3',
    token_number: '049',
    order_type: 'delivery',
    delivery_address: 'Boys Hostel A, Room 204',
    status: 'preparing',
    created_at: Date.now() - 12 * 60000, // 12 mins ago (urgent)
    items: [
      { item_id: 'i5', menu_item_id: 'm4', name: 'Spicy Chicken Burger', quantity: 3, station: 'GRILLED OR STEAMED', status: 'pending' },
      { item_id: 'i6', menu_item_id: 'm2', name: 'Classic Fries', quantity: 3, station: 'FRYER', status: 'pending' }
    ]
  }
];

export const defaultSliderItems: SliderItem[] = [
  {
    id: 's1',
    menuItemId: 'm1',
    tag: 'AROMATIC BASMATI EXCELLENCE',
    line1: 'Nizami Canopy',
    line2: 'Biryani',
    desc: 'Premium long-grain saffron basmati layered with mint leaves, garden veggies, and ground spices. Dum-cooked in sealed clay pots.',
    emoji: '🍛',
    price: 150,
    time: 8,
    bgColor: 'radial-gradient(circle at center, #63503B 0%, #2A2118 100%)',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
    ingredients: ['Dum Baked', 'Saffron Rice', 'Mint Leaves'],
    accentColor: '#F8BC51',
    sort_order: 1
  },
  {
    id: 's2',
    menuItemId: 'm4',
    tag: 'CAMPUS FAVOURITE',
    line1: 'Classic Smash',
    line2: 'Burger',
    desc: 'Double-smashed crispy chicken patty, fresh lettuce, and our secret golden mustard sauce. Built for mid-lecture cravings.',
    emoji: '🍔',
    price: 120,
    time: 8,
    bgColor: 'radial-gradient(circle at center, #E8621A 0%, #1A0A02 100%)',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
    ingredients: ['Smashed Patty', 'Secret Sauce', 'Fresh Bun'],
    accentColor: '#E8621A',
    sort_order: 2
  },
  {
    id: 's3',
    menuItemId: 'm3',
    tag: 'THICK & RICH',
    line1: 'Loaded Coffee',
    line2: 'Shake',
    desc: 'Chilled espresso cream blended over sweet vanilla milk and gourmet ice cream. The perfect escape from Hyderabad afternoons.',
    emoji: '🥤',
    price: 90,
    time: 6,
    bgColor: 'radial-gradient(circle at center, #2E7D5E 0%, #0B241A 100%)',
    image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80',
    ingredients: ['Espresso Shot', 'Vanilla Milk', 'Gourmet Cream'],
    accentColor: '#2E7D5E',
    sort_order: 3
  },
  {
    id: 's4',
    menuItemId: 'm2',
    tag: 'CRISPY & HOT',
    line1: 'Golden Spice',
    line2: 'Fries',
    desc: 'Double-fried hand-cut potatoes, seasoned generously with our signature Hau Hau peri-peri dust. Served sizzling in a paper cone.',
    emoji: '🍟',
    price: 60,
    time: 5,
    bgColor: 'radial-gradient(circle at center, #D4A832 0%, #251B03 100%)',
    image_url: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=800&q=80',
    ingredients: ['Double Fried', 'Peri-Peri Dust', 'Sea Salt'],
    accentColor: '#D4A832',
    sort_order: 4
  },
  {
    id: 's5',
    menuItemId: 'm5',
    tag: 'STREET FAVOURITE',
    line1: 'Steamed Chicken',
    line2: 'Momos',
    desc: '6 pieces of pillow-soft steamed dumplings, stuffed with spiced chicken mince, served with Hau Hau\'s signature fiery red chili dip.',
    emoji: '🥟',
    price: 80,
    time: 7,
    bgColor: 'radial-gradient(circle at center, #7C3AED 0%, #1F0A42 100%)',
    image_url: 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=800&q=80',
    ingredients: ['Pillow Soft', 'Fiery Dip', 'Spiced Mince'],
    accentColor: '#7C3AED',
    sort_order: 5
  }
];
