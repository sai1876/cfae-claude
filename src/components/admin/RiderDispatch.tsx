'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { OrderDocument, Staff } from '@/lib/types';
import { bulkDispatchOrders, logSecurityAlert } from '@/lib/dbService';
import { Package, Truck, CheckSquare, Square, ScanFace, Lock, AlertTriangle, User, Search, RefreshCw, X, QrCode, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { latLngToCell, gridDisk } from 'h3-js';

export default function RiderDispatch() {
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [riders, setRiders] = useState<Staff[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Security Flow State
  const [dispatchMode, setDispatchMode] = useState<'idle' | 'face_scan' | 'passcode'>('idle');
  const [scanAttempts, setScanAttempts] = useState(0);
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Listen for mobile scanner sync
  useEffect(() => {
    if (dispatchMode === 'face_scan' && scanSessionId) {
      const unsubscribe = onSnapshot(doc(db, 'scan_sessions', scanSessionId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'success' && !dispatching) {
            executeDispatch(false);
          } else if (data.status === 'failed') {
            simulateScanFailure();
            // Reset mobile session so they can try again if attempts < 5
            setDoc(doc(db, 'scan_sessions', scanSessionId), { status: 'pending', updated_at: Date.now() }, { merge: true });
          }
        }
      });
      return () => unsubscribe();
    }
  }, [dispatchMode, scanSessionId, dispatching]);

  // Fetch ready orders
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'ready'),
      where('order_type', '==', 'delivery')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched: OrderDocument[] = [];
      snap.forEach(doc => fetched.push(doc.data() as OrderDocument));
      fetched.sort((a, b) => b.created_at - a.created_at);
      setOrders(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch riders using H3 Spatial Index!
  useEffect(() => {
    // 1. Define Hau Hau Cafe Location (Example Coordinates)
    const CAFE_LAT = 17.4344;
    const CAFE_LNG = 78.3828;

    // 2. Calculate Cafe's Hexagon (Resolution 9 = ~174m radius)
    const cafeHex = latLngToCell(CAFE_LAT, CAFE_LNG, 9);

    // 3. Get Cafe Hex + 1 surrounding ring (total 7 hexagons, approx 500m radius)
    const neighboringHexagons = gridDisk(cafeHex, 1);

    // 4. Query Firestore efficiently! (No full table scans)
    const q = query(
      collection(db, 'staff'),
      where('role', '==', 'rider'),
      where('h3Index', 'in', neighboringHexagons)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched: Staff[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.deleted) {
          fetched.push({ id: doc.id, ...data } as Staff);
        }
      });
      setRiders(fetched);
      if (fetched.length > 0) {
        setSelectedRiderId(fetched[0].id);
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleOrderSelection = (orderId: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    setSelectedOrderIds(next);
  };

  const selectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.order_id)));
    }
  };

  const handleStartDispatch = async () => {
    if (selectedOrderIds.size === 0) {
      setErrorMsg("Select at least one order to dispatch.");
      return;
    }
    if (!selectedRiderId) {
      setErrorMsg("Select a delivery partner.");
      return;
    }
    setErrorMsg('');
    setScanAttempts(0);
    setPasscode('');
    
    // Create new QR session
    const sid = 'scan_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    setScanSessionId(sid);
    
    try {
      await setDoc(doc(db, 'scan_sessions', sid), {
        status: 'pending',
        rider_id: selectedRiderId,
        created_at: Date.now()
      });
      setDispatchMode('face_scan');
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to start scan session.");
    }
  };

  const executeDispatch = async (usedFallback: boolean) => {
    setDispatching(true);
    setErrorMsg('');
    try {
      const rider = riders.find(r => r.id === selectedRiderId);
      
      // If used 2FA fallback, track it for suspicious activity
      if (usedFallback) {
        const today = new Date().toDateString();
        const fallbackKey = `Hau Hau_dispatch_fallback_${today}`;
        const count = parseInt(localStorage.getItem(fallbackKey) || '0') + 1;
        localStorage.setItem(fallbackKey, count.toString());

        if (count > 3) {
          // Trigger security alert to Admin
          await logSecurityAlert(
            'SYSTEM', 
            'System Trigger', 
            `Manager bypassed Face Scan for Rider (${rider?.name || selectedRiderId}) ${count} times today. Possible suspicious physical handovers.`
          );
        }
      }

      await bulkDispatchOrders(Array.from(selectedOrderIds), selectedRiderId);
      
      setDispatchMode('idle');
      setSelectedOrderIds(new Set());
      setSuccessMessage(`Successfully dispatched ${selectedOrderIds.size} orders to ${rider?.name || 'Rider'}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMsg("Dispatch failed: " + err.message);
    } finally {
      setDispatching(false);
    }
  };

  const simulateScanFailure = () => {
    const nextAttempts = scanAttempts + 1;
    setScanAttempts(nextAttempts);
    if (nextAttempts >= 5) {
      setDispatchMode('passcode');
    }
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rider = riders.find(r => r.id === selectedRiderId);
    // If rider doesn't have a passcode set, we default to 7410 for mock purposes, or their actual passcode
    const expectedPasscode = rider?.passcode || '7410'; 
    if (passcode === expectedPasscode) {
      executeDispatch(true);
    } else {
      setErrorMsg("Incorrect Rider Passcode!");
    }
  };

  const filteredOrders = orders.filter(o => 
    o.token_number.includes(searchTerm) || o.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-serif italic font-black text-[#f8bc51] flex items-center gap-2">
          <Truck size={24} />
          Hatch Dispatch Console
        </h2>
        <p className="text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/50">
          Bundle ready orders and assign logistics partners securely
        </p>
      </div>

      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="w-full bg-[#10B981]/10 border border-[#10B981]/30 p-4 rounded-2xl flex items-center gap-4 text-[#10B981] overflow-hidden"
          >
            <CheckCircle size={24} className="shrink-0" />
            <div>
              <p className="font-mono uppercase tracking-widest text-sm font-bold">Handoff Complete</p>
              <p className="text-xs opacity-80 font-mono mt-1">{successMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Order Queue */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-[#10B981]" />
                <h3 className="font-serif italic text-lg text-white">Ready for Dispatch</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4c4b0]/40" size={14} />
                <input 
                  type="text" 
                  placeholder="Search Tokens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#070402] border border-[#302117] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                />
              </div>
            </div>

            {/* Bulk Selection Header */}
            <div className="flex items-center justify-between bg-[#070402] border border-[#302117]/60 p-3 rounded-xl">
              <button 
                onClick={selectAll}
                className="flex items-center gap-2 text-[#d4c4b0] hover:text-white transition-colors"
              >
                {selectedOrderIds.size > 0 && selectedOrderIds.size === filteredOrders.length ? (
                  <CheckSquare size={16} className="text-[#f8bc51]" />
                ) : (
                  <Square size={16} />
                )}
                <span className="font-mono text-[10px] uppercase tracking-wider font-bold">Select All</span>
              </button>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#f8bc51] bg-[#f8bc51]/10 px-2 py-0.5 rounded border border-[#f8bc51]/20">
                {selectedOrderIds.size} Selected
              </span>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto max-h-[60vh] pr-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-[#d4c4b0]/40 gap-2">
                  <RefreshCw className="animate-spin" size={20} />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Scanning Queue...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-[#d4c4b0]/40 gap-2 text-center border border-dashed border-[#302117] rounded-xl">
                  <CheckSquare size={24} />
                  <span className="font-mono text-[10px] uppercase tracking-widest leading-relaxed">No delivery orders waiting.<br/>The hatch is clear.</span>
                </div>
              ) : (
                filteredOrders.map(order => {
                  const isSelected = selectedOrderIds.has(order.order_id);
                  return (
                    <div 
                      key={order.order_id}
                      onClick={() => toggleOrderSelection(order.order_id)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-[#f8bc51]/5 border-[#f8bc51] shadow-[0_0_15px_rgba(248,188,81,0.1)]' 
                          : 'bg-[#070402]/50 border-[#302117] hover:border-[#f8bc51]/40'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {isSelected ? <CheckSquare size={20} className="text-[#f8bc51]" /> : <Square size={20} className="text-[#d4c4b0]/40" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-mono font-bold text-lg text-white">#{order.token_number}</h4>
                            <span className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest font-bold">Ready</span>
                          </div>
                          <p className="text-[10px] font-mono text-[#d4c4b0]/50 mt-1 uppercase tracking-wider">{order.items.length} Items &bull; ₹{order.gross_amount}</p>
                        </div>
                      </div>
                      <div className="mt-2 sm:mt-0 text-left sm:text-right">
                        <p className="text-[10px] font-mono text-white max-w-[150px] truncate">{order.delivery_address || 'Campus Location'}</p>
                        <p className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase tracking-widest mt-0.5">{new Date(order.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Handover Assignment */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-5 relative overflow-hidden">
            {/* Mesh back glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#60A5FA]/5 rounded-full filter blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-[#302117]/60 pb-2">
              <h3 className="font-serif italic text-lg text-white">Delivery Partner</h3>
              <User size={14} className="text-[#60A5FA]" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[9px] uppercase tracking-widest text-[#d4c4b0]/70">Assign To (Available Riders)</label>
              <select 
                value={selectedRiderId}
                onChange={e => setSelectedRiderId(e.target.value)}
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#60A5FA] transition-colors appearance-none font-mono"
              >
                {riders.length === 0 ? (
                  <option value="">No Riders Available</option>
                ) : (
                  riders.map(r => (
                    <option key={r.id} value={r.id}>{r.name} (ID: {r.employee_id || r.id.substring(0,4)}) {r.status === 'offline' ? '[OFFLINE]' : ''}</option>
                  ))
                )}
              </select>
            </div>

            {errorMsg && dispatchMode === 'idle' && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-[10px] font-mono flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            <button 
              onClick={handleStartDispatch}
              disabled={selectedOrderIds.size === 0 || riders.length === 0}
              className="w-full bg-[#60A5FA] hover:bg-[#93C5FD] disabled:bg-[#302117]/50 disabled:text-[#d4c4b0]/40 text-[#0A0604] rounded-xl py-3.5 font-mono font-bold text-xs uppercase tracking-widest transition-all mt-4 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(96,165,250,0.2)] disabled:shadow-none"
            >
              <Truck size={14} />
              Handover {selectedOrderIds.size > 0 ? selectedOrderIds.size : ''} Orders
            </button>
          </div>
        </div>
      </div>

      {/* Security Verification Modal */}
      <AnimatePresence>
        {dispatchMode !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#120a06] border border-[#302117] rounded-3xl p-6 md:p-8 max-w-md w-full relative overflow-hidden shadow-2xl"
            >
              {/* Mesh background based on mode */}
              <div className={`absolute top-0 right-0 w-full h-full rounded-full filter blur-[100px] pointer-events-none opacity-20 ${dispatchMode === 'face_scan' ? 'bg-[#60A5FA]' : 'bg-[#f8bc51]'}`} />

              <button 
                onClick={() => setDispatchMode('idle')}
                className="absolute top-6 right-6 text-[#d4c4b0]/60 hover:text-white transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="relative z-10 flex flex-col items-center text-center gap-4">
                {dispatchMode === 'face_scan' ? (
                  <>
                    <div className="bg-white p-4 rounded-3xl mx-auto shadow-[0_0_30px_rgba(96,165,250,0.2)]">
                      <QRCodeSVG 
                        value={`http://192.168.1.188:3000/scanner?session_id=${scanSessionId}`}
                        size={220}
                        level="H"
                        includeMargin={false}
                        fgColor="#0A0604"
                      />
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="text-xl font-serif italic text-white font-bold flex justify-center items-center gap-2">
                        <QrCode size={20} className="text-[#60A5FA]" />
                        Mobile Handoff
                      </h3>
                      <p className="text-[10px] font-mono text-[#d4c4b0]/60 uppercase tracking-widest mt-2 px-4 leading-relaxed">
                        Scan with your phone to perform camera verification.
                      </p>
                      
                      <div className="mt-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 py-2 rounded-xl">
                        <a 
                          href={`http://192.168.1.188:3000/scanner?session_id=${scanSessionId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#60A5FA] font-mono text-[9px] uppercase tracking-widest hover:underline flex justify-center items-center gap-1"
                        >
                          Open on this PC (Testing)
                        </a>
                      </div>
                    </div>

                    <div className="w-full flex gap-3 mt-4">
                      <button 
                        onClick={() => executeDispatch(false)}
                        disabled={dispatching}
                        className="flex-1 bg-[#60A5FA] hover:bg-[#93C5FD] text-[#0A0604] py-3 rounded-xl font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {dispatching ? <RefreshCw className="animate-spin" size={14} /> : 'Simulate Success'}
                      </button>
                      <button 
                        onClick={simulateScanFailure}
                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest"
                      >
                        Fail ({scanAttempts}/5)
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-[#f8bc51]/10 border border-[#f8bc51]/30 rounded-full flex items-center justify-center text-[#f8bc51]">
                      <Lock size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif italic text-white font-bold">Passcode Fallback</h3>
                      <p className="text-[10px] font-mono text-red-400 uppercase tracking-widest mt-2 px-4 leading-relaxed border border-red-500/20 bg-red-500/5 py-2 rounded-lg">
                        Scanner locked. Enter rider's secure passcode.
                      </p>
                    </div>

                    <form onSubmit={handlePasscodeSubmit} className="w-full mt-4 flex flex-col gap-4">
                      <input 
                        type="password"
                        placeholder="4-Digit Passcode"
                        value={passcode}
                        onChange={e => setPasscode(e.target.value)}
                        className="w-full bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-center tracking-[1em] text-white focus:outline-none focus:border-[#f8bc51] text-lg font-mono"
                        autoFocus
                      />
                      
                      {errorMsg && (
                        <p className="text-[10px] font-mono text-red-400 uppercase tracking-widest text-center animate-pulse">{errorMsg}</p>
                      )}

                      <button 
                        type="submit"
                        disabled={dispatching || passcode.length < 4}
                        className="w-full bg-[#f8bc51] hover:bg-[#ffce7b] disabled:bg-[#302117] disabled:text-[#d4c4b0]/40 text-[#0A0604] py-3 rounded-xl font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {dispatching ? <RefreshCw className="animate-spin" size={14} /> : 'Authorize Handover'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
