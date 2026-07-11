export interface SavedAddress {
  id: string;
  label: string; // 'Home' | 'Hostel' | 'Library' | 'Classroom' | 'Other'
  flatNo: string;
  floor?: string;
  area: string;
  landmark?: string;
  fullAddress: string;
  coordinates?: { lat: number; lng: number };
}

// Users
export interface UserDocument {
  user_id: string; // Firebase Auth UID
  phone: string;
  name?: string;
  student_email?: string;
  email?: string;
  email_verified: boolean;
  batch_year?: number;
  department?: string;
  expected_grad?: number;
  points: number;
  referral_code: string;
  referred_by?: string;
  account_status: 'active' | 'suspended' | 'blacklisted' | 'inactive';
  created_at: number; // Unix timestamp
  stress_coupons_issued?: { month: string; count: number; }; // Tracks coupon usage per month (format: YYYY-MM)
  addresses?: SavedAddress[];
  total_completed_orders?: number;
  successful_referrals?: number;
  status?: string;
  is_active?: boolean;
  is_email_verified?: boolean;
}

// Menu Items
export interface IngredientRecipe {
  stock_id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ModOption {
  name: string;
  price: number;
  stock_id?: string;
  quantity?: number;
}

export interface ModGroup {
  groupName: string;
  options: ModOption[];
}

export interface MenuItem {
  item_id: string;
  name: string;
  description: string;
  price: number;
  category: 'Biryani' | 'Momos' | 'Burgers' | 'Waffles' | 'Snacks' | 'Beverages';
  station: 'FRYER' | 'BREWER' | 'FASTFOOD' | 'BIRYANI' | 'GRILLED OR STEAMED' | 'FASTFOOD & BIRYANI';
  image_url?: string;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  recipe?: IngredientRecipe[];
  customizationOptions?: ModGroup[];
  available_outlets?: string[];
}


// Orders
export type OrderStatus = 'pending' | 'accepted' | 'confirmed' | 'preparing' | 'ready' | 'dispatched' | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled' | 'rejected';
export type FulfillmentStatus = 'dispatched' | 'out_for_delivery' | 'delivered';
export type OrderType = 'dine-in' | 'pickup' | 'delivery';

export interface OrderItem {
  item_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  station: MenuItem['station'];
  item_status: 'ordered' | 'preparing' | 'ready'; // For KDS
  modifiers?: string[];
  refunded_quantity?: number;
  refunded_amount?: number;
}

export interface OrderDocument {
  order_id: string;
  token_number: string;
  user_id: string;
  gross_amount: number;
  points_redeemed: number;
  cash_paid: number; // If paying at counter
  order_type: OrderType;
  hatch?: string; // Location identifier (e.g. OASIS / SMOKING)
  table_no?: string; // If dine-in
  outlet?: string; // Global outlet branch
  delivery_address?: string; // If delivery
  status: OrderStatus;
  fulfillment_status?: FulfillmentStatus;
  estimated_time_mins: number;
  items: OrderItem[];
  created_at: number;
  updated_at?: number;
  completed_at?: number;
  rider_id?: string;
  delivery_coordinates?: { lat: number; lng: number };
  rush_held?: boolean; // For manager rush mode queue
  feedback?: { rating: number; comment: string; submitted_at: number }; // Customer feedback
  otp?: string;
  payment_status?: string;
  is_paid?: boolean;
  refunded_amount?: number;
  refund_status?: string;
  refund_payment_status?: 'paid' | 'partial_pending';
}

// Outlets
export interface Outlet {
  id: string;
  outlet_id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'closed' | 'maintenance';
  hatches?: string[];
  created_at: number;
}

// Stock
export interface StockItem {
  stock_id: string;
  menu_item_id: string; // The item this stock represents
  outlet_id?: string; // Optional for backward compatibility, but required moving forward
  name: string;
  current_quantity: number;
  unit: string; // 'portions', 'cups', etc.
  low_threshold: number;
  last_updated: number;
  updated_by?: string;
  tracking_type?: 'bulk' | 'pack';
  pieces_per_pack?: number;
  cost_per_unit?: number;
}

export interface ConversionRecipe {
  stock_id: string;
  linked_menu_item_id: string;
  yield_min_per_unit: number;
  yield_max_per_unit: number;
  last_updated: number;
}

export interface DoughBatch {
  batch_id: string;
  outlet_id: string;
  stock_id: string;
  raw_qty_used: number;
  expected_min: number;
  expected_max: number;
  batch_start_time: number;
  batch_end_time?: number;
  waffles_sold_auto?: number;
  batch_status: 'active' | 'completed' | 'flagged';
  manager_uid: string;
  created_at: number;
}


// UI Config (Controlled by Owner)
export interface UIConfig {
  active_theme: 'default' | 'exam' | 'raining' | 'fest' | 'night' | 'valentines' | 'scorching' | 'custom';
  hero_headline: string;
  hero_sub: string;
  banner_active: boolean;
  banner_text: string;
  banner_color: 'golden' | 'urgent' | 'success' | 'dark';
  pickup_time_mins: number;
  delivery_time_mins: number;
  is_open: boolean;
  delivery_available: boolean;
  featured_items: string[]; // Array of menu_item_ids
  updated_at: number;
  hero_image?: string;
  auto_calendar_mode?: boolean;
  mock_date?: string;
  layout_mode?: 'slider' | 'grid_board' | 'summer_sips' | 'premium_salad';
  grid_board_title?: string;
  grid_board_badge_text?: string;
  grid_board_ribbon_text?: string;
  grid_cards?: GridCard[];
  summer_campaign_settings?: SummerCampaignSettings;
  premium_salad_settings?: PremiumSaladSettings;
  social_stats?: { value: string; label: string }[];
  social_stats_active?: boolean;
  auto_scroll_enabled?: boolean;
  auto_scroll_interval?: number;
}

export interface PremiumSaladSettings {
  background_gradient?: string;
  ingredients_sprite_url?: string;
  item1_name?: string;
  item2_name?: string;
  item3_name?: string;
  item4_name?: string;
}

export interface SummerCampaignSettings {
  background_gradient: string;
  hero_title: string;
  hero_subtitle: string;
  drinks: SummerDrinkItem[];
  categories: SummerCategoryItem[];
}

export interface SummerDrinkItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  imageScale: number;
  blendMode?: 'normal' | 'screen' | 'multiply';
  menuItemId?: string;
  price: number;
  originalPrice: number;
  tag: string;
  desc: string;
}

