'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, Flame, Droplets, Utensils, Coffee, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { OrderDocument, OrderItem } from '@/lib/types';
import StaffCopilot from '@/components/admin/StaffCopilot';
import KDSProfileModal from '@/components/kds/KDSProfileModal';
import { User } from 'lucide-react';

interface KDSClientProps {
  role: string;
  staffDetails: any;
}

export default function KDSClient({ role, staffDetails }: KDSClientProps) {
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // 1. Update current local time periodically to refresh elapsed minutes ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // 2. Map KDS Roles to MenuItem Station fields
  const isAllowedItem = (item: OrderItem) => {
    if (role === 'manager' || role === 'owner') return true;
    const stationUpper = (item.station || '').toUpperCase();
    
    if (role === 'deep_fryer') return stationUpper === 'FRYER';
    if (role === 'grill_fryer') return stationUpper === 'GRILLED OR STEAMED';
    if (role === 'biryani_master') return stationUpper === 'FASTFOOD & BIRYANI';
    if (role === 'brewer') return stationUpper === 'BREWER';
    
    return false;
  };

  // 3. Listen to real orders in the last 12 hours from Firestore in real-time
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
        // Only show orders that are NOT held by manager rush mode
        if (order.rush_held !== true) {
          fetchedOrders.push(order);
        }
      });
      
      // Sort in-memory by created_at ascending (oldest first for kitchen queues!)
      fetchedOrders.sort((a, b) => a.created_at - b.created_at);
      setOrders(fetchedOrders);
    }, (err) => {
      console.error("Failed to stream kitchen KDS orders: ", err);
    });

    return () => unsubscribe();
  }, []);

  // Filter KDS tickets to show:
  // - Only active preparing/ready orders (exclude delivered/rejected)
  // - Only orders that have items matching the current station
  // - Only items for this station that are NOT yet bumped (status != 'bumped')
  const filteredOrders = orders.map(order => {
    const stationItems = order.items.filter(item => isAllowedItem(item) && item.status !== 'bumped');
    return { 
      ...order, 
      items: stationItems,
      elapsed_mins: Math.max(0, Math.floor((nowTime - order.created_at) / (60 * 1000)))
    };
  }).filter(order => 
    order.items.length > 0 && 
    order.status !== 'delivered' && 
    order.status !== 'rejected'
  );

  const completedOrders = orders.filter(order => 
    order.items.some(item => isAllowedItem(item) && item.status === 'bumped')
  ).sort((a, b) => b.created_at - a.created_at);

  const getRoleIcon = () => {
    switch(role) {
      case 'deep_fryer': return <Flame className="text-[#e8621a]" />;
      case 'grill_fryer': return <Utensils className="text-[#f8bc51]" />;
      case 'biryani_master': return <Utensils className="text-[#10B981]" />;
      case 'brewer': return <Coffee className="text-[#60A5FA]" />;
      default: return <AlertTriangle className="text-[#f8bc51]" />;
    }
  };

  const getRoleTitle = () => {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Toggle KDS item status directly in Firestore
  const toggleItemReady = async (orderId: string, itemId: string, currentStatus: string) => {
    const rawOrder = orders.find(o => o.order_id === orderId);
    if (!rawOrder) return;

    const updatedItems = rawOrder.items.map(item => {
      if (item.item_id === itemId) {
        return {
          ...item,
          status: (currentStatus === 'ready' ? 'pending' : 'ready') as any
        };
      }
      return item;
    });

    // Check item states for top-level status auto-transitions
    const allItemsReady = updatedItems.every(item => item.status === 'ready' || item.status === 'bumped');
    const anyItemReadyOrBumped = updatedItems.some(item => item.status === 'ready' || item.status === 'bumped');

    try {
      const orderRef = doc(db, 'orders', orderId);
      const updates: any = { items: updatedItems };
      
      if (allItemsReady) {
        updates.status = 'ready';
      } else if (anyItemReadyOrBumped) {
        updates.status = 'preparing';
      } else {
        updates.status = 'pending';
      }
      
      await updateDoc(orderRef, updates);
    } catch (e) {
      console.error("Failed to toggle item ready status: ", e);
    }
  };

  // Bump station ticket in Firestore
  const handleBumpTicket = async (orderId: string) => {
    const rawOrder = orders.find(o => o.order_id === orderId);
    if (!rawOrder) return;

    // Mark all allowed station items as ready/bumped
    const updatedItems = rawOrder.items.map(item => {
      if (isAllowedItem(item)) {
        return {
          ...item,
          status: 'bumped' as const // Mark KDS status bumped
        };
      }
      return item;
    });

    // Check if ALL items across all stations are now marked ready or bumped
    const allOrderItemsReady = updatedItems.every(item => item.status === 'ready' || item.status === 'bumped');

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        items: updatedItems,
        // If all items are ready, set order status to ready so customers can pick up/deliver!
        status: allOrderItemsReady ? 'ready' : 'preparing'
      });
    } catch (e) {
      console.error("Failed to bump station KDS ticket: ", e);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'logout' }),
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-[#060403] text-[#f7dec4] font-sans p-6 overflow-hidden flex flex-col">
      {/* KDS Header */}
      <header className="bg-[#120a06]/80 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#302117]/50 border border-[#302117] flex items-center justify-center">
            {getRoleIcon()}
          </div>
          <div>
            <h1 className="font-sans text-3xl font-bold text-[#f8bc51] uppercase tracking-wide">
              {getRoleTitle()} Station
            </h1>
            <p className="text-[#d4c4b0]/50 font-mono text-xs uppercase tracking-widest mt-1">Kitchen Display System • Live</p>
          </div>
        </div>

        <div className="flex gap-6 items-center">
          <div className="text-right font-mono">
            <p className="text-[#d4c4b0]/40 text-[10px] uppercase tracking-widest">Active Tickets</p>
            <p className="text-2xl font-bold text-white">{filteredOrders.length}</p>
          </div>
          <div className="w-px h-10 bg-[#302117]" />
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="bg-[#302117]/30 hover:bg-[#302117] text-[#f8bc51] px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2"
          >
            <User size={14} /> Profile
          </button>
          <button 
            onClick={handleLogout}
            className="bg-[#302117]/30 hover:bg-[#302117] text-[#d4c4b0] px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
          >
            Exit Station
          </button>
        </div>
      </header>

      {/* Ticket Grid */}
      <div className="flex-1 overflow-x-auto flex gap-6 pb-4 ticket-scroll">
        <AnimatePresence mode="popLayout">
          {filteredOrders.length === 0 ? (
            <motion.div 
              key="clear"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex flex-col items-center justify-center text-[#d4c4b0]/30 font-mono text-sm uppercase tracking-widest"
            >
              <CheckCircle size={48} className="mb-4 opacity-50 text-[#10B981]" />
              No Active Tickets For Your Station
            </motion.div>
          ) : (
            filteredOrders.map(order => {
              const allStationItemsReady = order.items.every(i => i.status === 'ready');
              const isUrgent = order.elapsed_mins >= 10;

              return (
                <motion.div
                  key={order.order_id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  className={`w-[350px] shrink-0 bg-[#070402]/80 border-2 rounded-3xl overflow-hidden flex flex-col transition-colors ${
                    allStationItemsReady ? 'border-[#10B981]/30 opacity-60' : 
                    isUrgent ? 'border-[#e8621a]/60 shadow-[0_0_30px_rgba(232,98,26,0.15)]' : 'border-[#302117]'
                  }`}
                >
                  {/* Ticket Header */}
                  <div className={`p-5 border-b flex justify-between items-start ${
                    isUrgent && !allStationItemsReady ? 'bg-[#e8621a]/10 border-[#e8621a]/30' : 'bg-[#120a06]/50 border-[#302117]'
                  }`}>
                    <div>
                      <h2 className={`font-black text-white font-mono tracking-tight ${
                        order.order_type === 'delivery' ? 'text-lg' : 'text-3xl'
                      }`}>
                        #{order.order_type === 'delivery' ? order.order_id : order.token_number}
                      </h2>
                      <span className={`text-[10px] uppercase font-mono tracking-widest font-bold px-2 py-0.5 rounded mt-2 inline-block ${
                        order.order_type === 'dine-in' ? 'bg-[#f8bc51]/20 text-[#f8bc51]' :
                        order.order_type === 'delivery' ? 'bg-[#60A5FA]/20 text-[#60A5FA]' :
                        'bg-[#10B981]/20 text-[#10B981]'
                      }`}>
                        {order.order_type}
                      </span>
                    </div>
                    <div className={`text-right font-mono ${isUrgent && !allStationItemsReady ? 'text-[#e8621a] animate-pulse' : 'text-[#d4c4b0]/70'}`}>
                      <div className="flex items-center gap-1.5 justify-end text-xl font-bold">
                        <Clock size={16} />
                        {order.elapsed_mins}m
                      </div>
                      <div className="text-[10px] uppercase tracking-widest mt-1 opacity-70">Elapsed</div>
                    </div>
                  </div>

                  {/* Ticket Items */}
                  <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2">
                    {order.items.map(item => (
                      <button
                        key={item.item_id}
                        onClick={() => toggleItemReady(order.order_id, item.item_id, item.status)}
                        className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer ${
                          item.status === 'ready' 
                            ? 'bg-[#10B981]/10 border border-[#10B981]/20 opacity-50' 
                            : 'bg-[#120a06] border border-[#302117] hover:border-[#f8bc51]/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          item.status === 'ready' ? 'bg-[#10B981] text-white' : 'bg-[#302117] text-[#f8bc51]'
                        }`}>
                          {item.status === 'ready' ? <CheckCircle size={16} /> : `${item.quantity}x`}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold leading-tight ${item.status === 'ready' ? 'text-[#10B981] line-through' : 'text-white text-lg'}`}>
                            {item.name}
                          </p>
                          <p className="text-[#d4c4b0]/40 text-[10px] font-mono uppercase tracking-widest mt-1">
                            {item.station || 'GENERAL'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Bump Action */}
                  <div className="p-4 border-t border-[#302117] bg-[#070402]">
                    <button 
                      onClick={() => handleBumpTicket(order.order_id)}
                      disabled={!allStationItemsReady}
                      className="w-full py-4 rounded-xl font-mono text-sm uppercase tracking-widest font-bold transition-all disabled:opacity-30 disabled:bg-[#302117] disabled:text-[#d4c4b0] bg-[#10B981] text-white hover:bg-[#059669] cursor-pointer"
                    >
                      {allStationItemsReady ? 'Bump Ticket' : 'Cooking...'}
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .ticket-scroll::-webkit-scrollbar {
          height: 12px;
        }
        .ticket-scroll::-webkit-scrollbar-track {
          background: #120a06;
          border-radius: 10px;
        }
        .ticket-scroll::-webkit-scrollbar-thumb {
          background: #302117;
          border-radius: 10px;
        }
        .ticket-scroll::-webkit-scrollbar-thumb:hover {
          background: #f8bc51;
        }
      `}} />

      <StaffCopilot />

      <KDSProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        role={role}
        completedOrders={completedOrders}
        staffDetails={staffDetails}
      />
    </div>
  );
}
