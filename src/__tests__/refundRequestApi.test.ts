import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createRequest } from '@/app/api/refund-requests/create/route';
import { POST as reviewRequest } from '@/app/api/refund-requests/review/route';
import { POST as markPaymentDone } from '@/app/api/refund-requests/mark-payment-done/route';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireRole } from '@/server/auth/requireRole';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

vi.mock('@/lib/firebaseAdmin', () => ({
  adminDb: {
    collection: vi.fn(),
    runTransaction: vi.fn()
  }
}));

vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn()
}));

// Replaced requireAuth mock

vi.mock('@/server/events/logBusinessEvent', () => ({
  logBusinessEvent: vi.fn()
}));

describe('Refund Request API', () => {
  const mockAdminDb = adminDb as any;
  const requireRoleMock = vi.mocked(requireRole);
  const logEventMock = vi.mocked(logBusinessEvent);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTransaction = (mockBehavior: any) => {
    mockAdminDb.runTransaction.mockImplementation(async (callback: any) => {
      const transaction = {
        get: vi.fn().mockImplementation(mockBehavior.get || vi.fn()),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      };
      return await callback(transaction);
    });
  };

  it('customer creates request for own order successfully', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'cust1', role: 'customer' });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id) {
          return {
            exists: true,
            data: () => ({
              user_id: 'cust1',
              is_paid: true,
              gross_amount: 100,
              refunded_amount: 0
            })
          };
        } else {
          return { empty: true }; // for active requests query
        }
      }
    });
    
    // the query chaining for active request check
    mockAdminDb.collection.mockReturnValue({
      doc: (id: string) => ({
        id,
        collection: vi.fn().mockReturnValue({ doc: vi.fn() })
      }),
      where: () => ({
        where: () => ({
          // mock query ref
          get: () => ({ empty: true })
        })
      })
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        order_id: 'ord1',
        request_scope: 'full_order',
        reason_category: 'late_order',
        customer_note: 'Too late'
      })
    });

    const res = await createRequest(req);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.request_id).toBeDefined();
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'refund_request_created',
      metadata: expect.objectContaining({ action: 'refund_request_created' })
    }));
  });

  it('customer cannot request another users order', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'cust2', role: 'customer' });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id) {
          return {
            exists: true,
            data: () => ({
              user_id: 'cust1', // different
              is_paid: true,
              gross_amount: 100
            })
          };
        } else {
          return { empty: true };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        order_id: 'ord1',
        request_scope: 'full_order',
        reason_category: 'late_order',
        customer_note: 'Too late'
      })
    });

    const res = await createRequest(req);
    const data = await res.json();
    
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/Forbidden/);
  });

  it('duplicate pending request is blocked', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'cust1', role: 'customer' });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id) {
          return {
            exists: true,
            data: () => ({ user_id: 'cust1', is_paid: true, gross_amount: 100 })
          };
        }
        return { empty: false }; // active request exists
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        order_id: 'ord1',
        request_scope: 'full_order',
        reason_category: 'late_order',
        customer_note: 'Too late'
      })
    });

    const res = await createRequest(req);
    const data = await res.json();
    
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/active refund request already exists/);
  });

  it('manager can approve request atomically', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'mgr1', role: 'manager' });
    
    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'pending',
              order_id: 'ord1',
              request_scope: 'custom_amount',
              requested_amount: 10,
              reason_category: 'bad_quality'
            })
          };
        }
        if (ref.id === 'ord1') {
          return {
            exists: true,
            data: () => ({
              user_id: 'cust1',
              is_paid: true,
              gross_amount: 100,
              refunded_amount: 0
            })
          };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        decision: 'approved',
        manager_note: 'I agree'
      })
    });

    const res = await reviewRequest(req);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.refund_id).toBeDefined();
    
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'refund_request_reviewed'
    }));
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'refund_processed'
    }));
  });

  it('manager can reject request without creating ledger', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'mgr1', role: 'manager' });
    
    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'pending',
              order_id: 'ord1'
            })
          };
        }
        if (ref.id === 'ord1') {
          return { exists: true, data: () => ({}) };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        decision: 'rejected',
        manager_note: 'No way'
      })
    });

    const res = await reviewRequest(req);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.refund_id).toBeUndefined(); // no ledger
    
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'refund_request_reviewed',
      metadata: expect.objectContaining({ decision: 'rejected' })
    }));
  });

  it('staff cannot review requests', async () => {
    requireRoleMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 }) as any
    );

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        decision: 'approved',
        manager_note: 'Yes'
      })
    });

    const res = await reviewRequest(req);
    expect(res.status).toBe(403);
  });
  it('customer item refund request approval maps quantity/requested_amount correctly', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'mgr1', role: 'manager' });
    
    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'pending',
              order_id: 'ord1',
              request_scope: 'items',
              requested_amount: 15,
              reason_category: 'bad_quality',
              items_requested: [{ item_id: 'i1', quantity: 1, requested_amount: 15 }]
            })
          };
        }
        if (ref.id === 'ord1') {
          return {
            exists: true,
            data: () => ({
              user_id: 'cust1',
              is_paid: true,
              gross_amount: 100,
              refunded_amount: 0,
              items: [{ item_id: 'i1', quantity: 2, unit_price: 15 }]
            })
          };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        decision: 'approved',
        manager_note: 'I agree'
      })
    });

    const res = await reviewRequest(req);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.refund_id).toBeDefined();
    expect(data.refunded_amount).toBe(15);
  });

  it('item refund creates wastage mapping correctly using order data menu_item_id', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'mgr1', role: 'manager' });
    
    let setMock = vi.fn().mockResolvedValue({});
    mockAdminDb.collection.mockImplementation((col: string) => {
      if (col === 'wastage_events') {
        return { doc: () => ({ set: setMock }) };
      }
      return {
        doc: (id: string) => ({
          id,
          collection: (subCol: string) => ({
            doc: (subId: string) => ({ id: subId })
          })
        })
      };
    });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req_items') {
          return {
            exists: true,
            data: () => ({
              status: 'pending',
              order_id: 'ord1',
              request_scope: 'items',
              reason_category: 'bad_quality'
            })
          };
        }
        if (ref.id === 'ord1') {
          return {
            exists: true,
            data: () => ({
              user_id: 'cust1',
              is_paid: true,
              gross_amount: 100,
              refunded_amount: 0,
              items: [
                { item_id: 'cart1', menu_item_id: 'menu1', name: 'Burger', quantity: 2 },
                { item_id: 'cart2', name: 'No Menu ID', quantity: 1 }
              ]
            })
          };
        }
        return { exists: false };
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req_items',
        decision: 'approved',
        manager_note: 'Refund some items',
        approved_refund_amount: 51,
        create_wastage_record: true,
        wastage_event_type: 'wastage',
        approved_items: [
          { item_id: 'cart1', quantity_refunded: 1, refund_amount: 50 },
          { item_id: 'cart2', quantity_refunded: 1, refund_amount: 1 } // no menu id, but needs valid >0 amount
        ]
      })
    });

    const res = await reviewRequest(req);
    const data = await res.json();
    if (!data.success) {
      console.log('Error:', data.error);
    }
    expect(data.success).toBe(true);
    // Should create wastage only for items that have menu_item_id in orderData
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({
          menu_item_id: 'menu1',
          item_name: 'Burger',
          quantity: 1,
          order_item_id: 'cart1'
        })
      ])
    }));
    
    const callArgs = setMock.mock.calls[0][0];
    const items = callArgs.items;
    expect(items).toHaveLength(1);
    expect(items[0].menu_item_id).toBeDefined();
    
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'wastage_items_skipped'
    }));
  });

  it('item request without requested_amount cannot be approved unless manager supplies approved_items', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'mgr1', role: 'manager' });
    
    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'pending',
              order_id: 'ord1',
              request_scope: 'items',
              reason_category: 'bad_quality',
              items_requested: [{ item_id: 'i1', quantity: 1 }]
            })
          };
        }
        if (ref.id === 'ord1') {
          return {
            exists: true,
            data: () => ({
              user_id: 'cust1',
              is_paid: true,
              gross_amount: 100,
              refunded_amount: 0,
              items: [{ item_id: 'i1', quantity: 2, unit_price: 15 }]
            })
          };
        }
      }
    });

    // Test rejection without approved_items
    let req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        decision: 'approved',
        manager_note: 'I agree',
        approved_refund_amount: 15
      })
    });

    let res = await reviewRequest(req);
    let data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/missing a requested_amount/);

    // Test success with approved_items
    req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        decision: 'approved',
        manager_note: 'I agree',
        approved_refund_amount: 15,
        approved_items: [{ item_id: 'i1', quantity_refunded: 1, refund_amount: 15 }]
      })
    });

    res = await reviewRequest(req);
    data = await res.json();
    expect(data.success).toBe(true);
    expect(data.refund_id).toBeDefined();
  });

  it('full order refund creates wastage mapping correctly with menu_item_id', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'mgr1', role: 'manager' });
    
    let setMock = vi.fn().mockResolvedValue({});
    mockAdminDb.collection.mockImplementation((col: string) => {
      if (col === 'wastage_events') {
        return { doc: () => ({ set: setMock }) };
      }
      return {
        doc: (id: string) => ({
          id,
          collection: (subCol: string) => ({
            doc: (subId: string) => ({ id: subId })
          })
        })
      };
    });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req_full') {
          return {
            exists: true,
            data: () => ({
              status: 'pending',
              order_id: 'ord1',
              request_scope: 'full_order',
              reason_category: 'bad_quality',
              requested_amount: 100
            })
          };
        }
        if (ref.id === 'ord1') {
          return {
            exists: true,
            data: () => ({
              user_id: 'cust1',
              is_paid: true,
              gross_amount: 100,
              refunded_amount: 0,
              items: [
                { id: 'cart1', menu_item_id: 'menu1', name: 'Burger', quantity: 2 },
                { id: 'cart2', name: 'Missing Menu Item ID', quantity: 1 } // missing menu_item_id
              ]
            })
          };
        }
        return { exists: false };
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req_full',
        decision: 'approved',
        manager_note: 'Refund full order',
        approved_refund_amount: 100,
        create_wastage_record: true,
        wastage_event_type: 'wastage'
      })
    });

    const res = await reviewRequest(req);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    // Should create wastage only for items that have menu_item_id
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({
          menu_item_id: 'menu1',
          item_name: 'Burger',
          quantity: 2
        })
      ])
    }));
    // Should not include undefined menu_item_id
    const callArgs = setMock.mock.calls[0][0];
    const items = callArgs.items;
    expect(items).toHaveLength(1);
    expect(items[0].menu_item_id).toBeDefined();
    
    // It should also warn because it skipped some items
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'wastage_items_skipped',
      metadata: expect.objectContaining({
        reason: 'missing_menu_item_ids'
      })
    }));
  });

  it('approved request with missing payment_status can be marked paid if linked_refund_id exists', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'man1', role: 'manager' });
    
    mockAdminDb.collection.mockReturnValue({
      doc: (id: string) => ({
        id,
        collection: (col: string) => ({
          doc: (subId: string) => ({ id: subId })
        })
      })
    });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'approved',
              order_id: 'ord1',
              linked_refund_id: 'ref1'
            })
          };
        }
        if (ref.id === 'ref1') {
          return {
            exists: true,
            data: () => ({
              refund_id: 'ref1'
            })
          };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        payment_method: 'upi',
        payment_reference: 'UPI123'
      })
    });

    const res = await markPaymentDone(req);
    const data = await res.json();
    
    expect(data.success).toBe(true);
  });

  it('approved request with payment_status pending can be marked paid', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'man1', role: 'manager' });
    
    mockAdminDb.collection.mockReturnValue({
      doc: (id: string) => ({
        id,
        collection: (col: string) => ({
          doc: (subId: string) => ({ id: subId })
        })
      })
    });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'approved',
              payment_status: 'pending',
              order_id: 'ord1',
              linked_refund_id: 'ref1'
            })
          };
        }
        if (ref.id === 'ref1') {
          return {
            exists: true,
            data: () => ({
              refund_id: 'ref1'
            })
          };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        payment_method: 'upi',
        payment_reference: 'UPI123'
      })
    });

    const res = await markPaymentDone(req);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'refund_payment_marked_done'
    }));
  });

  it('fails to mark payment done if payment_reference missing for upi', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'man1', role: 'manager' });
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        payment_method: 'upi'
      })
    });

    const res = await markPaymentDone(req);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/payment_reference required/);
  });
  
  it('fails if request is already paid', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'man1', role: 'manager' });

    mockAdminDb.collection.mockReturnValue({
      doc: (id: string) => ({
        id,
        collection: (col: string) => ({
          doc: (subId: string) => ({ id: subId })
        })
      })
    });

    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'approved',
              payment_status: 'paid',
              order_id: 'ord1',
              linked_refund_id: 'ref1'
            })
          };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        payment_method: 'cash',
        payment_note: 'Given physically'
      })
    });

    const res = await markPaymentDone(req);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/already marked paid/);
  });

  it('fails if request is rejected', async () => {
    requireRoleMock.mockResolvedValue({ uid: 'man1', role: 'manager' });
    mockTransaction({
      get: (ref: any) => {
        if (ref.id === 'req1') {
          return {
            exists: true,
            data: () => ({
              status: 'rejected',
              order_id: 'ord1'
            })
          };
        }
      }
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req1',
        payment_method: 'cash'
      })
    });

    const res = await markPaymentDone(req);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/Cannot mark payment done for request with status: rejected/);
  });
});
