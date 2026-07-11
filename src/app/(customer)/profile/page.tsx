'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Copy, Check, Share2, Award, Gift, Clock, ChevronDown, ChevronUp, MapPin, Trash2, Home, Building, BookOpen, GraduationCap, Star } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getUserOrders, updateUserProfile } from '@/lib/dbService';
import { updateStudentEmail } from '@/lib/authService';
import { OrderDocument, SavedAddress, RefundRequestDocument } from '@/lib/types';
import AuthModal from '@/components/customer/AuthModal';
import FeedbackModal from '@/components/customer/FeedbackModal';
import { getFriendlyErrorMessage } from '@/lib/utils';
import { isTerminalOrderStatus, isCompletedOrderStatus, isRefundEligibleOrder } from '@/lib/orderUtils';
import { createRefundRequest, CreateRefundRequestPayload, getUserRefundRequests } from '@/features/orders/orderService';
import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('@/components/admin/LocationPickerMap'), { ssr: false });

function CustomSelect({ value, onChange, options }: { value: string, onChange: (v: any) => void, options: {value: string, label: string}[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative w-full" ref={ref}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-black/5 border border-border p-3 rounded-xl text-foreground text-sm font-medium flex justify-between items-center cursor-pointer hover:bg-black/10 transition-colors"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[110] w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
          >
            {options.map(opt => (
              <div 
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`p-3 text-sm cursor-pointer hover:bg-black/5 transition-colors flex justify-between items-center ${value === opt.value ? 'bg-[#f8bc51]/10 text-[#f8bc51] font-bold' : 'text-foreground font-medium'}`}
              >
                {opt.label}
                {value === opt.value && <Check size={16} className="text-[#f8bc51]" />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, userProfile, activeOrders, setUser, setUserProfile } = useStore();
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const [copied, setCopied] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [feedbackOrder, setFeedbackOrder] = useState<OrderDocument | null>(null);
  const [refundOrder, setRefundOrder] = useState<OrderDocument | null>(null);
  const [refundScope, setRefundScope] = useState<'full_order' | 'items' | 'custom_amount'>('full_order');
  const [refundReason, setRefundReason] = useState<CreateRefundRequestPayload['reason_category']>('wrong_item');
  const [refundNote, setRefundNote] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundItems, setRefundItems] = useState<{item_id: string, quantity: number}[]>([]);
  const [submittedRefunds, setSubmittedRefunds] = useState<Record<string, boolean>>({});
  const [refundRequests, setRefundRequests] = useState<RefundRequestDocument[]>([]);

  const getRefundDisplayInfo = (orderId: string) => {
    const req = refundRequests.find(r => r.order_id === orderId);
    
    if (!req) {
      if (submittedRefunds[orderId]) return { text: "Submitted", bg: "bg-blue-50 text-blue-700 border-blue-100" };
      return null;
    }

    if (req.status === 'pending') {
      return { text: "Pending review", bg: "bg-orange-50 text-orange-700 border-orange-100" };
    }
    if (req.status === 'rejected') {
      return { text: "Rejected", bg: "bg-red-50 text-red-700 border-red-100" };
    }
    if (req.status === 'approved') {
      if (req.payment_status === 'paid') {
        return { text: "Refund paid", bg: "bg-emerald-50 text-emerald-700 border-emerald-100" };
      }
      return { text: "Approved, payment pending", bg: "bg-blue-50 text-blue-700 border-blue-100" };
    }
    return null;
  };

  const ordersRef = useRef<HTMLDivElement>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState<'Home' | 'Hostel' | 'Library' | 'Classroom' | 'Other'>('Home');
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newFlatNo, setNewFlatNo] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState('');
  const [showGpsSuccess, setShowGpsSuccess] = useState(false);

  const [verifyStudentEmail, setVerifyStudentEmail] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

  const [showPointsHistory, setShowPointsHistory] = useState(false);
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
  const [activeBalance, setActiveBalance] = useState(0);
  const [pointsLoading, setPointsLoading] = useState(true);

  const profileUserId = user?.uid || (userProfile as any)?.uid || userProfile?.user_id;

  useEffect(() => {
    if (profileUserId) {
      const fetchLedger = async () => {
        setPointsLoading(true);
        try {
          const { db } = await import('@/lib/firebase');
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          
          const q = query(
            collection(db, 'point_ledger'),
            where('user_id', '==', profileUserId)
          );
          const snap = await getDocs(q);
          const data: any[] = [];
          snap.forEach(docSnap => {
            data.push({ id: docSnap.id, ...docSnap.data() });
          });
          
          // Sort in-memory descending by created_at
          data.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

          setLedgerHistory(data);
          
          // Calculate active balance
          const now = new Date().toISOString();
          const active = data.filter(d => d.amount > 0 && (!d.expires_at || d.expires_at > now) && !d.is_expired);
          const totalActive = active.reduce((sum, d) => sum + d.amount, 0);
          
          if (data.length === 0) {
            setActiveBalance(Number(userProfile?.points || 0));
          } else {
            setActiveBalance(totalActive);
          }
        } catch (err) {
          console.warn("Failed to fetch points ledger from Firestore:", err);
          setActiveBalance(Number(userProfile?.points || 0));
        } finally {
          setPointsLoading(false);
        }
      };
      fetchLedger();
    } else {
      setPointsLoading(false);
    }
  }, [profileUserId, user?.uid, (userProfile as any)?.uid, userProfile?.user_id, userProfile?.points]);

  const handleVerifyStudentEmail = async () => {
    if (!verifyStudentEmail || !verifyPassword) {
      setVerifyError('Please provide both student email and current password.');
      return;
    }
    const isStudentEmail = verifyStudentEmail.endsWith('.edu') || verifyStudentEmail.endsWith('.ac.in') || verifyStudentEmail.endsWith('.edu.in');
    if (!isStudentEmail) {
      setVerifyError('Please enter a valid student email (.edu, .ac.in, .edu.in)');
      return;
    }
    
    setVerifyingEmail(true);
    setVerifyError('');
    try {
      await updateStudentEmail(verifyPassword, verifyStudentEmail);
      setVerifySuccess(true);
    } catch (err: any) {
      setVerifyError(getFriendlyErrorMessage(err));
    } finally {
      setVerifyingEmail(false);
    }
  };

  const scrollToOrders = () => {
    ordersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (user?.uid) {
      getUserOrders(user.uid).then(setOrders).catch(console.error);
      getUserRefundRequests(user.uid).then(setRefundRequests).catch(console.error);
    }
  }, [user]);

  const filteredActiveOrders = activeOrders.filter(o => !isTerminalOrderStatus(o.status));
  const filteredPastOrders = orders.filter(o => isTerminalOrderStatus(o.status));

  const handleRefundSubmit = async () => {
    if (!refundOrder) return;
    setRefundSubmitting(true);
    try {
      await createRefundRequest({
        order_id: refundOrder.order_id,
        request_scope: refundScope,
        reason_category: refundReason,
        customer_note: refundNote,
        ...(refundScope === 'items' && { items: refundItems })
      });
      setSubmittedRefunds(prev => ({ ...prev, [refundOrder.order_id]: true }));
      setRefundOrder(null);
      if (user?.uid) {
        getUserRefundRequests(user.uid).then(setRefundRequests).catch(console.error);
      }
    } catch (err) {
      alert(getFriendlyErrorMessage(err));
    } finally {
      setRefundSubmitting(false);
    }
  };

  if (!user || !userProfile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <span style={{ fontSize: 60, marginBottom: 20 }}>👋</span>
        <h2 style={{ color: 'var(--foreground)', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Please Login</h2>
        <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', textAlign: 'center', marginBottom: 30 }}>You need to be logged in to view your profile and order history.</p>
        <button
          onClick={() => setIsAuthOpen(true)}
          style={{ background: '#d4a354', color: '#1b1208', border: 'none', padding: '12px 24px', borderRadius: 24, fontWeight: 700, cursor: 'pointer' }}
        >
          Login to Continue
        </button>
        <AuthModal 
          isOpen={isAuthOpen} 
          onClose={() => setIsAuthOpen(false)} 
        />
      </div>
    );
  }

  const handleCopyCode = () => {
    if (userProfile.referral_code) {
      navigator.clipboard.writeText(userProfile.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (navigator.share && userProfile.referral_code) {
      navigator.share({
        title: 'Join Hau Hau!',
        text: `Hey! Use my referral code ${userProfile.referral_code} to get extra points when you join Hau Hau!`,
        url: window.location.origin
      }).catch(console.error);
    } else {
      handleCopyCode();
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
    router.push('/');
  };

  const handleAutoFetchLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'OasisCafeDelivery/1.0' } }
          );
          
          if (!response.ok) throw new Error("Reverse geocoding failed");
          
          const data = await response.json();
          const addr = data.address || {};
          const street = addr.road || addr.suburb || addr.neighbourhood || addr.pedestrian || "";
          const building = addr.building || addr.amenity || addr.university || addr.college || "";
          
          let detectedArea = street;
          if (building && street) detectedArea = `${building}, ${street}`;
          else if (building) detectedArea = building;
          if (data.display_name && !detectedArea) detectedArea = data.display_name.split(',').slice(0, 2).join(',').trim();
          
          setNewArea(detectedArea || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          if (addr.suburb || addr.county) setNewLandmark(addr.suburb || addr.county || "");
          
          setShowGpsSuccess(true);
          setTimeout(() => setShowGpsSuccess(false), 3000);
          
          if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(100);
          }
        } catch (err) {
          console.error("Geocoding failed, falling back to coordinates:", err);
          setNewArea(`Campus Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setNewLandmark("GPS Detected Location");
          setShowGpsSuccess(true);
          setTimeout(() => setShowGpsSuccess(false), 3000);
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        console.error("GPS fetch error:", error);
        setErrorMsg("Unable to retrieve GPS coordinates. Please enter manually.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSaveNewAddress = async () => {
    if (!newFlatNo.trim() || !newArea.trim()) {
      setErrorMsg("Please provide at least Flat/Hostel No and Area");
      return;
    }
    if (!user || !userProfile) return;

    const labelText = newAddrLabel === 'Other' && newCustomLabel.trim() ? newCustomLabel.trim() : newAddrLabel;
    const compiledAddress = `${newFlatNo}, ${newFloor.trim() ? newFloor.trim() + ', ' : ''}${newArea.trim()}${newLandmark.trim() ? ' (Landmark: ' + newLandmark.trim() + ')' : ''}`;
    
    const newAddress: SavedAddress = {
      id: Math.random().toString(36).substring(7),
      label: labelText,
      flatNo: newFlatNo,
      floor: newFloor,
      area: newArea,
      landmark: newLandmark,
      fullAddress: compiledAddress,
      coordinates: coordinates,
    };
    
    const existingAddresses = userProfile.addresses || [];
    const updatedAddresses = [newAddress, ...existingAddresses];
    
    try {
      await updateUserProfile(user.uid, { addresses: updatedAddresses });
      setUserProfile({ ...userProfile, addresses: updatedAddresses });
      setShowAddAddress(false);
      setNewFlatNo(''); setNewFloor(''); setNewArea(''); setNewLandmark(''); setNewCustomLabel('');
      setCoordinates(undefined); setErrorMsg('');
    } catch (err) {
      console.error("Failed to save address: ", err);
      setErrorMsg(getFriendlyErrorMessage(err));
    }
  };


  const getInitials = () => {
    if (userProfile.student_email) {
      return userProfile.student_email.substring(0, 2).toUpperCase();
    }
    return "US";
  };

  const memberSince = new Date(userProfile.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', paddingBottom: 100 }}>
      {/* ── Header Area ── */}
      <div className="pt-12 pb-8 px-5 flex flex-col items-center text-center bg-gradient-to-b from-black/5 to-transparent">
        <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center text-3xl font-bold mb-4 shadow-xl">
          {getInitials()}
        </div>
        <h2 className="text-foreground text-xl font-bold tracking-tight mb-1">
          {user.phone.replace(/(\+\d{2})(\d{4})(\d{6})/, '$1 ****$3')}
        </h2>
        {userProfile.student_email && (
          <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium mt-1">
            <Check size={14} /> Verified Student
          </div>
        )}
      </div>

      <div className="px-4 flex flex-col gap-6">
        
        {/* Stats Row */}
        <div className="flex gap-3">
            <div className="flex-1 bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <Award size={20} className="text-black mx-auto mb-2" />
              <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold mb-1">Active Coins</p>
              <p className="text-foreground text-xl font-bold tracking-tight">
                {pointsLoading ? "..." : activeBalance}
              </p>
            </div>
          <div 
            onClick={scrollToOrders}
            className="flex-1 bg-card border border-border rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:bg-black/5 transition-colors"
          >
            <Gift size={20} className="text-black mx-auto mb-2" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold mb-1">Orders</p>
            <p className="text-foreground text-xl font-bold tracking-tight">{orders.length}</p>
          </div>
          <div className="flex-1 bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
            <Clock size={20} className="text-black mx-auto mb-2" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold mb-1">Joined</p>
            <p className="text-foreground text-sm font-semibold tracking-tight mt-1">{memberSince}</p>
          </div>
        </div>

        {/* Rewards Progress */}
        <div 
          onClick={() => setShowPointsHistory(true)}
          className="cursor-pointer bg-card border border-border rounded-2xl p-5 hover:bg-black/5 transition-colors relative overflow-hidden shadow-sm"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-black text-xs font-bold uppercase tracking-[0.15em]">Hau Hau Rewards</h3>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">View Ledger &rarr;</span>
          </div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-black text-black leading-none tracking-tighter">
              {pointsLoading ? "..." : activeBalance}
            </span>
            <span className="text-muted-foreground text-sm font-medium pb-1 tracking-tight">pts</span>
          </div>
          
          <div className="bg-black/5 rounded-xl p-3 mb-3 border border-border border-dashed">
            <p className="text-foreground text-xs font-semibold mb-1">
              Current Tier: <span className="text-black font-bold">{(userProfile.total_completed_orders || 0) <= 3 ? "Welcome Multiplier (15%)" : (userProfile.total_completed_orders || 0) <= 5 ? "Transition Phase (10%)" : "Lifetime Elite (8%)"}</span>
            </p>
            <p className="text-muted-foreground text-[11px] leading-relaxed font-medium">
              {(userProfile.total_completed_orders || 0) <= 3 ? "You are earning an accelerated 15% back on your first 3 orders!" : (userProfile.total_completed_orders || 0) <= 5 ? "You are earning 10% back on your 4th and 5th orders!" : "You are earning a flat 8% back on every single order for life."}
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 py-2 px-3 rounded-r-lg">
            <p className="text-red-700 text-[11px] font-semibold">
              ⚠️ Older coins expire exactly 45 days after you earn them. Use them before they disappear!
            </p>
          </div>
        </div>

        {/* Student Email Verification */}
        {!userProfile.student_email && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-emerald-700 text-sm font-bold tracking-tight mb-2 flex items-center gap-1.5">
                <Check size={18} className="stroke-[3]" /> Get Verified Student Badge
              </h3>
              <p className="text-emerald-600/80 text-xs font-medium mb-4 leading-relaxed">
                Verify your student email to unlock exclusive discounts and early access to drops.
              </p>
              
              {verifySuccess ? (
                <div className="bg-emerald-100/50 p-3 rounded-xl text-emerald-700 text-xs font-semibold text-center border border-emerald-200">
                  A verification link has been sent to {verifyStudentEmail}. Please check your inbox and click the link to verify your account.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <input
                    type="email"
                    value={verifyStudentEmail}
                    onChange={e => setVerifyStudentEmail(e.target.value)}
                    placeholder="Student Email (.edu, .ac.in)"
                    className="bg-white border border-emerald-200 rounded-xl p-3 text-black text-sm font-medium outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all placeholder:text-emerald-300"
                  />
                  <input
                    type="password"
                    value={verifyPassword}
                    onChange={e => setVerifyPassword(e.target.value)}
                    placeholder="Current Password"
                    className="bg-white border border-emerald-200 rounded-xl p-3 text-black text-sm font-medium outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all placeholder:text-emerald-300"
                  />
                  {verifyError && <p className="text-red-500 text-xs font-semibold">{verifyError}</p>}
                  <button
                    onClick={handleVerifyStudentEmail}
                    disabled={verifyingEmail}
                    className="bg-emerald-500 text-white border-none py-3 px-4 rounded-xl font-bold text-sm tracking-wide cursor-pointer transition-all hover:bg-emerald-600 disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20"
                  >
                    {verifyingEmail ? 'Sending...' : 'Send Verification Link'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Referral */}
          {(() => {
            const maxUnverifiedReferrals = 8;
            const referralsCount = userProfile.successful_referrals || 0;
            const isVerified = !!userProfile.student_email || !!userProfile.email_verified;
            const canRefer = isVerified || referralsCount < maxUnverifiedReferrals;
            const refCode = userProfile.referral_code || 'HAUHAU50';

            if (!canRefer) {
              return (
                <div className="mb-6">
                  <h3 className="text-foreground text-sm font-bold mb-3 tracking-tight">Invite & Earn</h3>
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-red-700 text-xs font-bold mb-1">You've reached Level 2!</p>
                    <p className="text-red-600/80 text-[11px] font-medium">Verify your student email above to unlock Level 3 (Grand Prize) and continue referring your friends.</p>
                  </div>
                </div>
              );
            }

            return (
              <div className="mb-6">
                <h3 className="text-foreground text-sm font-bold mb-3 tracking-tight">Invite & Earn</h3>
                <div className="bg-card border border-dashed border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold mb-1">Your Referral Code</p>
                    <p className="text-black text-xl font-bold tracking-[0.1em]">{refCode}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCopyCode} className="w-10 h-10 rounded-xl bg-black/5 text-black hover:bg-black/10 transition-colors flex items-center justify-center cursor-pointer">
                      {copied ? <Check size={18} className="stroke-[3]" /> : <Copy size={18} />}
                    </button>
                    <button onClick={handleShare} className="w-10 h-10 rounded-xl bg-black text-white hover:bg-black/80 transition-colors flex items-center justify-center cursor-pointer">
                      <Share2 size={18} />
                    </button>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs font-medium mt-2">Get 50 points when a friend uses your code to sign up!</p>
              </div>
            );
          })()}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-foreground text-sm font-bold tracking-tight">Saved Coordinates</h3>
            <button onClick={() => setShowAddAddress(!showAddAddress)} className="bg-black/5 border border-border rounded-lg py-1 px-3 text-black text-xs font-bold cursor-pointer hover:bg-black/10 transition-colors">
              {showAddAddress ? 'Cancel' : '+ Add'}
            </button>
          </div>

          <AnimatePresence>
            {showAddAddress && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: 16 }}>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(['Home', 'Hostel', 'Library', 'Classroom', 'Other'] as const).map(lbl => (
                      <button key={lbl} onClick={() => setNewAddrLabel(lbl)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${newAddrLabel === lbl ? 'border-black bg-black text-white' : 'border-border bg-transparent text-muted-foreground hover:bg-black/5'}`}>{lbl}</button>
                    ))}
                  </div>
                  {newAddrLabel === 'Other' && (
                    <input type="text" placeholder="Custom Label (e.g., GF's Hostel)" value={newCustomLabel} onChange={e => setNewCustomLabel(e.target.value)} className="w-full bg-black/5 border border-border p-2.5 rounded-xl text-foreground text-sm mb-3 outline-none focus:border-black transition-colors placeholder:text-muted-foreground" />
                  )}
                  
                  {errorMsg && <p className="text-red-500 text-xs font-semibold mb-3">{errorMsg}</p>}
                  <button onClick={handleAutoFetchLocation} disabled={gpsLoading} className={`w-full flex items-center justify-center gap-2 border p-3 rounded-xl font-bold text-sm mb-4 cursor-pointer transition-all ${showGpsSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-black/5 border-border text-black hover:bg-black/10'}`}>
                    <MapPin size={16} />
                    {gpsLoading ? 'Fetching GPS Coordinates...' : showGpsSuccess ? 'Location Detected!' : 'Auto Fetch Location (GPS)'}
                  </button>

                  {coordinates && (
                    <div className="mb-4">
                      <p className="text-muted-foreground text-[11px] mb-2 text-center font-medium">Drag the map or search to adjust your exact location</p>
                      <LocationPickerMap 
                        lat={coordinates.lat} 
                        lng={coordinates.lng} 
                        onChange={(lat, lng, address) => {
                          setCoordinates({ lat, lng });
                          if (address) {
                            const parts = address.split(',').map(s => s.trim());
                            if (parts.length >= 2) {
                              setNewArea(`${parts[0]}, ${parts[1]}`);
                            } else {
                              setNewArea(address);
                            }
                          }
                        }} 
                      />
                    </div>
                  )}

                  <div className="flex gap-2 mb-3">
                    <input type="text" placeholder="Flat / Room No." value={newFlatNo} onChange={e => setNewFlatNo(e.target.value)} className="flex-1 bg-black/5 border border-border p-2.5 rounded-xl text-foreground text-sm outline-none focus:border-black transition-colors placeholder:text-muted-foreground" />
                    <input type="text" placeholder="Floor (Optional)" value={newFloor} onChange={e => setNewFloor(e.target.value)} className="flex-1 bg-black/5 border border-border p-2.5 rounded-xl text-foreground text-sm outline-none focus:border-black transition-colors placeholder:text-muted-foreground" />
                  </div>
                  <input type="text" placeholder="Area / Building / Campus" value={newArea} onChange={e => setNewArea(e.target.value)} className="w-full bg-black/5 border border-border p-2.5 rounded-xl text-foreground text-sm mb-3 outline-none focus:border-black transition-colors placeholder:text-muted-foreground" />
                  <input type="text" placeholder="Landmark (Optional)" value={newLandmark} onChange={e => setNewLandmark(e.target.value)} className="w-full bg-black/5 border border-border p-2.5 rounded-xl text-foreground text-sm mb-4 outline-none focus:border-black transition-colors placeholder:text-muted-foreground" />
                  <button onClick={handleSaveNewAddress} className="w-full bg-black text-white border-none p-3 rounded-xl font-bold text-sm cursor-pointer hover:bg-black/80 transition-colors shadow-md">Save Address</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!userProfile.addresses || userProfile.addresses.length === 0 ? (
            <div className="bg-black/5 border border-dashed border-border rounded-2xl p-5 text-center">
              <MapPin size={24} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-xs font-medium">No saved addresses yet. Save your coordinate during checkout!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {userProfile.addresses.map((addr) => {
                let IconComponent = MapPin;
                if (addr.label === 'Home') IconComponent = Home;
                else if (addr.label === 'Hostel') IconComponent = Building;
                else if (addr.label === 'Library') IconComponent = BookOpen;
                else if (addr.label === 'Classroom') IconComponent = GraduationCap;

                return (
                  <div key={addr.id} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="bg-black/5 border border-border rounded-xl p-2 text-black flex items-center justify-center">
                        <IconComponent size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground text-xs font-bold uppercase tracking-widest">{addr.label}</p>
                        <p className="text-muted-foreground text-[11px] mt-0.5 leading-snug font-medium">{addr.fullAddress}</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={async () => {
                        if (!userProfile?.addresses) return;
                        const filtered = userProfile.addresses.filter(a => a.id !== addr.id);
                        try {
                          await updateUserProfile(user.uid, { addresses: filtered });
                          setUserProfile({ ...userProfile, addresses: filtered });
                        } catch (err) {
                          console.error("Failed to delete saved address from profile: ", err);
                        }
                      }}
                      className="bg-transparent border-none text-muted-foreground/50 p-2 cursor-pointer flex items-center justify-center hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Orders */}
        {filteredActiveOrders.length > 0 && (
          <div>
            <h3 className="text-foreground text-sm font-bold tracking-tight mb-3">Active Orders</h3>
            <div className="flex flex-col gap-3">
              {filteredActiveOrders.map(order => (
                <div key={order.order_id} className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                        {order.order_type === 'delivery' ? 'Order ID' : 'Order Token'}
                      </p>
                      <p className="text-foreground font-black tracking-tight text-lg">
                        #{order.order_type === 'delivery' ? order.order_id : order.token_number}
                      </p>
                    </div>
                    <div className="bg-black/5 text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                      {order.status}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs font-medium">{order.items.length} items • ₹{order.gross_amount}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order History */}
        {filteredPastOrders.length > 0 && (
          <div ref={ordersRef} className="scroll-mt-6">
            <h3 className="text-foreground text-sm font-bold tracking-tight mb-3">Past Orders</h3>
            <div className="flex flex-col gap-2.5 max-h-[600px] overflow-y-auto pr-1 category-scroll-container">
              {filteredPastOrders.map(order => {
                const isExpanded = expandedOrder === order.order_id;
                const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return (
                  <div key={order.order_id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                    <div 
                      onClick={() => setExpandedOrder(isExpanded ? null : order.order_id)}
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-black/5 transition-colors"
                    >
                      <div>
                        <p className="text-foreground text-sm font-bold">{date} • ₹{order.gross_amount}</p>
                        <p className="text-muted-foreground text-xs font-medium mt-1">{order.items.length} items • <span className="capitalize">{order.order_type}</span></p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{order.status}</span>
                        {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                            <div className="px-4 pb-4 border-t border-border/50">
                              <ul className="list-none p-0 m-0 mt-3 flex flex-col gap-2">
                                {order.items.map((item, i) => (
                                  <li key={i} className="flex justify-between text-xs font-medium">
                                    <span className="text-foreground/80">{item.quantity}x {item.name}</span>
                                    <span className="text-muted-foreground">₹{item.unit_price * item.quantity}</span>
                                  </li>
                                ))}
                              </ul>

                              {/* Feedback CTA */}
                              {isCompletedOrderStatus(order.status) && (
                                <div className="mt-4">
                                  {order.feedback ? (
                                    <div className="flex items-center gap-1.5 p-2 bg-black/5 rounded-xl border border-border">
                                      {[1,2,3,4,5].map(s => (
                                        <Star key={s} size={14}
                                          fill={s <= order.feedback!.rating ? '#D4AF37' : 'transparent'}
                                          color={s <= order.feedback!.rating ? '#D4AF37' : '#E5E5E5'}
                                          strokeWidth={1.5}
                                        />
                                      ))}
                                      <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider ml-1">Reviewed</span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={e => { e.stopPropagation(); setFeedbackOrder(order); }}
                                      className="w-full py-2.5 rounded-xl border border-border bg-black/5 text-black text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 hover:bg-black/10 transition-colors"
                                    >
                                      <Star size={14} />
                                      Rate this order
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Refund / Report Issue CTA */}
                              {isRefundEligibleOrder(order) && (
                                <div className="mt-3">
                                  {(() => {
                                    const statusInfo = getRefundDisplayInfo(order.order_id);
                                    if (statusInfo) {
                                      return (
                                        <div className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold ${statusInfo.bg}`}>
                                          {statusInfo.text}
                                        </div>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={e => { e.stopPropagation(); setRefundOrder(order); setRefundScope('full_order'); setRefundItems([]); setRefundNote(''); }}
                                        className="w-full py-2.5 rounded-xl border border-border bg-white text-muted-foreground text-xs font-bold cursor-pointer flex items-center justify-center hover:bg-black/5 transition-colors"
                                      >
                                        Report issue / Request refund
                                      </button>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-3 cursor-pointer hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} /> Logout
        </button>

      </div>

      {/* Points History Modal */}
      <AnimatePresence>
        {showPointsHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col justify-end"
            onClick={() => setShowPointsHistory(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-card border-t border-border rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">Points Ledger</h2>
                <button onClick={() => setShowPointsHistory(false)} className="text-muted-foreground bg-transparent border-none text-2xl cursor-pointer hover:text-black transition-colors">&times;</button>
              </div>

              <div className="flex flex-col gap-3">
                {ledgerHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-5 text-sm font-medium">No transaction history found.</p>
                ) : (
                  ledgerHistory.map((tx, idx) => (
                    <div key={tx.id} className="flex justify-between items-center p-4 bg-black/5 rounded-2xl border border-border">
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground text-sm font-bold capitalize">{tx.source}</span>
                        <span className="text-muted-foreground text-[11px] font-mono">
                          {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black text-lg ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">pts</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <FeedbackModal
        order={feedbackOrder}
        onClose={() => setFeedbackOrder(null)}
        onSubmitted={(orderId, rating, comment) => {
          setOrders(prev =>
            prev.map(o =>
              o.order_id === orderId
                ? { ...o, feedback: { rating, comment, submitted_at: Date.now() } }
                : o
            )
          );
        }}
      />

      {/* Refund / Issue Modal */}
      <AnimatePresence>
        {refundOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col justify-end"
            onClick={() => setRefundOrder(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-card border-t border-border rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">Report Issue</h2>
                <button onClick={() => setRefundOrder(null)} className="text-muted-foreground bg-transparent border-none text-2xl cursor-pointer hover:text-black transition-colors">&times;</button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="relative z-[120]">
                  <label className="text-sm font-bold text-foreground mb-2 block">Reason for Issue</label>
                  <CustomSelect 
                    value={refundReason}
                    onChange={setRefundReason}
                    options={[
                      { value: 'wrong_item', label: 'Wrong Item' },
                      { value: 'missing_item', label: 'Missing Item' },
                      { value: 'bad_quality', label: 'Bad Quality / Spoiled' },
                      { value: 'late_order', label: 'Late Order' },
                      { value: 'cancelled_order', label: 'Order Cancelled' },
                      { value: 'payment_issue', label: 'Payment Issue' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                </div>

                <div className="relative z-[110]">
                  <label className="text-sm font-bold text-foreground mb-2 block mt-1">Request Scope</label>
                  <CustomSelect 
                    value={refundScope}
                    onChange={(val) => {
                      setRefundScope(val);
                      if (val === 'items') {
                        setRefundItems(refundOrder.items.map(i => ({ item_id: i.item_id, quantity: i.quantity })));
                      }
                    }}
                    options={[
                      { value: 'full_order', label: 'Full Order (Entire order is affected)' },
                      { value: 'items', label: 'Specific Items Only' },
                    ]}
                  />
                </div>

                {refundScope === 'items' && (
                  <div className="bg-black/5 border border-border p-3 rounded-xl">
                    <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Select Items & Quantities</p>
                    <div className="flex flex-col gap-3">
                      {refundOrder.items.map(item => {
                        const sel = refundItems.find(r => r.item_id === item.item_id);
                        const isSelected = !!sel && sel.quantity > 0;
                        return (
                          <div key={item.item_id} className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRefundItems([...refundItems, { item_id: item.item_id, quantity: item.quantity }]);
                                } else {
                                  setRefundItems(refundItems.filter(r => r.item_id !== item.item_id));
                                }
                              }}
                            />
                            <div className="flex-1 text-sm font-medium">{item.name}</div>
                            {isSelected && (
                              <input 
                                type="number" 
                                min={1} 
                                max={item.quantity}
                                value={sel?.quantity || 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  setRefundItems(refundItems.map(r => r.item_id === item.item_id ? { ...r, quantity: val } : r));
                                }}
                                className="w-16 bg-white border border-border p-1 rounded text-center text-sm"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-bold text-foreground mb-1 block">Additional Details</label>
                  <textarea 
                    placeholder="Please explain the issue briefly..."
                    value={refundNote}
                    onChange={e => setRefundNote(e.target.value)}
                    className="w-full bg-black/5 border border-border p-3 rounded-xl text-foreground outline-none text-sm font-medium min-h-[100px]"
                  />
                </div>

                <button
                  onClick={handleRefundSubmit}
                  disabled={refundSubmitting || refundNote.length < 5}
                  className="w-full bg-black text-white p-4 rounded-xl font-bold mt-2 disabled:opacity-50 transition-colors"
                >
                  {refundSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
