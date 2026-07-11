import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/orders/update-status/route';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

// Mock dependencies
vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn()
}));

vi.mock('@/lib/firebaseAdmin', () => {
  const docMock = {
    get: vi.fn(),
    update: vi.fn()
  };
  const collectionMock = {
    doc: vi.fn(() => docMock)
  };
  return {
    adminDb: {
      collection: vi.fn(() => collectionMock)
    }
  };
});

vi.mock('@/server/events/logBusinessEvent', () => ({
  logBusinessEvent: vi.fn()
}));

describe('POST /api/orders/update-status', () => {
  const createRequest = (body: any) => new Request('http://localhost/api/orders/update-status', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized access (not staff/manager/admin/owner)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }));

    const req = createRequest({ order_id: '123', next_status: 'preparing' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.detail).toBe('Unauthorized');
    expect(requireRole).toHaveBeenCalledWith(req, ['staff', 'manager', 'admin', 'owner']);
  });

  it('rejects invalid payload via Zod (missing next_status, payment_status, rider_id, rush_held)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);

    const req = createRequest({ order_id: '123' }); // Missing at least one status field
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('rejects invalid fields in payload (items, generic patches)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    
    // Setup mock order
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: false, rush_held: true })
    } as any);

    const req = createRequest({ 
      order_id: '123', 
      next_status: 'preparing', 
      items: [{ id: '1' }] // Extraneous field
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify it didn't pass "items" to update
    const updateCall = vi.mocked(docMock.update).mock.calls[0][0];
    expect(updateCall).not.toHaveProperty('items');
  });

  it('allows manager to jump to delivered with a reason and logs a warning for skipped states', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: false })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'delivered', reason: 'Customer requested early delivery' });
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    expect(logBusinessEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'order_status_changed',
      severity: 'warning' // Skipped forward transition
    }));
  });

  it('rejects manager jumping to delivered without a reason', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: false })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'delivered' });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/valid reason is required/);
  });

  it('blocks staff from random backward transitions', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'delivered', is_paid: true })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'pending' });
    const res = await POST(req);
    
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Cannot modify a terminal order state/);
  });

  it('rejects staff updating payment_status', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: false })
    } as any);

    const req = createRequest({ order_id: '123', payment_status: 'paid' });
    const res = await POST(req);
    
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Insufficient permissions to modify payment status/);
  });

  it('allows manager to update payment_status', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: false })
    } as any);

    const req = createRequest({ order_id: '123', payment_status: 'paid' });
    const res = await POST(req);
    
    expect(res.status).toBe(200);
  });

  it('rejects cancel/reject without reason', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: false })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'cancelled' });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/valid reason is required/);
  });

  it('allows staff to complete ready order directly', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'ready', is_paid: true })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'completed' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('allows staff to complete out_for_delivery order directly', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'out_for_delivery', is_paid: true })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'completed' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('rejects manager jumping from pending to completed without a reason', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: true })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'completed' });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/valid reason is required/);
  });

  it('allows manager to jump from pending to completed with a reason', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', is_paid: true })
    } as any);

    const req = createRequest({ order_id: '123', next_status: 'completed', reason: 'Manager override completion' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
