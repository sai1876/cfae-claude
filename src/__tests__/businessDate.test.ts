import { describe, it, expect, afterAll } from 'vitest';
import { getCurrentBusinessDate, getBusinessWindow, isWithinOperatingWindow, getBusinessDateContext } from '../lib/businessDate';

describe('businessDate utils', () => {
  describe('getBusinessWindow', () => {
    it('returns start_at 11:00 AM and end_at 1:00 AM next day (14 hours)', () => {
      const { start_at, end_at, timezone } = getBusinessWindow('2026-07-10');
      
      // 2026-07-10T11:00:00+05:30 -> UTC timestamp
      const startMs = new Date('2026-07-10T11:00:00+05:30').getTime();
      const endMs = startMs + 14 * 60 * 60 * 1000;

      expect(start_at).toBe(startMs);
      expect(end_at).toBe(endMs);
      expect(timezone).toBe('Asia/Kolkata');
    });
  });

  describe('isWithinOperatingWindow', () => {
    it('2026-07-10 11:00 AM IST belongs inside business_date 2026-07-10', () => {
      const ts = new Date('2026-07-10T11:00:00+05:30').getTime();
      expect(isWithinOperatingWindow(ts, '2026-07-10')).toBe(true);
    });

    it('2026-07-11 12:30 AM IST belongs inside business_date 2026-07-10', () => {
      const ts = new Date('2026-07-11T00:30:00+05:30').getTime();
      expect(isWithinOperatingWindow(ts, '2026-07-10')).toBe(true);
    });

    it('2026-07-11 1:30 AM IST is outside business window for 2026-07-10', () => {
      const ts = new Date('2026-07-11T01:30:00+05:30').getTime();
      expect(isWithinOperatingWindow(ts, '2026-07-10')).toBe(false);
    });

    it('2026-07-11 10:00 AM IST is outside business window for 2026-07-10', () => {
      const ts = new Date('2026-07-11T10:00:00+05:30').getTime();
      expect(isWithinOperatingWindow(ts, '2026-07-10')).toBe(false);
    });
  });

  describe('getBusinessDateContext', () => {
    it('2026-07-10 11:00am IST => open_window, business_date 2026-07-10', () => {
      const ts = new Date('2026-07-10T11:00:00+05:30').getTime();
      const ctx = getBusinessDateContext(ts);
      expect(ctx.business_date).toBe('2026-07-10');
      expect(ctx.operating_state).toBe('open_window');
      expect(ctx.is_operating_time).toBe(true);
    });

    it('2026-07-11 12:30am IST => after_midnight_window, business_date 2026-07-10', () => {
      const ts = new Date('2026-07-11T00:30:00+05:30').getTime();
      const ctx = getBusinessDateContext(ts);
      expect(ctx.business_date).toBe('2026-07-10');
      expect(ctx.operating_state).toBe('after_midnight_window');
      expect(ctx.is_operating_time).toBe(true);
    });

    it('2026-07-11 8:00am IST => closed_before_open, business_date 2026-07-10', () => {
      const ts = new Date('2026-07-11T08:00:00+05:30').getTime();
      const ctx = getBusinessDateContext(ts);
      expect(ctx.business_date).toBe('2026-07-10');
      expect(ctx.operating_state).toBe('closed_before_open');
      expect(ctx.is_operating_time).toBe(false);
    });
  });

  describe('getCurrentBusinessDate', () => {
    it('returns business date only', () => {
      const ts = new Date('2026-07-11T10:59:59+05:30').getTime();
      expect(getCurrentBusinessDate(ts)).toBe('2026-07-10');
    });
  });

  describe('timezone independence', () => {
    const originalTz = process.env.TZ;
    
    afterAll(() => {
      process.env.TZ = originalTz;
    });

    it('returns IST business date even when system timezone is different', () => {
      process.env.TZ = 'America/New_York';
      
      // 2026-07-10T12:00:00Z is 2026-07-10 05:30 PM IST (open_window)
      const ts1 = new Date('2026-07-10T12:00:00Z').getTime();
      const ctx1 = getBusinessDateContext(ts1);
      expect(ctx1.business_date).toBe('2026-07-10');
      expect(ctx1.operating_state).toBe('open_window');

      // 2026-07-11T00:30:00Z is 2026-07-11 06:00 AM IST (closed_before_open) -> belongs to 2026-07-10
      const ts2 = new Date('2026-07-11T00:30:00Z').getTime();
      const ctx2 = getBusinessDateContext(ts2);
      expect(ctx2.business_date).toBe('2026-07-10');
      expect(ctx2.operating_state).toBe('closed_before_open');
    });
  });
});
