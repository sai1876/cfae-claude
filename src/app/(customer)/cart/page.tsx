'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, ArrowRight, Tag, Info, RotateCw, MapPin, CheckCircle2, AlertCircle, X, PartyPopper, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { createOrder, updateUserProfile, fetchOutlets, fetchOffers, fetchMenuItems } from '@/lib/dbService';
import { SavedAddress } from '@/lib/types';

interface CelebrationParticle {
  id: number;
  type: 'confetti' | 'ribbon';
  x: number;
  y: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'svg';
  delay: number;
  duration: number;
  drift: number;
  rotateZ: number;
}

const generateCelebrationParticles = (): CelebrationParticle[] => {
  const colors = [
    '#f59e0b', // Amber/Gold
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#ec4899', // Pink
    '#e11d48', // Crimson Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#d4a354'  // Cafe Gold Accent
  ];

  return Array.from({ length: 60 }).map((_, i) => {
    const isRibbon = i % 4 === 0; // 25% ribbons, 75% normal confetti
    const delay = Math.random() * 0.4;
    const duration = 2.5 + Math.random() * 2;
    const size = isRibbon ? 12 + Math.random() * 16 : 6 + Math.random() * 8;
    const drift = (Math.random() - 0.5) * 150; // horizontal drift amplitude
    const rotateZ = Math.random() * 360;

    return {
      id: i,
      type: isRibbon ? 'ribbon' : 'confetti',
      x: Math.random() * 100, // percentage of viewport width
      y: -20, // start above screen
      color: colors[Math.floor(Math.random() * colors.length)],
      size,
      shape: isRibbon ? 'svg' : (Math.random() > 0.5 ? 'circle' : 'square'),
      delay,
      duration,
      drift,
      rotateZ
    };
  });
};

