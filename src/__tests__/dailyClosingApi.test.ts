import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentBusinessDate, getBusinessWindow } from '../lib/businessDate';
import { POST as generatePOST } from '../app/api/daily-closing/generate/route';
import { POST as submitPOST } from '../app/api/daily-closing/submit/route';
import { POST as reviewPOST } from '../app/api/daily-closing/review/route';

// Mock dependencies
vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn()
}));

vi.mock('@/server/events/logBusinessEvent', () => ({
  logBusinessEvent: vi.fn().mockResolvedValue(true)
}));

const { mockAdminDb } = vi.hoisted(() => ({
  mockAdminDb: {
    collection: vi.fn(),
    runTransaction: vi.fn()
  }
}));

vi.mock('@/lib/firebaseAdmin', () => ({
  adminDb: mockAdminDb
}));

import { requireRole } from '@/server/auth/requireRole';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

describe('Daily Closing API & Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Business Date Utility', () => {
    it('getCurrentBusinessDate returns correct date based on 11 AM threshold', () => {
      // 2026-07-10 10:59:59 AM IST (UTC+5:30)
      const before11 = new Date('2026-07-10T10:59:59+05:30').getTime();
      expect(getCurrentBusinessDate(before11)).toBe('2026-07-09');

      // 2026-07-10 11:00:00 AM IST
      const at11 = new Date('2026-07-10T11:00:00+05:30').getTime();
      expect(getCurrentBusinessDate(at11)).toBe('2026-07-10');

      // 2026-07-11 01:00:00 AM IST
      const nextDay1AM = new Date('2026-07-11T01:00:00+05:30').getTime();
      expect(getCurrentBusinessDate(nextDay1AM)).toBe('2026-07-10');
    });

    it('getBusinessWindow returns correct unix timestamps', () => {
      const window = getBusinessWindow('2026-07-10');
      const start = new Date('2026-07-10T11:00:00+05:30').getTime();
      const end = start + (14 * 60 * 60 * 1000);
      
      expect(window.start_at).toBe(start);
      expect(window.end_at).toBe(end);
      expect(window.timezone).toBe('Asia/Kolkata');
    });
  });

  describe('Generate API', () => {
    it('blocks generation if previous day is submitted but not locked', async () => {
      vi.mocked(requireRole).mockResolvedValue({ uid: 'mgr1', role: 'manager' } as any);
      
      const mockQueryGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ data: () => ({ status: 'submitted', business_date: '2026-07-09' }) }]
      });

      const mockLimit = vi.fn().mockReturnValue({ get: mockQueryGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockAdminDb.collection.mockImplementation((col) => {
        if (col === 'daily_closings') {
          return { where: mockWhere1 };
        }
        return { where: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) };
      });

      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ outlet_id: 'hauhau-main', business_date: '2026-07-10' })
      });

      const res = await generatePOST(req);
      const data = await res.json();

      expect(data.success).toBe(false);
      expect(data.error).toMatch(/submitted but not locked/);
      expect(data.requires_override).toBe(true);
    });

    it('aggregates orders correctly inside business window', async () => {
      vi.mocked(requireRole).mockResolvedValue({ uid: 'mgr1', role: 'manager' } as any);
      
      const mockQueryGet = vi.fn().mockResolvedValue({ empty: true, docs: [] }); // no previous closing
      
      const mockOrdersGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ status: 'completed', gross_amount: 500, cash_paid: 500, payment_status: 'paid' }) },
          { data: () => ({ status: 'completed', gross_amount: 300, cash_paid: 0, payment_status: 'paid' }) }, // upi
          { data: () => ({ status: 'cancelled' }) }
        ]
      });

      mockAdminDb.collection.mockImplementation((col) => {
        if (col === 'daily_closings') {
          return {
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: mockQueryGet,
            doc: vi.fn().mockReturnValue({ id: 'doc1' })
          };
        }
        if (col === 'orders') {
          return {
            where: vi.fn().mockReturnThis(),
            get: mockOrdersGet
          };
        }
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0, forEach: vi.fn() })
        };
      });

      let savedData: any = null;
      mockAdminDb.runTransaction.mockImplementation(async (cb) => {
        const t = {
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockImplementation((ref, data) => { savedData = data; })
        };
        await cb(t);
      });

      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ outlet_id: 'hauhau-main', business_date: '2026-07-10' })
      });

      const res = await generatePOST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(savedData.sales_summary.gross_sales).toBe(800);
      expect(savedData.sales_summary.cash_sales).toBe(500);
      expect(savedData.sales_summary.upi_sales).toBe(300);
      expect(savedData.sales_summary.completed_order_count).toBe(2);
      expect(savedData.sales_summary.cancelled_order_count).toBe(1);
    });
  });

  describe('Submit API', () => {
    it('requires note if cash difference is large', async () => {
      vi.mocked(requireRole).mockResolvedValue({ uid: 'mgr1', role: 'manager' } as any);
      
      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          closing_id: 'close1',
          counted_cash: 300,
          verified_upi: 0
        })
      });

      mockAdminDb.runTransaction.mockImplementation(async (cb) => {
        const t = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: 'draft',
              cash_reconciliation: { expected_cash: 500 } // Diff is -200
            })
          }),
          set: vi.fn()
        };
        await cb(t);
      });

      const res = await submitPOST(req);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/exceeds threshold.*manager note is required/i);
    });

    it('submits successfully with note if cash difference is large', async () => {
      vi.mocked(requireRole).mockResolvedValue({ uid: 'mgr1', role: 'manager' } as any);
      
      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          closing_id: 'close1',
          counted_cash: 300,
          verified_upi: 0,
          manager_cash_note: 'Lost 200'
        })
      });

      let savedData: any = null;
      mockAdminDb.runTransaction.mockImplementation(async (cb) => {
        const t = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: 'draft',
              cash_reconciliation: { expected_cash: 500 },
              payment_reconciliation: {}
            })
          }),
          set: vi.fn().mockImplementation((ref, data) => { savedData = data; })
        };
        await cb(t);
      });

      const res = await submitPOST(req);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(savedData.status).toBe('submitted');
      expect(savedData.cash_reconciliation.cash_difference).toBe(-200);
      expect(logBusinessEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'daily_closing_submitted' }));
    });
  });

  describe('Review API', () => {
    it('blocks admin from approving and locking', async () => {
      vi.mocked(requireRole).mockResolvedValue({ uid: 'adm1', role: 'admin' } as any);
      
      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          closing_id: 'close1',
          decision: 'approved'
        })
      });

      const res = await reviewPOST(req);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Only owner can approve and lock/i);
    });

    it('allows owner to approve and lock, requiring note if difference > 500', async () => {
      vi.mocked(requireRole).mockResolvedValue({ uid: 'own1', role: 'owner' } as any);
      
      let req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          closing_id: 'close1',
          decision: 'approved'
        })
      });

      mockAdminDb.runTransaction.mockImplementation(async (cb) => {
        const t = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: 'submitted',
              cash_reconciliation: { cash_difference: -600 }
            })
          }),
          set: vi.fn()
        };
        await cb(t);
      });

      let res = await reviewPOST(req);
      let data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Explicit owner note is required/i);

      // Now with note
      req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          closing_id: 'close1',
          decision: 'approved',
          founder_review_note: 'Checked cameras, cash was miscounted'
        })
      });

      let savedData: any = null;
      mockAdminDb.runTransaction.mockImplementation(async (cb) => {
        const t = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: 'submitted',
              cash_reconciliation: { cash_difference: -600 }
            })
          }),
          set: vi.fn().mockImplementation((ref, d) => { savedData = d; })
        };
        await cb(t);
      });

      res = await reviewPOST(req);
      data = await res.json();
      
      expect(data.success).toBe(true);
      expect(savedData.status).toBe('locked');
      expect(savedData.founder_review_note).toBe('Checked cameras, cash was miscounted');
    });
  });
});
