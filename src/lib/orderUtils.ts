import { OrderDocument } from './types';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'delivered', 'rejected'] as const;

export type TerminalOrderStatus = typeof TERMINAL_STATUSES[number];

/**
 * Checks if an order status represents a terminal state.
 * Terminal states mean the order has reached the end of its lifecycle.
 */
export function isTerminalOrderStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as any);
}

/**
 * Checks if an order status is currently active (not terminal).
 */
export function isActiveOrderStatus(status: string): boolean {
  return !isTerminalOrderStatus(status);
}

/**
 * Checks if an order is completed (delivered or completed).
 */
export function isCompletedOrderStatus(status: string): boolean {
  return status === 'completed' || status === 'delivered';
}

/**
 * Checks if an order is eligible for a refund request.
 */
export function isRefundEligibleOrder(order: OrderDocument): boolean {
  return !!((isCompletedOrderStatus(order.status) || (order.status === 'cancelled' && order.is_paid)) &&
         (order.gross_amount - (order.refunded_amount || 0) > 0));
}
