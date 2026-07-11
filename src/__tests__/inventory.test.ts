import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateOrderStatus } from '../lib/dbService';
import * as firestore from 'firebase/firestore';

// Mock firestore
vi.mock('@/lib/firebase', () => {
  return {
    db: {},
    auth: {
      currentUser: {
        getIdToken: vi.fn().mockResolvedValue('mock-id-token')
      }
    }
  };
});

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    runTransaction: vi.fn(),
    getDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    collection: vi.fn()
  };
});

// Mock global fetch to prevent Invalid URL for relative paths
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true })
});

describe('Inventory & Orders dbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateOrderStatus', () => {
    it('should only update order status and NOT deduct stock', async () => {
      await updateOrderStatus('order_123', 'preparing');
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/orders/update-status',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: JSON.stringify({ order_id: 'order_123', next_status: 'preparing' })
        })
      );
      
      expect(firestore.runTransaction).not.toHaveBeenCalled();
    });
  });
});
