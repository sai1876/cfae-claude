"use client";

import React, { useState, useEffect } from 'react';
import { WastageEventDocument } from '@/lib/types';
import { X, Check, Plus } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface WastageManagementProps {
  userRole: string;
}

export default function WastageManagement({ userRole }: WastageManagementProps) {
  const [events, setEvents] = useState<WastageEventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reported' | 'approved' | 'rejected'>('reported');
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    source_type: 'kitchen_error',
    event_type: 'wastage',
    loss_basis: 'menu_item',
    item_id: '',
    item_name: '',
    quantity: 1,
    unit: '',
    reason_category: '',
    manager_note: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/wastage-events/list', { headers });
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleApprove = async (eventId: string, decision: 'approved' | 'rejected') => {
    try {
      setProcessing(eventId);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/wastage-events/approve', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event_id: eventId,
          decision,
          manager_note: decision === 'rejected' ? 'Rejected by manager' : 'Approved by manager'
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchEvents();
      } else {
        alert(data.error || "Failed to process");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/wastage-events/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source_type: reportForm.source_type,
          event_type: reportForm.event_type,
          items: [{
            ...(reportForm.loss_basis === 'menu_item' ? { menu_item_id: reportForm.item_id } : { stock_item_id: reportForm.item_id }),
            item_name: reportForm.item_name,
            quantity: reportForm.quantity,
            unit: reportForm.unit || undefined,
            loss_basis: reportForm.loss_basis
          }],
          reason_category: reportForm.reason_category,
          manager_note: reportForm.manager_note
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setReportForm({
          source_type: 'kitchen_error', event_type: 'wastage', loss_basis: 'menu_item',
          item_id: '', item_name: '', quantity: 1, unit: '', reason_category: '', manager_note: ''
        });
        fetchEvents();
      } else {
        alert(data.error || "Failed to create report");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };
  const filteredEvents = events.filter(e => e.status === activeTab);

  if (loading) return <div className="text-[#f7dec4]">Loading wastage events...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="w-full flex flex-col gap-6 text-[#f7dec4]">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-serif tracking-wide text-[#f7dec4]">Wastage & Remakes</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded border border-orange-600/50 flex items-center gap-2 transition-colors">
            <Plus size={16} /> Report
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-[#3e2e21]">
        {['reported', 'approved', 'rejected'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 uppercase tracking-wider text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-orange-500 text-orange-400'
                : 'text-[#f7dec4]/60 hover:text-[#f7dec4]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="p-8 text-center border border-[#3e2e21] rounded bg-[#0A0604] text-[#f7dec4]/60">
          No {activeTab} events found.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredEvents.map(event => (
            <div key={event.event_id} className="p-4 border border-[#3e2e21] rounded bg-[#0A0604] flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-orange-400">{event.event_type.toUpperCase()}</span>
                    <span className="text-sm text-[#f7dec4]/50">|</span>
                    <span className="text-sm text-[#f7dec4]/70">{event.source_type}</span>
                  </div>
                  <div className="text-sm text-[#f7dec4]/50">
                    ID: {event.event_id}
                  </div>
                  {event.order_id && (
                    <div className="text-sm text-[#f7dec4]/50">
                      Order: {event.order_id}
                    </div>
                  )}
                </div>
                {event.status === 'reported' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(event.event_id, 'approved')}
                      disabled={processing === event.event_id}
                      className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/30 rounded hover:bg-green-500/20 flex items-center gap-1 text-sm disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleApprove(event.event_id, 'rejected')}
                      disabled={processing === event.event_id}
                      className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 flex items-center gap-1 text-sm disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-[#110A07] p-3 rounded border border-[#3e2e21]/50">
                <div>
                  <h4 className="font-semibold text-[#f7dec4]/70 mb-2">Items</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {event.items.map((item, i) => (
                      <li key={i} className="text-[#f7dec4]">
                        {item.quantity}x {item.item_name}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#f7dec4]/70 mb-2">Details</h4>
                  <p><span className="text-[#f7dec4]/50">Reason:</span> {event.reason_category || 'N/A'}</p>
                  <p><span className="text-[#f7dec4]/50">Note:</span> {event.manager_note}</p>
                  <p><span className="text-[#f7dec4]/50">Deduct Inventory:</span> {event.deduct_inventory ? 'Yes' : 'No'} ({event.deduction_method})</p>
                  <p><span className="text-[#f7dec4]/50">Date:</span> {new Date(event.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#110A07] border border-[#3e2e21] rounded-xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#3e2e21] flex justify-between items-center">
              <h3 className="text-xl font-bold font-serif text-[#f7dec4]">Report Wastage/Remake</h3>
              <button onClick={() => setShowModal(false)} className="text-[#f7dec4]/50 hover:text-[#f7dec4]">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateReport} className="p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Source Type</label>
                  <select value={reportForm.source_type} onChange={e => setReportForm(f => ({ ...f, source_type: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                    <option value="kitchen_error">Kitchen Error</option>
                    <option value="customer_complaint">Customer Complaint</option>
                    <option value="prep_damage">Prep Damage</option>
                    <option value="expired_stock">Expired Stock</option>
                    <option value="staff_meal">Staff Meal</option>
                    <option value="manual_adjustment">Manual Adjustment</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Event Type</label>
                  <select value={reportForm.event_type} onChange={e => setReportForm(f => ({ ...f, event_type: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                    <option value="wastage">Wastage</option>
                    <option value="remake">Remake</option>
                    <option value="spoilage">Spoilage</option>
                    <option value="missing_item">Missing Item</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Loss Basis</label>
                  <select value={reportForm.loss_basis} onChange={e => setReportForm(f => ({ ...f, loss_basis: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                    <option value="menu_item">Menu Item</option>
                    <option value="stock_item">Stock Item</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Item ID</label>
                  <input type="text" required value={reportForm.item_id} onChange={e => setReportForm(f => ({ ...f, item_id: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500" placeholder="e.g. M1, S1" />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Item Name</label>
                  <input type="text" required value={reportForm.item_name} onChange={e => setReportForm(f => ({ ...f, item_name: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500" placeholder="e.g. Classic Burger" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Quantity</label>
                  <input type="number" required min="1" step="0.1" value={reportForm.quantity} onChange={e => setReportForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 1 }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Unit</label>
                  <input type="text" value={reportForm.unit} onChange={e => setReportForm(f => ({ ...f, unit: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500" placeholder="e.g. kg, pieces" />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Reason Category</label>
                  <input type="text" required value={reportForm.reason_category} onChange={e => setReportForm(f => ({ ...f, reason_category: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500" placeholder="e.g. dropped on floor" />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs text-[#f7dec4]/70 uppercase font-mono tracking-wider">Manager Note</label>
                  <textarea required value={reportForm.manager_note} onChange={e => setReportForm(f => ({ ...f, manager_note: e.target.value }))} className="bg-[#0A0604] border border-[#3e2e21] rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500 h-20 resize-none" placeholder="Add detailed context..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#3e2e21]">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-[#3e2e21] text-[#f7dec4] rounded hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
