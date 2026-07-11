import { describe, it, expect } from 'vitest';
import { isTerminalOrderStatus, isCompletedOrderStatus, isRefundEligibleOrder } from '../lib/orderUtils';
import { OrderDocument } from '../lib/types';

describe('Customer Profile UI Helpers', () => {
  it('identifies terminal orders correctly', () => {
    expect(isTerminalOrderStatus('completed')).toBe(true);
    expect(isTerminalOrderStatus('cancelled')).toBe(true);
    expect(isTerminalOrderStatus('delivered')).toBe(true);
    expect(isTerminalOrderStatus('rejected')).toBe(true);
    expect(isTerminalOrderStatus('preparing')).toBe(false);
  });

  it('identifies completed/delivered as completed orders', () => {
    expect(isCompletedOrderStatus('completed')).toBe(true);
    expect(isCompletedOrderStatus('delivered')).toBe(true);
    expect(isCompletedOrderStatus('cancelled')).toBe(false);
  });

  it('checks refund eligibility correctly for completed orders', () => {
    expect(isRefundEligibleOrder({ status: 'completed', gross_amount: 100, refunded_amount: 0 } as OrderDocument)).toBe(true);
    expect(isRefundEligibleOrder({ status: 'completed', gross_amount: 100, refunded_amount: 100 } as OrderDocument)).toBe(false);
  });

  it('checks refund eligibility correctly for cancelled but paid orders', () => {
    expect(isRefundEligibleOrder({ status: 'cancelled', is_paid: true, gross_amount: 100, refunded_amount: 0 } as OrderDocument)).toBe(true);
    expect(isRefundEligibleOrder({ status: 'cancelled', is_paid: false, gross_amount: 100, refunded_amount: 0 } as OrderDocument)).toBe(false);
  });
});
