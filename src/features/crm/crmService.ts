import { ORDERS_COL, APPROVALS_COL, REVIEWS_COL, COMPLAINTS_COL } from '@/lib/firebase/collections';
import { collection, doc, setDoc, updateDoc, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { ApprovalRequest } from '@/lib/types';

import { db } from "@/lib/firebase";


export const logSecurityAlert = async (managerId: string, managerName: string, actionDetails: string): Promise<void> => {
  const alertId = `alert_${Date.now()}`;
  const docRef = doc(db, APPROVALS_COL, alertId);
  await setDoc(docRef, {
    request_id: alertId,
    requested_by: managerId,
    timestamp: Date.now(),
    action_type: 'security_alert',
    status: 'pending',
    reason: 'Suspicious Activity Detected',
    payload: { details: actionDetails, managerName }
  });
};

/**
 * Submits a star rating + optional comment on a delivered order
 */
export const submitOrderFeedback = async (
  orderId: string,
  rating: number,
  comment: string
): Promise<void> => {
  const orderRef = doc(db, ORDERS_COL, orderId);
  await updateDoc(orderRef, {
    feedback: {
      rating,
      comment: comment.trim(),
      submitted_at: Date.now(),
    },
  });
};

// --- Smart Refill AI Helper ---

export const streamApprovals = (callback: (data: ApprovalRequest[]) => void) => {
  const q = query(collection(db, APPROVALS_COL));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => doc.data() as ApprovalRequest);
    data.sort((a, b) => b.timestamp - a.timestamp);
    callback(data);
  }, (err) => {
    console.error("Failed to fetch approvals: ", err);
  });
};

export const updateApprovalStatus = async (requestId: string, status: 'approved' | 'rejected') => {
  const ref = doc(db, APPROVALS_COL, requestId);
  await updateDoc(ref, { status });
};

export const submitApprovalRequest = async (request: Omit<ApprovalRequest, 'request_id' | 'timestamp' | 'status'>) => {
  const requestId = `req_${Date.now()}`;
  const fullRequest: ApprovalRequest = {
    ...request,
    request_id: requestId,
    timestamp: Date.now(),
    status: 'pending'
  };
  await setDoc(doc(db, APPROVALS_COL, requestId), fullRequest);
  return requestId;
};

// --- Dough Conversion Recipes & Batches telemetry ---



export const fetchReviewsList = async () => {
  const q = query(collection(db, REVIEWS_COL), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};



export const fetchComplaintsList = async () => {
  const q = query(collection(db, COMPLAINTS_COL), orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const resolveComplaintTicket = async (id: string, resolution: string) => {
  await updateDoc(doc(db, COMPLAINTS_COL, id), {
    status: 'resolved',
    resolution,
    resolved_at: new Date().toISOString()
  });
};