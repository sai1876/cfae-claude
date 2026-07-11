'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Package, CheckCircle, Navigation, Bike, Clock, ChevronRight, Phone, User, History, HelpCircle, Power, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { OrderDocument, UserDocument, Staff } from '@/lib/types';
import { bulkDispatchOrders, markOrderAsDelivered } from '@/lib/dbService';

const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

interface DeliveryClientProps {
  role: string;
  riderId: string;
}

export default function DeliveryClient({ role, riderId }: DeliveryClientProps) {
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const [customerPhones, setCustomerPhones] = useState<Record<string, string>>({});
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isDelivering, setIsDelivering] = useState(false);
  const [riderOutlet, setRiderOutlet] = useState<string | null>(null);
  
  // Verification states
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Profile states
  const [showProfile, setShowProfile] = useState(false);
  const [riderDetails, setRiderDetails] = useState<Staff | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderDocument[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch rider's assigned outlet and listen to status changes
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'staff', riderId), (staffDoc) => {
      if (staffDoc.exists()) {
        const data = staffDoc.data() as Staff;
        setRiderDetails({ ...data, id: staffDoc.id });
        setRiderOutlet(data.outlet);
      }
    }, (e) => {
      console.error('Error fetching staff profile:', e);
    });
    
    return () => unsubscribe();
  }, [riderId]);

  // Fetch order history when profile is opened
  useEffect(() => {
    if (showProfile) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const q = query(
            collection(db, 'orders'),
            where('rider_id', '==', riderId)
          );
          const snapshot = await getDocs(q);
          const history = snapshot.docs
            .map(d => d.data() as OrderDocument)
            .filter(o => o.status === 'delivered')
            .sort((a, b) => (b.completed_at || b.created_at) - (a.completed_at || a.created_at))
            .slice(0, 50);
          setOrderHistory(history);
        } catch (e) {
          console.error('Error fetching history:', e);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [showProfile, riderId]);

  // Listen to active and ready orders in real-time
  useEffect(() => {
    // Stream orders from the last 24 hours to ensure 100% index safety
    const timeLimit = Date.now() - 24 * 60 * 60 * 1000;
    const q = query(
      collection(db, 'orders'),
      where('created_at', '>=', timeLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: OrderDocument[] = [];
      snapshot.forEach((docSnap) => {
        const order = docSnap.data() as OrderDocument;
        
        // Filter in-memory for maximum robustness and index-safety
        if (order.order_type === 'delivery') {
          if (order.status === 'ready') {
            // Show ready deliveries that match rider outlet, or show all if rider has global/no outlet
            if (!riderOutlet || riderOutlet === 'Global Outlets' || order.hatch === riderOutlet || !order.hatch) {
              fetchedOrders.push(order);
            }
          } else if (order.status === 'dispatched' && order.rider_id === riderId) {
            // Show deliveries dispatched by the manager to this specific rider
            fetchedOrders.push(order);
          } else if (order.status === 'out_for_delivery' && order.rider_id === riderId) {
            // Show active deliveries assigned to this specific rider
            fetchedOrders.push(order);
          }
        }
      });
      setOrders(fetchedOrders);
    }, (err) => {
      console.error("Failed to stream delivery orders: ", err);
    });

    return () => unsubscribe();
  }, [riderOutlet, riderId]);

  // Fetch customer phones for out_for_delivery
  useEffect(() => {
    const fetchPhones = async () => {
      const activeDeliveries = orders.filter(o => o.status === 'out_for_delivery');
      const newPhones: Record<string, string> = { ...customerPhones };
      
      const missingPhoneDeliveries = activeDeliveries.filter(order => !newPhones[order.user_id]);
      
      if (missingPhoneDeliveries.length > 0) {
        await Promise.all(
          missingPhoneDeliveries.map(async (order) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', order.user_id));
              if (userDoc.exists()) {
                newPhones[order.user_id] = (userDoc.data() as UserDocument).phone;
              }
            } catch (e) {
              console.error(e);
            }
          })
        );
        setCustomerPhones(newPhones);
      }
    };

    fetchPhones();
  }, [orders]);

  const availableOrders = orders.filter(o => o.status === 'ready' || o.status === 'dispatched');
  const activeDeliveries = orders.filter(o => o.status === 'out_for_delivery');

  useEffect(() => {
    setIsDelivering(activeDeliveries.length > 0);
  }, [activeDeliveries.length]);

  // Broadcast location when delivering
  useEffect(() => {
    let watchId: number;
    let lastBroadcast = 0;
    let wakeLock: any = null;
    
    if (isDelivering) {
      // 1. Request Screen Wake Lock to keep phone active while delivering
      if ('wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen')
          .then((lock: any) => { wakeLock = lock; })
          .catch((err: any) => console.log('Wake Lock error:', err));
      }

      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            // 2. Filter out highly inaccurate "ghost" spikes (e.g. cell tower fallback)
            // If the GPS accuracy radius is worse than 60 meters, ignore it to prevent the map marker from wildly jumping
            if (pos.coords.accuracy > 60) return;

            const now = Date.now();
            // 3. Lower throttle to 2.5 seconds for much smoother real-time map movement
            if (now - lastBroadcast > 2500) {
              lastBroadcast = now;
              try {
                await updateDoc(doc(db, 'staff', riderId), {
                  location: {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    updated_at: now
                  }
                });
              } catch (e) {
                console.error('Failed to broadcast location:', e);
              }
            }
          },
          (err) => console.error('Geolocation error:', err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }

    return () => {
      if (watchId !== undefined && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (wakeLock) {
        wakeLock.release().catch(console.error);
      }
    };
  }, [isDelivering, riderId]);

  const toggleSelection = (orderId: string) => {
    const order = availableOrders.find(o => o.order_id === orderId);
    if (!order || order.status === 'ready') {
      alert("This order has not been assigned to you yet! Suggest it to your manager.");
      return;
    }
    
    const newSet = new Set(selectedOrderIds);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setSelectedOrderIds(newSet);
  };

  const startBatchRoute = async () => {
    if (selectedOrderIds.size === 0) return;
    
    // Convert Set to Array
    const orderIds = Array.from(selectedOrderIds);
    
    try {
      await bulkDispatchOrders(orderIds, riderId);
      setSelectedOrderIds(new Set());
      
      // Open Google Maps
      const selectedOrders = availableOrders.filter(o => selectedOrderIds.has(o.order_id));
      if (selectedOrders.length > 0) {
        let mapsUrl = `https://www.google.com/maps/dir/?api=1`;
        
        // Use outlet location as origin ideally, but for now we let it use current location if omitted,
        // or just pass destination and waypoints
        const destination = selectedOrders[selectedOrders.length - 1];
        if (destination.delivery_coordinates) {
            mapsUrl += `&destination=${destination.delivery_coordinates.lat},${destination.delivery_coordinates.lng}`;
        } else {
            const destAddr = typeof destination.delivery_address === 'string'
              ? destination.delivery_address
              : (destination.delivery_address as any)?.fullAddress || '';
            mapsUrl += `&destination=${encodeURIComponent(destAddr)}`;
        }

        if (selectedOrders.length > 1) {
          const waypoints = selectedOrders.slice(0, selectedOrders.length - 1).map(o => {
            if (o.delivery_coordinates) {
                return `${o.delivery_coordinates.lat},${o.delivery_coordinates.lng}`;
            }
            const ptAddr = typeof o.delivery_address === 'string'
              ? o.delivery_address
              : (o.delivery_address as any)?.fullAddress || '';
            return encodeURIComponent(ptAddr);
          }).join('|');
          mapsUrl += `&waypoints=${waypoints}`;
        }
        
        window.open(mapsUrl, '_blank');
      }
      
    } catch (e) {
      console.error(e);
      alert('Failed to start route');
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    try {
      await markOrderAsDelivered(orderId);
    } catch (e) {
      console.error(e);
      alert('Failed to mark as delivered');
    }
  };

  const handleVerifyAndComplete = async (order: OrderDocument) => {
    if (order.otp && enteredOtp !== order.otp) {
      setOtpError('Invalid OTP. Please verify with customer.');
      return;
    }
    
    try {
      await markOrderAsDelivered(order.order_id);
      setVerifyingOrderId(null);
      setEnteredOtp('');
      setOtpError(null);
    } catch (e) {
      console.error(e);
      setOtpError('Failed to mark order as delivered');
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const toggleStatus = async () => {
    if (!riderDetails) return;
    
    if (riderDetails.status === 'active') {
      // Check if trying to go offline while having active or dispatched orders
      const hasActiveOrders = orders.some(o => 
        (o.status === 'out_for_delivery' || o.status === 'dispatched') && o.rider_id === riderId
      );
      if (hasActiveOrders) {
        alert("Cannot go offline while you have active or assigned deliveries!");
        return;
      }
    }
    
    try {
      const newStatus = riderDetails.status === 'active' ? 'offline' : 'active';
      await updateDoc(doc(db, 'staff', riderId), {
        status: newStatus
      });
    } catch (e) {
      console.error('Failed to update status', e);
      alert('Failed to update status');
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
    <div className="min-h-screen bg-[#060403] text-[#f7dec4] font-sans flex flex-col max-w-md mx-auto relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-[-20%] w-[300px] h-[300px] bg-[#60A5FA]/10 rounded-full filter blur-[80px] pointer-events-none" />

      {/* Header */}
      <header className="bg-[#120a06]/80 backdrop-blur-xl border-b border-[#302117] p-6 flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#60A5FA]/10 border border-[#60A5FA]/30 flex items-center justify-center">
            <Bike className="text-[#60A5FA]" size={20} />
          </div>
          <div>
            <h1 className="font-serif italic text-xl font-black text-[#60A5FA]">Rider Ops</h1>
            <p className="text-[#d4c4b0]/50 font-mono text-[10px] uppercase tracking-widest mt-0.5">Hau Hau Delivery Matrix</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-1.5 text-[#d4c4b0]/60 hover:text-white transition-colors"
          >
            <User size={18} />
          </button>
          <button 
            onClick={handleLogout}
            className="text-[#d4c4b0]/40 font-mono text-[9px] uppercase tracking-widest hover:text-white"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 z-10 pb-32">
        {isDelivering ? (
          <div className="flex flex-col gap-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#d4c4b0]/50 mb-2">Active Route ({activeDeliveries.length})</h2>
            <AnimatePresence>
              {activeDeliveries.map(order => (
                <motion.div 
                  key={order.order_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-[#120a06] border border-[#60A5FA]/30 rounded-2xl p-4 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-center border-b border-[#302117]/50 pb-3">
                    <div>
                      <span className="font-mono text-sm font-bold text-white">#{order.order_id}</span>
                      <span className="ml-2 text-xs font-mono text-[#d4c4b0]/50">{order.items.length} Items</span>
                    </div>
                     <button 
                       onClick={() => {
                         if (order.delivery_coordinates) {
                           window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_coordinates.lat},${order.delivery_coordinates.lng}`, '_blank');
                         } else {
                           const queryAddr = typeof order.delivery_address === 'string'
                             ? order.delivery_address
                             : (order.delivery_address as any)?.fullAddress || '';
                           window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryAddr)}`, '_blank');
                         }
                       }}
                       className="bg-[#60A5FA]/10 text-[#60A5FA] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest font-bold"
                     >
                       <Navigation size={12} /> Map
                     </button>
                   </div>
                   
                   <div className="flex items-start gap-2 text-[#d4c4b0]">
                     <MapPin size={16} className="shrink-0 mt-0.5 text-[#60A5FA]" />
                     <p className="text-sm font-bold">
                       {typeof order.delivery_address === 'string'
                         ? order.delivery_address
                         : (order.delivery_address as any)?.fullAddress ||
                           ((order.delivery_address as any)?.lat !== undefined
                             ? `Coordinates: ${(order.delivery_address as any).lat.toFixed(6)}, ${(order.delivery_address as any).lng.toFixed(6)}`
                             : '')}
                     </p>
                  </div>

                  {verifyingOrderId === order.order_id ? (
                    <div className="bg-[#1b120c] border border-[#d4a354]/30 rounded-xl p-4 flex flex-col gap-3 mt-2">
                      <div className="text-[10px] font-mono text-[#d4c4b0]/70 uppercase tracking-widest text-center">Enter 4-Digit Customer OTP</div>
                      <input 
                        type="text"
                        maxLength={4}
                        placeholder="••••"
                        value={enteredOtp}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setEnteredOtp(val);
                          setOtpError(null);
                        }}
                        className="bg-black/40 border border-[#302117] rounded-xl py-2 text-center text-xl font-mono tracking-[0.5em] text-[#d4a354] outline-none focus:border-[#d4a354]"
                      />
                      {otpError && <div className="text-[#ef4444] text-[10px] font-mono text-center">{otpError}</div>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setVerifyingOrderId(null);
                            setEnteredOtp('');
                            setOtpError(null);
                          }}
                          className="flex-1 bg-[#302117] hover:bg-[#4a3324] text-white py-2 rounded-lg font-mono text-[9px] uppercase tracking-widest font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleVerifyAndComplete(order)}
                          className="flex-[2] bg-[#10B981] hover:bg-[#059669] text-white py-2 rounded-lg font-mono text-[9px] uppercase tracking-widest font-bold"
                        >
                          Verify & Complete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      {customerPhones[order.user_id] && (
                        <a 
                          href={`tel:${customerPhones[order.user_id]}`}
                          className="flex-1 bg-[#302117] hover:bg-[#4a3324] text-white py-3 rounded-xl font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <Phone size={16} /> Call
                        </a>
                      )}
                      <button 
                        onClick={() => {
                          if (order.otp) {
                            setVerifyingOrderId(order.order_id);
                            setEnteredOtp('');
                            setOtpError(null);
                          } else {
                            handleCompleteDelivery(order.order_id);
                          }
                        }}
                        className="flex-[2] bg-[#10B981] hover:bg-[#059669] text-white py-3 rounded-xl font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <CheckCircle size={16} /> Delivered
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#d4c4b0]/50 mb-2">Ready for Pickup</h2>
            
            {availableOrders.length === 0 ? (
              <div className="text-center py-10 text-[#d4c4b0]/30 font-mono text-sm uppercase tracking-widest flex flex-col items-center gap-3">
                <Package size={40} className="opacity-50" />
                No pending deliveries
              </div>
            ) : (
              <>
                <MapComponent 
                  orders={availableOrders} 
                  selectedOrderIds={selectedOrderIds} 
                  onToggleSelection={toggleSelection} 
                />
                <div className="text-xs font-mono text-[#d4c4b0]/50 text-center">Select orders on the map to build your route</div>
                
                {availableOrders.map(order => {
                  const isSelected = selectedOrderIds.has(order.order_id);
                  if (!isSelected) return null; // Only show selected items in the list to reduce clutter since they use the map
                  
                  return (
                    <motion.div 
                      key={order.order_id}
                      onClick={() => toggleSelection(order.order_id)}
                      className={`bg-[#070402] border-2 rounded-2xl p-4 flex flex-col gap-3 transition-all cursor-pointer ${
                        isSelected ? 'border-[#60A5FA] bg-[#60A5FA]/5' : 'border-[#302117] hover:border-[#60A5FA]/40'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'border-[#60A5FA] bg-[#60A5FA]' : 'border-[#302117]'
                          }`}>
                            {isSelected && <CheckCircle size={12} className="text-[#070402]" />}
                          </div>
                          <span className="font-mono text-sm font-bold text-white tracking-tight">#{order.order_id}</span>
                        </div>
                        <span className="text-xs font-mono text-[#d4c4b0]/50 flex items-center gap-1">
                          <Clock size={12} /> {formatTime(order.created_at)}
                        </span>
                      </div>
                      
                      <div className="pl-7 flex items-start gap-2 text-[#d4c4b0]/80">
                        <MapPin size={14} className="shrink-0 mt-0.5 text-[#60A5FA]/70" />
                        <div>
                          <p className="text-sm font-bold">
                            {typeof order.delivery_address === 'string'
                              ? order.delivery_address
                              : (order.delivery_address as any)?.fullAddress ||
                                ((order.delivery_address as any)?.lat !== undefined
                                  ? `Coordinates: ${(order.delivery_address as any).lat.toFixed(6)}, ${(order.delivery_address as any).lng.toFixed(6)}`
                                  : '')}
                          </p>
                          <p className="text-[10px] font-mono text-[#d4c4b0]/40 uppercase tracking-widest mt-1">{order.items.length} Items to carry</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button for Batch Start */}
      {!isDelivering && selectedOrderIds.size > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#060403] via-[#060403] to-transparent z-20"
        >
          <div className="max-w-md mx-auto">
            <button 
              onClick={startBatchRoute}
              className="w-full bg-[#60A5FA] hover:bg-[#3B82F6] text-[#0A0604] py-4 rounded-2xl font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(96,165,250,0.3)] transition-all"
            >
              Start Route & Navigate ({selectedOrderIds.size}) <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Profile Drawer */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#060403] z-50 flex flex-col overflow-hidden"
          >
            <div className="bg-[#120a06]/80 backdrop-blur-xl border-b border-[#302117] p-6 flex justify-between items-center shrink-0">
              <h2 className="font-serif italic text-xl font-black text-white">Rider Profile</h2>
              <button 
                onClick={() => setShowProfile(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
              {/* Profile Card */}
              {riderDetails && (
                <div className="bg-[#120a06] border border-[#60A5FA]/30 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#60A5FA]/5 rounded-bl-full pointer-events-none" />
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white">{riderDetails.name}</h3>
                      <p className="text-[#d4c4b0]/50 font-mono text-xs mt-1">ID: {riderDetails.employee_id}</p>
                      <p className="text-[#60A5FA]/80 font-mono text-xs mt-1 uppercase tracking-widest">{riderDetails.outlet}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${
                      riderDetails.status === 'active' ? 'bg-[#10B981]/10 border-[#10B981] text-[#10B981]' : 'bg-red-500/10 border-red-500/50 text-red-500/50'
                    }`}>
                      <Power size={24} />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#302117]/50 flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-widest text-[#d4c4b0]/70">Status</span>
                    <button
                      onClick={toggleStatus}
                      className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                        riderDetails.status === 'active' ? 'bg-[#10B981]' : 'bg-[#302117]'
                      }`}
                    >
                      <motion.div
                        animate={{ x: riderDetails.status === 'active' ? 26 : 4 }}
                        className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-md"
                      />
                    </button>
                  </div>
                  {riderDetails.status === 'offline' && (
                    <p className="text-red-400/80 text-[10px] font-mono text-right">You are offline. You won't receive new orders.</p>
                  )}
                </div>
              )}

              {/* Order History */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#d4c4b0]/70 pb-2 border-b border-[#302117]">
                  <History size={16} />
                  <h4 className="font-mono text-xs uppercase tracking-widest font-bold">Recent Deliveries</h4>
                </div>
                
                {loadingHistory ? (
                  <div className="text-center py-6 text-[#d4c4b0]/30 font-mono text-xs animate-pulse">Loading history...</div>
                ) : orderHistory.length === 0 ? (
                  <div className="text-center py-6 text-[#d4c4b0]/30 font-mono text-xs">No completed deliveries yet.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {orderHistory.map(order => (
                      <div key={order.order_id} className="bg-[#120a06] border border-[#302117] rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <div className="font-mono text-xs font-bold text-white">#{order.order_id}</div>
                          <div className="text-[10px] font-mono text-[#d4c4b0]/50 mt-1">
                            {new Date(order.completed_at || order.created_at).toLocaleDateString()} • {formatTime(order.completed_at || order.created_at)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[#10B981] font-mono text-xs flex items-center gap-1 justify-end"><CheckCircle size={12} /> Delivered</div>
                          <div className="text-[10px] font-mono text-[#d4c4b0]/40 mt-1">{order.items.length} items</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Help Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#d4c4b0]/70 pb-2 border-b border-[#302117]">
                  <HelpCircle size={16} />
                  <h4 className="font-mono text-xs uppercase tracking-widest font-bold">Help & Support</h4>
                </div>
                <div className="bg-[#120a06] border border-[#302117] rounded-xl p-4 space-y-4">
                  <div>
                    <h5 className="text-white text-sm font-bold">Need assistance?</h5>
                    <p className="text-[#d4c4b0]/60 text-xs mt-1 leading-relaxed">
                      If you're facing issues with an active delivery or the app, contact your manager immediately.
                    </p>
                  </div>
                  <a href="tel:+919999999999" className="block w-full bg-[#302117] hover:bg-[#4a3324] text-white py-3 rounded-lg font-mono text-xs uppercase tracking-widest font-bold text-center transition-colors">
                    Call Manager
                  </a>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
