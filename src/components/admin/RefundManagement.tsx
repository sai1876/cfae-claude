'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, FileText, AlertCircle, RefreshCw, ShoppingBag, Download } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { RefundRequestDocument, OrderDocument } from '@/lib/types';
import { generateRefundsCSV, downloadCSV } from '@/lib/csvExport';

interface ExtendedRefundRequest extends RefundRequestDocument {
  orderData?: OrderDocument;
}

export default function RefundManagement() {
  const [requests, setRequests] = useState<ExtendedRefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending_review' | 'payment_pending' | 'paid' | 'rejected'>('pending_review');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Form states per request
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});
  const [itemApprovals, setItemApprovals] = useState<Record<string, Record<string, { qty: number, amount: number }>>>({});
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<Record<string, string>>({});
  const [wastageWarningMsg, setWastageWarningMsg] = useState<Record<string, string>>({});

  const [createWastage, setCreateWastage] = useState<Record<string, boolean>>({});
  const [wastageType, setWastageType] = useState<Record<string, 'remake' | 'wastage' | 'spoilage' | 'missing_item'>>({});

  const [paymentModalReq, setPaymentModalReq] = useState<ExtendedRefundRequest | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'wallet' | 'manual'>('upi');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'refund_requests'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const fetchedRequests: ExtendedRefundRequest[] = [];
      
      for (const d of snap.docs) {
        const reqData = d.data() as RefundRequestDocument;
        let orderData: OrderDocument | undefined;
        try {
          const orderSnap = await getDoc(doc(db, 'orders', reqData.order_id));
          if (orderSnap.exists()) {
            orderData = orderSnap.data() as OrderDocument;
          }
        } catch (e) {
          console.warn('Failed to fetch order', reqData.order_id);
        }
        fetchedRequests.push({ ...reqData, orderData });
      }
      setRequests(fetchedRequests);
    } catch (error) {
      console.error('Error fetching refund requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleNoteChange = (id: string, note: string) => {
    setManagerNotes(prev => ({ ...prev, [id]: note }));
    setErrorMsg(prev => ({ ...prev, [id]: '' }));
  };

  const handleWastageToggle = (id: string, reason: string) => {
    setCreateWastage(prev => {
      const isChecked = !prev[id];
      if (isChecked && !wastageType[id]) {
        setWastageType(t => ({ ...t, [id]: reason === 'missing_item' ? 'remake' : 'wastage' }));
      }
      return { ...prev, [id]: isChecked };
    });
  };

  const handleAmountChange = (id: string, amount: string) => {
    setApprovedAmounts(prev => ({ ...prev, [id]: amount }));
    setErrorMsg(prev => ({ ...prev, [id]: '' }));
  };

  const handleItemApprovalChange = (reqId: string, itemId: string, field: 'qty' | 'amount', value: number) => {
    setItemApprovals(prev => {
      const reqItems = prev[reqId] || {};
      const currentItem = reqItems[itemId] || { qty: 0, amount: 0 };
      return {
        ...prev,
        [reqId]: {
          ...reqItems,
          [itemId]: { ...currentItem, [field]: value }
        }
      };
    });
    setErrorMsg(prev => ({ ...prev, [reqId]: '' }));
  };

  const getRemainingRefundable = (order?: OrderDocument) => {
    if (!order) return 0;
    const gross = order.gross_amount || 0;
    const refunded = order.refunded_amount || 0;
    return Math.max(0, gross - refunded);
  };

  const submitReview = async (req: ExtendedRefundRequest, decision: 'approved' | 'rejected') => {
    const note = managerNotes[req.request_id] || '';
    if (!note.trim()) {
      setErrorMsg(prev => ({ ...prev, [req.request_id]: 'Manager note is required.' }));
      return;
    }

    let payloadAmount: number | undefined = undefined;
    let payloadItems: any[] | undefined = undefined;

    const remaining = getRemainingRefundable(req.orderData);

    if (decision === 'approved') {
      if (req.request_scope === 'full_order') {
        const inputAmount = parseFloat(approvedAmounts[req.request_id] || String(remaining));
        if (isNaN(inputAmount) || inputAmount <= 0 || inputAmount > remaining) {
          setErrorMsg(prev => ({ ...prev, [req.request_id]: `Invalid approved amount. Max: ₹${remaining}` }));
          return;
        }
        payloadAmount = inputAmount;
      } else if (req.request_scope === 'custom_amount') {
        const inputAmount = parseFloat(approvedAmounts[req.request_id] || '');
        if (isNaN(inputAmount) || inputAmount <= 0 || inputAmount > remaining) {
          setErrorMsg(prev => ({ ...prev, [req.request_id]: `Invalid approved amount. Max: ₹${remaining}` }));
          return;
        }
        payloadAmount = inputAmount;
      } else if (req.request_scope === 'items') {
        const itemApps = itemApprovals[req.request_id] || {};
        
        payloadItems = (req.items_requested || []).map(item => {
          const orderItem = req.orderData?.items.find(oi => oi.item_id === item.item_id);
          const defaultQty = item.quantity;
          const defaultAmount = item.requested_amount ?? ((orderItem?.unit_price || 0) * defaultQty);
          
          const qty = itemApps[item.item_id]?.qty ?? defaultQty;
          const amount = itemApps[item.item_id]?.amount ?? defaultAmount;
          
          const refundedQty = orderItem?.refunded_quantity || 0;
          const remainingQty = orderItem ? (orderItem.quantity - refundedQty) : qty;
          
          return {
            item_id: item.item_id,
            quantity_refunded: qty,
            refund_amount: amount,
            remainingQty
          };
        }).filter(i => i.quantity_refunded > 0 && i.refund_amount > 0);

        if (payloadItems.length === 0) {
          setErrorMsg(prev => ({ ...prev, [req.request_id]: 'Must approve at least one item with valid quantity and amount.' }));
          return;
        }

        // Validate max qtys
        const overQtyItem = payloadItems.find(i => i.quantity_refunded > i.remainingQty);
        if (overQtyItem) {
          setErrorMsg(prev => ({ ...prev, [req.request_id]: `Approved qty for ${overQtyItem.item_id} exceeds remaining qty (${overQtyItem.remainingQty}).` }));
          return;
        }

        // Strip out the extra fields for the API
        payloadItems = payloadItems.map(i => ({
          item_id: i.item_id,
          quantity_refunded: i.quantity_refunded,
          refund_amount: i.refund_amount
        }));
        const totalAmt = payloadItems.reduce((acc: number, curr: any) => acc + curr.refund_amount, 0);
        payloadAmount = totalAmt;
        if (totalAmt > remaining) {
          setErrorMsg(prev => ({ ...prev, [req.request_id]: `Total exceeds remaining amount (Max: ₹${remaining})` }));
          return;
        }
      }
    }

    setProcessingId(req.request_id);
    setErrorMsg(prev => ({ ...prev, [req.request_id]: '' }));
    setWastageWarningMsg(prev => ({ ...prev, [req.request_id]: '' }));
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();

      const res = await fetch('/api/refund-requests/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: req.request_id,
          decision,
          manager_note: note,
          ...(decision === 'approved' && payloadAmount !== undefined ? { approved_refund_amount: payloadAmount as number } : {}),
          ...(decision === 'approved' && payloadItems ? { approved_items: payloadItems } : {}),
          ...(decision === 'approved' && createWastage[req.request_id] ? { 
            create_wastage_record: true, 
            wastage_event_type: wastageType[req.request_id] || 'wastage' 
          } : {})
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Review failed');
      }

      setSuccessMsg(prev => ({ ...prev, [req.request_id]: `Successfully ${decision}.` }));
      if (data.wastage_warning) {
        setWastageWarningMsg(prev => ({ ...prev, [req.request_id]: data.wastage_warning }));
      }
      
      // Update local state
      setRequests(prev => prev.map(r => 
        r.request_id === req.request_id ? { ...r, status: decision, ...(decision === 'approved' ? { payment_status: 'pending' } : {}) } : r
      ));
      
      setTimeout(() => {
        if (decision === 'approved') setActiveTab('payment_pending');
        else if (decision === 'rejected') setActiveTab('rejected');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(prev => ({ ...prev, [req.request_id]: err.message || 'An error occurred' }));
    } finally {
      setProcessingId(null);
    }
  };

  const submitPayment = async () => {
    if (!paymentModalReq) return;
    setPaymentSubmitting(true);
    setPaymentError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();

      const res = await fetch('/api/refund-requests/mark-payment-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          request_id: paymentModalReq.request_id,
          payment_method: paymentMethod,
          ...(paymentRef && { payment_reference: paymentRef }),
          ...(paymentNote && { payment_note: paymentNote })
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to mark payment done');

      await fetchRequests();
      setPaymentModalReq(null);
      setActiveTab('paid');
    } catch (err: any) {
      setPaymentError(err.message || 'An error occurred');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'pending_review') return r.status === 'pending';
    if (activeTab === 'payment_pending') return r.status === 'approved' && (!r.payment_status || r.payment_status === 'pending');
    if (activeTab === 'paid') return r.status === 'approved' && r.payment_status === 'paid';
    if (activeTab === 'rejected') return r.status === 'rejected';
    return false;
  });

  const handleExportCSV = () => {
    const csvStr = generateRefundsCSV(filteredRequests);
    downloadCSV(csvStr, `refunds_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col gap-6 text-[#f7dec4] overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-serif italic text-3xl font-black text-white">Refund Queue</h2>
          <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-1">Review & Process Refund Requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-[#302117] rounded-lg hover:bg-[#302117]/50 text-[#d4c4b0] disabled:opacity-50 transition-colors font-mono text-xs uppercase tracking-widest"
          >
            <Download size={16} /> Export CSV
          </button>
          <button 
            onClick={fetchRequests} 
            disabled={loading}
            className="p-2 border border-[#302117] rounded-lg hover:bg-[#302117]/50 text-[#d4c4b0] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-[#120a06]/60 rounded-xl border border-[#302117]/60 flex-wrap max-w-full overflow-x-auto">
        {[
          { id: 'pending_review', label: 'Pending Review' },
          { id: 'payment_pending', label: 'Payment Pending' },
          { id: 'paid', label: 'Paid Refunds' },
          { id: 'rejected', label: 'Rejected' }
        ].map(tab => {
          const count = requests.filter(r => {
            if (tab.id === 'pending_review') return r.status === 'pending';
            if (tab.id === 'payment_pending') return r.status === 'approved' && (!r.payment_status || r.payment_status === 'pending');
            if (tab.id === 'paid') return r.status === 'approved' && r.payment_status === 'paid';
            if (tab.id === 'rejected') return r.status === 'rejected';
            return false;
          }).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#f8bc51] text-[#0A0604] shadow-[0_0_15px_rgba(248,188,81,0.2)]' 
                  : 'text-[#d4c4b0]/60 hover:text-[#d4c4b0] hover:bg-[#302117]/40'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-sm font-mono text-[#f8bc51] animate-pulse">Loading queue...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {filteredRequests.length === 0 ? (
              <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117]/60 rounded-xl p-8 text-center text-[#d4c4b0]/50 font-mono text-xs uppercase tracking-widest">
                No {activeTab} requests
              </div>
            ) : (
              filteredRequests.map(req => (
                <motion.div
                  key={req.request_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-[#120a06]/60 backdrop-blur-xl border border-[#302117]/80 rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden w-full max-w-full"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    req.status === 'pending' ? 'bg-[#f8bc51]/50 shadow-[0_0_10px_rgba(248,188,81,0.5)]' :
                    req.status === 'approved' ? 'bg-[#10B981]/50 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                    'bg-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  }`} />

                  {/* Header Info */}
                  <div className="flex flex-col md:flex-row justify-between gap-4 flex-wrap min-w-0 break-words">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Order: {req.order_id.slice(-6).toUpperCase()}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#302117] text-[#d4c4b0] uppercase">
                          {req.request_scope.replace('_', ' ')}
                        </span>
                        {req.reason_category && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-900/50 uppercase">
                            {req.reason_category.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[#d4c4b0]/60 uppercase tracking-widest break-all max-w-full overflow-hidden">
                        Req ID: {req.request_id} • User: {req.user_id.slice(0,6)} • {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                    {req.orderData && (
                      <div className="flex gap-4 text-right text-xs font-mono">
                        <div className="flex flex-col">
                          <span className="text-[#d4c4b0]/50 uppercase tracking-widest">Order Total</span>
                          <span className="text-white font-bold">₹{req.orderData.gross_amount}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#d4c4b0]/50 uppercase tracking-widest">Refunded</span>
                          <span className="text-orange-400 font-bold">₹{req.orderData.refunded_amount || 0}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#d4c4b0]/50 uppercase tracking-widest">Remaining</span>
                          <span className="text-[#10B981] font-bold">₹{getRemainingRefundable(req.orderData)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer Note */}
                  <div className="bg-[#070402] border border-[#302117] rounded-xl p-4 text-sm text-[#d4c4b0]">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#d4c4b0]/50 uppercase tracking-widest mb-2">
                      <FileText size={12} /> Customer Note
                    </div>
                    {req.customer_note || <span className="italic opacity-50">No note provided.</span>}
                  </div>

                  {/* Order Status Context */}
                  {req.orderData && (
                    <div className="flex gap-3 text-[10px] font-mono uppercase tracking-widest bg-[#302117]/20 border border-[#302117]/40 p-2 rounded-lg flex-wrap min-w-0 max-w-full">
                      <span className="text-[#d4c4b0]/60">Status: <span className="text-white">{req.orderData.status}</span></span>
                      <span className="text-[#d4c4b0]/60">Payment: <span className="text-white">{req.orderData.payment_status || (req.orderData.is_paid ? 'Paid' : 'Unpaid')}</span></span>
                    </div>
                  )}

                  {/* Action Area for Pending Requests */}
                  {activeTab === 'pending_review' && (
                    <div className="flex flex-col gap-4 border-t border-[#302117]/50 pt-4">
                      
                      {/* Dynamic Approval Inputs based on Scope */}
                      {req.request_scope === 'items' && req.items_requested && req.items_requested.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-[#f8bc51]">Requested Items Review:</p>
                          <div className="flex flex-col gap-2 bg-[#070402] p-3 rounded-xl border border-[#302117]">
                            {req.items_requested.map(item => {
                              const orderItem = req.orderData?.items.find(oi => oi.item_id === item.item_id);
                              const refundedQty = orderItem?.refunded_quantity || 0;
                              const remainingQty = orderItem ? (orderItem.quantity - refundedQty) : item.quantity;

                              return (
                                <div key={item.item_id} className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-[#302117]/50 last:border-0">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white flex items-center gap-2">
                                      <ShoppingBag size={12} className="text-[#d4c4b0]/50" />
                                      {orderItem?.name || item.item_id}
                                    </span>
                                    <span className="text-[10px] font-mono text-[#d4c4b0]/60">
                                      Ordered: {orderItem?.quantity || '?'} | Refunded: {refundedQty} | Remaining: <span className="text-[#f8bc51] font-bold">{remainingQty}</span> @ ₹{orderItem?.unit_price || '?'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/50">Approved Qty</label>
                                      <input 
                                        type="number"
                                        min="0"
                                        max={remainingQty}
                                        value={itemApprovals[req.request_id]?.[item.item_id]?.qty ?? item.quantity}
                                        onChange={(e) => handleItemApprovalChange(req.request_id, item.item_id, 'qty', parseInt(e.target.value) || 0)}
                                        className="w-16 bg-[#120a06] border border-[#302117] rounded px-2 py-1 text-xs text-white"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[8px] font-mono uppercase text-[#d4c4b0]/50">Refund ₹</label>
                                      <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={itemApprovals[req.request_id]?.[item.item_id]?.amount ?? item.requested_amount ?? ((orderItem?.unit_price || 0) * item.quantity)}
                                        onChange={(e) => handleItemApprovalChange(req.request_id, item.item_id, 'amount', parseFloat(e.target.value) || 0)}
                                        className="w-20 bg-[#120a06] border border-[#302117] rounded px-2 py-1 text-xs text-white"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(req.request_scope === 'full_order' || req.request_scope === 'custom_amount') && (
                        <div className="flex flex-col gap-1 min-w-0 flex-wrap">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-[#f8bc51]">
                            Approved Refund Amount (₹) {req.request_scope === 'full_order' ? '(Default: Remaining)' : ''}
                          </label>
                          <input 
                            type="number"
                            min="0.01"
                            max={getRemainingRefundable(req.orderData)}
                            step="0.01"
                            value={approvedAmounts[req.request_id] ?? (req.request_scope === 'full_order' ? getRemainingRefundable(req.orderData) : (req.requested_amount || ''))}
                            onChange={(e) => handleAmountChange(req.request_id, e.target.value)}
                            placeholder={`Max ₹${getRemainingRefundable(req.orderData)}`}
                            className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-2 text-white font-mono text-sm w-48 focus:outline-none focus:border-[#f8bc51]"
                          />
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[#f8bc51]">Manager Note (Required)</label>
                        <textarea 
                          value={managerNotes[req.request_id] || ''}
                          onChange={(e) => handleNoteChange(req.request_id, e.target.value)}
                          placeholder="Reason for approval or rejection..."
                          className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-sm text-white resize-none h-20 focus:outline-none focus:border-[#f8bc51] transition-colors"
                        />
                      </div>

                      {['wrong_item', 'missing_item', 'bad_quality'].includes(req.reason_category) && (
                        <div className="flex flex-col gap-2 mt-2 p-3 border border-[#302117] rounded-xl bg-[#110A07]">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#f7dec4]">
                            <input
                              type="checkbox"
                              checked={!!createWastage[req.request_id]}
                              onChange={() => handleWastageToggle(req.request_id, req.reason_category)}
                              className="accent-[#f8bc51] w-4 h-4"
                            />
                            Also create food loss/remake record
                          </label>
                          {createWastage[req.request_id] && (
                            <div className="pl-6 flex gap-3 text-xs">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`wastageType-${req.request_id}`}
                                  checked={wastageType[req.request_id] === 'remake'}
                                  onChange={() => setWastageType(t => ({ ...t, [req.request_id]: 'remake' }))}
                                  className="accent-[#f8bc51]"
                                />
                                Remake (Deducts stock)
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`wastageType-${req.request_id}`}
                                  checked={wastageType[req.request_id] === 'wastage'}
                                  onChange={() => setWastageType(t => ({ ...t, [req.request_id]: 'wastage' }))}
                                  className="accent-[#f8bc51]"
                                />
                                Wastage (No deduction)
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                      {errorMsg[req.request_id] && (
                        <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-950/30 p-3 rounded-lg border border-red-900/50">
                          <AlertCircle size={14} /> {errorMsg[req.request_id]}
                        </div>
                      )}
                      {successMsg[req.request_id] && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[#10B981] text-xs font-mono bg-[#10B981]/10 p-3 rounded-lg border border-[#10B981]/30">
                            <CheckCircle size={14} /> {successMsg[req.request_id]}
                          </div>
                          {wastageWarningMsg[req.request_id] && (
                            <div className="flex items-center gap-2 text-yellow-500 text-xs font-mono bg-yellow-950/30 p-3 rounded-lg border border-yellow-900/50">
                              <AlertCircle size={14} /> {wastageWarningMsg[req.request_id]}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 mt-2">
                        <button 
                          onClick={() => submitReview(req, 'rejected')}
                          disabled={processingId === req.request_id}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                        <button 
                          onClick={() => submitReview(req, 'approved')}
                          disabled={processingId === req.request_id}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-[#0A0604] bg-[#f8bc51] hover:bg-[#ffce7b] transition-colors shadow-[0_0_15px_rgba(248,188,81,0.2)] disabled:opacity-50"
                        >
                          {processingId === req.request_id ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                          Approve
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Completed View Details */}
                  {req.status !== 'pending' && (
                    <div className="bg-[#070402] border border-[#302117] rounded-xl p-4 text-sm text-[#d4c4b0] mt-2">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-[#d4c4b0]/50 uppercase tracking-widest mb-2">
                        <CheckCircle size={12} className={req.status === 'approved' ? 'text-[#10B981]' : 'text-red-400'} /> 
                        Manager Note
                      </div>
                      {req.manager_note || <span className="italic opacity-50">No note provided.</span>}
                      {req.status === 'approved' && req.linked_refund_id && (
                        <div className="mt-2 text-[10px] font-mono text-[#d4c4b0]/50 break-all max-w-full overflow-hidden">
                          Refund ID: {req.linked_refund_id}
                        </div>
                      )}
                      
                      {activeTab === 'paid' && (
                        <div className="mt-4 border border-[#302117] bg-[#120a06] rounded-xl p-3">
                          <div className="text-[10px] font-mono text-[#f8bc51] uppercase tracking-widest mb-2 border-b border-[#302117]/50 pb-2">
                            Payment Proof
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs min-w-0 flex-wrap break-words">
                            <div><span className="opacity-50">Method:</span> <span className="uppercase">{req.payment_method || 'Unknown'}</span></div>
                            <div><span className="opacity-50">Date:</span> {req.paid_at ? new Date(req.paid_at).toLocaleString() : 'N/A'}</div>
                            <div className="col-span-2">
                              <span className="opacity-50">Ref:</span>{' '}
                              {['upi', 'bank_transfer'].includes(req.payment_method || '') && !req.payment_reference ? (
                                <span className="text-red-400 font-mono">Missing payment reference</span>
                              ) : (
                                <span className="font-mono text-[#10B981] break-all">{req.payment_reference || 'No reference'}</span>
                              )}
                            </div>
                            <div className="col-span-2 text-[#d4c4b0]/70"><span className="opacity-50">Note:</span> {req.payment_note || 'No note'}</div>
                          </div>
                        </div>
                      )}
                      
                      {activeTab === 'payment_pending' && (
                        <div className="mt-4 pt-4 border-t border-[#302117] flex justify-end">
                          <button 
                            onClick={() => {
                              setPaymentModalReq(req);
                              setPaymentMethod('upi');
                              setPaymentRef('');
                              setPaymentNote('');
                              setPaymentError('');
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                          >
                            Mark Payment Done
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModalReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#120a06] border border-[#302117] rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-[#302117] flex justify-between items-center bg-[#070402]">
                <h3 className="font-serif italic text-2xl font-black text-white">Settle Payment</h3>
                <button onClick={() => setPaymentModalReq(null)} className="text-[#d4c4b0]/50 hover:text-white transition-colors">
                  <XCircle size={24} />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono text-[#f8bc51] uppercase tracking-widest">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51] appearance-none"
                  >
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="wallet">Wallet</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                
                {['upi', 'bank_transfer'].includes(paymentMethod) && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-[#f8bc51] uppercase tracking-widest">Reference ID (Required)</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="e.g. UTR Number"
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51]"
                    />
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono text-[#f8bc51] uppercase tracking-widest">Note (Optional)</label>
                  <textarea
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Any extra details..."
                    className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-sm text-white resize-none h-20 focus:outline-none focus:border-[#f8bc51]"
                  />
                </div>

                {paymentError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-950/30 p-3 rounded-lg border border-red-900/50">
                    <AlertCircle size={14} /> {paymentError}
                  </div>
                )}

                <button 
                  onClick={submitPayment}
                  disabled={paymentSubmitting}
                  className="mt-2 w-full py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-[#0A0604] bg-[#f8bc51] hover:bg-[#ffce7b] transition-colors shadow-[0_0_15px_rgba(248,188,81,0.2)] disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {paymentSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Confirm Settlement
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
