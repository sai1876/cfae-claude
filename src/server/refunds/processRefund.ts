import { v4 as uuidv4 } from 'uuid';

export interface ProcessRefundParams {
  refund_scope: 'full_order' | 'items' | 'custom_amount';
  refund_amount: number;
  reason: string;
  method: string;
  requestItems?: { item_id: string; quantity_refunded: number; refund_amount: number }[];
  uid: string;
}

export interface RefundResultPayload {
  refundId: string;
  nextRefundStatus: string;
  newRefundedAmount: number;
  itemCount: number;
  outlet_id: string;
}

export const processRefundTransaction = async (
  transaction: FirebaseFirestore.Transaction,
  orderRef: FirebaseFirestore.DocumentReference,
  params: ProcessRefundParams
): Promise<RefundResultPayload> => {
  const { refund_scope, refund_amount, reason, method, requestItems, uid } = params;
  const actualMethod = method || 'manual';
  const refundId = uuidv4();

  // Re-read order data securely inside the transaction
  const orderSnap = await transaction.get(orderRef);
  if (!orderSnap.exists) {
    throw { status: 404, message: "Order not found." };
  }
  const orderData = orderSnap.data()!;

  const outlet_id = orderData.outlet || orderData.outlet_id || '';
  
  const orderTotal = orderData.gross_amount ?? orderData.total_amount_after_points ?? orderData.total_amount ?? 0;
  
  if (orderTotal <= 0) {
    throw { status: 400, message: "Refundable amount unavailable for this order." };
  }

  const isPaid = orderData.is_paid === true || orderData.payment_status === 'paid' || (orderData.cash_paid && orderData.cash_paid > 0);
  if (!isPaid) {
    throw { status: 400, message: "Cannot refund an unpaid order." };
  }

  const currentRefunded = orderData.refunded_amount || 0;
  const currentRefundStatus = orderData.refund_status || 'none';

  if (currentRefundStatus === 'full') {
    throw { status: 403, message: "Order is already fully refunded." };
  }

  const newRefundedAmount = currentRefunded + refund_amount;

  if (newRefundedAmount > orderTotal + 0.01) {
    throw { status: 400, message: `Total cumulative refund amount (${newRefundedAmount}) exceeds order total (${orderTotal}).` };
  }

  let nextRefundStatus = 'partial';
  if (Math.abs(newRefundedAmount - orderTotal) < 0.01) {
    nextRefundStatus = 'full';
  }

  const orderItems = orderData.items || [];
  let updatedItems = [...orderItems];
  let itemsForLedger: any[] | undefined = undefined;
  let itemCount = 0;

  if (refund_scope === 'items' && requestItems) {
    itemsForLedger = [];
    itemCount = requestItems.length;

    for (const reqItem of requestItems) {
      const itemIdx = updatedItems.findIndex((i: any) => i.item_id === reqItem.item_id);
      if (itemIdx === -1) {
        throw { status: 400, message: `Item ID ${reqItem.item_id} not found in order.` };
      }

      const dbItem = updatedItems[itemIdx];
      const alreadyRefundedQty = dbItem.refunded_quantity || 0;
      const alreadyRefundedAmt = dbItem.refunded_amount || 0;
      
      const remainingQty = dbItem.quantity - alreadyRefundedQty;
      const itemLineTotal = dbItem.unit_price * dbItem.quantity;
      const remainingAmt = itemLineTotal - alreadyRefundedAmt;

      if (reqItem.quantity_refunded > remainingQty) {
        throw { status: 400, message: `Refund quantity for item ${reqItem.item_id} exceeds remaining refundable quantity.` };
      }

      if (reqItem.refund_amount > remainingAmt + 0.01) {
        throw { status: 400, message: `Refund amount for item ${reqItem.item_id} exceeds remaining item refundable amount.` };
      }

      updatedItems[itemIdx] = {
        ...dbItem,
        refunded_quantity: alreadyRefundedQty + reqItem.quantity_refunded,
        refunded_amount: alreadyRefundedAmt + reqItem.refund_amount
      };

      itemsForLedger.push({
        item_id: dbItem.item_id,
        menu_item_id: dbItem.menu_item_id,
        quantity_refunded: reqItem.quantity_refunded,
        refund_amount: reqItem.refund_amount
      });
    }
  } else if (refund_scope === 'full_order') {
    itemsForLedger = [];
    for (const dbItem of updatedItems) {
      const alreadyRefundedQty = dbItem.refunded_quantity || 0;
      const alreadyRefundedAmt = dbItem.refunded_amount || 0;
      const remainingQty = dbItem.quantity - alreadyRefundedQty;
      const remainingAmt = (dbItem.unit_price * dbItem.quantity) - alreadyRefundedAmt;
      
      if (remainingAmt > 0 || remainingQty > 0) {
        itemsForLedger.push({
          item_id: dbItem.item_id,
          menu_item_id: dbItem.menu_item_id,
          quantity_refunded: remainingQty > 0 ? remainingQty : 0,
          refund_amount: remainingAmt > 0 ? remainingAmt : 0
        });
      }
      
      dbItem.refunded_quantity = dbItem.quantity;
      dbItem.refunded_amount = dbItem.unit_price * dbItem.quantity;
    }
  }

  const refundLedgerRef = orderRef.collection('refunds').doc(refundId);
  transaction.set(refundLedgerRef, {
    refund_id: refundId,
    refund_scope,
    refund_amount,
    refund_method: actualMethod,
    reason: reason.trim(),
    refunded_by: uid,
    refunded_at: Date.now(),
    refund_status: 'payment_pending',
    payment_status: 'pending',
    ...(itemsForLedger && itemsForLedger.length > 0 && { items_refunded: itemsForLedger })
  });

  transaction.update(orderRef, {
    refund_status: nextRefundStatus,
    refund_payment_status: 'partial_pending',
    refunded_amount: newRefundedAmount,
    refunded_at: Date.now(),
    refunded_by: uid,
    refund_reason: reason.trim(),
    refund_method: actualMethod,
    items: updatedItems
  });

  return {
    refundId,
    nextRefundStatus,
    newRefundedAmount,
    itemCount,
    outlet_id
  };
};
