'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Clock, 
  ShoppingBag, 
  Coins, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle, 
  Wallet,
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Info,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '@/store/useStore';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFriendlyErrorMessage } from '@/lib/utils';

function VoiceCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = searchParams.get('session');

  const { user, userProfile, setUserProfile } = useStore();

  // Webpage State Gates
  const [passwordGate, setPasswordGate] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Order loading states
  const [voiceOrder, setVoiceOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Expiration & Timer States
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes default
  const [isExpired, setIsExpired] = useState(false);
  const [isSoftDeleted, setIsSoftDeleted] = useState(false);

  // Loyalty and Coins States
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  // Payment UI States
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'pay'>('cart');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Fetch user's latest coins/points balance when authenticated
  useEffect(() => {
    if (user?.uid) {
      const fetchPoints = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setAvailablePoints(data.points || 0);
          }
        } catch (e) {
          console.error("Failed to fetch loyalty points:", e);
        }
      };
      fetchPoints();
    }
  }, [user]);

  // Real-time voice order document listener
  useEffect(() => {
    if (!session) {
      setOrderError("Invalid session parameter. Please open link from WhatsApp.");
      return;
    }

    setLoadingOrder(true);
    const orderDocRef = doc(db, 'voice_orders', session);
    
    // Subscribe to order updates
    const unsubscribe = onSnapshot(orderDocRef, (snap) => {
      setLoadingOrder(false);
      if (!snap.exists()) {
        setOrderError("Voice order session was not found or has been removed.");
        return;
      }
      
      const data = snap.data();
      setVoiceOrder(data);

      if (data.status === 'SOFT_DELETED') {
        setIsExpired(true);
        setIsSoftDeleted(true);
      } else if (data.status === 'PAID_CONFIRMED') {
        setOrderSuccess(true);
        setTimeout(() => router.push('/profile'), 2500);
      }
    }, (err) => {
      setLoadingOrder(false);
      setOrderError("Failed to fetch order details. Please check connection.");
      console.error(err);
    });

    return () => unsubscribe();
  }, [session, router]);

  // Countdown timer based on expires_at timestamp
  useEffect(() => {
    if (!voiceOrder || isExpired || voiceOrder.status !== 'PENDING') return;

    const timer = setInterval(() => {
      const expiresAt = voiceOrder.expires_at.toMillis();
      const diff = Math.floor((expiresAt - Date.now()) / 1000);

      if (diff <= 0) {
        setTimeLeft(0);
        setIsExpired(true);
        clearInterval(timer);
        triggerSoftDelete();
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [voiceOrder, isExpired]);

  // Trigger soft delete API hook upon session expiry
  const triggerSoftDelete = async () => {
    if (isSoftDeleted || !session) return;
    setIsSoftDeleted(true);
    try {
      await fetch('/api/voice-order/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY || ''}`
        },
        body: JSON.stringify({ session, action: 'soft_delete' })
      });
      console.log("Triggered soft delete for expired session.");
    } catch (e) {
      console.error("Failed to soft-delete expired session:", e);
    }
  };

  // Submit Password Gate validation (Gate D)
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setAuthError("Password cannot be blank.");
      return;
    }

    setIsVerifyingPassword(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/voice-order/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY || ''}`
        },
        body: JSON.stringify({
          session,
          action: 'verify_password',
          password
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || 'Incorrect security password/PIN.');
        setIsVerifyingPassword(false);
        return;
      }

      // Password checks out! Unlock DOM
      setPasswordGate(false);
    } catch (err) {
      console.error(err);
      setAuthError('Authentication service failed. Please try again.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  if (orderError) {
    return (
      <div className="min-h-screen bg-[#060403] text-[#f7dec4] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#120a06] border border-[#E8621A]/30 p-8 rounded-3xl max-w-sm flex flex-col items-center gap-4">
          <AlertTriangle className="text-[#E8621A]" size={48} />
          <h2 className="font-serif italic text-2xl text-white">Verification Failed</h2>
          <p className="text-sm text-[#d4c4b0]/70">{orderError}</p>
          <button 
            onClick={() => router.push('/menu')}
            className="mt-4 px-6 py-2.5 bg-[#f8bc51] text-[#0A0604] rounded-xl font-mono text-xs uppercase tracking-widest font-bold"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // Calculate order metrics
  const orderSubtotal = voiceOrder?.estimated_total || 0;
  const maxAllowedPoints = Math.floor(orderSubtotal * 0.20); // 20% Profit Shield Cap
  const pointsRedeemed = usePoints ? Math.min(availablePoints, maxAllowedPoints) : 0;
  const netPayable = orderSubtotal - pointsRedeemed;

  // Format countdown minutes/seconds
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Trigger payments & place order transition to KDS
  const handlePaymentSubmit = async () => {
    setIsPlacingOrder(true);

    try {
      const res = await fetch('/api/voice-order/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY || ''}`
        },
        body: JSON.stringify({
          session,
          action: 'complete_payment',
          pointsRedeemed
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Payment transaction failed');
      }

      setOrderSuccess(true);
      setTimeout(() => {
        router.push('/profile');
      }, 2500);

    } catch (e: any) {
      console.error(e);
      setToast({ message: getFriendlyErrorMessage(e), type: 'error' });
      setIsPlacingOrder(false);
    }
  };

  // Generate UPI deep link intent
  const upiIntentLink = `upi://pay?pa=hauhau@upi&pn=Hau%20Hau%20Dining&am=${netPayable}&cu=INR&tn=Voice%20Order%20${session}`;

  return (
    <div className="min-h-[100dvh] w-full bg-[#060403] text-[#f7dec4] flex flex-col relative overflow-x-hidden overflow-y-auto font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-[#f8bc51]/5 rounded-full filter blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-[#E8621A]/5 rounded-full filter blur-[80px] pointer-events-none" />

      {/* PASSWORD GATE LOCK (Gate D) */}
      <AnimatePresence>
        {passwordGate && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#060403]/95 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#120a06]/90 border border-[#302117]/80 rounded-3xl p-8 shadow-2xl flex flex-col gap-6"
            >
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-2xl bg-[#f8bc51]/10 border border-[#f8bc51]/20 flex items-center justify-center text-[#f8bc51]">
                  <Lock size={22} />
                </div>
              </div>

              <div className="text-center">
                <h1 className="font-serif italic text-2xl font-bold text-white">Password Challenge</h1>
                <p className="text-xs text-[#d4c4b0]/60 mt-1 leading-relaxed">
                  Enter your permanent Hau Hau profile password to authenticate checkout session.
                </p>
              </div>

              <form onSubmit={handleVerifyPassword} className="flex flex-col gap-4">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-center text-sm focus:outline-none focus:border-[#f8bc51] text-white tracking-widest font-mono"
                />

                {authError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px] text-center font-mono leading-relaxed">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  className="w-full bg-[#f8bc51] hover:bg-[#ffce7b] text-[#0A0604] py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                >
                  {isVerifyingPassword ? 'Authenticating...' : 'Confirm Identity'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SESSION EXPIRED CARD GATE */}
      <AnimatePresence>
        {isExpired && (
          <div className="fixed inset-0 z-40 bg-[#060403]/95 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-[#120a06] border border-red-500/20 p-8 rounded-3xl max-w-sm text-center flex flex-col items-center gap-4 shadow-2xl">
              <Clock className="text-red-500 animate-pulse" size={48} />
              <h2 className="font-serif italic text-2xl text-white">Session Expired, Boss</h2>
              <p className="text-sm text-[#d4c4b0]/70">
                Order not confirmed within the 5-minute break limit. Please re-send a voice note to order.
              </p>
              <button 
                onClick={() => router.push('/menu')}
                className="mt-2 w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-mono text-xs uppercase tracking-widest font-bold"
              >
                Return to Menu
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS CARD GATE */}
      <AnimatePresence>
        {orderSuccess && (
          <div className="fixed inset-0 z-40 bg-[#060403] flex flex-col items-center justify-center p-6 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <CheckCircle className="text-[#10B981] animate-bounce" size={64} />
              <h2 className="font-serif italic text-3xl text-white font-bold">Order Confirmed!</h2>
              <p className="text-sm text-[#d4c4b0]/70 max-w-xs">
                Your voice order is paid and dropped straight into the kitchen printer! Lock in your 3-minute pickup slot.
              </p>
              <p className="font-mono text-xs text-[#f8bc51] mt-2">Redirecting to operations board...</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN CHECKOUT BODY CONTAINER */}
      {!passwordGate && voiceOrder && !isExpired && (
        <div className="flex-1 flex flex-col max-w-lg w-full mx-auto p-6 relative z-10 gap-6">
          {/* Header & Timer banner */}
          <div className="bg-[#120a06]/60 border border-[#302117] rounded-3xl p-6 flex items-center justify-between shadow-lg">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#d4c4b0]/40">Active Session</span>
              <h1 className="font-serif italic text-2xl text-white font-bold">Checkout Order</h1>
            </div>
            <div className="bg-[#E8621A]/10 border border-[#E8621A]/30 px-4 py-2 rounded-2xl flex items-center gap-2 text-[#E8621A]">
              <Clock size={16} />
              <span className="font-mono text-sm font-bold">{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Checkout Steps navigation */}
          {checkoutStep === 'cart' ? (
            <>
              {/* CART VIEW */}
              <div className="bg-[#120a06]/40 border border-[#302117] rounded-3xl p-6 flex flex-col gap-4 shadow-lg">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#f8bc51] border-b border-[#302117]/60 pb-3 flex items-center gap-1.5">
                  <ShoppingBag size={12} /> Extracted Items List
                </h3>

                <div className="flex flex-col gap-3.5 max-h-[220px] overflow-y-auto">
                  {voiceOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-[#070402]/60 p-3.5 rounded-2xl border border-[#302117]/40">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">{item.name}</span>
                        <span className="text-[10px] font-mono text-[#d4c4b0]/50">Qty: {item.qty} × ₹{item.unit_price}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#f7dec4]">₹{item.qty * item.unit_price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* LOYALTY SAVINGS CARD */}
              <div className="bg-[#120a06]/40 border border-[#302117] rounded-3xl p-6 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#302117]/60 pb-3">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#f8bc51] flex items-center gap-1.5">
                    <Coins size={12} /> Profit Shield Coins
                  </h3>
                  <div className="font-mono text-xs text-[#d4c4b0]/50">Max use: <strong className="text-white">₹{maxAllowedPoints}</strong></div>
                </div>

                <div className="flex items-center justify-between bg-[#070402]/60 p-4 rounded-2xl border border-[#302117]/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#f8bc51]/10 border border-[#f8bc51]/20 flex items-center justify-center text-[#f8bc51]">
                      <Coins size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-[#d4c4b0]/70 font-mono">Available: {availablePoints} Coins</span>
                      <span className="text-[9px] text-[#d4c4b0]/40">1 Coin = ₹1 (20% cap max limit)</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={availablePoints === 0}
                    checked={usePoints}
                    onChange={(e) => setUsePoints(e.target.checked)}
                    className="w-5 h-5 rounded border-[#302117] bg-[#070402] text-[#f8bc51] focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* PRICING ESTIMATION SUMMARY */}
              <div className="bg-[#120a06]/60 border border-[#302117] rounded-3xl p-6 flex flex-col gap-3.5 shadow-lg">
                <div className="flex justify-between text-xs text-[#d4c4b0]/70">
                  <span>Gross Order Amount</span>
                  <span className="font-mono">₹{orderSubtotal}</span>
                </div>
                {usePoints && pointsRedeemed > 0 && (
                  <div className="flex justify-between text-xs text-[#10B981]">
                    <span>Loyalty Points Discount</span>
                    <span className="font-mono">-₹{pointsRedeemed}</span>
                  </div>
                )}
                <div className="border-t border-[#302117]/60 pt-3 flex justify-between font-bold text-white text-lg">
                  <span>Net Payable Amount</span>
                  <span className="font-mono text-[#f8bc51]">₹{netPayable}</span>
                </div>

                <button
                  onClick={() => setCheckoutStep('pay')}
                  className="w-full bg-[#f8bc51] hover:bg-[#ffce7b] text-[#0A0604] py-4 rounded-2xl font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all mt-2"
                >
                  Proceed to Payment <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* PAYMENT VIEW */}
              <div className="bg-[#120a06]/40 border border-[#302117] rounded-3xl p-6 flex flex-col gap-5 shadow-lg items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-[#E8621A]/10 border border-[#E8621A]/20 flex items-center justify-center text-[#E8621A]">
                  <Wallet size={18} />
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-serif italic text-xl text-white font-bold">Prepaid UPI Checkout</h3>
                  <p className="text-xs text-[#d4c4b0]/60 max-w-xs">
                    Please complete 100% upfront payment of <strong className="text-[#f8bc51]">₹{netPayable}</strong> using any UPI applications.
                  </p>
                </div>

                {/* Mobile direct link vs desktop QR code options */}
                <div className="w-full flex flex-col gap-3 mt-2">
                  <a
                    href={upiIntentLink}
                    className="w-full bg-[#120a06] hover:bg-[#302117]/45 border border-[#302117] py-4 rounded-2xl text-xs uppercase tracking-widest font-mono font-bold flex items-center justify-center gap-2 text-[#f8bc51] transition-colors"
                  >
                    <Smartphone size={16} /> Pay via UPI Application
                  </a>
                  
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="w-full bg-transparent hover:bg-white/5 border border-white/10 py-3 rounded-2xl text-[10px] uppercase tracking-wider font-mono flex items-center justify-center gap-2 text-[#d4c4b0]/70 transition-colors"
                  >
                    <QrCode size={14} /> {showQR ? 'Hide QR Code' : 'Display payment QR code'}
                  </button>
                </div>

                {showQR && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl border border-white/10 mt-1"
                  >
                    <QRCodeSVG value={upiIntentLink} size={150} />
                    <span className="font-mono text-[9px] text-black font-bold uppercase tracking-wider">Scan using GPay / PhonePe</span>
                  </motion.div>
                )}
              </div>

              {/* CHECKOUT PLACEMENT ACTIONS */}
              <div className="flex gap-3">
                <button
                  disabled={isPlacingOrder}
                  onClick={() => setCheckoutStep('cart')}
                  className="flex-1 bg-transparent border border-[#302117] hover:bg-[#302117]/30 text-[#d4c4b0] py-4 rounded-2xl font-mono font-bold text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  Go Back
                </button>
                <button
                  disabled={isPlacingOrder}
                  onClick={handlePaymentSubmit}
                  className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white py-4 rounded-2xl font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-[#10B981]/15 disabled:opacity-50"
                >
                  {isPlacingOrder ? 'Verifying payment...' : 'Confirm Paid'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* LOADING ORDER OVERLAY */}
      {loadingOrder && (
        <div className="fixed inset-0 z-30 bg-[#060403]/90 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 border-4 border-t-[#f8bc51] border-[#302117] rounded-full animate-spin mb-4" />
          <p className="font-mono text-xs text-[#d4c4b0]/60 uppercase tracking-widest">Loading voice order parameters...</p>
        </div>
      )}
      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '16px',
              right: '16px',
              maxWidth: '420px',
              margin: '0 auto',
              zIndex: 100000,
              background: 'rgba(20, 16, 11, 0.92)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${
                toast.type === 'success'
                  ? 'rgba(16, 185, 129, 0.4)'
                  : toast.type === 'error'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'rgba(212, 163, 84, 0.4)'
              }`,
              borderRadius: '16px',
              padding: '14px 18px',
              boxShadow: `0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px ${
                toast.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : toast.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(212, 163, 84, 0.15)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {toast.type === 'success' && <CheckCircle2 size={22} color="#10b981" />}
              {toast.type === 'error' && <AlertCircle size={22} color="#ef4444" />}
              {toast.type === 'info' && <Info size={22} color="#d4a354" />}
            </div>
            <div style={{ flex: 1, color: '#fff', fontSize: '13.5px', fontWeight: 500, lineHeight: 1.4 }}>
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VoiceCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060403] text-[#f7dec4] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-t-[#f8bc51] border-[#302117] rounded-full animate-spin mb-4" />
        <p className="font-mono text-xs text-[#d4c4b0]/60 uppercase tracking-widest">Loading checkout modules...</p>
      </div>
    }>
      <VoiceCheckoutContent />
    </Suspense>
  );
}
