export interface PricingPreviewInput {
  cart: Array<{ price: number; quantity: number; menuItemId?: string; item_id?: string }>;
  platformFee: number;
  promoApplied: boolean;
  promoDiscountPercent: number;
  promoScope: string;
  activeBalance: number;
  pointsInput: number;
  menuItems: Array<{ item_id?: string; category?: string }>;
}

export function calculatePricingPreview({
  cart,
  platformFee,
  promoApplied,
  promoDiscountPercent,
  promoScope,
  activeBalance,
  pointsInput,
  menuItems,
}: PricingPreviewInput) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  let promoDiscount = 0;
  if (promoApplied) {
    if (!promoScope || promoScope.toLowerCase() === 'all') {
      promoDiscount = Math.floor(subtotal * (promoDiscountPercent / 100));
    } else {
      const scopedSubtotal = cart.reduce((sum, item) => {
        const menuItemId = item.menuItemId || item.item_id;
        const menuItem = menuItems.find(m => m.item_id === menuItemId);
        const category = menuItem?.category || '';
        
        if (category.toLowerCase() === promoScope.toLowerCase()) {
          return sum + item.price * item.quantity;
        }
        return sum;
      }, 0);
      
      promoDiscount = Math.floor(scopedSubtotal * (promoDiscountPercent / 100));
    }
  }

  // Pre-points total matches server-side logic now
  const prePointsTotal = subtotal - promoDiscount + platformFee;
  const maxRedeemablePoints = Math.floor(prePointsTotal * 0.20);
  
  const maxCanUse = Math.min(activeBalance, maxRedeemablePoints);
  const pointsRedeemed = Math.min(Number(pointsInput) || 0, maxCanUse);
  
  const total = Math.max(0, subtotal - promoDiscount - pointsRedeemed + platformFee);

  return {
    subtotal,
    promoDiscount,
    pointsRedeemed,
    platformFee,
    total,
    maxRedeemablePoints
  };
}
