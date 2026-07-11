import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrderServer } from '../server/orders/createOrderServer';

// Mock dependencies
const mockGet = vi.fn();
const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit, get: mockGet });
const mockRunTransaction = vi.fn();
const mockCollection = vi.fn().mockReturnThis();
const mockDoc = vi.fn().mockReturnThis();

vi.mock('../lib/firebaseAdmin', () => ({
  adminDb: {
    collection: (...args: any[]) => {
      mockCollection(...args);
      return {
        doc: (...args2: any[]) => {
          mockDoc(...args2);
          return { get: mockGet };
        },
        where: mockWhere,
        get: mockGet
      };
    },
    runTransaction: (...args: any[]) => {
      mockRunTransaction(...args);
      // Execute the transaction callback immediately with a fake transaction object
      const cb = args[0];
      return cb({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ current_quantity: 100, date: new Date().toDateString() }) }),
        update: vi.fn(),
        set: vi.fn(),
      });
    }
  },
  adminAuth: {}
}));

vi.mock('../server/notifications/triggerLowStockAlert', () => ({
  triggerLowStockAlert: vi.fn()
}));

vi.mock('../lib/checkout', () => ({
  apply_wallet_points: vi.fn().mockResolvedValue({ success: true })
}));

describe('createOrderServer pricing logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates price from Firestore menu, ignoring client expected total', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'item1',
      data: () => ({
        price: 200,
        is_available: true,
        name: 'Pizza'
      })
    });
    mockWhere.mockReturnValue({ limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ empty: true }) }) });

    const orderData = await createOrderServer(
      'test-uid',
      10, // Client tries to spoof total as ₹10
      undefined, // promoCode
      0, // pointsRedeemed
      'pickup',
      [{ menuItemId: 'item1', quantity: 2, price: 5 }] // Client tries to spoof item price
    );

    // 200 * 2 = 400 + 5 (platform fee) = 405
    expect(orderData.gross_amount).toBe(405);
  });

  it('rejects order if menu item is missing', async () => {
    mockGet.mockResolvedValueOnce({
      exists: false
    });

    await expect(
      createOrderServer('test-uid', 100, undefined, 0, 'pickup', [{ menuItemId: 'missing-item', quantity: 1 }])
    ).rejects.toThrow('Menu item not found: missing-item');
  });

  it('rejects order if menu item is sold out (is_available === false)', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'sold-out-item',
      data: () => ({
        price: 100,
        is_available: false,
        name: 'Burger'
      })
    });

    await expect(
      createOrderServer('test-uid', 100, undefined, 0, 'pickup', [{ menuItemId: 'sold-out-item', quantity: 1 }])
    ).rejects.toThrow('Menu item is currently unavailable: Burger');
  });

  it('calculates points redemption server-side with 20% cap', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'item1',
      data: () => ({
        price: 500,
        is_available: true,
        name: 'Cake'
      })
    });
    mockWhere.mockReturnValue({ limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ empty: true }) }) });

    const orderData = await createOrderServer(
      'test-uid',
      505,
      undefined, // promoCode
      1000, // Client tries to redeem 1000 points
      'pickup',
      [{ menuItemId: 'item1', quantity: 1 }]
    );

    // Subtotal: 500 + 5 (platform fee) = 505
    // Max points allowed: 20% of 505 = 101
    // Final total: 505 - 101 = 404
    expect(orderData.gross_amount).toBe(404);
    expect(orderData.points_redeemed).toBe(101);
  });

  it('valid promo applies discount', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'item1',
      data: () => ({ price: 200, is_available: true, name: 'Pizza', category: 'Biryani' })
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    mockWhere.mockImplementation((field) => {
      if (field === 'display_order_code') {
        return { limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ empty: true }) }) };
      }
      return {
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ isActive: true, expiryDate: tomorrow.toISOString().split('T')[0], discountPercent: 10, categoryScope: 'All' }) }]
          })
        })
      };
    });

    const orderData = await createOrderServer('test-uid', undefined, 'SAVE10', 0, 'pickup', [{ menuItemId: 'item1', quantity: 2 }]);
    // subtotal = 400
    // discount = 40
    // prePointsTotal = 400 - 40 + 5 = 365
    expect(orderData.promo_discount).toBe(40);
    expect(orderData.gross_amount).toBe(365);
  });

  it('expired promo is rejected', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'item1',
      data: () => ({ price: 200, is_available: true, name: 'Pizza', category: 'Biryani' })
    });
    mockWhere.mockImplementation((field) => {
      if (field === 'display_order_code') {
        return { limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ empty: true }) }) };
      }
      return {
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ isActive: true, expiryDate: '2020-01-01', discountPercent: 10, categoryScope: 'All' }) }]
          })
        })
      };
    });

    const orderData = await createOrderServer('test-uid', undefined, 'EXPIRED', 0, 'pickup', [{ menuItemId: 'item1', quantity: 1 }]);
    // subtotal = 200
    // discount = 0 (rejected)
    // total = 200 - 0 + 5 = 205
    expect(orderData.promo_discount).toBeUndefined(); // or 0 if not set, but we only set it if acceptedPromoCode is truthy
    expect(orderData.gross_amount).toBe(205);
  });

  it('inactive promo is rejected', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'item1',
      data: () => ({ price: 200, is_available: true, name: 'Pizza' })
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    mockWhere.mockImplementation((field) => {
      if (field === 'display_order_code') {
        return { limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ empty: true }) }) };
      }
      return {
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ isActive: false, expiryDate: tomorrow.toISOString().split('T')[0], discountPercent: 10, categoryScope: 'All' }) }]
          })
        })
      };
    });

    const orderData = await createOrderServer('test-uid', undefined, 'INACTIVE', 0, 'pickup', [{ menuItemId: 'item1', quantity: 1 }]);
    expect(orderData.gross_amount).toBe(205);
  });

  it('category-scoped promo only discounts eligible items', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'item1',
      data: () => ({ price: 200, is_available: true, name: 'Pizza', category: 'Biryani' })
    });
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'item2',
      data: () => ({ price: 100, is_available: true, name: 'Coke', category: 'Beverages' })
    });
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    mockWhere.mockImplementation((field) => {
      if (field === 'display_order_code') {
        return { limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ empty: true }) }) };
      }
      return {
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ isActive: true, expiryDate: tomorrow.toISOString().split('T')[0], discountPercent: 50, categoryScope: 'Biryani' }) }]
          })
        })
      };
    });

    const orderData = await createOrderServer('test-uid', undefined, 'BIRYANI50', 0, 'pickup', [
      { menuItemId: 'item1', quantity: 1 }, // 200 (eligible) -> discount 100
      { menuItemId: 'item2', quantity: 1 }  // 100 (ineligible)
    ]);
    
    // eligibleAmount = 200
    // discount = 50% of 200 = 100
    // subtotal = 300
    // prePointsTotal = 300 - 100 + 5 = 205
    expect(orderData.promo_discount).toBe(100);
    expect(orderData.gross_amount).toBe(205);
  });
});
