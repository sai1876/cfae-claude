'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, ChevronUp, ChevronDown, Minus, Plus, X, MapPin, Coffee, Percent, Compass, 
  ShieldAlert, Navigation, Home, Building, BookOpen, GraduationCap, RotateCw, Check, Trash2, PlusCircle
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { createOrder, updateUserProfile, streamUIConfig } from '@/lib/dbService';
import { getCalendarEventConfig } from '@/lib/calendarEvents';
import { UIConfig } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AuthModal from './AuthModal';
import { SavedAddress } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';

export default function CartSheet({ showTrigger = true }: { showTrigger?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const isCartPage = pathname === '/cart';

  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  // Checkout States
  const [orderType, setOrderType] = useState<'dine-in' | 'pickup' | 'delivery'>('pickup');
  const [selectedHatch, setSelectedHatch] = useState<'OASIS' | 'SMOKING' | 'CANOPY'>('OASIS');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Detailed Address States
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
  const [showGpsSuccess, setShowGpsSuccess] = useState(false);
  const [uiConfig, setUiConfig] = useState<UIConfig | null>(null);

  useEffect(() => {
    const unsubscribe = streamUIConfig((config) => {
      setUiConfig(config);
    });
    return () => unsubscribe();
  }, []);

  const { user, userProfile, setUserProfile, cart, removeFromCart, updateQuantity, clearCart, customerOutlet } = useStore();

  const [activePoints, setActivePoints] = useState(0);

  useEffect(() => {
    if (user?.uid && isOpen) {
      const fetchPoints = async () => {
        try {
          const q = query(
            collection(db, 'point_ledger'),
            where('user_id', '==', user.uid)
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
          const active = data.filter((entry: any) => entry.expires_at > now);
          const total = active.reduce((sum, entry) => sum + entry.amount, 0);
          setActivePoints(total);
        } catch (err) {
          console.warn("Failed to fetch points from Firestore:", err);
        }
      };
      fetchPoints();
    }
  }, [user?.uid, isOpen]);

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

  const activeDate = uiConfig?.mock_date ? new Date(uiConfig.mock_date) : new Date();
  const calendarEvent = uiConfig?.auto_calendar_mode ? getCalendarEventConfig(activeDate) : null;
  const activeCampaignDiscount = calendarEvent?.automatic_discount;

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotalAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Automatic Campaign Occasion Discount
  const discountPercent = activeCampaignDiscount?.discount_percent || 0;
  const campaignDiscountAmount = Math.floor(subtotalAmount * (discountPercent / 100));

  // Loyalty calculations: Cap redemption at 20% of the remaining amount
  const availablePoints = activePoints;
  const maxRedeemableValue = Math.floor((subtotalAmount - campaignDiscountAmount) * 0.20);
  const pointsToRedeem = redeemPoints ? Math.min(availablePoints, maxRedeemableValue) : 0;
  const finalAmount = Math.max(0, subtotalAmount - campaignDiscountAmount - pointsToRedeem);

  if (totalItems === 0) return null;

  const handleAutoFetchLocation = () => {
    if (!navigator.geolocation) {
      setOrderError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    setOrderError("");

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
        setOrderError("Unable to retrieve GPS coordinates. Please enter manually.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    let compiledAddress = deliveryAddress;
    let activeCoordinates = coordinates;

    if (orderType === 'delivery') {
      if (isAddingNewAddress) {
        if (!flatNo.trim()) {
          setOrderError('Please provide Flat/House/Hostel & Room number.');
          return;
        }
        if (!area.trim()) {
          setOrderError('Please provide Street/Area or Campus location.');
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
            setUserProfile({ ...userProfile, addresses: updatedAddresses });
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
          setOrderError('Please select a saved address or enter a new one');
          return;
        }
      }
    }

    setIsPlacingOrder(true);
    setOrderError('');

    try {
      await createOrder(
        user.uid,
        subtotalAmount - campaignDiscountAmount,
        pointsToRedeem,
        orderType,
        cart,
        selectedHatch, // Local collection hatch
        undefined, // tableNo
        customerOutlet, // Global outlet branch for telemetry (outlet)
        orderType === 'delivery' ? compiledAddress : undefined,
        orderType === 'delivery' ? activeCoordinates : undefined
      );

      // Successfully checked out!
      clearCart();
      setIsOpen(false);
      setRedeemPoints(false);
      setDeliveryAddress('');
      
      // Clear form inputs
      setFlatNo('');
      setFloor('');
      setArea('');
      setLandmark('');
      setCustomLabel('');
      setCoordinates(undefined);
      setSelectedAddressId(null);

      // Play success tactile feel if supported
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([100, 50, 100, 50, 150]);
      }
    } catch (error) {
      console.error('Checkout failed: ', error);
      setOrderError('Order submission failed. Please check connection and try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleAuthSuccess = () => {
    // Re-check order submission on successful auth
    setTimeout(() => {
      handlePlaceOrder();
    }, 500);
  };

  return (
    <>
      <AnimatePresence>
        {/* Floating Mini Cart Trigger */}
        {!isOpen && showTrigger && cart.length > 0 && !isCartPage && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={() => router.push('/cart')}
            className="fixed bottom-20 left-4 right-4 z-40 bg-hauhau-surface-container-highest shadow-[0_12px_40px_rgba(0,0,0,0.7)] rounded-2xl p-4 flex items-center justify-between cursor-pointer border border-hauhau-gold/20"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="text-hauhau-gold" size={24} />
                <span className="absolute -top-2 -right-2 bg-hauhau-gold text-hauhau-surface text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              </div>
              <div>
                <p className="text-hauhau-on-surface-variant font-medium text-xs font-mono tracking-wider uppercase">Your Escape Basket</p>
                <p className="text-hauhau-gold font-bold text-sm">₹{subtotalAmount}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-hauhau-gold font-mono text-xs uppercase tracking-widest bg-hauhau-gold/10 px-3 py-1.5 rounded-full border border-hauhau-gold/20">
              Review & Pay
              <ChevronUp size={16} />
            </div>
          </motion.div>
        )}

        {/* Expanded Sheet */}
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-hauhau-surface rounded-t-[32px] border-t border-hauhau-outline-variant shadow-[0_-15px_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[92vh] max-w-[650px] mx-auto overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-hauhau-outline-variant/30">
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-hauhau-gold mb-1 block">Checkout Panel</span>
                  <h2 className="font-serif italic text-2xl text-hauhau-cream">Your Order Basket</h2>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 bg-hauhau-surface-bright rounded-full text-hauhau-on-surface-variant hover:text-hauhau-cream transition-colors"
                >
                  <ChevronDown size={20} />
                </button>
              </div>

              {/* Error Banner */}
              {orderError && (
                <div className="mx-6 mt-4 p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs font-mono flex items-center gap-2">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              {/* Main Content Area (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
                
                {/* Items List */}
                <div className="space-y-3">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-hauhau-on-surface-variant">Selected Items</h4>
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-start justify-between bg-hauhau-surface-bright/20 p-4 rounded-2xl border border-hauhau-outline-variant/10">
                        <div className="flex-1 pr-4">
                          <h4 className="font-medium text-hauhau-cream text-sm leading-snug">{item.name}</h4>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.modifiers.map((mod) => (
                                <span key={mod} className="text-[9px] font-mono bg-hauhau-surface-bright/70 text-hauhau-on-surface-variant px-2 py-0.5 rounded border border-hauhau-outline-variant/10">
                                  {mod}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-hauhau-gold font-bold text-xs mt-2 font-mono">₹{item.price}</p>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-hauhau-surface-container rounded-full px-2.5 py-1.5 border border-hauhau-outline-variant/10 shrink-0">
                          <button 
                            onClick={() => item.quantity > 1 ? updateQuantity(item.id, -1) : removeFromCart(item.id)}
                            className="p-1 text-hauhau-on-surface-variant hover:text-hauhau-gold transition-colors"
                          >
                            {item.quantity === 1 ? <X size={12} /> : <Minus size={12} />}
                          </button>
                          <span className="text-hauhau-cream font-mono font-bold text-sm w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 text-hauhau-on-surface-variant hover:text-hauhau-gold transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Authenticated Checkout Options */}
                {user ? (
                  <>
                    {/* Step 1: Order Type */}
                    <div className="space-y-3">
                      <h4 className="font-mono text-xs uppercase tracking-widest text-hauhau-on-surface-variant">Handoff Preference</h4>
                      <div className="grid grid-cols-3 gap-2 bg-hauhau-surface-container/60 p-1.5 rounded-2xl border border-hauhau-outline-variant/20">
                        {(['dine-in', 'pickup', 'delivery'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className={`py-3 px-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all ${
                              orderType === type
                                ? 'bg-hauhau-gold text-hauhau-surface shadow-md'
                                : 'text-hauhau-on-surface-variant hover:text-hauhau-cream'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 2: Location Settings based on Order Type */}
                    <div className="space-y-3">
                      <h4 className="font-mono text-xs uppercase tracking-widest text-hauhau-on-surface-variant">
                        {orderType === 'delivery' ? 'Delivery Destination' : 'Handoff Station'}
                      </h4>

                      {orderType === 'delivery' ? (
                        <div className="space-y-4">
                          {/* Saved Addresses List (if available and user is authenticated) */}
                          {user && userProfile?.addresses && userProfile.addresses.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-mono tracking-widest uppercase text-hauhau-on-surface-variant/70 block">
                                Saved Coordinates
                              </span>
                              <div className="grid grid-cols-1 gap-2.5">
                                {userProfile.addresses.map((addr) => {
                                  // Pick icon based on label
                                  let IconComponent = MapPin;
                                  if (addr.label === 'Home') IconComponent = Home;
                                  else if (addr.label === 'Hostel') IconComponent = Building;
                                  else if (addr.label === 'Library') IconComponent = BookOpen;
                                  else if (addr.label === 'Classroom') IconComponent = GraduationCap;

                                  const isSelected = selectedAddressId === addr.id && !isAddingNewAddress;

                                  return (
                                    <div
                                      key={addr.id}
                                      onClick={() => {
                                        setSelectedAddressId(addr.id);
                                        setDeliveryAddress(addr.fullAddress);
                                        setIsAddingNewAddress(false);
                                        setOrderError('');
                                      }}
                                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3.5 group relative ${
                                        isSelected
                                          ? 'bg-hauhau-gold/15 border-hauhau-gold shadow-[0_0_15px_rgba(248,188,81,0.1)]'
                                          : 'bg-hauhau-surface-bright/20 border-hauhau-outline-variant/15 text-hauhau-on-surface-variant hover:border-hauhau-outline-variant/40 hover:text-hauhau-cream'
                                      }`}
                                    >
                                      <div className={`p-2.5 rounded-xl shrink-0 ${
                                        isSelected ? 'bg-hauhau-gold text-hauhau-surface' : 'bg-hauhau-surface-container text-hauhau-gold border border-hauhau-outline-variant/10'
                                      }`}>
                                        <IconComponent size={16} />
                                      </div>
                                      <div className="flex-1 pr-6">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-xs uppercase font-mono tracking-wider text-hauhau-cream">{addr.label}</span>
                                          {isSelected && (
                                            <span className="text-[9px] font-mono px-2 py-0.5 bg-hauhau-gold/20 text-hauhau-gold rounded-full border border-hauhau-gold/30">
                                              Selected
                                            </span>
                                          )}
                                        </div>
                                        <p className={`text-xs mt-1 leading-relaxed ${isSelected ? 'text-hauhau-cream/90' : 'text-hauhau-on-surface-variant/85 group-hover:text-hauhau-on-surface-variant'}`}>
                                          {addr.fullAddress}
                                        </p>
                                      </div>
                                      
                                      {/* Delete button */}
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (!userProfile?.addresses) return;
                                          const filtered = userProfile.addresses.filter(a => a.id !== addr.id);
                                          try {
                                            await updateUserProfile(user.uid, { addresses: filtered });
                                            setUserProfile({ ...userProfile, addresses: filtered });
                                            if (selectedAddressId === addr.id) {
                                              setSelectedAddressId(null);
                                              setDeliveryAddress('');
                                              setIsAddingNewAddress(true);
                                            }
                                          } catch (err) {
                                            console.error("Failed to delete saved address: ", err);
                                          }
                                        }}
                                        className="absolute right-3 top-3 p-1.5 bg-black/40 hover:bg-red-950/60 text-hauhau-on-surface-variant hover:text-red-400 rounded-lg transition-all border border-hauhau-outline-variant/10 hover:border-red-500/20 opacity-0 group-hover:opacity-100"
                                        title="Delete saved address"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAddingNewAddress(true);
                                    setSelectedAddressId(null);
                                  }}
                                  className={`p-3.5 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider transition-all ${
                                    isAddingNewAddress
                                      ? 'bg-hauhau-gold/5 border-hauhau-gold text-hauhau-gold'
                                      : 'bg-hauhau-surface-bright/5 border-hauhau-outline-variant/30 text-hauhau-on-surface-variant hover:text-hauhau-cream hover:border-hauhau-outline-variant/60'
                                  }`}
                                >
                                  <PlusCircle size={14} />
                                  Enter A New Delivery Location
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Address input form */}
                          {(!user || !userProfile?.addresses || userProfile.addresses.length === 0 || isAddingNewAddress) && (
                            <div className="space-y-4 p-5 bg-hauhau-surface-bright/10 rounded-3xl border border-hauhau-outline-variant/15 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-hauhau-gold/3 blur-2xl rounded-full pointer-events-none" />

                              {/* Form Header with Back/Cancel option if they have saved addresses */}
                              {user && userProfile?.addresses && userProfile.addresses.length > 0 && (
                                <div className="flex justify-between items-center pb-2 border-b border-hauhau-outline-variant/15">
                                  <span className="text-[10px] font-mono uppercase tracking-widest text-hauhau-gold font-bold">New Delivery Coordinates</span>
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
                                    className="text-[10px] font-mono text-hauhau-on-surface-variant hover:text-hauhau-cream uppercase transition-colors"
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
                                className="w-full py-3 px-4 bg-hauhau-gold/5 border border-hauhau-gold/25 hover:border-hauhau-gold/60 hover:bg-hauhau-gold/10 text-hauhau-gold font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <RotateCw size={14} className={gpsLoading ? "animate-spin" : ""} />
                                {gpsLoading ? "Acquiring Coordinates..." : "Auto-Fetch Current Location"}
                              </button>

                              {/* GPS Success Banner */}
                              <AnimatePresence>
                                {showGpsSuccess && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-3 bg-hauhau-gold/10 border border-hauhau-gold/30 text-hauhau-gold rounded-xl text-xs font-mono flex items-center justify-center gap-2 overflow-hidden"
                                  >
                                    <Check size={14} className="text-hauhau-gold" />
                                    <span>Coordinates Secured Successfully</span>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Fields Grid */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5 col-span-2">
                                  <label className="text-[10px] font-mono uppercase tracking-widest text-hauhau-on-surface-variant block">
                                    Hostel / Flat / House & Room *
                                  </label>
                                  <input
                                    type="text"
                                    value={flatNo}
                                    onChange={(e) => setFlatNo(e.target.value)}
                                    placeholder="e.g. Room 302, Hostel 5"
                                    className="w-full bg-hauhau-surface-bright/30 border border-hauhau-outline-variant/20 rounded-xl py-3 px-4 text-hauhau-cream placeholder-hauhau-on-surface-variant/30 focus:border-hauhau-gold outline-none transition-colors text-sm"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-mono uppercase tracking-widest text-hauhau-on-surface-variant block">
                                    Floor / Wing (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={floor}
                                    onChange={(e) => setFloor(e.target.value)}
                                    placeholder="e.g. 3rd Floor, C-Wing"
                                    className="w-full bg-hauhau-surface-bright/30 border border-hauhau-outline-variant/20 rounded-xl py-3 px-4 text-hauhau-cream placeholder-hauhau-on-surface-variant/30 focus:border-hauhau-gold outline-none transition-colors text-sm"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-mono uppercase tracking-widest text-hauhau-on-surface-variant block">
                                    Nearby Landmark (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={landmark}
                                    onChange={(e) => setLandmark(e.target.value)}
                                    placeholder="e.g. Near Mess Gate"
                                    className="w-full bg-hauhau-surface-bright/30 border border-hauhau-outline-variant/20 rounded-xl py-3 px-4 text-hauhau-cream placeholder-hauhau-on-surface-variant/30 focus:border-hauhau-gold outline-none transition-colors text-sm"
                                  />
                                </div>

                                <div className="space-y-1.5 col-span-2">
                                  <label className="text-[10px] font-mono uppercase tracking-widest text-hauhau-on-surface-variant block">
                                    Campus Area / Location *
                                  </label>
                                  <input
                                    type="text"
                                    value={area}
                                    onChange={(e) => setArea(e.target.value)}
                                    placeholder="e.g. IIT Campus, Library Lawn"
                                    className="w-full bg-hauhau-surface-bright/30 border border-hauhau-outline-variant/20 rounded-xl py-3 px-4 text-hauhau-cream placeholder-hauhau-on-surface-variant/30 focus:border-hauhau-gold outline-none transition-colors text-sm"
                                  />
                                </div>
                              </div>

                              {/* Address Label Selector */}
                              <div className="space-y-2 pt-1">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-hauhau-on-surface-variant block">
                                  Address Type / Label
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {(['Hostel', 'Library', 'Classroom', 'Home', 'Other'] as const).map((lbl) => {
                                    let Icon = MapPin;
                                    if (lbl === 'Home') Icon = Home;
                                    else if (lbl === 'Hostel') Icon = Building;
                                    else if (lbl === 'Library') Icon = BookOpen;
                                    else if (lbl === 'Classroom') Icon = GraduationCap;

                                    return (
                                      <button
                                        key={lbl}
                                        type="button"
                                        onClick={() => setAddressLabel(lbl)}
                                        className={`py-2 px-3 rounded-lg text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 border ${
                                          addressLabel === lbl
                                            ? 'bg-hauhau-gold border-hauhau-gold text-hauhau-surface font-black'
                                            : 'bg-hauhau-surface-bright/20 border-hauhau-outline-variant/10 text-hauhau-on-surface-variant hover:text-hauhau-cream hover:border-hauhau-outline-variant/30'
                                        }`}
                                      >
                                        <Icon size={12} />
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
                                    className="w-full bg-hauhau-surface-bright/30 border border-hauhau-outline-variant/20 rounded-xl py-2 px-3.5 text-hauhau-cream placeholder-hauhau-on-surface-variant/30 focus:border-hauhau-gold outline-none transition-colors text-xs font-mono mt-2"
                                  />
                                )}
                              </div>

                              {/* Save checkbox (only visible if logged in) */}
                              {user && (
                                <label className="flex items-center gap-2.5 text-xs text-hauhau-on-surface-variant cursor-pointer select-none pt-2 hover:text-hauhau-cream transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={saveToProfile}
                                    onChange={(e) => setSaveToProfile(e.target.checked)}
                                    className="rounded border-hauhau-outline-variant/40 bg-hauhau-surface-bright text-hauhau-gold focus:ring-hauhau-gold"
                                  />
                                  <span>Save this coordinate for future orders</span>
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {([
                            { code: 'OASIS', label: 'Oasis Hatch', desc: 'Deck mist-cooling' },
                            { code: 'SMOKING', label: 'Sunset Deck', desc: 'Open music deck' },
                            { code: 'CANOPY', label: 'Canopy Hatch', desc: 'Tranquil gardens' }
                          ] as const).map((h) => (
                            <button
                              key={h.code}
                              onClick={() => setSelectedHatch(h.code)}
                              className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                                selectedHatch === h.code
                                  ? 'bg-hauhau-gold/10 border-hauhau-gold text-hauhau-cream shadow-[0_0_15px_rgba(248,188,81,0.08)]'
                                  : 'bg-hauhau-surface-bright/20 border-hauhau-outline-variant/10 text-hauhau-on-surface-variant hover:border-hauhau-outline-variant/30 hover:text-hauhau-cream'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Compass size={14} className={selectedHatch === h.code ? 'text-hauhau-gold' : 'text-hauhau-on-surface-variant/50'} />
                                <span className="font-bold text-xs">{h.label}</span>
                              </div>
                              <span className="text-[10px] mt-1.5 opacity-60 leading-tight block">{h.desc}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 3: Loyalty points redemption */}
                    {availablePoints > 0 && (
                      <div className="p-4 bg-hauhau-surface-container/40 border border-hauhau-outline-variant/10 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-hauhau-gold/10 flex items-center justify-center text-hauhau-gold border border-hauhau-gold/20">
                            <Percent size={18} />
                          </div>
                          <div>
                            <p className="text-xs text-hauhau-on-surface-variant font-mono uppercase tracking-wide">Loyalty Point Balance</p>
                            <p className="text-sm text-hauhau-cream font-bold">{availablePoints} Points Available</p>
                          </div>
                        </div>

                        <button
                          onClick={() => setRedeemPoints(!redeemPoints)}
                          className={`w-14 h-8 rounded-full p-1 transition-all ${
                            redeemPoints ? 'bg-hauhau-gold flex justify-end' : 'bg-hauhau-surface-bright border border-hauhau-outline-variant/20 flex justify-start'
                          }`}
                        >
                          <motion.div 
                            layout
                            className={`w-6 h-6 rounded-full shadow-md ${redeemPoints ? 'bg-hauhau-surface' : 'bg-hauhau-on-surface-variant/80'}`} 
                          />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  // Unauthenticated CTA Box
                  <div className="p-6 bg-hauhau-surface-container/50 border border-hauhau-outline-variant/20 rounded-3xl text-center space-y-4">
                    <div className="w-12 h-12 bg-hauhau-gold/15 rounded-2xl border border-hauhau-gold/30 flex items-center justify-center text-hauhau-gold mx-auto">
                      <Coffee size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif italic text-lg text-hauhau-cream">Secure Student Checkout</h4>
                      <p className="text-xs text-hauhau-on-surface-variant leading-relaxed max-w-sm mx-auto mt-1">
                        Connect with your number to earn 10% loyalty cashback points, unlock student invite gifts, and follow real-time KDS preparation updates.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsAuthOpen(true)}
                      className="px-6 py-3 bg-hauhau-gold text-hauhau-surface font-bold rounded-xl text-sm transition-all hover:shadow-[0_0_15px_rgba(248,188,81,0.2)]"
                    >
                      Authenticate Account
                    </button>
                  </div>
                )}
              </div>

              {/* Footer / Summary Pricing & Primary Action */}
              <div className="p-6 pb-10 md:pb-6 bg-hauhau-surface-container border-t border-hauhau-outline-variant/30 backdrop-blur-md pb-safe">
                <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-xs text-hauhau-on-surface-variant font-mono uppercase">
                      <span>Gross Subtotal</span>
                      <span className="text-hauhau-cream font-medium">₹{subtotalAmount}</span>
                    </div>
                    {campaignDiscountAmount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-400 font-mono uppercase">
                        <span>{activeCampaignDiscount?.description || 'Campaign Discount'}</span>
                        <span>-₹{campaignDiscountAmount}</span>
                      </div>
                    )}
                    {pointsToRedeem > 0 && (
                      <div className="flex justify-between text-xs text-hauhau-gold font-mono uppercase">
                        <span>Wallet Discount Applied (Max 20%)</span>
                        <span>-₹{pointsToRedeem}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-hauhau-cream font-bold font-serif pt-2 border-t border-hauhau-outline-variant/10">
                      <span>Final Net Payable (80% minimum)</span>
                      <span className="text-hauhau-gold text-base">₹{finalAmount}</span>
                    </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder}
                  className="w-full bg-hauhau-gold text-hauhau-surface font-bold text-base py-4.5 rounded-2xl hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(248,188,81,0.3)] transition-all flex justify-between px-8 items-center disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="uppercase tracking-widest text-sm font-mono font-black">
                    {isPlacingOrder ? 'Transmitting Ticket...' : user ? 'Place Escape Order' : 'Login to Place Order'}
                  </span>
                  <span className="font-mono text-lg">₹{finalAmount}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AuthModal 
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