export interface SummerCategoryItem {
  id: string;
  title: string;
  iconType: 'emoji' | 'image';
  iconValue: string; // emoji char or image url
  imageScale: number;
  blendMode?: 'normal' | 'screen' | 'multiply';
  redirectCategory: string; // which category to scroll to
}

export interface GridCard {
  id: string;
  title: string;
  subtitle?: string;
  price_text?: string;
  image_url: string;
  imageScale?: number;
  blendMode?: 'normal' | 'screen' | 'multiply';
  redirect_type: 'category' | 'item';
  redirect_value: string;
}

export interface SliderItem {
  id: string; // Document ID
  menuItemId: string; // Linked MenuItem ID
  tag: string; // category/highlight tag (e.g. AROMATIC BASMATI EXCELLENCE)
  line1: string; // title line 1 (e.g. Nizami Canopy)
  line2: string; // title line 2 (e.g. Biryani)
  desc: string; // interesting description
  emoji?: string; // optional emoji fallback
  price: number; // overridden price
  time: number; // base wait time in minutes
  bgColor: string; // radial background gradient
  image_url: string; // transparent photo URL
  imageScale?: number; // scale override for UI layout
  blendMode?: 'normal' | 'screen' | 'multiply';
  ingredients: string[]; // custom highlights/tags
  accentColor: string; // hex color for highlights
  sort_order?: number; // sorting index
}

// Offers & Promo Campaigns
export interface Offer {
  code: string;
  discountPercent: number;
  description: string;
  categoryScope: string;
  isActive: boolean;
  expiryDate: string;
  imageUrl?: string;
  outlets?: {
    canopy: boolean;  // Oasis/Library Canopy
    oasis: boolean;   // Oasis Hub
    smoking: boolean; // Smoking Huts
  };
}
// Staff Accounts
export interface StaffShift {
  id: string; // Unique ID for the shift
  day: string; // e.g. "Monday"
  date: string; // e.g. "Oct 24"
  time: string; // e.g. "08:00 AM - 04:00 PM"
  type: string; // e.g. "Morning Shift", "Evening Shift", "Day Off"
}

export interface Staff {
  id: string;
  employee_id: string;
  name: string;
  email?: string;
  role: 'owner' | 'manager' | 'deep_fryer' | 'grill_fryer' | 'biryani_master' | 'brewer' | 'rider';
  outlet: string;
  pending_transfer?: {
    target_outlet: string;
    effective_time: number;
  };
  passcode?: string;
  status: 'active' | 'offline' | 'suspended';
  created_at: number;
  location?: { lat: number; lng: number; accuracy?: number; updated_at: number };
  schedule?: StaffShift[];
  faceDescriptor?: any;
  phone?: string;
  shift_start?: string;
  shift_end?: string;
  salary?: number;
  hourly_rate?: number;
  attendance_status?: string;
  break_start?: number;
  break_end?: number;
  assigned_hatch?: string;
  hire_date?: string;
  performance_rating?: number;
}

