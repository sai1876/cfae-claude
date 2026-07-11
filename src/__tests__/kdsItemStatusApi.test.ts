import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/orders/update-kds-item-status/route';
import { POST as RecalculatePOST } from '@/app/api/orders/recalculate-kds-order-status/route';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

// Mock dependencies
vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn(),
}));

vi.mock('@/lib/firebaseAdmin', () => {
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn();
  const docMock = {
    get: getMock,
    update: updateMock,
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
          update: vi.fn().mockImplementation((ref, data) => ref.update(data))
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
  return new Request('http://localhost/api/orders/update-kds-item-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('KDS Item Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }));
    const req = createRequest({ order_id: '123', item_index: 0, item_status: 'ready' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid payloads (missing item_index)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const req = createRequest({ order_id: '123', item_status: 'ready' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects arbitrary patch objects (strict schema)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const req = createRequest({ order_id: '123', item_index: 0, item_status: 'ready', arbitrary_field: 'hacked' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects if station role updates wrong station', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'deep_fryer' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ items: [{ item_id: 'item1', item_status: 'ordered', station: 'BREWER' }] })
    } as any);

    const req = createRequest({ order_id: '123', item_index: 0, item_id: 'item1', item_status: 'ready' });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Station mismatch/);
  });

  it('allows if station role updates correct station', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'deep_fryer' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ items: [{ item_id: 'item1', item_status: 'ordered', station: 'FRYER' }] })
    } as any);

    const req = createRequest({ order_id: '123', item_index: 0, item_id: 'item1', item_status: 'ready' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('allows manager to update any station', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'manager' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ items: [{ item_id: 'item1', item_status: 'ordered', station: 'BREWER' }] })
    } as any);

    const req = createRequest({ order_id: '123', item_index: 0, item_id: 'item1', item_status: 'ready' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('rejects if item_index is out of bounds', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ items: [{ item_id: 'item1', item_status: 'ordered' }] })
    } as any);

    const req = createRequest({ order_id: '123', item_index: 1, item_status: 'ready' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects if item_id does not match the item at item_index (stale state)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ items: [{ item_id: 'item1', item_status: 'ordered' }] })
    } as any);

    const req = createRequest({ order_id: '123', item_index: 0, item_id: 'item2_stale', item_status: 'ready' });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/Stale/);
  });

describe('POST /api/orders/recalculate-kds-order-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({ uid: 'uid1', role: 'deep_fryer' } as any);
  });

  const createReq = (body: any) => new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any);
    const req = createReq({ order_id: '123' });
    const res = await RecalculatePOST(req);
    expect(res.status).toBe(401);
  });

  it('calculates preparing status when some items are ready', async () => {
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'confirmed', items: [{ item_status: 'ready' }, { item_status: 'ordered' }] })
    } as any);

    const req = createReq({ order_id: '123' });
    const res = await RecalculatePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.next_status).toBe('preparing');
    expect(json.changed).toBe(true);
  });

  it('calculates ready status when all items are ready', async () => {
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'preparing', items: [{ item_status: 'ready' }, { item_status: 'ready' }] })
    } as any);

    const req = createReq({ order_id: '123' });
    const res = await RecalculatePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.next_status).toBe('ready');
  });

  it('does not transition if status is already correct', async () => {
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'preparing', items: [{ item_status: 'ready' }, { item_status: 'ordered' }] })
    } as any);

    const req = createReq({ order_id: '123' });
    const res = await RecalculatePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.changed).toBe(false);
  });
  
  it('rejects terminal status updates', async () => {
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed', items: [{ item_status: 'ready' }] })
    } as any);

    const req = createReq({ order_id: '123' });
    const res = await RecalculatePOST(req);
    expect(res.status).toBe(403);
  });
});

  it('successfully updates item status and logs business event', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ uid: 'uid1', role: 'staff' } as any);
    const docMock = adminDb!.collection('orders').doc('123');
    vi.mocked(docMock.get).mockResolvedValueOnce({
      exists: true,
      data: () => ({ 
        outlet_id: 'outletA',
        items: [
          { item_id: 'item1', item_status: 'ordered' },
          { item_id: 'item2', item_status: 'ordered' }
        ] 
      })
    } as any);

    const req = createRequest({ order_id: '123', item_index: 1, item_id: 'item2', item_status: 'preparing' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify Firestore update payload
    expect(docMock.update).toHaveBeenCalledWith(expect.objectContaining({
      items: [
        { item_id: 'item1', item_status: 'ordered' },
        { item_id: 'item2', item_status: 'preparing' }
      ]
    }));

    // Verify Business Event
    expect(logBusinessEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'kds_item_status_changed',
      actor_id: 'uid1',
      actor_type: 'staff',
      target_type: 'order_item',
      target_id: '123:1',
      order_id: '123',
      outlet_id: 'outletA',
      metadata: expect.objectContaining({
        item_index: 1,
        previous_status: 'ordered',
        next_status: 'preparing'
      })
    }));
  });
});
