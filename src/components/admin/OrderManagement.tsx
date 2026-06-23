'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Send, AlertTriangle, CheckCircle, Clock, MapPin, Coffee, ShoppingBag, Truck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { OrderDocument } from '@/lib/types';

export default function OrderManagement() {
  const [isRushMode, setIsRushMode] = useState(false);
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<'active' | 'completed'>('active');

  // 1. Listen to Rush Mode state in Firestore config
  useEffect(() => {
    const configRef = doc(db, 'config', 'store_settings');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsRushMode(!!docSnap.data().rush_mode_active);
      }
      setLoading(false);
    }, (err) => {
      console.error("Failed to load store settings: ", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen to real orders in the last 12 hours in real-time
  useEffect(() => {
    const timeLimit = Date.now() - 12 * 60 * 60 * 1000;
    const q = query(
      collection(db, 'orders'),
      where('created_at', '>=', timeLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: OrderDocument[] = [];
      snapshot.forEach((docSnap) => {
        const order = docSnap.data() as OrderDocument;
        if (order.status !== 'rejected') {
          fetchedOrders.push(order);
        }
      });
      
      // Sort in memory by created_at descending (newest first)
      fetchedOrders.sort((a, b) => b.created_at - a.created_at);
      setOrders(fetchedOrders);
    }, (err) => {
      console.error("Failed to stream active orders: ", err);
    });

    return () => unsubscribe();
  }, []);

  // 3. Toggle Rush Mode state in Firestore
  const toggleRushMode = async () => {
    const nextVal = !isRushMode;
    setIsRushMode(nextVal);
    try {
      const configRef = doc(db, 'config', 'store_settings');
      await updateDoc(configRef, { rush_mode_active: nextVal });
    } catch (e) {
      console.error("Failed to update rush mode status in database: ", e);
    }
  };

  // 4. Push Held Order to KDS (clears rush_held & sets status to preparing)
  const pushToKDS = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { 
        rush_held: false, 
        status: 'preparing' 
      });
    } catch (e) {
      console.error("Failed to push held order to KDS: ", e);
      alert("Failed to push order to KDS");
    }
  };

  // 5. Collect Amount & Mark Completed
  const markCompleted = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { 
        status: 'delivered',
        is_paid: true,
        completed_at: Date.now()
      });
    } catch (e) {
      console.error("Failed to mark order completed: ", e);
      alert("Failed to mark order completed");
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-6 w-full text-[#f7dec4]">
      {/* Header and Rush Mode Toggle */}
      <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-[-30%] right-[-10%] w-48 h-48 bg-[#e8621a]/5 rounded-full filter blur-xl" />
        <div>
          <h2 className="font-serif italic text-2xl text-white">Order Management</h2>
          <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Control Kitchen Inflow & Rush Queues</p>
        </div>

        <button 
          onClick={toggleRushMode}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-all border cursor-pointer ${
            isRushMode 
              ? 'bg-[#e8621a]/20 text-[#e8621a] border-[#e8621a]/50 shadow-[0_0_15px_rgba(232,98,26,0.3)] animate-pulse' 
              : 'bg-[#302117]/40 text-[#d4c4b0]/60 border-[#302117] hover:border-[#f8bc51]/40 hover:text-[#f8bc51]'
          }`}
        >
          <Power size={14} />
          {isRushMode ? 'Rush Mode ON' : 'Rush Mode OFF'}
        </button>
      </div>

      {isRushMode && (
        <div className="bg-[#e8621a]/10 border border-[#e8621a]/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-[#e8621a] shrink-0" />
          <div>
            <h4 className="text-white text-sm font-bold">Rush Mode is Active</h4>
            <p className="text-xs text-[#d4c4b0]/70 mt-0.5">New customer orders will be held in the queue below. You must manually push them to release them to KDS display boards.</p>
          </div>
        </div>
      )}

      {/* Tab Switcher & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#302117]/40 pb-3">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#d4c4b0]/60">Live Order Inflow (Last 12 Hours)</h3>
        
        <div className="flex gap-1.5 bg-[#120a06]/55 p-1 border border-[#302117]/65 rounded-xl w-fit backdrop-blur-xl">
          <button
            onClick={() => setViewTab('active')}
            className={`px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer ${
              viewTab === 'active'
                ? 'bg-[#f8bc51] text-[#0a0604] shadow-[0_0_10px_rgba(248,188,81,0.12)]'
                : 'text-[#d4c4b0]/60 hover:text-white'
            }`}
          >
            Active Queue ({orders.filter(o => o.status !== 'delivered').length})
          </button>
          <button
            onClick={() => setViewTab('completed')}
            className={`px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer ${
              viewTab === 'completed'
                ? 'bg-[#f8bc51] text-[#0a0604] shadow-[0_0_10px_rgba(248,188,81,0.12)]'
                : 'text-[#d4c4b0]/60 hover:text-white'
            }`}
          >
            Completed ({orders.filter(o => o.status === 'delivered').length})
          </button>
        </div>
      </div>
      
      {orders.filter(o => viewTab === 'active' ? o.status !== 'delivered' : o.status === 'delivered').length === 0 ? (
        <div className="text-center py-16 bg-[#120a06]/20 border border-[#302117]/35 rounded-3xl flex flex-col items-center gap-3">
          <ShoppingBag size={32} className="text-[#d4c4b0]/20" />
          <p className="font-mono text-xs text-[#d4c4b0]/40 uppercase tracking-wider">
            {viewTab === 'active' ? 'No active orders in the queue' : 'No completed orders in the queue'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {orders
              .filter(o => viewTab === 'active' ? o.status !== 'delivered' : o.status === 'delivered')
              .map(order => {
              const isHeld = order.rush_held === true;
              return (
                <motion.div 
                  key={order.order_id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  className={`bg-[#070402]/30 border ${isHeld ? 'border-[#e8621a]/50 bg-[#e8621a]/[0.02]' : 'border-[#302117]'} rounded-2xl p-5 flex flex-col gap-4 relative`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`bg-white/10 text-white py-1 rounded-lg font-mono font-bold tracking-wider ${
                        order.order_type === 'delivery' ? 'px-2 text-[10px]' : 'px-2.5 text-xs'
                      }`}>
                        #{order.order_type === 'delivery' ? order.order_id : order.token_number}
                      </span>
                      <span className="text-[10px] text-[#d4c4b0]/50 font-mono flex items-center gap-1">
                        <Clock size={10} />
                        {formatTime(order.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded ${
                        order.order_type === 'delivery' 
                          ? 'bg-blue-500/10 text-blue-400' 
                          : order.order_type === 'pickup' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {order.order_type}
                      </span>

                      {isHeld ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      ) : (
                        <CheckCircle size={14} className="text-[#10B981]" />
                      )}
                    </div>
                  </div>

                  {/* Order Items Contents */}
                  <div className="font-mono text-xs text-[#d4c4b0]/70 flex flex-col gap-2 bg-[#120a06]/50 p-3 rounded-xl border border-[#302117]/50 mt-1">
                    <span className="text-[9px] uppercase tracking-widest text-[#f8bc51] font-bold flex items-center gap-1">
                      <Coffee size={10} /> Order Contents
                    </span>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-white text-xs">
                        <span>{item.name}</span>
                        <span className="bg-[#302117] text-[#f8bc51] px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Hand-off counter or coordinates detail */}
                  {order.order_type === 'delivery' && order.delivery_address && (
                    <div className="flex items-start gap-1.5 font-mono text-[9px] text-[#d4c4b0]/50 border-t border-[#302117]/20 pt-2.5">
                      <MapPin size={10} className="text-[#f8bc51] shrink-0 mt-0.5" />
                      <span 
                        className="truncate" 
                        title={
                          typeof order.delivery_address === 'string'
                            ? order.delivery_address
                            : (order.delivery_address as any)?.fullAddress ||
                              ((order.delivery_address as any)?.lat !== undefined
                                ? `Coordinates: ${(order.delivery_address as any).lat.toFixed(6)}, ${(order.delivery_address as any).lng.toFixed(6)}`
                                : '')
                        }
                      >
                        {
                          typeof order.delivery_address === 'string'
                            ? order.delivery_address
                            : (order.delivery_address as any)?.fullAddress ||
                              ((order.delivery_address as any)?.lat !== undefined
                                ? `Coordinates: ${(order.delivery_address as any).lat.toFixed(6)}, ${(order.delivery_address as any).lng.toFixed(6)}`
                                : '')
                        }
                      </span>
                    </div>
                  )}

                  {order.order_type === 'delivery' && order.otp && (
                    <div className="flex justify-between items-center font-mono text-[9px] text-[#d4c4b0]/50 border-t border-[#302117]/20 pt-2.5">
                      <span>DELIVERY OTP</span>
                      <span className="text-[#f8bc51] font-bold tracking-wider">{order.otp}</span>
                    </div>
                  )}

                  {order.order_type !== 'delivery' && order.hatch && (
                    <div className="flex justify-between items-center font-mono text-[9px] text-[#d4c4b0]/50 border-t border-[#302117]/20 pt-2.5">
                      <span>HAND-OFF POINT</span>
                      <span className="text-[#f8bc51] font-bold uppercase">{order.hatch} Hatch</span>
                    </div>
                  )}

                  {/* Operational Action Button */}
                  <div className="flex gap-2 mt-2">
                    {isHeld ? (
                      <button 
                        onClick={() => pushToKDS(order.order_id)}
                        className="flex-1 bg-[#f8bc51] hover:bg-[#ffce7b] text-[#0A0604] py-2.5 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(248,188,81,0.15)] cursor-pointer"
                      >
                        <Send size={12} /> 
                        Push to KDS
                      </button>
                    ) : order.status === 'ready' ? (
                      order.order_type === 'delivery' ? (
                        <button 
                          onClick={() => window.location.href='?tab=dispatch'}
                          className="flex-1 bg-[#60A5FA] hover:bg-[#93C5FD] text-[#0A0604] py-2.5 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(96,165,250,0.2)] cursor-pointer"
                        >
                          <Truck size={12} /> 
                          Route to Dispatch
                        </button>
                      ) : (
                        <button 
                          onClick={() => markCompleted(order.order_id)}
                          className="flex-1 bg-[#10B981] hover:bg-[#34D399] text-white py-2.5 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
                        >
                          <CheckCircle size={12} /> 
                          Collect & Handover
                        </button>
                      )
                    ) : order.status === 'delivered' ? (
                      <div className="flex-1 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] py-2.5 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <CheckCircle size={12} /> 
                        Delivered & Paid
                      </div>
                    ) : (
                      <button 
                        disabled
                        className="flex-1 bg-[#302117] text-[#d4c4b0]/30 py-2.5 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <Send size={12} /> 
                        {`In Prep: ${order.status}`}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
