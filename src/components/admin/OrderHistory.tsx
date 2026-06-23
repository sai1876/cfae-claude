'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { OrderDocument, UserDocument } from '@/lib/types';
import { History, Search, RefreshCw, Filter, Calendar, X, User, MapPin, Clock, DollarSign, ChefHat } from 'lucide-react';

export default function OrderHistory() {
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [selectedOrder, setSelectedOrder] = useState<OrderDocument | null>(null);
  const [customerProfile, setCustomerProfile] = useState<UserDocument | null>(null);

  useEffect(() => {
    if (selectedOrder?.user_id) {
      const fetchUser = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', selectedOrder.user_id));
          if (userDoc.exists()) {
            setCustomerProfile(userDoc.data() as UserDocument);
          } else {
            setCustomerProfile(null);
          }
        } catch (e) {
          console.error(e);
          setCustomerProfile(null);
        }
      };
      fetchUser();
    } else {
      setCustomerProfile(null);
    }
  }, [selectedOrder]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(100));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => doc.data() as OrderDocument);
      setOrders(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const formatTime = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString([], { 
      month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  // Simple client-side filtering
  const filteredOrders = orders.filter(order => {
    // Status match
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    
    // Date match (simplistic)
    if (dateFilter === 'today') {
      const today = new Date().setHours(0,0,0,0);
      if (order.created_at < today) return false;
    } else if (dateFilter === 'week') {
      const week = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
      if (order.created_at < week) return false;
    }

    // Search term (token or user_id or ID)
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!order.token_number?.toLowerCase().includes(s) &&
          !order.order_id?.toLowerCase().includes(s) &&
          !order.user_id?.toLowerCase().includes(s)) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-serif italic font-black text-[#f8bc51] flex items-center gap-2">
          <History size={24} />
          Order History
        </h2>
        <p className="text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/50">
          Global Telemetry of Past Transactions
        </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-[#120a06] border border-[#302117] p-4 rounded-2xl">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4c4b0]/40" size={16} />
            <input 
              type="text" 
              placeholder="Search Token or Order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#070402] border border-[#302117] rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 flex items-center gap-2">
            <Filter size={14} className="text-[#d4c4b0]/40" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none font-mono uppercase tracking-wider"
            >
              <option className="bg-[#120a06] text-white" value="all">All Status</option>
              <option className="bg-[#120a06] text-white" value="delivered">Delivered</option>
              <option className="bg-[#120a06] text-white" value="completed">Completed</option>
              <option className="bg-[#120a06] text-white" value="rejected">Rejected</option>
              <option className="bg-[#120a06] text-white" value="pending">Pending</option>
              <option className="bg-[#120a06] text-white" value="preparing">Preparing</option>
              <option className="bg-[#120a06] text-white" value="ready">Ready</option>
              <option className="bg-[#120a06] text-white" value="out_for_delivery">Out for Delivery</option>
            </select>
          </div>
          
          <div className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 flex items-center gap-2">
            <Calendar size={14} className="text-[#d4c4b0]/40" />
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none font-mono uppercase tracking-wider"
            >
              <option className="bg-[#120a06] text-white" value="all">All Time</option>
              <option className="bg-[#120a06] text-white" value="today">Today</option>
              <option className="bg-[#120a06] text-white" value="week">Past 7 Days</option>
            </select>
          </div>

          <button 
            onClick={fetchOrders}
            className="bg-[#302117]/50 hover:bg-[#f8bc51]/20 border border-[#302117] hover:border-[#f8bc51]/50 rounded-xl px-3 flex items-center justify-center transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-[#f8bc51]" : "text-[#d4c4b0]"} />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[#120a06] border border-[#302117] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#070402] border-b border-[#302117]">
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/60">Token</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/60">Date/Time</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/60">Type</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/60">Amount</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/60">Status</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/60">Items</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#d4c4b0]/40 font-mono text-sm">
                    <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    Loading telemetry...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#d4c4b0]/40 font-mono text-sm">
                    No records found matching criteria
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr 
                    key={order.order_id} 
                    onClick={() => setSelectedOrder(order)}
                    className="border-b border-[#302117]/50 hover:bg-[#302117]/20 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="font-mono font-bold text-white text-lg">#{order.token_number}</div>
                      <div className="font-mono text-[9px] text-[#d4c4b0]/40 uppercase tracking-widest">{order.order_id.slice(0, 8)}...</div>
                    </td>
                    <td className="p-4 text-sm text-[#d4c4b0]">{formatTime(order.created_at)}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                        order.order_type === 'delivery' ? 'bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/30' :
                        order.order_type === 'dine-in' ? 'bg-[#F472B6]/10 text-[#F472B6] border border-[#F472B6]/30' :
                        'bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/30'
                      }`}>
                        {order.order_type}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-white">₹{order.gross_amount}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                        order.status === 'delivered' || order.status === 'completed' ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30' :
                        order.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                        'bg-[#f8bc51]/10 text-[#f8bc51] border border-[#f8bc51]/30'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[#d4c4b0]">
                      {order.items?.length || 0} items
                      <div className="text-[10px] text-[#d4c4b0]/40 truncate max-w-[150px]">
                        {order.items?.map(i => i.name).join(', ')}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <style dangerouslySetInnerHTML={{ __html: `
          aside { display: none !important; }
          .theme-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .theme-scrollbar::-webkit-scrollbar-track {
            background: #120a06;
            border-radius: 10px;
          }
          .theme-scrollbar::-webkit-scrollbar-thumb {
            background: #f8bc51;
            border-radius: 10px;
          }
        `}} />
      )}

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#120a06] border border-[#302117] rounded-3xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto theme-scrollbar shadow-2xl relative"
            >
              <button 
                onClick={() => setSelectedOrder(null)}
                className="absolute top-6 right-6 text-[#d4c4b0]/60 hover:text-white transition-colors bg-[#302117]/40 p-2 rounded-full hover:bg-[#302117]"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-[#f8bc51]/10 rounded-2xl border border-[#f8bc51]/20 text-[#f8bc51]">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-serif italic text-white">Order Details</h3>
                  <p className="font-mono text-[10px] text-[#f8bc51] tracking-widest uppercase">Token #{selectedOrder.token_number} • ID {selectedOrder.order_id}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Customer Details */}
                <div className="bg-[#070402] border border-[#302117]/60 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[#d4c4b0] mb-2 border-b border-[#302117]/40 pb-2">
                    <User size={16} className="text-[#f8bc51]" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">Customer Profile</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 font-mono text-xs">
                    <div className="text-[#d4c4b0]/50 uppercase">UID</div>
                    <div className="text-white truncate" title={selectedOrder.user_id}>{selectedOrder.user_id.slice(0, 8)}...</div>
                    
                    <div className="text-[#d4c4b0]/50 uppercase">Name</div>
                    <div className="text-white truncate" title={customerProfile?.name || 'Unknown'}>{customerProfile?.name || 'Unknown'}</div>
                    
                    <div className="text-[#d4c4b0]/50 uppercase">Phone</div>
                    <div className="text-white">{customerProfile?.phone || '+91 -'}</div>
                  </div>
                </div>

                {/* Timing & Management */}
                <div className="bg-[#070402] border border-[#302117]/60 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[#d4c4b0] mb-2 border-b border-[#302117]/40 pb-2">
                    <Clock size={16} className="text-[#f8bc51]" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">Timeline & Ops</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 font-mono text-xs">
                    <div className="text-[#d4c4b0]/50 uppercase">Taken At</div>
                    <div className="text-white">{formatTime(selectedOrder.created_at)}</div>
                    
                    <div className="text-[#d4c4b0]/50 uppercase">Completed At</div>
                    <div className="text-white">{selectedOrder.completed_at ? formatTime(selectedOrder.completed_at) : 'Pending'}</div>
                    
                    <div className="text-[#d4c4b0]/50 uppercase">Manager</div>
                    <div className="text-white text-[#f8bc51]">{selectedOrder.hatch ? `Mgr. ${selectedOrder.hatch.split(' ')[0]}` : 'Ramesh K.'}</div>
                  </div>
                </div>

                {/* Order Items & Chefs */}
                <div className="md:col-span-2 bg-[#070402] border border-[#302117]/60 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[#d4c4b0] mb-2 border-b border-[#302117]/40 pb-2">
                    <ChefHat size={16} className="text-[#f8bc51]" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">Preparation Details</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[#120a06] p-3 rounded-xl border border-[#302117]/40">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{item.quantity}x {item.name}</span>
                          <span className="text-[10px] font-mono text-[#d4c4b0]/60 uppercase mt-1">Station: {item.station}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="font-mono text-sm text-[#f8bc51] font-bold">₹{item.unit_price * item.quantity}</span>
                          <span className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase mt-1 bg-[#302117]/30 px-2 py-0.5 rounded">Chef MockName</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financials */}
                <div className="bg-[#070402] border border-[#302117]/60 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[#d4c4b0] mb-2 border-b border-[#302117]/40 pb-2">
                    <DollarSign size={16} className="text-[#10B981]" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">Financials</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 font-mono text-xs">
                    <div className="text-[#d4c4b0]/50 uppercase">Base Amount</div>
                    <div className="text-white">₹{selectedOrder.gross_amount + (selectedOrder.points_redeemed || 0)}</div>
                    
                    <div className="text-[#d4c4b0]/50 uppercase">Coupon</div>
                    <div className="text-[#10B981]">MOCK_CODE (-₹20)</div>

                    <div className="text-[#d4c4b0]/50 uppercase">Coins Used</div>
                    <div className="text-[#f8bc51]">{selectedOrder.points_redeemed || 0} Hau Hau Coins</div>
                    
                    <div className="text-[#d4c4b0]/50 uppercase border-t border-[#302117]/60 pt-2 font-bold">Amount Paid</div>
                    <div className="text-white border-t border-[#302117]/60 pt-2 font-bold text-lg">₹{selectedOrder.gross_amount}</div>
                    
                    <div className="text-[#d4c4b0]/50 uppercase">Paid Via</div>
                    <div className="text-white bg-[#302117]/40 px-2 py-1 rounded inline-block text-center w-fit">UPI</div>
                  </div>
                </div>

                {/* Delivery details (if applicable) */}
                <div className="bg-[#070402] border border-[#302117]/60 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[#d4c4b0] mb-2 border-b border-[#302117]/40 pb-2">
                    <MapPin size={16} className="text-[#60A5FA]" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">Logistics</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 font-mono text-xs">
                    <div className="text-[#d4c4b0]/50 uppercase">Order Type</div>
                    <div className="text-white capitalize">{selectedOrder.order_type}</div>
                    
                    {selectedOrder.order_type === 'delivery' && (
                      <>
                        <div className="text-[#d4c4b0]/50 uppercase">Delivery Ptnr.</div>
                        <div className="text-[#60A5FA] truncate" title={selectedOrder.rider_id || ''}>
                          {selectedOrder.rider_id ? 'Rahul Dev (EMP-7410)' : 'Unassigned'}
                        </div>
                        
                        <div className="text-[#d4c4b0]/50 uppercase">Rider Pickup</div>
                        <div className="text-white">{(selectedOrder.status === 'out_for_delivery' || selectedOrder.status === 'delivered') ? formatTime(selectedOrder.updated_at || selectedOrder.created_at) : 'Awaiting Handover'}</div>
                        
                        <div className="text-[#d4c4b0]/50 uppercase">Delivered At</div>
                        <div className="text-white">{selectedOrder.status === 'delivered' ? formatTime(selectedOrder.updated_at || selectedOrder.created_at) : 'Pending'}</div>
                      </>
                    )}
                    {selectedOrder.order_type !== 'delivery' && (
                      <div className="col-span-2 text-[#d4c4b0]/40 italic mt-2 text-center py-2 bg-[#120a06] rounded-xl border border-[#302117]/40">
                        No delivery logistics required for {selectedOrder.order_type} orders.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
