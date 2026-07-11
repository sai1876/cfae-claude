import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refundPayment } from '@/features/orders/orderService';

vi.mock('@/lib/firebase', () => {
  return {
    auth: {
      currentUser: {
        getIdToken: vi.fn().mockResolvedValue('fake-token')
      }
    },
    db: {}
  };
});

describe('orderService - refundPayment', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({})
    } as any);
  });

  it('sends correct payload for full_order scope', async () => {
    await refundPayment('order1', 'full_order', 100, 'Bad food', 'cash');

    expect(fetchSpy).toHaveBeenCalledWith('/api/orders/refund-payment', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        order_id: 'order1',
        refund_scope: 'full_order',
        refund_amount: 100,
        reason: 'Bad food',
        method: 'cash'
      })
    }));
  });

  it('sends correct payload for custom_amount scope', async () => {
    await refundPayment('order2', 'custom_amount', 50, 'Goodwill');

    expect(fetchSpy).toHaveBeenCalledWith('/api/orders/refund-payment', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        order_id: 'order2',
        refund_scope: 'custom_amount',
        refund_amount: 50,
        reason: 'Goodwill'
      })
    }));
  });

  it('sends correct payload for items scope', async () => {
    const items = [
      { item_id: 'i1', quantity_refunded: 1, refund_amount: 20 },
      { item_id: 'i2', quantity_refunded: 2, refund_amount: 30 }
    ];
    await refundPayment('order3', 'items', 50, 'Items missing', 'card', items);

    expect(fetchSpy).toHaveBeenCalledWith('/api/orders/refund-payment', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        order_id: 'order3',
        refund_scope: 'items',
        refund_amount: 50,
        reason: 'Items missing',
        method: 'card',
        items
      })
    }));
  });

  it('rejects items scope without items array', async () => {
    await expect(refundPayment('order4', 'items', 50, 'Missing items'))
      .rejects.toThrow("Items array is required when refund scope is 'items'");
    
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects full_order scope with items array', async () => {
    const items = [{ item_id: 'i1', quantity_refunded: 1, refund_amount: 20 }];
    await expect(refundPayment('order5', 'full_order', 50, 'Refund', 'cash', items))
      .rejects.toThrow("Items array must not be provided for non-item scopes");
    
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects custom_amount scope with items array', async () => {
    const items = [{ item_id: 'i1', quantity_refunded: 1, refund_amount: 20 }];
    await expect(refundPayment('order6', 'custom_amount', 50, 'Refund', 'cash', items))
      .rejects.toThrow("Items array must not be provided for non-item scopes");
    
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