export interface PromoDraft {
  code: string;
  discountPercent: number;
  description: string;
  categoryScope: string;
}

export interface AISlideDetails {
  tag: string;
  desc: string;
  tags: string[];
  accentColor: string;
  bgColor: string;
}

export interface SmartRefillAnalysis {
  suggested_refill_amount: number;
  reasoning: string;
}

export interface AtmosphereConfig {
  active_theme: 'default' | 'scorching' | 'raining' | 'night' | 'exam' | 'fest' | 'valentines' | 'custom';
  hero_headline: string;
  hero_sub: string;
  banner_active: boolean;
  banner_text: string;
  banner_color: 'golden' | 'urgent' | 'success' | 'dark';
  reason: string;
  social_stats?: any;
  social_stats_active?: boolean;
}

// Manager Approvals
export interface OrderEvent {
  event_type: 'status_changed' | 'payment_failed' | 'other';
  timestamp: number;
  details?: Record<string, any>;
}

export type RefundReasonCategory = 'wrong_item' | 'missing_item' | 'bad_quality' | 'late_order' | 'cancelled_order' | 'payment_issue' | 'other';

export interface RefundRequestItem {
  item_id: string;
  quantity: number;
  requested_amount?: number;
}

export interface RefundRequestDocument {
  request_id: string;
  order_id: string;
  user_id: string;
  request_scope: 'full_order' | 'items' | 'custom_amount';
  requested_amount?: number;
  reason_category: RefundReasonCategory;
  customer_note: string;
  items_requested?: RefundRequestItem[];
  status: 'pending' | 'approved' | 'rejected';
  manager_note?: string;
  linked_refund_id?: string;
  payment_status?: 'pending' | 'paid' | 'failed' | 'not_required';
  paid_at?: number;
  paid_by?: string;
  payment_method?: string;
  payment_reference?: string;
  payment_note?: string;
  reviewed_by?: string;
  reviewed_at?: number;
  created_at: number;
  updated_at: number;
}

export interface ApprovalRequest {
  request_id: string;
  requested_by: string;
  timestamp: number;
  action_type: 'menu_edit' | 'staff_edit' | 'stock_adjustment' | 'security_alert';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  payload: any;
}

export interface WastageEventItem {
  menu_item_id?: string;
  stock_item_id?: string;
  item_name: string;
  quantity: number;
  unit?: string;
  unit_cost_estimate?: number;
  station?: string;
  loss_basis: 'menu_item' | 'stock_item';
}

export interface WastageEventDocument {
  event_id: string;
  order_id?: string;
  source_type: 'customer_complaint' | 'kitchen_error' | 'prep_damage' | 'expired_stock' | 'staff_meal' | 'manual_adjustment';
  event_type: 'remake' | 'wastage' | 'spoilage' | 'missing_item';
  items: WastageEventItem[];
  reason_category: string;
  manager_note: string; // required
  photo_urls?: string[];
  reported_by: string;
  approved_by?: string;
  status: 'reported' | 'approved' | 'rejected';
  
  // Inventory fields
  deduct_inventory: boolean;
  deduction_method: 'none' | 'recipe' | 'stock_direct';
  inventory_deducted_at?: number;
  inventory_deduction_ref?: string;
  linked_refund_request_id?: string;

  title: string;
  subtitle?: string;
  price_text?: string;
  image_url: string;
  imageScale?: number;
  blendMode?: 'normal' | 'screen' | 'multiply';
  redirect_type: 'category' | 'item';
  redirect_value: string;
}

export interface SliderItem {
  id: string; // Document ID
  menuItemId: string; // Linked MenuItem ID
  tag: string; // category/highlight tag (e.g. AROMATIC BASMATI EXCELLENCE)
  line1: string; // title line 1 (e.g. Nizami Canopy)
  line2: string; // title line 2 (e.g. Biryani)
  desc: string; // interesting description
  emoji?: string; // optional emoji fallback
  price: number; // overridden price
  time: number; // base wait time in minutes
  bgColor: string; // radial background gradient
  image_url: string; // transparent photo URL
  imageScale?: number; // scale override for UI layout
  blendMode?: 'normal' | 'screen' | 'multiply';
  ingredients: string[]; // custom highlights/tags
  accentColor: string; // hex color for highlights
  sort_order?: number; // sorting index
}

