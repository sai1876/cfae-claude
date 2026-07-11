import { describe, it, expect } from 'vitest';
import { calculatePricingPreview } from '../features/checkout/clientPricingPreview';

describe('clientPricingPreview logic', () => {
  const menuItems = [
    { item_id: 'item1', category: 'Biryani' },
    { item_id: 'item2', category: 'Beverages' }
  ];

  it('calculates subtotal correctly', () => {
    const result = calculatePricingPreview({
      cart: [{ price: 200, quantity: 2, menuItemId: 'item1' }],
      platformFee: 5,
      promoApplied: false,
      promoDiscountPercent: 0,
      promoScope: 'All',
      activeBalance: 0,
      pointsInput: 0,
      menuItems
    });

    expect(result.subtotal).toBe(400);
    expect(result.total).toBe(405); // 400 + 5 platform fee
  });

  it('applies category-scoped promo only to eligible items', () => {
    const result = calculatePricingPreview({
      cart: [
        { price: 200, quantity: 1, menuItemId: 'item1' }, // Biryani
        { price: 50, quantity: 2, menuItemId: 'item2' }  // Beverages (100)
      ],
      platformFee: 5,
      promoApplied: true,
      promoDiscountPercent: 50,
      promoScope: 'Biryani',
      activeBalance: 0,
      pointsInput: 0,
      menuItems
    });

    // Eligible subtotal = 200
    // Discount = 100
    expect(result.subtotal).toBe(300);
    expect(result.promoDiscount).toBe(100);
    expect(result.total).toBe(205); // 300 - 100 + 5
  });

  it('calculates points redemption matching server 20% limit', () => {
    const result = calculatePricingPreview({
      cart: [{ price: 500, quantity: 1, menuItemId: 'item1' }],
      platformFee: 5,
      promoApplied: false,
      promoDiscountPercent: 0,
      promoScope: 'All',
      activeBalance: 1000,
      pointsInput: 1000,
      menuItems
    });

    // prePointsTotal = 505
    // max points = 20% of 505 = 101
    expect(result.pointsRedeemed).toBe(101);
    expect(result.total).toBe(404); // 505 - 101
  });
});
