'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Flame, Sparkles, CheckCircle2, X, MapPin } from 'lucide-react';
import { db } from '@/lib/firebase';
import { isActiveOrderStatus } from '@/lib/orderUtils';
import { doc, onSnapshot } from 'firebase/firestore';
import { useStore } from '@/store/useStore';
import { streamUserOrders } from '@/lib/dbService';
import { OrderDocument, Staff } from '@/lib/types';
import dynamic from 'next/dynamic';

const CustomerDeliveryMap = dynamic(() => import('./CustomerDeliveryMap'), { ssr: false });

export default function FloatingOrderTracker({ showNavigation = false }: { showNavigation?: boolean }) {
  const { user, activeOrders, setActiveOrders } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | null>(null);
  const [riderLocation, setRiderLocation] = useState<{lat: number, lng: number} | undefined>(undefined);

  // Subscribe to real-time active orders across the customer portal
  useEffect(() => {
    if (!user?.uid) {
      setActiveOrders([]);
      return;
    }

    const unsubscribe = streamUserOrders(user.uid, (orders) => {
      // Keep only active (incomplete) orders for real-time tracking
      const active = orders.filter(
        (o) => isActiveOrderStatus(o.status)
      );
      setActiveOrders(active);
    });

    return () => unsubscribe();
  }, [user?.uid, setActiveOrders]);

  const activeTrackableOrders = activeOrders.filter(o => isActiveOrderStatus(o.status));
  
  const activeOrder = selectedTrackingOrderId 
    ? activeTrackableOrders.find(o => o.order_id === selectedTrackingOrderId) || null
    : (activeTrackableOrders.length === 1 ? activeTrackableOrders[0] : null);

  useEffect(() => {
    if (selectedTrackingOrderId && !activeTrackableOrders.find(o => o.order_id === selectedTrackingOrderId)) {
      setIsOpen(false);
      setSelectedTrackingOrderId(null);
    }
    if (activeTrackableOrders.length === 0) {
      setIsOpen(false);
      setIsSelectorOpen(false);
    }
  }, [activeTrackableOrders, selectedTrackingOrderId]);

  useEffect(() => {
    if (activeOrder?.order_type === 'delivery' && activeOrder?.fulfillment_status === 'out_for_delivery' && activeOrder?.rider_id) {
      const unsubscribe = onSnapshot(doc(db, 'staff', activeOrder.rider_id), (docSnap) => {
        if (docSnap.exists()) {
          const staffData = docSnap.data() as Staff;
          if (staffData.location) {
            setRiderLocation({ lat: staffData.location.lat, lng: staffData.location.lng });
          }
        }
      });
      return () => unsubscribe();
    } else {
      setRiderLocation(undefined);
    }
  }, [activeOrder?.status, activeOrder?.rider_id, activeOrder?.order_type]);

  const displayOrder = activeOrder || activeTrackableOrders[0];
  const isMultiple = activeTrackableOrders.length > 1;

  if (activeTrackableOrders.length === 0 || !displayOrder) return null;

  // Map state to progress percentage and sub-copy
  const getStatusMapping = (order: OrderDocument) => {
    switch (order.status) {
      case 'confirmed':
        return {
          step: 0,
          percent: 15,
          title: 'Order Confirmed',
          icon: <ShoppingBag className="text-[var(--primary)]" size={20} />,
          desc: 'Your order request has been received. Queueing at prep station...',
        };
      
      case 'preparing':
        return {
          step: 1,
          percent: 50,
          title: 'Preparing Refreshments',
          icon: <Flame className="text-amber-500 animate-pulse" size={20} />,
          desc: 'Our chefs are crafting your culinary retreat inside the kitchen.',
        };
      case 'ready':
        return {
          step: 2,
          percent: 85,
          title: order.order_type === 'delivery' ? 'Prepared & Awaiting Rider' : 'Ready for Pickup!',
          icon: <Sparkles className="text-emerald-500 animate-bounce" size={20} />,
          desc: order.order_type === 'delivery'
            ? `Your order is freshly prepared and awaiting dispatch. A rider will pick it up shortly! 🛵`
            : order.hatch 
            ? `Collect your ice cold sips and bites at the ${order.hatch} Hatch! 🍹`
            : 'Your order is ready! Collect it from the counter.',
        };
      case 'dispatched' as any:
      case 'out_for_delivery' as any:
        return {
          step: 2,
          percent: 85,
          title: 'Out for Delivery',
          icon: <Sparkles className="text-blue-400 animate-pulse" size={20} />,
          desc: 'Rider is carrying your refreshments to your campus coordinate!',
        };
      case 'delivered' as any:
        return {
          step: 3,
          percent: 100,
          title: 'Delivered',
          icon: <CheckCircle2 className="text-[#22c55e]" size={20} />,
          desc: 'Vibes restored. Leave the classroom stress behind!',
        };
      default:
        return {
          step: 0,
          percent: 0,
          title: 'Processing',
          icon: <ShoppingBag size={20} />,
          desc: 'Initialising ticket...',
        };
    }
  };

  const statusInfo = getStatusMapping(displayOrder);
  const modalStatusInfo = activeOrder ? getStatusMapping(activeOrder) : statusInfo;

  // Position offset based on whether bottom tab bar navigation is visible
  const btnBottom = showNavigation ? 'bottom-[88px]' : 'bottom-5';

  return (
    <>
      {/* Floating Status Button */}
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (isMultiple) {
            setIsSelectorOpen(true);
          } else {
            setSelectedTrackingOrderId(displayOrder.order_id);
            setIsOpen(true);
          }
        }}
        className={`fixed left-4 ${btnBottom} z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-full`}
        style={{
          background: 'linear-gradient(135deg, rgba(27, 18, 8, 0.95) 0%, rgba(14, 11, 7, 0.98) 100%)',
          border: '1.5px solid rgba(212, 163, 84, 0.35)',
          boxShadow: '0 8px 32px rgba(196, 144, 64, 0.25), inset 0 1px 1px rgba(255,255,255,0.05)',
          cursor: 'pointer',
        }}
      >
        {/* Animated glowing status indicator dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            displayOrder.status === 'ready' || displayOrder.fulfillment_status === 'out_for_delivery'
              ? 'bg-emerald-400'
              : 'bg-amber-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            displayOrder.status === 'ready' || displayOrder.fulfillment_status === 'out_for_delivery'
              ? 'bg-emerald-500'
              : 'bg-amber-500'
          }`}></span>
        </span>

        {isMultiple ? (
          <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: '0.05em' }}>
            {activeTrackableOrders.length} Active Orders
          </span>
        ) : (
          <>
            <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: '0.05em' }}>
              #{displayOrder.order_type === 'delivery' ? displayOrder.order_id : displayOrder.token_number}
            </span>
            <div style={{ width: '1.5px', height: '12px', background: 'rgba(212,163,84,0.2)' }} />
            <span style={{ color: 'var(--foreground)', fontSize: 11, textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.05em' }}>
              {displayOrder.fulfillment_status === 'out_for_delivery' ? 'On The Way' : displayOrder.status === 'ready' ? 'Ready!' : 'Preparing'}
            </span>
          </>
        )}
      </motion.button>

      {/* Selector Modal */}
      <AnimatePresence>
        {isSelectorOpen && (
          <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4 sm:p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSelectorOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-[#120a06] border border-[#302117] rounded-3xl overflow-hidden z-10 shadow-2xl pb-4 sm:pb-0"
            >
              <div className="p-5 border-b border-[#302117]/60 flex justify-between items-center bg-[#070402]">
                <h3 className="font-serif italic text-lg text-white">Select Order to Track</h3>
                <button onClick={() => setIsSelectorOpen(false)} className="text-[#d4c4b0]/50 hover:text-[#f8bc51] transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar">
                {activeTrackableOrders.map(order => (
                  <button
                    key={order.order_id}
                    onClick={() => {
                      setSelectedTrackingOrderId(order.order_id);
                      setIsSelectorOpen(false);
                      setIsOpen(true);
                    }}
                    className="w-full text-left bg-[#070402]/50 border border-[#302117] hover:border-[#f8bc51]/40 rounded-2xl p-4 transition-all group flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-white font-bold">
                          #{order.order_type === 'delivery' ? order.order_id : order.token_number}
                        </span>
                        <span className="text-[9px] font-mono uppercase bg-[#302117]/50 text-[#d4c4b0] px-2 py-0.5 rounded">
                          {order.order_type}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#d4c4b0]/60 font-mono uppercase tracking-wider">
                        {order.status === 'ready' ? 'Ready' : order.status === 'preparing' ? 'Preparing' : order.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        {' • '}₹{order.gross_amount}
                      </div>
                    </div>
                    <div className="text-[#f8bc51] opacity-0 group-hover:opacity-100 transition-opacity">
                      Track &rarr;
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Detailed Panel Modal */}
      <AnimatePresence>
        {isOpen && activeOrder && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md"
            />

            {/* Modal Body Container */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-[450px] max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl z-10"
              style={{
                background: 'linear-gradient(160deg, var(--background) 0%, var(--surface-dim) 100%)',
                border: '1px solid rgba(212, 163, 84, 0.2)',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8)',
              }}
            >
              {/* Top Banner Accent */}
              <div style={{ height: 6, background: 'linear-gradient(90deg, var(--primary), #8a5f1e, #f59e0b)' }} />

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-[var(--primary)] p-1.5 rounded-full hover:bg-foreground/5 transition-all"
                style={{ cursor: 'pointer' }}
              >
                <X size={18} />
              </button>

              <div className="p-6">
                {/* Header info */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`h-14 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/30 flex items-center justify-center font-mono font-black text-[var(--primary)] shadow-[0_0_15px_rgba(212,163,84,0.1)] ${
                    activeOrder.order_type === 'delivery' ? 'px-4 text-sm' : 'w-14 text-2xl'
                  }`}>
                    #{activeOrder.order_type === 'delivery' ? activeOrder.order_id : activeOrder.token_number}
                  </div>
                  <div>
                    <span className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground block">Active Order Tracker</span>
                    <h3 className="font-serif italic text-xl text-[var(--foreground)] mt-0.5">{modalStatusInfo.title}</h3>
                  </div>
                  <div className="ml-auto">
                    <span className="font-mono text-[10px] uppercase text-[var(--primary)] bg-[var(--primary)]/10 px-3.5 py-1.5 rounded-full border border-[var(--primary)]/20 font-bold tracking-wider">
                      {activeOrder.order_type}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-6">
                  <div className="h-1.5 bg-white/5 w-full rounded-full overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${modalStatusInfo.percent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-[var(--primary)] to-amber-400 shadow-[0_0_10px_rgba(212,163,84,0.5)] absolute left-0 top-0"
                    />
                  </div>
                  
                  {/* Progress Node Labels */}
                  <div className="flex justify-between items-center relative py-4 mt-2">
                    <div className="absolute left-4 right-4 h-0.5 bg-white/5 z-0" />
                    {['Ordered', 'Preparing', activeOrder.order_type === 'delivery' ? 'On Way' : 'Ready'].map((name, idx) => {
                      const isActive = modalStatusInfo.step >= idx;
                      const isCurrent = modalStatusInfo.step === idx;
                      return (
                        <div key={name} className="flex flex-col items-center z-10">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                            isCurrent
                              ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_0_15px_rgba(212,163,84,0.4)]'
                              : isActive
                              ? 'bg-[var(--background)] border-[var(--primary)] text-[var(--primary)]'
                              : 'bg-[var(--surface-dim)] border-border text-muted-foreground/30'
                          }`}>
                            {idx === 0 && '🛒'}
                            {idx === 1 && '🔥'}
                            {idx === 2 && (activeOrder.order_type === 'delivery' ? '🚴' : '🥤')}
                          </div>
                          <span className={`text-[9px] font-mono uppercase tracking-widest mt-2 ${
                            isCurrent ? 'text-[var(--primary)] font-bold' : 'text-muted-foreground'
                          }`}>
                            {name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detail Description */}
                <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl flex gap-3 items-start mb-6">
                  <div className="shrink-0 mt-0.5">{modalStatusInfo.icon}</div>
                  <p className="text-xs text-white/70 leading-relaxed">{modalStatusInfo.desc}</p>
                </div>

                {/* OTP block for delivery orders */}
                {activeOrder.order_type === 'delivery' && activeOrder.otp && (
                  <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center mb-6">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Delivery Verification OTP</span>
                    <span className="font-mono text-3xl font-black tracking-[0.25em] text-[var(--primary)] pl-[0.25em]">{activeOrder.otp}</span>
                    <p className="text-[11px] text-white/60">Share this code with your delivery partner to verify your order.</p>
                  </div>
                )}

                {/* Live Tracking Map */}
                {activeOrder.order_type === 'delivery' && activeOrder.fulfillment_status === 'out_for_delivery' && (
                  <div className="mb-6">
                    <CustomerDeliveryMap 
                      orderId={activeOrder.order_id}
                      riderLocation={riderLocation} 
                      deliveryLocation={activeOrder.delivery_coordinates} 
                    />
                  </div>
                )}

                {/* Checklist / Order Items */}
                <div className="space-y-3 mb-6">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your Escape Pack</h4>
                  <div className="max-h-[160px] overflow-y-auto no-scrollbar space-y-2 pr-1">
                    {activeOrder.items.map((item) => (
                      <div key={item.item_id} className="flex items-center justify-between p-3 bg-white/[0.01] rounded-xl border border-white/[0.03] text-xs">
                        <div className="flex-1 pr-3">
                          <span className="text-[var(--foreground)] font-medium">{item.name}</span>
                          <span className="text-[var(--primary)] font-mono font-bold ml-2">×{item.quantity}</span>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.modifiers.map((mod) => (
                                <span key={mod} className="text-[8px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/50">
                                  {mod}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono uppercase tracking-wider ${
                            item.item_status === 'ready' 
                              ? 'text-emerald-400 font-bold' 
                              : item.item_status === 'preparing' 
                              ? 'text-amber-400' 
                              : 'text-white/30'
                          }`}>
                            {item.item_status === 'ready' ? 'Ready' : item.item_status === 'preparing' ? 'Preparing' : 'Pending'}
                          </span>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            item.item_status === 'ready' 
                              ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' 
                              : item.item_status === 'preparing' 
                              ? 'bg-amber-400 animate-pulse' 
                              : 'bg-white/10'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hand-off counter/address point */}
                {activeOrder.order_type === 'delivery' && activeOrder.delivery_address && (
                  <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Rider Coordinate Address</span>
                    <div className="flex gap-2 items-start text-xs text-white/80">
                      <MapPin size={14} className="text-[var(--primary)] shrink-0 mt-0.5" />
                      <span>
                        {typeof activeOrder.delivery_address === 'string'
                          ? activeOrder.delivery_address
                          : (activeOrder.delivery_address as any)?.fullAddress ||
                            ((activeOrder.delivery_address as any)?.lat !== undefined
                              ? `Coordinates: ${(activeOrder.delivery_address as any).lat.toFixed(6)}, ${(activeOrder.delivery_address as any).lng.toFixed(6)}`
                              : '')}
                      </span>
                    </div>
                  </div>
                )}

                {activeOrder.order_type !== 'delivery' && activeOrder.hatch && (
                  <div className="flex justify-between items-center text-xs font-mono border-t border-white/5 pt-4">
                    <span className="text-muted-foreground uppercase tracking-widest text-[9px]">Hand-off Point</span>
                    <span className="text-[var(--primary)] font-bold uppercase">{activeOrder.hatch} Hatch</span>
                  </div>
                )}

                {/* Confirm tracking button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full mt-6 py-3.5 rounded-xl font-mono text-xs uppercase tracking-widest font-bold text-[var(--primary-foreground)] transition-all"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, #a07830 100%)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(212, 163, 84, 0.3)',
                  }}
                >
                  Return to Cafe
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
