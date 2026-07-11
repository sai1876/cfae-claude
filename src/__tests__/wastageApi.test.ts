import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST as createWastage } from '@/app/api/wastage-events/create/route';
import { POST as approveWastage } from '@/app/api/wastage-events/approve/route';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireRole } from '@/server/auth/requireRole';

// Mock everything
vi.mock('@/lib/firebaseAdmin', () => ({
  adminDb: {
    collection: vi.fn(),
    runTransaction: vi.fn()
  }
}));

vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn()
}));

vi.mock('@/server/events/logBusinessEvent', () => ({
  logBusinessEvent: vi.fn()
}));

describe('Wastage API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Wastage', () => {
    it('determines deduct_inventory=true for remake with menu_item', async () => {
      // Mock auth
      (requireRole as any).mockResolvedValue({ uid: 'kitchen1', role: 'kitchen' });
      
      const docSet = vi.fn().mockResolvedValue({});
      ((adminDb as any).collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({ set: docSet })
      });

      const req = new Request('http://localhost/api/wastage-events/create', {
        method: 'POST',
        body: JSON.stringify({
          source_type: 'customer_complaint',
          event_type: 'remake',
          items: [{ item_name: 'Burger', quantity: 1, loss_basis: 'menu_item' }],
          reason_category: 'test',
          manager_note: 'test note'
        })
      });

      const res = await createWastage(req);
      const data = await res.json();
      
      expect(data.success).toBe(true);
      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({
        deduct_inventory: true,
        deduction_method: 'recipe'
      }));
    });

    it('determines deduct_inventory=false for prepared food wastage', async () => {
      (requireRole as any).mockResolvedValue({ uid: 'kitchen1', role: 'kitchen' });
      
      const docSet = vi.fn().mockResolvedValue({});
      ((adminDb as any).collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({ set: docSet })
      });

      const req = new Request('http://localhost/api/wastage-events/create', {
        method: 'POST',
        body: JSON.stringify({
          source_type: 'customer_complaint',
          event_type: 'wastage',
          items: [{ item_name: 'Burger', quantity: 1, loss_basis: 'menu_item' }],
          reason_category: 'test',
          manager_note: 'test note'
        })
      });

      const res = await createWastage(req);
      const data = await res.json();
      
      expect(data.success).toBe(true);
      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({
        deduct_inventory: false,
        deduction_method: 'none'
      }));
    });
  });
  
  describe('Approve Wastage', () => {
    it('executes transaction for recipe deduction idempotently', async () => {
      (requireRole as any).mockResolvedValue({ uid: 'manager1', role: 'manager' });
      
      const mockWhere = vi.fn().mockReturnValue({
        // This is what transaction.get will receive
        _isMockQuery: true
      });

      ((adminDb as any).collection as any).mockImplementation((col: string) => {
        return {
          doc: vi.fn().mockImplementation((id?: string) => ({ id: id || 'mockDoc' })),
          where: mockWhere
        };
      });
      
      ((adminDb as any).runTransaction as any).mockImplementation(async (cb: any) => {
        const mockTransaction = {
          get: vi.fn().mockImplementation(async (ref) => {
            if (ref._isMockQuery) {
              return { empty: true }; // No existing stock movements
            }
            if (ref.id === 'event1') {
              return {
                exists: true,
                data: () => ({
                  status: 'reported',
                  deduct_inventory: true,
                  deduction_method: 'recipe',
                  inventory_deducted_at: null, // Not deducted yet
                  items: [{ menu_item_id: 'menu1', loss_basis: 'menu_item', quantity: 2 }]
                })
              };
            }
            if (ref.id === 'menu1') {
              return {
                exists: true,
                data: () => ({ recipe: [{ stock_id: 'stock1', quantity: 5 }] })
              };
            }
            if (ref.id === 'stock1') {
              return { exists: true, data: () => ({ current_quantity: 20 }) };
            }
            return { exists: false };
          }),
          update: vi.fn(),
          set: vi.fn()
        };
        await cb(mockTransaction);
        return mockTransaction;
      });

      const req = new Request('http://localhost/api/wastage-events/approve', {
        method: 'POST',
        body: JSON.stringify({
          event_id: 'event1',
          decision: 'approved'
        })
      });

      const res = await approveWastage(req);
      const data = await res.json();
      
      if (!data.success) {
        console.error("Test failed because:", data.error);
      }
      expect(data.success).toBe(true);
      expect((adminDb as any).runTransaction).toHaveBeenCalled();
    });
  });
});
