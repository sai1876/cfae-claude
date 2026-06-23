'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Copy, Check, Share2, Award, Gift, Clock, ChevronDown, ChevronUp, MapPin, Trash2, Home, Building, BookOpen, GraduationCap, Star } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getUserOrders, updateUserProfile, submitOrderFeedback } from '@/lib/dbService';
import { updateStudentEmail } from '@/lib/authService';
import { OrderDocument, SavedAddress } from '@/lib/types';
import AuthModal from '@/components/customer/AuthModal';
import FeedbackModal from '@/components/customer/FeedbackModal';
import { getFriendlyErrorMessage } from '@/lib/utils';
import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('@/components/admin/LocationPickerMap'), { ssr: false });

export default function ProfilePage() {
  const router = useRouter();
  const { user, userProfile, activeOrders, setUser, setUserProfile } = useStore();
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const [copied, setCopied] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [feedbackOrder, setFeedbackOrder] = useState<OrderDocument | null>(null);
  const ordersRef = useRef<HTMLDivElement>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [feedbackState, setFeedbackState] = useState<{ [key: string]: { rating: number; comment: string; submitting: boolean } }>({});

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

  useEffect(() => {
    if (userProfile?.user_id) {
      const fetchLedger = async () => {
        try {
          const { db } = await import('@/lib/firebase');
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          
          const q = query(
            collection(db, 'point_ledger'),
            where('user_id', '==', userProfile.user_id)
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
          const active = data.filter(d => d.amount > 0 && d.expires_at > now && !d.is_expired);
          const totalActive = active.reduce((sum, d) => sum + d.amount, 0);
          setActiveBalance(totalActive);
        } catch (err) {
          console.warn("Failed to fetch points ledger from Firestore:", err);
        }
      };
      fetchLedger();
    }
  }, [userProfile?.user_id]);

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
    }
  }, [user]);

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
        title: 'Join Oasis Cafe!',
        text: `Hey! Use my referral code ${userProfile.referral_code} to get extra points when you join Oasis Cafe!`,
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

  const statusColors: Record<string, string> = {
    pending: '#eab308',
    accepted: '#eab308',
    preparing: '#f97316',
    ready: '#22c55e',
    delivered: '#6b7280',
    rejected: '#ef4444',
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
      <div style={{
        padding: '40px 20px 30px',
        background: 'linear-gradient(180deg, rgba(212,163,84,0.1) 0%, rgba(14,11,7,0) 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #c49040, #8a5f1e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--foreground)', fontSize: 32, fontWeight: 700, marginBottom: 16,
          boxShadow: '0 8px 24px rgba(196,144,64,0.3)',
        }}>
          {getInitials()}
        </div>
        <h2 style={{ color: 'var(--foreground)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {user.phone.replace(/(\+\d{2})(\d{4})(\d{6})/, '$1 ****$3')}
        </h2>
        {userProfile.student_email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 13, fontWeight: 500 }}>
            <Check size={14} /> Verified Student
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 12px', textAlign: 'center' }}>
              <Award size={20} color="#d4a354" style={{ margin: '0 auto 8px' }} />
              <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Coins</p>
              <p style={{ color: 'var(--foreground)', fontSize: 18, fontWeight: 700 }}>{activeBalance}</p>
            </div>
          <div 
            onClick={scrollToOrders}
            style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 12px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(212,163,84,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--card)'}
          >
            <Gift size={20} color="#d4a354" style={{ margin: '0 auto 8px' }} />
            <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orders</p>
            <p style={{ color: 'var(--foreground)', fontSize: 18, fontWeight: 700 }}>{orders.length}</p>
          </div>
          <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 12px', textAlign: 'center' }}>
            <Clock size={20} color="#d4a354" style={{ margin: '0 auto 8px' }} />
            <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</p>
            <p style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{memberSince}</p>
          </div>
        </div>

        {/* Rewards Progress */}
        <div 
          onClick={() => setShowPointsHistory(true)}
          style={{ cursor: 'pointer', background: 'rgba(198,139,53,0.05)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}
          className="hover:bg-[rgba(212,163,84,0.08)] transition-colors relative overflow-hidden"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'rgba(212,163,84,0.8)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Oasis Rewards</h3>
            <span className="text-[10px] text-[#d4a354]/60 uppercase tracking-widest font-mono flex items-center gap-1">View Ledger &rarr;</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{activeBalance}</span>
            <span style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 14, paddingBottom: 4 }}>pts</span>
          </div>
          
          <div style={{ background: 'rgba(var(--foreground-rgb), 0.05)', borderRadius: 12, padding: 12, marginBottom: 12, border: '1px dashed var(--border)' }}>
            <p style={{ color: 'rgba(var(--foreground-rgb), 0.8)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Current Tier: <span style={{ color: 'var(--primary)' }}>{(userProfile.total_completed_orders || 0) <= 3 ? "Welcome Multiplier (15%)" : (userProfile.total_completed_orders || 0) <= 5 ? "Transition Phase (10%)" : "Lifetime Elite (8%)"}</span>
            </p>
            <p style={{ color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 11 }}>
              {(userProfile.total_completed_orders || 0) <= 3 ? "You are earning an accelerated 15% back on your first 3 orders!" : (userProfile.total_completed_orders || 0) <= 5 ? "You are earning 10% back on your 4th and 5th orders!" : "You are earning a flat 8% back on every single order for life."}
            </p>
          </div>

          <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '8px 12px', borderRadius: '0 8px 8px 0' }}>
            <p style={{ color: '#fca5a5', fontSize: 11, fontWeight: 500 }}>
              ⚠️ Older coins expire exactly 45 days after you earn them. Use them before they disappear!
            </p>
          </div>
        </div>

        {/* Student Email Verification */}
        {!userProfile.student_email && (
            <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ color: '#4ade80', fontSize: 15, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={18} /> Get Verified Student Badge
              </h3>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 16 }}>
                Verify your student email to unlock exclusive discounts and early access to drops.
              </p>
              
              {verifySuccess ? (
                <div style={{ background: 'rgba(74,222,128,0.1)', padding: 12, borderRadius: 12, color: '#4ade80', fontSize: 13, textAlign: 'center' }}>
                  A verification link has been sent to {verifyStudentEmail}. Please check your inbox and click the link to verify your account.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="email"
                    value={verifyStudentEmail}
                    onChange={e => setVerifyStudentEmail(e.target.value)}
                    placeholder="Student Email (.edu, .ac.in)"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--foreground)', fontSize: 14, outline: 'none' }}
                  />
                  <input
                    type="password"
                    value={verifyPassword}
                    onChange={e => setVerifyPassword(e.target.value)}
                    placeholder="Current Password"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--foreground)', fontSize: 14, outline: 'none' }}
                  />
                  {verifyError && <p style={{ color: '#ef4444', fontSize: 12 }}>{verifyError}</p>}
                  <button
                    onClick={handleVerifyStudentEmail}
                    disabled={verifyingEmail}
                    style={{ background: '#4ade80', color: '#000', border: 'none', padding: 12, borderRadius: 12, fontWeight: 600, cursor: 'pointer', opacity: verifyingEmail ? 0.7 : 1 }}
                  >
                    {verifyingEmail ? 'Sending...' : 'Send Verification Link'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Referral */}
        {userProfile.referral_code && (
          <div>
            <h3 style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Invite & Earn</h3>
            <div style={{ background: 'var(--card)', border: '1px dashed rgba(212,163,84,0.3)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 12, marginBottom: 4 }}>Your Referral Code</p>
                <p style={{ color: 'var(--primary)', fontSize: 18, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{userProfile.referral_code}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleCopyCode} style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(198,139,53,0.08)', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <button onClick={handleShare} style={{ width: 40, height: 40, borderRadius: 10, background: '#d4a354', border: 'none', color: '#1b1208', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Share2 size={18} />
                </button>
              </div>
            </div>
            <p style={{ color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 11, marginTop: 8 }}>Get 50 points when a friend uses your code to sign up!</p>
          </div>
        )}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 600 }}>Saved Coordinates</h3>
            <button onClick={() => setShowAddAddress(!showAddAddress)} style={{ background: 'rgba(198,139,53,0.08)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 12px', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {showAddAddress ? 'Cancel' : '+ Add'}
            </button>
          </div>

          <AnimatePresence>
            {showAddAddress && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {(['Home', 'Hostel', 'Library', 'Classroom', 'Other'] as const).map(lbl => (
                      <button key={lbl} onClick={() => setNewAddrLabel(lbl)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${newAddrLabel === lbl ? 'rgba(212,163,84,0.4)' : 'var(--border)'}`, background: newAddrLabel === lbl ? 'rgba(212,163,84,0.15)' : 'transparent', color: newAddrLabel === lbl ? '#d4a354' : 'var(--muted-foreground)', cursor: 'pointer' }}>{lbl}</button>
                    ))}
                  </div>
                  {newAddrLabel === 'Other' && (
                    <input type="text" placeholder="Custom Label (e.g., GF's Hostel)" value={newCustomLabel} onChange={e => setNewCustomLabel(e.target.value)} style={{ width: '100%', background: 'rgba(var(--foreground-rgb), 0.04)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 8, color: 'var(--foreground)', fontSize: 13, marginBottom: 12, outline: 'none' }} />
                  )}
                  
                  {errorMsg && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{errorMsg}</p>}
                  <button onClick={handleAutoFetchLocation} disabled={gpsLoading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: showGpsSuccess ? 'rgba(16,185,129,0.1)' : 'rgba(212,163,84,0.1)', border: `1px solid ${showGpsSuccess ? 'rgba(16,185,129,0.3)' : 'rgba(212,163,84,0.2)'}`, padding: '12px', borderRadius: 8, color: showGpsSuccess ? '#10b981' : '#d4a354', fontWeight: 600, fontSize: 13, marginBottom: 16, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <MapPin size={16} />
                    {gpsLoading ? 'Fetching GPS Coordinates...' : showGpsSuccess ? 'Location Detected!' : 'Auto Fetch Location (GPS)'}
                  </button>

                  {coordinates && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ color: 'var(--muted-foreground)', fontSize: 11, marginBottom: 8, textAlign: 'center' }}>Drag the map or search to adjust your exact location</p>
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

                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <input type="text" placeholder="Flat / Room No." value={newFlatNo} onChange={e => setNewFlatNo(e.target.value)} style={{ flex: 1, background: 'rgba(var(--foreground-rgb), 0.04)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 8, color: 'var(--foreground)', fontSize: 13, outline: 'none' }} />
                    <input type="text" placeholder="Floor (Optional)" value={newFloor} onChange={e => setNewFloor(e.target.value)} style={{ flex: 1, background: 'rgba(var(--foreground-rgb), 0.04)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 8, color: 'var(--foreground)', fontSize: 13, outline: 'none' }} />
                  </div>
                  <input type="text" placeholder="Area / Building / Campus" value={newArea} onChange={e => setNewArea(e.target.value)} style={{ width: '100%', background: 'rgba(var(--foreground-rgb), 0.04)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 8, color: 'var(--foreground)', fontSize: 13, marginBottom: 12, outline: 'none' }} />
                  <input type="text" placeholder="Landmark (Optional)" value={newLandmark} onChange={e => setNewLandmark(e.target.value)} style={{ width: '100%', background: 'rgba(var(--foreground-rgb), 0.04)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 8, color: 'var(--foreground)', fontSize: 13, marginBottom: 16, outline: 'none' }} />
                  <button onClick={handleSaveNewAddress} style={{ width: '100%', background: '#d4a354', color: '#1b1208', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save Address</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!userProfile.addresses || userProfile.addresses.length === 0 ? (
            <div style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px dashed var(--border)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <MapPin size={24} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 8px' }} />
              <p style={{ color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 12 }}>No saved addresses yet. Save your coordinate during checkout!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {userProfile.addresses.map((addr) => {
                let IconComponent = MapPin;
                if (addr.label === 'Home') IconComponent = Home;
                else if (addr.label === 'Hostel') IconComponent = Building;
                else if (addr.label === 'Library') IconComponent = BookOpen;
                else if (addr.label === 'Classroom') IconComponent = GraduationCap;

                return (
                  <div key={addr.id} style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid rgba(var(--foreground-rgb), 0.05)', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{ background: 'rgba(198,139,53,0.08)', border: '1px solid var(--border)', borderRadius: 10, padding: 8, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconComponent size={16} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'var(--foreground)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{addr.label}</p>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: 12, marginTop: 2, lineHeight: '1.4' }}>{addr.fullAddress}</p>
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
                      style={{ background: 'none', border: 'none', color: 'rgba(var(--foreground-rgb), 0.3)', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
        {activeOrders.length > 0 && (
          <div>
            <h3 style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Active Orders</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeOrders.map(order => (
                <div key={order.order_id} style={{ background: 'linear-gradient(135deg, rgba(var(--foreground-rgb), 0.05), rgba(var(--foreground-rgb), 0.02))', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 11 }}>
                        {order.order_type === 'delivery' ? 'Order ID' : 'Order Token'}
                      </p>
                      <p style={{ color: 'var(--foreground)', fontSize: order.order_type === 'delivery' ? 14 : 18, fontWeight: 700, fontFamily: 'monospace' }}>
                        #{order.order_type === 'delivery' ? order.order_id : order.token_number}
                      </p>
                    </div>
                    <div style={{ background: `${statusColors[order.status] || '#d4a354'}20`, color: statusColors[order.status] || '#d4a354', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                      {order.status}
                    </div>
                  </div>
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>{order.items.length} items • ₹{order.gross_amount}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order History */}
        {orders.length > 0 && (
          <div ref={ordersRef} style={{ scrollMarginTop: '20px' }}>
            <h3 style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Past Orders</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '600px', overflowY: 'auto', paddingRight: 4 }}>
              {orders.map(order => {
                const isExpanded = expandedOrder === order.order_id;
                const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const fs = feedbackState[order.order_id] || { rating: 0, comment: '', submitting: false };
                
                return (
                  <div key={order.order_id} style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid rgba(var(--foreground-rgb), 0.05)', borderRadius: 12, overflow: 'hidden' }}>
                    <div 
                      onClick={() => setExpandedOrder(isExpanded ? null : order.order_id)}
                      style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <div>
                        <p style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 500 }}>{date} • ₹{order.gross_amount}</p>
                        <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 12, marginTop: 4 }}>{order.items.length} items • {order.order_type}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: statusColors[order.status], fontSize: 12, textTransform: 'capitalize' }}>{order.status}</span>
                        {isExpanded ? <ChevronUp size={16} color="rgba(var(--foreground-rgb), 0.4)" /> : <ChevronDown size={16} color="rgba(var(--foreground-rgb), 0.4)" />}
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                            <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(var(--foreground-rgb), 0.05)' }}>
                              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {order.items.map((item, i) => (
                                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'rgba(var(--foreground-rgb), 0.8)' }}>{item.quantity}x {item.name}</span>
                                    <span style={{ color: 'rgba(var(--foreground-rgb), 0.5)' }}>₹{item.unit_price * item.quantity}</span>
                                  </li>
                                ))}
                              </ul>

                              {/* Feedback CTA */}
                              {order.status === 'delivered' && (
                                <div style={{ marginTop: 16 }}>
                                  {order.feedback ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(198,139,53,0.08)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                      {[1,2,3,4,5].map(s => (
                                        <Star key={s} size={14}
                                          fill={s <= order.feedback!.rating ? '#d4a354' : 'transparent'}
                                          color={s <= order.feedback!.rating ? '#d4a354' : 'rgba(255,255,255,0.2)'}
                                          strokeWidth={1.5}
                                        />
                                      ))}
                                      <span style={{ color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 12, marginLeft: 4 }}>Reviewed</span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={e => { e.stopPropagation(); setFeedbackOrder(order); }}
                                      style={{
                                        width: '100%', padding: '10px 0',
                                        borderRadius: 10, border: '1px solid var(--border)',
                                        background: 'rgba(212,163,84,0.07)',
                                        color: 'var(--primary)', fontSize: 13, fontWeight: 600,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                      }}
                                    >
                                      <Star size={14} />
                                      Rate this order
                                    </button>
                                  )}
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
          style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: 16, borderRadius: 12, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            onClick={() => setShowPointsHistory(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ background: 'var(--card)', borderTop: '1px solid rgba(212,163,84,0.2)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f7dec4', fontFamily: 'var(--font-fable-noir), serif' }}>Points Ledger</h2>
                <button onClick={() => setShowPointsHistory(false)} style={{ color: 'rgba(var(--foreground-rgb), 0.5)', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ledgerHistory.length === 0 ? (
                  <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', textAlign: 'center', paddingTop: 20, paddingBottom: 20 }}>No transaction history found.</p>
                ) : (
                  ledgerHistory.map((tx, idx) => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--card)', borderRadius: 12, border: '1px solid rgba(var(--foreground-rgb), 0.05)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 500, textTransform: 'capitalize' }}>{tx.source}</span>
                        <span style={{ color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 11, fontFamily: 'monospace' }}>
                          {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: tx.amount > 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 16 }}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                        <span style={{ color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 10, textTransform: 'uppercase' }}>pts</span>
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
    </div>
  );
}
