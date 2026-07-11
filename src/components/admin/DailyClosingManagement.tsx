'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { DailyClosingDocument } from '@/lib/types';
import { getBusinessDateContext } from '@/lib/businessDate';
import { Loader2, CheckCircle2, Lock, FileText, Send, XCircle } from 'lucide-react';

const toast = {
  success: (msg: string) => alert(msg),
  error: (msg: string) => alert(msg)
};

interface DailyClosingManagementProps {
  outletId: string;
  userRole: 'manager' | 'admin' | 'owner';
}

export default function DailyClosingManagement({ outletId, userRole }: DailyClosingManagementProps) {
  const [closings, setClosings] = useState<DailyClosingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'draft' | 'submitted' | 'locked' | 'rejected' | 'history'>('draft');
  const [generating, setGenerating] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Form states for submission
  const [countedCash, setCountedCash] = useState<Record<string, number>>({});
  const [verifiedUpi, setVerifiedUpi] = useState<Record<string, number>>({});
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});
  
  // Form states for review
  const [founderNotes, setFounderNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchClosings();
  }, [outletId, activeTab]);

  const fetchClosings = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      
      let url = `/api/daily-closing/list?outlet_id=${outletId}`;
      if (activeTab !== 'history') {
        url += `&status=${activeTab}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setClosings(data.closings);
      } else {
        toast.error(data.error || 'Failed to fetch closings');
      }
    } catch (err: any) {
      toast.error('Error fetching closings');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const { business_date } = getBusinessDateContext();


      const res = await fetch('/api/daily-closing/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ outlet_id: outletId, business_date })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Generated successfully');
        fetchClosings();
      } else {
        toast.error(data.error || 'Generation failed');
      }
    } catch (err: any) {
      toast.error('Error generating closing');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (closing: DailyClosingDocument) => {
    const cash = countedCash[closing.closing_id];
    const upi = verifiedUpi[closing.closing_id];
    const note = managerNotes[closing.closing_id];

    if (cash === undefined || upi === undefined) {
      toast.error('Counted Cash and Verified UPI are required.');
      return;
    }

    try {
      setSubmittingId(closing.closing_id);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const res = await fetch('/api/daily-closing/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          closing_id: closing.closing_id,
          counted_cash: Number(cash),
          verified_upi: Number(upi),
          manager_cash_note: note,
          manager_notes: note
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Submitted for review');
        fetchClosings();
      } else {
        toast.error(data.error || 'Submission failed');
      }
    } catch (err: any) {
      toast.error('Error submitting closing');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReview = async (closing_id: string, decision: 'approved' | 'rejected') => {
    try {
      setSubmittingId(closing_id);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const note = founderNotes[closing_id];

      const res = await fetch('/api/daily-closing/review', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          closing_id,
          decision,
          founder_review_note: note
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(decision === 'approved' ? 'Closing Locked' : 'Closing Rejected');
        fetchClosings();
      } else {
        toast.error(data.error || 'Review failed');
      }
    } catch (err: any) {
      toast.error('Error reviewing closing');
    } finally {
      setSubmittingId(null);
    }
  };

  const renderDashboardCards = (closing: DailyClosingDocument) => {
    const { sales_summary, cash_reconciliation, payment_reconciliation, refund_summary, wastage_summary } = closing;
    const cashDiff = cash_reconciliation?.cash_difference || 0;
    const upiDiff = payment_reconciliation?.upi_difference || 0;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Gross Sales</p>
          <p className="text-xl font-bold">₹{sales_summary.gross_sales.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Net Sales</p>
          <p className="text-xl font-bold text-green-600">₹{sales_summary.net_sales.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Expected Cash</p>
          <p className="text-xl font-bold">₹{cash_reconciliation?.expected_cash?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Expected UPI</p>
          <p className="text-xl font-bold">₹{payment_reconciliation?.expected_upi?.toFixed(2) || '0.00'}</p>
        </div>
        <div className={`p-4 rounded-lg border ${Math.abs(cashDiff) > 100 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-sm text-gray-500">Cash Difference</p>
          <p className={`text-xl font-bold ${Math.abs(cashDiff) > 100 ? 'text-red-600' : 'text-gray-900'}`}>
            ₹{cashDiff.toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">UPI Difference</p>
          <p className="text-xl font-bold">₹{upiDiff.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Refunds Paid</p>
          <p className="text-xl font-bold text-orange-600">₹{refund_summary.refund_amount_paid_today.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Wastage Count</p>
          <p className="text-xl font-bold">{wastage_summary.wastage_events_count}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold mt-2">Daily Closing</h1>
        {['manager', 'admin', 'owner'].includes(userRole) && activeTab === 'draft' && (() => {
          const dateContext = getBusinessDateContext();
          return (
            <div className="flex flex-col items-end gap-2">
              {dateContext.operating_state === 'closed_before_open' && (
                <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 max-w-sm text-right">
                  Store is currently outside operating hours. This will generate the previous business date closing.
                </div>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Today's Draft
              </button>
            </div>
          );
        })()}
      </div>

      <div className="flex space-x-2 border-b border-gray-200">
        {(['draft', 'submitted', 'locked', 'rejected', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : closings.length === 0 ? (
        <div className="text-center p-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          No records found in this view.
        </div>
      ) : (
        <div className="space-y-6">
          {closings.map(closing => (
            <div key={closing.closing_id} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    Business Date: {closing.business_date}
                    {closing.status === 'locked' && <Lock className="w-4 h-4 text-green-600" />}
                    {closing.status === 'submitted' && <Send className="w-4 h-4 text-blue-600" />}
                    {closing.status === 'rejected' && <XCircle className="w-4 h-4 text-red-600" />}
                  </h3>
                  <p className="text-sm text-gray-500">ID: {closing.closing_id}</p>
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full capitalize">
                  {closing.status}
                </span>
              </div>

              {renderDashboardCards(closing)}

              {(closing.status === 'draft' || closing.status === 'rejected') && (
                <div className="mt-6 space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-gray-900">Manager Verification</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Counted Cash (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={countedCash[closing.closing_id] ?? ''}
                        onChange={e => setCountedCash({ ...countedCash, [closing.closing_id]: Number(e.target.value) })}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-black focus:border-black"
                        placeholder="Enter physical cash amount"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Verified UPI (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={verifiedUpi[closing.closing_id] ?? ''}
                        onChange={e => setVerifiedUpi({ ...verifiedUpi, [closing.closing_id]: Number(e.target.value) })}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-black focus:border-black"
                        placeholder="Enter merchant app amount"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Required if large difference)</label>
                      <textarea
                        value={managerNotes[closing.closing_id] ?? ''}
                        onChange={e => setManagerNotes({ ...managerNotes, [closing.closing_id]: e.target.value })}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-black focus:border-black"
                        rows={2}
                        placeholder="Explain any differences, wastage issues, or operational notes."
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleSubmit(closing)}
                    disabled={submittingId === closing.closing_id}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {submittingId === closing.closing_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Submit for Review
                  </button>
                </div>
              )}

              {closing.status === 'submitted' && (userRole === 'admin' || userRole === 'owner') && (
                <div className="mt-6 space-y-4 border-t pt-4 bg-yellow-50 -mx-6 px-6 pb-6 rounded-b-xl">
                  <h4 className="font-semibold text-gray-900 pt-4">Admin/Owner Review</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Review Notes</label>
                    <textarea
                      value={founderNotes[closing.closing_id] ?? ''}
                      onChange={e => setFounderNotes({ ...founderNotes, [closing.closing_id]: e.target.value })}
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-black focus:border-black"
                      rows={2}
                      placeholder="Feedback to manager or internal audit notes."
                    />
                  </div>
                  <div className="flex gap-4">
                    {userRole === 'owner' && (
                      <button
                        onClick={() => handleReview(closing.closing_id, 'approved')}
                        disabled={submittingId === closing.closing_id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {submittingId === closing.closing_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Approve & Lock
                      </button>
                    )}
                    <button
                      onClick={() => handleReview(closing.closing_id, 'rejected')}
                      disabled={submittingId === closing.closing_id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition disabled:opacity-50"
                    >
                      {submittingId === closing.closing_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {(closing.founder_review_note || closing.manager_notes) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {closing.manager_notes && (
                    <div className="mb-2">
                      <span className="font-semibold text-sm">Manager Note:</span>
                      <p className="text-sm text-gray-700">{closing.manager_notes}</p>
                    </div>
                  )}
                  {closing.founder_review_note && (
                    <div>
                      <span className="font-semibold text-sm text-indigo-700">Reviewer Note:</span>
                      <p className="text-sm text-gray-700">{closing.founder_review_note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
