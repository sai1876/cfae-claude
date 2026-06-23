'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Flame, Sparkles, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { streamUserOrders } from '@/lib/dbService';
import { useStore } from '@/store/useStore';
import { OrderDocument, Staff } from '@/lib/types';
import dynamic from 'next/dynamic';

const CustomerDeliveryMap = dynamic(() => import('./CustomerDeliveryMap'), { ssr: false });

export default function OrderTracker() {
  const { user, activeOrders, setActiveOrders } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [riderLocation, setRiderLocation] = useState<{lat: number, lng: number} | undefined>(undefined);

  useEffect(() => {
    if (!user?.uid) {
      setActiveOrders([]);
      return;
    }

    // Subscribe to real-time order history for this specific student
    const unsubscribe = streamUserOrders(user.uid, (orders) => {
      // Keep only active (incomplete) orders for real-time tracking
      const active = orders.filter(
        (o) => o.status !== 'delivered' && o.status !== 'rejected'
      );
      setActiveOrders(active);
    });

    return () => unsubscribe();
  }, [user?.uid, setActiveOrders]);

  const activeOrder = activeOrders.length > 0 ? activeOrders[0] : null;

  useEffect(() => {
    if (activeOrder?.order_type === 'delivery' && activeOrder?.status === 'out_for_delivery' && activeOrder?.rider_id) {
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

  if (activeOrders.length === 0 || !activeOrder) return null;

  // Map state to progress percentage and sub-copy
  const getStatusMapping = (status: OrderDocument['status']) => {
    switch (status) {
      case 'pending':
        return {
          step: 0,
          percent: 15,
          title: 'Order Confirmed',
          icon: <ShoppingBag className="text-Hau Hau-gold" size={20} />,
          desc: 'Your escape request has been received. Queueing at prep station...',
        };
      case 'accepted':
      case 'preparing':
        return {
          step: 1,
          percent: 50,
          title: 'Preparing Refreshments',
          icon: <Flame className="text-Hau Hau-amber animate-pulse" size={20} />,
          desc: 'Chefs are crafting your culinary retreat inside the mist-cooled kitchen.',
        };
      case 'ready':
        return {
          step: 2,
          percent: 85,
          title: activeOrder.order_type === 'delivery' ? 'Prepared & Awaiting Rider' : 'Ready for Pickup!',
          icon: <Sparkles className="text-Hau Hau-bamboo animate-bounce" size={20} />,
          desc: activeOrder.order_type === 'delivery'
            ? `Your order is freshly prepared and awaiting dispatch. A rider will pick it up shortly! 🛵`
            : activeOrder.hatch 
            ? `Collect your ice cold sips and bites at the ${activeOrder.hatch} Hatch! 🍹`
            : 'Your order is ready! Collect it from the counter.',
        };
      case 'out_for_delivery':
        return {
          step: 2,
          percent: 85,
          title: 'Out for Delivery',
          icon: <Sparkles className="text-blue-400 animate-pulse" size={20} />,
          desc: 'Rider is carrying your refreshments to your campus coordinate!',
        };
      case 'delivered':
        return {
          step: 3,
          percent: 100,
          title: 'Delivered',
          icon: <CheckCircle2 className="text-Hau Hau-water" size={20} />,
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

  const statusInfo = getStatusMapping(activeOrder.status);

  return (
    <div className="w-full px-container-mobile md:px-container-desktop max-w-[800px] mx-auto mb-10 relative z-40">
      <motion.div
        layout
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden relative"
      >
        {/* Animated ambient glow based on status */}
        <div className={`absolute -inset-1 opacity-20 blur-2xl transition-all duration-1000 z-0 ${
          statusInfo.percent === 100 ? 'bg-primary' : 'bg-primary'
        }`} />
        <div className="relative z-10 bg-black/40">
          {/* Main Brief Card */}
          <div 
            onClick={() => setExpanded(!expanded)}
            className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className={`shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/40 flex items-center justify-center font-mono font-black text-primary shadow-[0_0_15px_rgba(248,188,81,0.15)] ${
                activeOrder.order_type === 'delivery' ? 'h-14 px-4 text-sm' : 'h-14 w-14 text-2xl'
              }`}>
                #{activeOrder.order_type === 'delivery' ? activeOrder.order_id : activeOrder.token_number}
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-mono text-[10px] md:text-xs tracking-widest uppercase text-primary/70 whitespace-nowrap mb-1">
                  • Live Order Tracking
                </span>
                <h4 className="font-serif italic text-2xl md:text-3xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  {statusInfo.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t border-white/5 pt-3 md:pt-0 md:border-0">
              <div className="flex items-center gap-2">
                {activeOrder.order_type === 'delivery' && activeOrder.otp && (
                  <span className="font-mono text-xs font-bold text-white bg-primary/20 px-3 py-1.5 rounded-full border border-primary/40 drop-shadow-[0_0_10px_rgba(248,188,81,0.4)] flex items-center gap-1.5">
                    <span className="text-primary/70">OTP:</span> {activeOrder.otp}
                  </span>
                )}
                <span className="font-mono text-[10px] tracking-wider uppercase text-on-surface bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                  {activeOrder.order_type}
                </span>
              </div>
              <motion.div 
                animate={{ rotate: expanded ? 180 : 0 }}
                className="text-primary/60 bg-white/5 p-2 rounded-full"
              >
                ▼
              </motion.div>
            </div>
          </div>

          {/* Progress Bar Strip */}
          <div className="h-1.5 bg-white/5 w-full relative overflow-hidden">
            <motion.div 
              animate={{ width: `${statusInfo.percent}%` }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-amber-500 to-primary shadow-[0_0_15px_rgba(248,188,81,0.8)] absolute left-0 top-0 rounded-r-full"
            />
          </div>

        {/* Detailed Expandable Area */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-Hau Hau-outline-variant/30 overflow-hidden"
            >
              <div className="p-6 space-y-6">
                {/* Visual Status Step Nodes */}
                <div className="flex justify-between items-center relative py-4">
                  {/* Backdrop connector line */}
                  <div className="absolute left-4 right-4 h-0.5 bg-Hau Hau-surface-bright z-0" />
                  
                  {/* Status Steps */}
                  {['Ordered', 'Preparing', activeOrder.order_type === 'delivery' ? 'On Way' : 'Ready'].map((name, idx) => {
                    const isActive = statusInfo.step >= idx;
                    const isCurrent = statusInfo.step === idx;
                    return (
                      <div key={name} className="flex flex-col items-center z-10">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                          isCurrent 
                            ? 'bg-Hau Hau-gold border-Hau Hau-gold text-Hau Hau-surface shadow-[0_0_15px_rgba(248,188,81,0.4)]'
                            : isActive 
                            ? 'bg-Hau Hau-surface border-Hau Hau-gold text-Hau Hau-gold'
                            : 'bg-Hau Hau-surface-bright border-Hau Hau-outline-variant/30 text-Hau Hau-on-surface-variant/40'
                        }`}>
                          {idx === 0 && '🛒'}
                          {idx === 1 && '🔥'}
                          {idx === 2 && (activeOrder.order_type === 'delivery' ? '🚴' : '🥤')}
                        </div>
                        <span className={`text-[10px] font-mono uppercase tracking-widest mt-2 ${
                          isCurrent ? 'text-Hau Hau-gold font-bold' : 'text-Hau Hau-on-surface-variant/70'
                        }`}>
                          {name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Subtext description */}
                <div className="bg-Hau Hau-surface-bright/20 border border-Hau Hau-outline-variant/15 p-4 rounded-2xl flex gap-3 items-start">
                  <div className="shrink-0 mt-0.5">{statusInfo.icon}</div>
                  <p className="text-sm text-Hau Hau-on-surface-variant leading-relaxed">{statusInfo.desc}</p>
                </div>

                {/* OTP block for delivery orders */}
                {activeOrder.order_type === 'delivery' && activeOrder.otp && (
                  <div className="bg-Hau Hau-gold/5 border border-Hau Hau-gold/20 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-Hau Hau-on-surface-variant">Delivery Verification OTP</span>
                    <span className="font-mono text-3xl font-black tracking-[0.25em] text-Hau Hau-gold pl-[0.25em]">{activeOrder.otp}</span>
                    <p className="text-xs text-Hau Hau-cream/60">Share this 4-digit code with your rider to complete delivery.</p>
                  </div>
                )}

                {/* Live Tracking Map */}
                {activeOrder.order_type === 'delivery' && activeOrder.status === 'out_for_delivery' && (
                  <div className="mb-4">
                    <CustomerDeliveryMap 
                      orderId={activeOrder.id}
                      riderLocation={riderLocation} 
                      deliveryLocation={activeOrder.delivery_coordinates} 
                    />
                  </div>
                )}

                {/* Order Details Checklist */}
                <div className="space-y-3">
                  <h5 className="font-mono text-xs uppercase tracking-widest text-Hau Hau-on-surface-variant">Order Checklist</h5>
                  <div className="space-y-2">
                    {activeOrder.items.map((item) => (
                      <div key={item.item_id} className="flex items-center justify-between p-3.5 bg-Hau Hau-surface/40 rounded-xl border border-Hau Hau-outline-variant/10 text-sm">
                        <div className="flex-1 pr-4">
                          <span className="text-Hau Hau-cream font-medium">{item.name}</span>
                          <span className="text-Hau Hau-gold font-mono font-bold ml-2">×{item.quantity}</span>
                          {/* Modifiers List */}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.modifiers.map(mod => (
                                <span key={mod} className="text-[9px] font-mono bg-Hau Hau-surface-bright px-2 py-0.5 rounded text-Hau Hau-on-surface-variant">
                                  {mod}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Prep Status Indicator */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono uppercase tracking-wider ${
                            item.status === 'ready' 
                              ? 'text-Hau Hau-bamboo' 
                              : item.status === 'preparing' 
                              ? 'text-Hau Hau-amber' 
                              : 'text-Hau Hau-on-surface-variant/40'
                          }`}>
                            {item.status === 'ready' ? 'Ready' : item.status === 'preparing' ? 'Preparing' : 'Pending'}
                          </span>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'ready' 
                              ? 'bg-Hau Hau-bamboo shadow-[0_0_8px_#afd0a1]' 
                              : item.status === 'preparing' 
                              ? 'bg-Hau Hau-amber animate-pulse' 
                              : 'bg-Hau Hau-surface-bright'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Counter Meta */}
                {activeOrder.hatch && (
                  <div className="flex justify-between items-center text-xs font-mono border-t border-Hau Hau-outline-variant/20 pt-4">
                    <span className="text-Hau Hau-on-surface-variant">Hand-off Point</span>
                    <span className="text-Hau Hau-gold font-bold uppercase">{activeOrder.hatch} Hatch</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
