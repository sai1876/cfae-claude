import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/orders/refund-payment/route';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn(),
}));

vi.mock('@/lib/firebaseAdmin', () => {
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn();
  
  const refundDocMock = {
    set: setMock
  };
  const refundsCollectionMock = {
    doc: vi.fn(() => refundDocMock)
  };
  
  const docMock = {
    get: getMock,
    update: updateMock,
    collection: vi.fn((colName) => {
      if (colName === 'refunds') return refundsCollectionMock;
      return null;
    })
  };
  
  const collectionMock = {
    doc: vi.fn(() => docMock),
  };
  return {
    adminDb: {
      collection: vi.fn(() => collectionMock),
      runTransaction: vi.fn(async (cb) => {
        const transactionMock = {
          get: vi.fn().mockImplementation((ref) => ref.get()),
          update: vi.fn().mockImplementation((ref, data) => ref.update(data)),
          set: vi.fn().mockImplementation((ref, data) => ref.set(data))
        };
        return cb(transactionMock);
      }),
    },
  };
});

vi.mock('@/server/events/logBusinessEvent', () => ({
  logBusinessEvent: vi.fn().mockResolvedValue(undefined),
}));

function createRequest(body: any) {
  return new Request('http://localhost/api/orders/refund-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Payment Refund API', () => {
  let docMock: any;
  let refundsDocMock: any;
  let transactionSetMock: any;
  let transactionUpdateMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    docMock = adminDb!.collection('orders').doc('123');
    refundsDocMock = docMock.collection('refunds').doc('any');
    // Using vi.mocked on the runTransaction callback methods indirectly by spying on them if we could, 
    // but the transaction mock delegates back to docMock methods.
    transactionSetMock = refundsDocMock.set;
    transactionUpdateMock = docMock.update;
  });

  it('rejects staff and customer requests', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(NextResponse.json({ error: 'Forbidden' }, { status: 403 }) as any);
    const req = createRequest({ order_id: '123', refund_scope: 'full_order', refund_amount: 10, reason: 'test' });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('allows manager/admin to process full order refund, creates ledger', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        refunded_amount: 0,
        refund_status: 'none',
        items: [
          { item_id: 'i1', unit_price: 60, quantity: 1, refunded_quantity: 0, refunded_amount: 0 },
          { item_id: 'i2', unit_price: 20, quantity: 2, refunded_quantity: 0, refunded_amount: 0 }
        ]
      })
    } as any);

    const req = createRequest({ order_id: '123', refund_scope: 'full_order', refund_amount: 100, reason: 'Bad quality' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.refund_status).toBe('full');

    // Ledger created
    expect(transactionSetMock).toHaveBeenCalledWith(expect.objectContaining({
      refund_scope: 'full_order',
      refund_amount: 100,
      items_refunded: expect.arrayContaining([
        expect.objectContaining({ item_id: 'i1', quantity_refunded: 1, refund_amount: 60 }),
        expect.objectContaining({ item_id: 'i2', quantity_refunded: 2, refund_amount: 40 })
      ])
    }));

    // Order summary updated
    expect(transactionUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      refund_status: 'full',
      refunded_amount: 100
    }));

    // Logs event
    expect(logBusinessEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'refund_processed',
      metadata: expect.objectContaining({
        refund_scope: 'full_order',
        refund_amount: 100
      })
    }));
  });

  it('rejects items scope without items array', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    const req = createRequest({ order_id: '123', refund_scope: 'items', refund_amount: 10, reason: 'test' });
    const res = await POST(req);
    expect(res.status).toBe(400); // Zod validation fails
  });

  it('processes single item refund successfully', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        refunded_amount: 0,
        refund_status: 'none',
        items: [
          { item_id: 'i1', menu_item_id: 'm1', unit_price: 50, quantity: 2, refunded_quantity: 0, refunded_amount: 0 }
        ]
      })
    } as any);

    const req = createRequest({
      order_id: '123',
      refund_scope: 'items',
      refund_amount: 50,
      reason: 'Cold',
      items: [{ item_id: 'i1', quantity_refunded: 1, refund_amount: 50 }]
    });
    
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(transactionSetMock).toHaveBeenCalledWith(expect.objectContaining({
      refund_scope: 'items',
      items_refunded: [
        { item_id: 'i1', menu_item_id: 'm1', quantity_refunded: 1, refund_amount: 50 }
      ]
    }));

    // Assert items array mutation
    expect(transactionUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      refund_status: 'partial',
      refunded_amount: 50,
      items: [
        expect.objectContaining({ item_id: 'i1', refunded_quantity: 1, refunded_amount: 50 })
      ]
    }));
  });

  it('processes multiple item refund successfully', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        refunded_amount: 0,
        refund_status: 'none',
        items: [
          { item_id: 'i1', unit_price: 40, quantity: 1 },
          { item_id: 'i2', unit_price: 60, quantity: 1 }
        ]
      })
    } as any);

    const req = createRequest({
      order_id: '123',
      refund_scope: 'items',
      refund_amount: 100,
      reason: 'Lost order',
      items: [
        { item_id: 'i1', quantity_refunded: 1, refund_amount: 40 },
        { item_id: 'i2', quantity_refunded: 1, refund_amount: 60 }
      ]
    });
    
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('rejects unknown item_id', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        items: [{ item_id: 'i1', unit_price: 100, quantity: 1 }]
      })
    } as any);

    const req = createRequest({
      order_id: '123',
      refund_scope: 'items',
      refund_amount: 100,
      reason: 'test',
      items: [{ item_id: 'unknown', quantity_refunded: 1, refund_amount: 100 }]
    });
    
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('not found in order');
  });

  it('rejects over quantity refund for an item', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        items: [{ item_id: 'i1', unit_price: 100, quantity: 1, refunded_quantity: 1 }]
      })
    } as any);

    const req = createRequest({
      order_id: '123',
      refund_scope: 'items',
      refund_amount: 100,
      reason: 'test',
      items: [{ item_id: 'i1', quantity_refunded: 1, refund_amount: 100 }]
    });
    
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('exceeds remaining refundable quantity');
  });

  it('rejects over amount refund for an item', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        items: [{ item_id: 'i1', unit_price: 50, quantity: 1, refunded_amount: 0 }]
      })
    } as any);

    const req = createRequest({
      order_id: '123',
      refund_scope: 'items',
      refund_amount: 60,
      reason: 'test',
      items: [{ item_id: 'i1', quantity_refunded: 1, refund_amount: 60 }]
    });
    
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('exceeds remaining item refundable amount');
  });

  it('processes custom amount refund successfully without items', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        refunded_amount: 0,
        items: []
      })
    } as any);

    const req = createRequest({
      order_id: '123',
      refund_scope: 'custom_amount',
      refund_amount: 20,
      reason: 'Goodwill'
    });
    
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(transactionSetMock).toHaveBeenCalledWith(expect.objectContaining({
      refund_scope: 'custom_amount',
      refund_amount: 20,
      reason: 'Goodwill'
    }));
  });

  it('rejects cumulative refund exceeding gross_amount', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        refunded_amount: 80,
      })
    } as any);

    const req = createRequest({ order_id: '123', refund_scope: 'custom_amount', refund_amount: 30, reason: 'Too much' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('exceeds order total');
  });

  it('rejects duplicate full refund', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: true,
        refunded_amount: 100,
        refund_status: 'full'
      })
    } as any);

    const req = createRequest({ order_id: '123', refund_scope: 'full_order', refund_amount: 100, reason: 'Duplicate' });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects unpaid order', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'admin' } as any);
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({
        gross_amount: 100,
        is_paid: false
      })
    } as any);

    const req = createRequest({ order_id: '123', refund_scope: 'custom_amount', refund_amount: 10, reason: 'Unpaid' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Cannot refund an unpaid order.");
  });
});
