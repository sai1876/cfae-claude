import { ORDERS_COL } from '@/lib/firebase/collections';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { OrderDocument, RefundRequestDocument } from '@/lib/types';

import { db, auth } from "@/lib/firebase";


export const streamUserOrders = (
  userId: string,
  callback: (orders: OrderDocument[]) => void
) => {
  const q = query(
    collection(db, ORDERS_COL),
    where("user_id", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const orders: OrderDocument[] = [];
    snapshot.forEach((doc) => {
      orders.push(doc.data() as OrderDocument);
    });
    // Sort in memory to avoid missing index errors
    orders.sort((a, b) => b.created_at - a.created_at);
    callback(orders);
  }, (err) => {
    console.error("Failed to stream customer orders: ", err);
  });
};

/**
 * Fetch customer's order history once
 */
export const getUserOrders = async (userId: string): Promise<OrderDocument[]> => {
  const q = query(
    collection(db, ORDERS_COL),
    where("user_id", "==", userId)
  );
  const snapshot = await getDocs(q);
  const orders: OrderDocument[] = [];
  snapshot.forEach((doc) => {
    orders.push(doc.data() as OrderDocument);
  });
  // Sort in memory to avoid missing index errors
  orders.sort((a, b) => b.created_at - a.created_at);
  return orders.slice(0, 20);
};

// --- Store UI Config Streams ---

/**
 * Updates order status.
 * Stock deduction happens during createOrder(). This function only handles order state updates.
 */
export const updateOrderStatus = async (
  orderId: string, 
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'rejected'
): Promise<void> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Authentication required");

  const res = await fetch('/api/orders/update-status', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ order_id: orderId, next_status: status })
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to update status to ${status}`);
  }

  // Auto-refund inventory logic has been securely removed.
  // Payment refunds and operational wastage are handled via separate, dedicated server routes.
};

/**
 * @deprecated Transaction-based ingredient stock auto-deduction is now handled during order creation in the Server API.
 * This function should no longer be used.
 */
export const deductIngredientsForOrder = async (_orderId: string): Promise<void> => {
  throw new Error("Stock deduction happens only during order creation via the Server API. Legacy client deduction is disabled.");
};

export const refundPayment = async (
  orderId: string,
  refundScope: 'full_order' | 'items' | 'custom_amount',
  refundAmount: number,
  reason: string,
  method?: 'cash' | 'upi' | 'card' | 'wallet' | 'manual',
  items?: { item_id: string; quantity_refunded: number; refund_amount: number }[]
): Promise<void> => {
  if (refundScope === 'items' && (!items || items.length === 0)) {
    throw new Error("Items array is required when refund scope is 'items'");
  }
  if (refundScope !== 'items' && items && items.length > 0) {
    throw new Error("Items array must not be provided for non-item scopes");
  }

  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Authentication required");

  const res = await fetch('/api/orders/refund-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      order_id: orderId,
      refund_scope: refundScope,
      refund_amount: refundAmount,
      reason,
      method,
      ...(items && { items })
    })
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Failed to process payment refund');
  }
};

// --- Outlet Management ---

export const bulkDispatchOrders = async (orderIds: string[], riderId: string): Promise<void> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Authentication required");

  const promises = orderIds.map(orderId => 
    fetch('/api/orders/update-status', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ order_id: orderId, next_status: 'out_for_delivery', rider_id: riderId })
    }).then(async res => {
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || `Failed to dispatch order ${orderId}`);
      }
    })
  );
  await Promise.all(promises);
};

export const markOrderAsDelivered = async (orderId: string): Promise<void> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Authentication required");

  const res = await fetch('/api/orders/update-status', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ order_id: orderId, next_status: 'delivered' })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Failed to mark order as delivered');
  }
};

export interface CreateRefundRequestPayload {
  order_id: string;
  request_scope: 'full_order' | 'items' | 'custom_amount';
  requested_amount?: number;
  reason_category: 'wrong_item' | 'missing_item' | 'bad_quality' | 'late_order' | 'cancelled_order' | 'payment_issue' | 'other';
  customer_note: string;
  items?: { item_id: string; quantity: number; requested_amount?: number }[];
}

export const createRefundRequest = async (payload: CreateRefundRequestPayload): Promise<{ request_id: string }> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Authentication required");

  const res = await fetch('/api/refund-requests/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit refund request');
  }

  return data;
};

export const getUserRefundRequests = async (userId: string): Promise<RefundRequestDocument[]> => {
  const q = query(
    collection(db, 'refund_requests'),
    where("user_id", "==", userId)
  );
  const snapshot = await getDocs(q);
  const requests: RefundRequestDocument[] = [];
  snapshot.forEach((doc) => {
    requests.push(doc.data() as RefundRequestDocument);
  });
  requests.sort((a, b) => b.created_at - a.created_at);
  return requests;
};

// --- Customer Feedback ---