// Offers & Promo Campaigns
export interface Offer {
  code: string;
  discountPercent: number;
  description: string;
  categoryScope: string;
  isActive: boolean;
  expiryDate: string;
  imageUrl?: string;
  outlets?: {
    canopy: boolean;  // Oasis/Library Canopy
    oasis: boolean;   // Oasis Hub
    smoking: boolean; // Smoking Huts
  };
}
// Staff Accounts
export interface StaffShift {
  id: string; // Unique ID for the shift
  day: string; // e.g. "Monday"
  date: string; // e.g. "Oct 24"
  time: string; // e.g. "08:00 AM - 04:00 PM"
  type: string; // e.g. "Morning Shift", "Evening Shift", "Day Off"
}

export interface Staff {
  id: string;
  employee_id: string;
  name: string;
  email?: string;
  role: 'owner' | 'manager' | 'deep_fryer' | 'grill_fryer' | 'biryani_master' | 'brewer' | 'rider';
  outlet: string;
  pending_transfer?: {
    target_outlet: string;
    effective_time: number;
  };
  passcode?: string;
  status: 'active' | 'offline' | 'suspended';
  created_at: number;
  location?: { lat: number; lng: number; accuracy?: number; updated_at: number };
  schedule?: StaffShift[];
  faceDescriptor?: any;
  phone?: string;
  shift_start?: string;
  shift_end?: string;
  salary?: number;
  hourly_rate?: number;
  attendance_status?: string;
  break_start?: number;
  break_end?: number;
  assigned_hatch?: string;
  hire_date?: string;
  performance_rating?: number;
}

export interface PromoDraft {
  code: string;
  discountPercent: number;
  description: string;
  categoryScope: string;
}

export interface AISlideDetails {
  tag: string;
  desc: string;
  tags: string[];
  accentColor: string;
  bgColor: string;
}



export interface WastageEventDocument {
  event_id: string;
  order_id?: string;
  source_type: 'customer_complaint' | 'kitchen_error' | 'prep_damage' | 'expired_stock' | 'staff_meal' | 'manual_adjustment';
  event_type: 'remake' | 'wastage' | 'spoilage' | 'missing_item';
  items: WastageEventItem[];
  reason_category: string;
  manager_note: string; // required
  photo_urls?: string[];
  reported_by: string;
  approved_by?: string;
  status: 'reported' | 'approved' | 'rejected';
  
  // Inventory fields
  deduct_inventory: boolean;
  deduction_method: 'none' | 'recipe' | 'stock_direct';
  inventory_deducted_at?: number;
  inventory_deduction_ref?: string;
  linked_refund_request_id?: string;

  created_at: number;
  updated_at: number;
  approved_at?: number;
}

export interface StockMovementDocument {
  movement_id: string;
  stock_id: string;
  event_id: string;
  movement_type: 'wastage' | 'remake' | 'spoilage' | 'staff_meal' | 'manual_adjustment';
  quantity_delta: number;
  previous_quantity: number;
  new_quantity: number;
  reason_category: string;
  actor_id: string;
  created_at: number;
  linked_order_id?: string;
  linked_refund_request_id?: string;
}

// Daily Closing & Cash Reconciliation
export interface DailyClosingDocument {
  closing_id: string;
  outlet_id: string;
  business_date: string; // YYYY-MM-DD
  business_window: {
    start_at: number; // Unix timestamp
    end_at: number; // Unix timestamp
    timezone: 'Asia/Kolkata';
  };
  opened_at?: number;
  closed_at?: number;
  closed_by?: string;
  status: 'draft' | 'submitted' | 'locked' | 'rejected';
  
  sales_summary: {
    gross_sales: number;
    net_sales: number;
    order_count: number;
    completed_order_count: number;
    cancelled_order_count: number;
    refunded_amount: number;
    discount_amount: number;
    cash_sales: number;
    upi_sales: number;
    wallet_sales: number;
    unpaid_amount: number;
  };

  cash_reconciliation: {
    opening_cash: number;
    expected_cash: number;
    counted_cash: number;
    cash_difference: number;
    manager_cash_note?: string;
    cash_proof_photo_urls?: string[];
  };

  payment_reconciliation: {
    expected_upi: number;
    verified_upi: number;
    upi_difference: number;
    payment_proof_refs?: string[];
    manager_payment_note?: string;
  };

  refund_summary: {
    refund_requests_count: number;
    approved_refunds_count: number;
    paid_refunds_count: number;
    pending_refund_payments: number;
    refund_amount_paid_today: number;
  };

  wastage_summary: {
    wastage_events_count: number;
    approved_wastage_count: number;
    estimated_wastage_cost: number;
    remake_count: number;
    stock_movements_count: number;
  };

  inventory_summary: {
    stock_movements_today: number;
    negative_stock_alerts: number;
    low_stock_alerts: number;
    manual_adjustments_count: number;
  };

  manager_notes?: string;
  founder_review_note?: string;
  approved_by?: string;
  approved_at?: number;
  created_at: number;
  updated_at: number;
  locked_at?: number;
}