const CelebrationOverlay = ({ active }: { active: boolean }) => {
  const [particles, setParticles] = useState<CelebrationParticle[]>([]);

  useEffect(() => {
    if (active) {
      setParticles(generateCelebrationParticles());
    } else {
      setParticles([]);
    }
  }, [active]);

  if (!active) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99999, overflow: 'hidden' }}>
      {particles.map((p) => {
        const shapeElement = (() => {
          if (p.type === 'ribbon') {
            return (
              <svg 
                viewBox="0 0 20 60" 
                style={{ 
                  width: p.size, 
                  height: p.size * 3, 
                  color: p.color, 
                  display: 'block' 
                }}
              >
                <path 
                  d="M10,0 C18,10 2,20 10,30 C18,40 2,50 10,60" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                />
              </svg>
            );
          } else if (p.shape === 'circle') {
            return (
              <div 
                style={{ 
                  width: p.size, 
                  height: p.size, 
                  borderRadius: '50%', 
                  backgroundColor: p.color 
                }} 
              />
            );
          } else {
            return (
              <div 
                style={{ 
                  width: p.size, 
                  height: p.size * 1.5, 
                  backgroundColor: p.color 
                }} 
              />
            );
          }
        })();

        return (
          <motion.div
            key={p.id}
            initial={{ 
              x: `${p.x}vw`, 
              y: '-10vh', 
              opacity: 1, 
              rotateZ: p.rotateZ,
              rotateX: 0,
              rotateY: 0
            }}
            animate={{
              y: '115vh',
              x: [
                `${p.x}vw`, 
                `calc(${p.x}vw + ${p.drift * 0.6}px)`, 
                `calc(${p.x}vw - ${p.drift * 0.3}px)`, 
                `calc(${p.x}vw + ${p.drift}px)`
              ],
              rotateZ: p.rotateZ + 720,
              rotateX: [0, 360, 720, 1080],
              rotateY: [0, 540, 1080, 1620],
              opacity: [1, 1, 1, 0]
            }}
            transition={{
              y: { duration: p.duration, ease: 'easeIn', delay: p.delay },
              x: { duration: p.duration, ease: 'easeInOut', delay: p.delay },
              rotateZ: { duration: p.duration, ease: 'linear', delay: p.delay },
              rotateX: { duration: p.duration, ease: 'linear', delay: p.delay },
              rotateY: { duration: p.duration, ease: 'linear', delay: p.delay },
              opacity: { duration: p.duration, ease: 'easeOut', delay: p.delay }
            }}
            style={{
              position: 'absolute',
              pointerEvents: 'none'
            }}
          >
            {shapeElement}
          </motion.div>
        );
      })}
    </div>
  );
};

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, clearCart, user, userProfile, customerOutlet, setCustomerOutlet } = useStore();

  // Toast & Celebration States
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    id: number;
  } | null>(null);

  const [showPromoSuccessModal, setShowPromoSuccessModal] = useState(false);
  const [appliedPromoDetails, setAppliedPromoDetails] = useState<{
    code: string;
    discountPercent: number;
    savedAmount: number;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(prev => prev?.id === id ? null : prev);
    }, 4000);
  };

  
  const [outlets, setOutlets] = useState<any[]>([]);
  const [orderType, setOrderType] = useState<'dine-in' | 'pickup' | 'delivery'>('dine-in');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscountPercent, setPromoDiscountPercent] = useState(0);
  const [promoScope, setPromoScope] = useState<string>('All');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [usePoints, setUsePoints] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeBalance, setActiveBalance] = useState(0);
  const [pointsInput, setPointsInput] = useState('');

  // Dine-in & Pickup states
  const [tableNo, setTableNo] = useState('');
  const [selectedHatch, setSelectedHatch] = useState('');
  const [availableHatches, setAvailableHatches] = useState<string[]>([]);

  // Detailed Address States (for delivery type)
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [flatNo, setFlatNo] = useState('');
  const [floor, setFloor] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Hostel' | 'Library' | 'Classroom' | 'Other'>('Hostel');
  const [customLabel, setCustomLabel] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState('');
  const [showGpsSuccess, setShowGpsSuccess] = useState(false);

  useEffect(() => {
    fetchOutlets().then(setOutlets).catch(console.error);
    fetchMenuItems().then(setMenuItems).catch(console.error);
  }, []);

  useEffect(() => {
    if (userProfile?.user_id) {
      const fetchLedger = async () => {
        try {
          const q = query(
            collection(db, 'point_ledger'),
            where('user_id', '==', userProfile.user_id)
          );
          const snap = await getDocs(q);
          const data: any[] = [];
          snap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.amount > 0 && !d.is_expired) {
              data.push(d);
            }
          });

          const now = new Date().toISOString();
          const active = data.filter((d: any) => d.expires_at > now);
          const totalActive = active.reduce((sum: number, d: any) => sum + d.amount, 0);
          setActiveBalance(totalActive);
        } catch (err) {
          console.error("Failed to fetch ledger from Firestore", err);
        }
      };
      fetchLedger();
    }
  }, [userProfile?.user_id]);

  useEffect(() => {
    if (orderType === 'pickup' && customerOutlet) {
      fetchOutlets().then(outlets => {
        const out = outlets.find(o => o.name === customerOutlet);
        if (out && out.hatches) {
          setAvailableHatches(out.hatches);
          if (out.hatches.length > 0) setSelectedHatch(out.hatches[0]);
        } else {
          setAvailableHatches([]);
        }
      }).catch(console.error);
    }
  }, [orderType, customerOutlet]);

  // Automatically manage address selection when user shifts to delivery
  useEffect(() => {
    if (orderType === 'delivery') {
      if (userProfile?.addresses && userProfile.addresses.length > 0) {
        if (!selectedAddressId) {
          const firstAddr = userProfile.addresses[0];
          setSelectedAddressId(firstAddr.id);
          setDeliveryAddress(firstAddr.fullAddress);
          setIsAddingNewAddress(false);
        }
      } else {
        setIsAddingNewAddress(true);
      }
    }
  }, [orderType, userProfile, selectedAddressId]);

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
            {
              headers: {
                'User-Agent': 'OasisCafeDelivery/1.0'
              }
            }
          );
          
          if (!response.ok) throw new Error("Reverse geocoding failed");
          
          const data = await response.json();
          const addr = data.address || {};
          const street = addr.road || addr.suburb || addr.neighbourhood || addr.pedestrian || "";
          const building = addr.building || addr.amenity || addr.university || addr.college || "";
          
          let detectedArea = street;
          if (building && street) {
            detectedArea = `${building}, ${street}`;
          } else if (building) {
            detectedArea = building;
          }
          
          if (data.display_name && !detectedArea) {
            detectedArea = data.display_name.split(',').slice(0, 2).join(',').trim();
          }
          
          setArea(detectedArea || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          if (addr.suburb || addr.county) {
            setLandmark(addr.suburb || addr.county || "");
          }
          
          setShowGpsSuccess(true);
          setTimeout(() => setShowGpsSuccess(false), 3000);
          
          if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(100);
          }
        } catch (err) {
          console.error("Geocoding failed, falling back to coordinates:", err);
          setArea(`Campus Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setLandmark("GPS Detected Location");
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

  // Totals calculation
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const platformFee = 5;
  
  // Promo Discount Calculation based on category scope
  const promoDiscount = (() => {
    if (!promoApplied) return 0;
    
    if (!promoScope || promoScope.toLowerCase() === 'all') {
      return subtotal * (promoDiscountPercent / 100);
    }
    
    // Calculate scope-specific subtotal
    const scopedSubtotal = cart.reduce((sum, item) => {
      const menuItem = menuItems.find(m => m.item_id === item.menuItemId);
      const category = menuItem?.category || '';
      
      // Case-insensitive match on category scope
      if (category.toLowerCase() === promoScope.toLowerCase()) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
    
    return scopedSubtotal * (promoDiscountPercent / 100);
  })();
  
  const maxRedeemablePoints = Math.floor(subtotal * 0.20);
  const maxCanUse = Math.min(activeBalance, maxRedeemablePoints);
  const pointsRedeemed = Math.min(Number(pointsInput) || 0, maxCanUse);
  const pointsDiscount = pointsRedeemed; // 1 pt = 1 rupee
  
  const total = Math.max(0, subtotal - promoDiscount - pointsDiscount + platformFee);

  const handlePlaceOrder = async () => {
    if (!user) {
      router.push('/profile');
      return;
    }
    if (cart.length === 0) return;

    let compiledAddress = deliveryAddress;
    let activeCoordinates = coordinates;

    if (orderType === 'dine-in' && !tableNo.trim()) {
      triggerToast('Please provide your Table Number for Dine-In.', 'error');
      return;
    }

    if (orderType === 'pickup' && availableHatches.length > 0 && !selectedHatch.trim()) {
      triggerToast('Please select a Pickup Point / Hatch.', 'error');
      return;
    }

    if (orderType === 'delivery') {
      if (isAddingNewAddress) {
        if (!flatNo.trim()) {
          triggerToast('Please provide Flat/House/Hostel & Room number.', 'error');
          return;
        }
        if (!area.trim()) {
          triggerToast('Please provide Street/Area or Campus location.', 'error');
          return;
        }

        const labelText = addressLabel === 'Other' && customLabel.trim() ? customLabel.trim() : addressLabel;
        compiledAddress = `${flatNo}, ${floor.trim() ? floor.trim() + ', ' : ''}${area.trim()}${landmark.trim() ? ' (Landmark: ' + landmark.trim() + ')' : ''}`;

        // Save new address to profile if checked
        if (saveToProfile && userProfile) {
          const newAddress: SavedAddress = {
            id: Math.random().toString(36).substring(7),
            label: labelText,
            flatNo,
            floor,
            area,
            landmark,
            fullAddress: compiledAddress,
            coordinates: coordinates
          };
          const existingAddresses = userProfile.addresses || [];
          const updatedAddresses = [newAddress, ...existingAddresses.slice(0, 4)];

          try {
            await updateUserProfile(user.uid, { addresses: updatedAddresses });
            useStore.setState({ userProfile: { ...userProfile, addresses: updatedAddresses } });
          } catch (e) {
            console.error("Failed to save address: ", e);
          }
        }
      } else {
        // Use selected saved address
        const saved = userProfile?.addresses?.find(a => a.id === selectedAddressId);
        if (saved) {
          compiledAddress = saved.fullAddress;
          activeCoordinates = saved.coordinates;
        } else if (!deliveryAddress.trim()) {
          triggerToast('Please select a saved address or enter a new one.', 'error');
          return;
        }
      }
    }

    setIsPlacingOrder(true);
    try {
      await createOrder(
        user.uid,
        total,
        pointsRedeemed,
        orderType,
        cart.map(c => ({
          menuItemId: c.menuItemId,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          station: c.station,
          modifiers: c.modifiers
        })),
        orderType === 'pickup' ? selectedHatch : undefined,
        orderType === 'dine-in' ? tableNo : undefined,
        customerOutlet,
        orderType === 'delivery' ? compiledAddress : undefined,
        orderType === 'delivery' ? activeCoordinates : undefined
      );
      
      clearCart();
      setSuccess(true);
      
      // Reset address inputs
      setFlatNo('');
      setFloor('');
      setArea('');
      setLandmark('');
      setCustomLabel('');
      setCoordinates(undefined);
      setSelectedAddressId(null);

      setTimeout(() => {
        router.push('/profile');
      }, 2000);
    } catch (e) {
      console.error(e);
      triggerToast("Failed to place order. Please try again.", "error");
      setIsPlacingOrder(false);
    }
  };

  const getPromoDiscountAmountForOffer = (discountPercent: number, scope: string) => {
    if (!scope || scope.toLowerCase() === 'all') {
      return subtotal * (discountPercent / 100);
    }
    const scopedSubtotal = cart.reduce((sum, item) => {
      const menuItem = menuItems.find(m => m.item_id === item.menuItemId);
      const category = menuItem?.category || '';
      if (category.toLowerCase() === scope.toLowerCase()) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
    return scopedSubtotal * (discountPercent / 100);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const allOffers = await fetchOffers();
      const matched = allOffers.find(o => o.code.toUpperCase() === promoCode.toUpperCase() && o.isActive);
      
      if (matched) {
        const today = new Date().toISOString().split('T')[0];
        if (matched.expiryDate < today) {
          triggerToast("This promo code has expired!", "error");
          setPromoApplied(false);
          setPromoDiscountPercent(0);
          setPromoScope('All');
          return;
        }
        
        const saved = getPromoDiscountAmountForOffer(matched.discountPercent, matched.categoryScope || 'All');
        setPromoDiscountPercent(matched.discountPercent);
        setPromoScope(matched.categoryScope || 'All');
        setPromoApplied(true);
        setAppliedPromoDetails({
          code: matched.code,
          discountPercent: matched.discountPercent,
          savedAmount: saved
        });
        setShowPromoSuccessModal(true);
        setShowConfetti(true);
      } else {
        // Fallback standard code if DB is empty
        if (promoCode.toUpperCase() === 'OASIS10') {
          const saved = getPromoDiscountAmountForOffer(10, 'All');
          setPromoDiscountPercent(10);
          setPromoScope('All');
          setPromoApplied(true);
          setAppliedPromoDetails({
            code: 'OASIS10',
            discountPercent: 10,
            savedAmount: saved
          });
          setShowPromoSuccessModal(true);
          setShowConfetti(true);
        } else if (promoCode.toUpperCase() === 'STRESS_FREE_10') {
          const saved = getPromoDiscountAmountForOffer(10, 'All');
          setPromoDiscountPercent(10);
          setPromoScope('All');
          setPromoApplied(true);
          setAppliedPromoDetails({
            code: 'STRESS_FREE_10',
            discountPercent: 10,
            savedAmount: saved
          });
          setShowPromoSuccessModal(true);
          setShowConfetti(true);
        } else {
          triggerToast("Invalid or inactive promo code.", "error");
          setPromoApplied(false);
          setPromoDiscountPercent(0);
          setPromoScope('All');
        }
      }
    } catch (err) {
      console.error("Failed to apply promo code dynamically:", err);
      triggerToast("Error validating promo code. Trying offline fallback...", "info");
      if (promoCode.toUpperCase() === 'OASIS10' || promoCode.toUpperCase() === 'STRESS_FREE_10') {
        const saved = getPromoDiscountAmountForOffer(10, 'All');
        setPromoDiscountPercent(10);
        setPromoScope('All');
        setPromoApplied(true);
        setAppliedPromoDetails({
          code: promoCode.toUpperCase(),
          discountPercent: 10,
          savedAmount: saved
        });
        setShowPromoSuccessModal(true);
        setShowConfetti(true);
      } else {
        setPromoApplied(false);
        setPromoDiscountPercent(0);
        setPromoScope('All');
      }
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#4ade80,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 10px 40px rgba(74,222,128,0.3)' }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </motion.div>
        <h2 style={{ color: 'var(--foreground)', fontSize: 24, fontWeight: 700, marginBottom: 10 }}>Order Placed!</h2>
        <p style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>Your order is being sent to the kitchen.</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', paddingTop: '30vh' }}>
        <span style={{ fontSize: 70, marginBottom: 20 }}>🥣</span>
        <h2 style={{ color: 'var(--foreground)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Cart's lonely yaar!</h2>
        <p style={{ color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 14, marginBottom: 30 }}>Add some delicious food to make it happy.</p>
        <button
          onClick={() => router.push('/menu')}
          style={{ background: '#d4a354', color: '#1b1208', border: 'none', padding: '12px 24px', borderRadius: 24, fontWeight: 700, cursor: 'pointer' }}
        >
          Explore Menu
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(212,163,84,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'var(--foreground)', fontSize: 24, fontWeight: 700, margin: 0 }}>Your Order</h1>
          <p style={{ color: 'var(--primary)', fontSize: 12, margin: '2px 0 0' }}>{cart.reduce((s,i) => s + i.quantity, 0)} items</p>
        </div>
        
        {/* Dynamic Outlet Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,98,26,0.08)', border: '1px solid rgba(232,98,26,0.2)', borderRadius: 16, padding: '6px 12px' }}>
          <MapPin size={12} color="#e8621a" />
          <select 
            value={customerOutlet} 
            onChange={(e) => setCustomerOutlet(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#e8621a',
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              outline: 'none',
              cursor: 'pointer',
              paddingRight: 4
            }}
          >
            <option value="HYD CAMPUS" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>HYD CAMPUS</option>
            {outlets.map(o => (
              o.name !== 'HYD CAMPUS' && (
                <option key={o.id} value={o.name} style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
                  {o.name.toUpperCase()}
                </option>
              )
            ))}
          </select>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Order Type Toggle */}
        <div style={{ display: 'flex', background: 'rgba(var(--foreground-rgb), 0.04)', borderRadius: 12, padding: 4, marginBottom: 24, border: '1px solid var(--border)' }}>
          {(['dine-in', 'pickup', 'delivery'] as const).map(type => {
            const isSelected = orderType === type;
            return (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                  border: 'none', background: isSelected ? 'rgba(212,163,84,0.15)' : 'transparent',
                  color: isSelected ? '#d4a354' : 'var(--muted-foreground)',
                  fontWeight: isSelected ? 600 : 400, textTransform: 'capitalize', fontSize: 13,
                }}
              >
                {type}
              </button>
            );
          })}
          </div>

          {/* Pickup Hatch Selection */}
          {orderType === 'pickup' && availableHatches.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
              <h3 style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600, margin: '0 0 12px 0' }}>Select Pickup Point</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {availableHatches.map(hatch => (
                  <label key={hatch} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: selectedHatch === hatch ? 'rgba(212,163,84,0.1)' : 'rgba(var(--foreground-rgb), 0.02)', border: `1px solid ${selectedHatch === hatch ? 'rgba(212,163,84,0.4)' : 'rgba(var(--foreground-rgb), 0.05)'}`, borderRadius: 12, cursor: 'pointer' }}>
                    <input type="radio" name="hatch" value={hatch} checked={selectedHatch === hatch} onChange={() => setSelectedHatch(hatch)} style={{ accentColor: '#d4a354' }} />
                    <span style={{ color: selectedHatch === hatch ? '#d4a354' : '#fff', fontSize: 13, fontWeight: selectedHatch === hatch ? 600 : 400 }}>{hatch}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Dine-in Table Number */}
          {orderType === 'dine-in' && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
              <h3 style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600, margin: '0 0 12px 0' }}>Table Number</h3>
              <input
                type="text"
                placeholder="e.g. T-12 or 4"
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                style={{ width: '100%', background: 'rgba(var(--foreground-rgb), 0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
          )}

          {/* Delivery Address Form */}
        {orderType === 'delivery' && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600, margin: 0 }}>Delivery Address</h3>
              {errorMsg && <span style={{ color: '#ef4444', fontSize: 11 }}>⚠️ {errorMsg}</span>}
            </div>
            
            {/* Saved Addresses List (if available and user is authenticated) */}
            {user && userProfile?.addresses && userProfile.addresses.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>Saved Coordinates</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {userProfile.addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id && !isAddingNewAddress;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          setDeliveryAddress(addr.fullAddress);
                          setIsAddingNewAddress(false);
                          setErrorMsg('');
                        }}
                        style={{
                          padding: 12, borderRadius: 12, border: `1px solid ${isSelected ? '#d4a354' : 'var(--border)'}`,
                          background: isSelected ? 'rgba(212,163,84,0.08)' : 'rgba(var(--foreground-rgb), 0.01)',
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: 10 }}>
                          <p style={{ color: isSelected ? '#d4a354' : '#fff', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'monospace' }}>{addr.label}</p>
                          <p style={{ color: 'var(--muted-foreground)', fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>{addr.fullAddress}</p>
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!userProfile?.addresses) return;
                            const filtered = userProfile.addresses.filter(a => a.id !== addr.id);
                            try {
                              await updateUserProfile(user.uid, { addresses: filtered });
                              useStore.setState({ userProfile: { ...userProfile, addresses: filtered } });
                              if (selectedAddressId === addr.id) {
                                setSelectedAddressId(null);
                                setDeliveryAddress('');
                                setIsAddingNewAddress(true);
                              }
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          style={{ background: 'none', border: 'none', color: 'rgba(var(--foreground-rgb), 0.3)', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => {
                      setIsAddingNewAddress(true);
                      setSelectedAddressId(null);
                    }}
                    style={{
                      background: isAddingNewAddress ? 'rgba(212,163,84,0.05)' : 'none',
                      border: `1px dashed ${isAddingNewAddress ? '#d4a354' : 'var(--border)'}`,
                      color: isAddingNewAddress ? '#d4a354' : 'var(--muted-foreground)',
                      padding: 10, borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'monospace'
                    }}
                  >
                    + Enter New Delivery Location
                  </button>
                </div>
              </div>
            )}

            {/* Address input form */}
            {(!user || !userProfile?.addresses || userProfile.addresses.length === 0 || isAddingNewAddress) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Form Header with Back to Saved Option */}
                {user && userProfile?.addresses && userProfile.addresses.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--primary)', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 700 }}>New Location</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewAddress(false);
                        if (userProfile.addresses && userProfile.addresses.length > 0) {
                          const first = userProfile.addresses[0];
                          setSelectedAddressId(first.id);
                          setDeliveryAddress(first.fullAddress);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'rgba(var(--foreground-rgb), 0.4)', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    >
                      ← Use Saved Addresses
                    </button>
                  </div>
                )}

                {/* GPS Auto fetch button */}
                <button
                  type="button"
                  onClick={handleAutoFetchLocation}
                  disabled={gpsLoading}
                  style={{
                    width: '100%', background: 'rgba(198,139,53,0.05)', border: '1px solid var(--border)',
                    color: 'var(--primary)', padding: '10px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <RotateCw size={12} className={gpsLoading ? "animate-spin" : ""} />
                  {gpsLoading ? "Acquiring Coordinates..." : "Auto-Fetch Current Location"}
                </button>

                {/* GPS Success Banner */}
                <AnimatePresence>
                  {showGpsSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)',
                        borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        color: '#4ade80', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', overflow: 'hidden'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>Coordinates Secured Successfully</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Flat / Room No */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 10, textTransform: 'uppercase', fontFamily: 'monospace' }}>Flat / Hostel & Room *</label>
                  <input
                    type="text"
                    value={flatNo}
                    onChange={(e) => setFlatNo(e.target.value)}
                    placeholder="e.g. Room 302, Hostel 5"
                    style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: 'var(--foreground)', outline: 'none', fontSize: 12 }}
                  />
                </div>

                {/* Floor / Wing */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 10, textTransform: 'uppercase', fontFamily: 'monospace' }}>Floor / Wing (Optional)</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. 3rd Floor"
                    style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: 'var(--foreground)', outline: 'none', fontSize: 12 }}
                  />
                </div>

                {/* Landmark */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 10, textTransform: 'uppercase', fontFamily: 'monospace' }}>Nearby Landmark (Optional)</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Near Mess Gate"
                    style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: 'var(--foreground)', outline: 'none', fontSize: 12 }}
                  />
                </div>

                {/* Campus Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 10, textTransform: 'uppercase', fontFamily: 'monospace' }}>Campus Area / Location *</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. IIT Campus, Library Lawn"
                    style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: 'var(--foreground)', outline: 'none', fontSize: 12 }}
                  />
                </div>

                {/* Labels Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <label style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 10, textTransform: 'uppercase', fontFamily: 'monospace' }}>Address Type / Label</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(['Hostel', 'Library', 'Classroom', 'Home', 'Other'] as const).map((lbl) => {
                      const isSelected = addressLabel === lbl;
                      return (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddressLabel(lbl)}
                          style={{
                            background: isSelected ? '#d4a354' : 'rgba(var(--foreground-rgb), 0.04)',
                            border: `1px solid ${isSelected ? '#d4a354' : 'var(--border)'}`,
                            color: isSelected ? '#1b1208' : 'var(--muted-foreground)',
                            padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'monospace'
                          }}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>

                  {addressLabel === 'Other' && (
                    <input
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Enter custom label e.g., Labs"
                      maxLength={15}
                      style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, color: 'var(--foreground)', outline: 'none', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', marginTop: 4 }}
                    />
                  )}
                </div>

                {/* Save checkbox (only visible if logged in) */}
                {user && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 11, cursor: 'pointer', userSelect: 'none', marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={saveToProfile}
                      onChange={(e) => setSaveToProfile(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: '#d4a354' }}
                    />
                    <span>Save this coordinate for future orders</span>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cart Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {cart.map(item => {
            const menuItem = menuItems.find(m => m.item_id === item.menuItemId);
            const category = menuItem?.category || '';
            const isDiscounted = promoApplied && (
              !promoScope || 
              promoScope.toLowerCase() === 'all' || 
              category.toLowerCase() === promoScope.toLowerCase()
            );
            const itemOriginalPrice = item.price * item.quantity;
            const itemDiscountedPrice = itemOriginalPrice * (1 - promoDiscountPercent / 100);

            return (
              <div key={item.id} style={{ background: 'rgba(var(--foreground-rgb), 0.02)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{item.name}</h3>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {item.modifiers.map(m => (
                          <span key={m} style={{ background: 'rgba(198,139,53,0.08)', color: 'rgba(212,163,84,0.8)', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{m}</span>
                        ))}
                      </div>
                    )}
                    <p style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
                      {isDiscounted ? (
                        <>
                          <span style={{ color: 'rgba(var(--foreground-rgb), 0.4)', textDecoration: 'line-through' }}>₹{itemOriginalPrice}</span>
                          <span style={{ color: '#4ade80' }}>₹{itemDiscountedPrice.toFixed(2)}</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--primary)' }}>₹{itemOriginalPrice}</span>
                      )}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'rgba(var(--foreground-rgb), 0.3)', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(var(--foreground-rgb), 0.04)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 8px' }}>
                      <button onClick={() => updateQuantity(item.id, -1)} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer', padding: 2 }}><Minus size={14} /></button>
                      <span style={{ color: 'var(--foreground)', fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer', padding: 2 }}><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Promo Code */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Tag size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(212,163,84,0.5)' }} />
            <input
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(false); }}
              placeholder="Have a promo code?"
              style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 12px 12px 36px', color: 'var(--foreground)', outline: 'none', textTransform: 'uppercase', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={handleApplyPromo}
            style={{ background: promoApplied ? 'rgba(74,222,128,0.15)' : 'rgba(212,163,84,0.15)', border: promoApplied ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(212,163,84,0.3)', color: promoApplied ? '#4ade80' : '#d4a354', borderRadius: 12, padding: '0 20px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {promoApplied ? 'Applied' : 'Apply'}
          </button>
        </div>

        {/* Points Redemption */}
        {userProfile && activeBalance > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(198,139,53,0.05)', border: '1px dashed var(--primary)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🪙</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600 }}>Use Active Coins</p>
                <p style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>Active Balance: {activeBalance} pts | Max usable: {maxRedeemablePoints} pts</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min="0"
                max={maxCanUse}
                value={pointsInput}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = 0;
                  if (val > maxCanUse) val = maxCanUse;
                  setPointsInput(val > 0 ? val.toString() : '');
                }}
                placeholder="Enter points to redeem"
                style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--foreground)', outline: 'none' }}
              />
              <button
                onClick={() => setPointsInput(maxCanUse.toString())}
                style={{ background: 'rgba(198,139,53,0.08)', border: '1px solid var(--border)', color: 'var(--primary)', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Max
              </button>
            </div>
            <p style={{ color: 'var(--primary)', fontSize: 11 }}>* You can cover a maximum of 20% of your gross order value with coins.</p>
          </div>
        )}

        {/* Bill Summary */}
        <div style={{ background: 'rgba(var(--foreground-rgb), 0.02)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <h3 style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Bill Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', fontSize: 13 }}>
              <span>Gross Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            {promoDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80', fontSize: 13 }}>
                <span>Promo Discount</span>
                <span>-₹{promoDiscount.toFixed(2)}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontSize: 13 }}>
                <span>Wallet Discount Applied (Max 20%)</span>
                <span>-₹{pointsDiscount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Platform Fee <Info size={12} /></span>
              <span>₹{platformFee}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--foreground)', fontSize: 16, fontWeight: 700 }}>
              <span>Final Net Payable (80% min)</span>
              <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 18 }}>₹{Math.round(total)}</span>
            </div>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          onClick={handlePlaceOrder}
          disabled={isPlacingOrder}
          style={{
            width: '100%', background: 'linear-gradient(135deg,#e2a855,#a26b1f)', border: 'none',
            color: 'var(--foreground)', padding: 16, borderRadius: 16, fontSize: 16, fontWeight: 700,
            cursor: isPlacingOrder ? 'wait' : 'pointer', opacity: isPlacingOrder ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 8px 24px rgba(196,144,64,0.25)',
          }}
        >
          {isPlacingOrder ? 'Placing Order...' : user ? 'Place Order' : 'Login to Continue'} <ArrowRight size={18} />
        </button>
      </div>

      {/* Celebration Confetti and Ribbons Overlay */}
      <CelebrationOverlay active={showConfetti} />

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
              background: 'rgba(var(--background-rgb), 0.92)',
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
            <div style={{ flex: 1, color: 'var(--foreground)', fontSize: '13.5px', fontWeight: 500, lineHeight: 1.4 }}>
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(var(--foreground-rgb), 0.4)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--border)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'rgba(var(--foreground-rgb), 0.4)';
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration Promo Success Modal */}
      <AnimatePresence>
        {showPromoSuccessModal && appliedPromoDetails && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(var(--background-rgb), 0.82)',
              backdropFilter: 'blur(10px)',
              zIndex: 99998,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              pointerEvents: 'auto'
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              style={{
                width: '100%',
                maxWidth: '360px',
                background: 'linear-gradient(135deg, #d4a354, #8a5f1e, #d4a354)',
                padding: '1.5px', // simulated border
                borderRadius: '24px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(212, 163, 84, 0.25)',
                position: 'relative',
                pointerEvents: 'auto'
              }}
            >
              <div
                style={{
                  background: 'var(--card)',
                  borderRadius: '22px',
                  padding: '36px 24px 28px',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Twinkling Gold Sparkles */}
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'absolute', top: 24, left: 30, color: 'var(--primary)', opacity: 0.7 }}
                >
                  <Sparkles size={16} />
                </motion.div>
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  style={{ position: 'absolute', bottom: 110, right: 24, color: 'var(--primary)', opacity: 0.7 }}
                >
                  <Sparkles size={14} />
                </motion.div>

                {/* Rotating Dotted Ring + Checkmark */}
                <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto 24px' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, ease: 'linear', repeat: Infinity }}
                    style={{
                      position: 'absolute',
                      inset: -4,
                      borderRadius: '50%',
                      border: '1.5px dashed rgba(16, 185, 129, 0.65)',
                      pointerEvents: 'none'
                    }}
                  />
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(16, 185, 129, 0.04))',
                      border: '2.5px solid #10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <CheckCircle2 size={40} color="#10b981" />
                  </div>
                </div>

                {/* Modal Info */}
                <span 
                  style={{ 
                    display: 'inline-block',
                    backgroundColor: 'rgba(212, 163, 84, 0.1)',
                    border: '1px solid rgba(212, 163, 84, 0.25)',
                    color: 'var(--primary)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    marginBottom: 14,
                    letterSpacing: '0.08em'
                  }}
                >
                  Coupon Applied
                </span>

                <h3 style={{ color: 'var(--foreground)', fontSize: '21px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                  Code <span style={{ color: 'var(--primary)' }}>'{appliedPromoDetails.code}'</span>
                </h3>
                
                <p style={{ color: 'var(--muted-foreground)', fontSize: '13.5px', margin: '0 0 28px 0', fontWeight: 400 }}>
                  Congratulations! You unlocked {appliedPromoDetails.discountPercent}% OFF.
                </p>

                {/* Large Savings Callout */}
                <motion.div
                  initial={{ scale: 0.98 }}
                  animate={{ scale: 1 }}
                  transition={{
                    repeat: Infinity,
                    repeatType: 'reverse',
                    duration: 1.5,
                    ease: 'easeInOut'
                  }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.02))',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '18px',
                    padding: '18px 20px',
                    marginBottom: 28,
                    boxShadow: 'inset 0 0 15px rgba(16, 185, 129, 0.05), 0 0 15px rgba(16, 185, 129, 0.1)'
                  }}
                >
                  <p style={{ color: 'rgba(16, 185, 129, 0.85)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 4px 0' }}>
                    Total Savings
                  </p>
                  <p 
                    style={{ 
                      color: '#10b981', 
                      fontSize: '30px', 
                      fontWeight: 800, 
                      fontFamily: 'monospace', 
                      margin: 0,
                      textShadow: '0 0 15px rgba(16, 185, 129, 0.55)'
                    }}
                  >
                    ₹{appliedPromoDetails.savedAmount.toFixed(2)}
                  </p>
                </motion.div>

                {/* Action Button */}
                <button
                  onClick={() => {
                    setShowPromoSuccessModal(false);
                    setShowConfetti(false);
                  }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #d4a354, #8a5f1e)',
                    border: 'none',
                    color: 'var(--foreground)',
                    padding: '15px 20px',
                    borderRadius: '16px',
                    fontSize: '14.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(196, 144, 64, 0.35)',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Woohoo! Thanks
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
