// Point Kickback Tiers
export const KICKBACK_TIERS = {
  TIER_1: { maxOrders: 3, percentage: 0.15 }, // 15% for first 3 orders
  TIER_2: { maxOrders: 5, percentage: 0.10 }, // 10% for orders 4-5
  LIFETIME: { percentage: 0.08 }               // Flat 8% for orders 6+
};

// Referrer Referral Kickback Percentage
export const REFERRER_KICKBACK_PERCENTAGE = 0.08;

// Gamified Referral Voucher Milestones
export const REFERRAL_MILESTONES: Record<number, string> = {
  3: 'fries',
  8: 'thickshake',
  15: 'popcorn_or_drink'
};

// Expiration time for points ledger (45 days)
export const POINT_LEDGER_EXPIRY_DAYS = 45;

// Recipe Override Defaults for menu items without DB recipe configurations
export interface RecipeIngredientDefault {
  name: string;
  requiredQty: number;
}

export const BACKUP_MENU_RECIPES: Record<string, RecipeIngredientDefault[]> = {
  m1: [
    { name: 'Premium Basmati Rice', requiredQty: 0.15 },
    { name: 'Fresh Boneless Chicken', requiredQty: 0.1 }
  ],
  m3: [
    { name: 'Whole Milk Creamer', requiredQty: 0.25 },
    { name: 'Roasted Coffee Beans', requiredQty: 0.015 }
  ],
  m2: [
    { name: 'Belgian Potato Waffles', requiredQty: 1 }
  ]
};
