'use client';

import React, { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { collection, doc, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { mockMenuItems, mockUIConfig, defaultSliderItems } from '@/lib/mockData';
import { getFriendlyErrorMessage } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import AuthWorkspace from '@/components/auth/AuthWorkspace';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060403] text-[#f7dec4] flex items-center justify-center font-mono text-xs uppercase tracking-widest">
        Loading Command Shield...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const isStaff = searchParams.get('staff') === 'true';

  if (!isStaff) {
    return <AuthWorkspace defaultTab="login" />;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (val && !/\S+@\S+\.\S+/.test(val)) {
      setEmailError('Please enter a valid email (e.g. rohan.sharma@hauhaucafe.com)');
    } else {
      setEmailError(null);
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val && val.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError(null);
    }
  };

  // TOTP State
  const [totpStep, setTotpStep] = useState<'none' | 'setup' | 'verify'>('none');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempIdToken, setTempIdToken] = useState('');

  // DB Seeding States
  const [seedLoading, setSeedLoading] = useState<boolean>(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedEmail, setSeedEmail] = useState<string>('');
  const [seedPassword, setSeedPassword] = useState<string>('');
  const [showSeedForm, setShowSeedForm] = useState<boolean>(false);
  const [isAlreadyInitialized, setIsAlreadyInitialized] = useState<boolean | null>(null);

  React.useEffect(() => {
    // Check Firestore initialization flag
    getDoc(doc(db, 'config', 'initialized')).then((snap) => {
      setIsAlreadyInitialized(snap.exists());
    }).catch(() => {
      const localEmail = typeof window !== 'undefined' ? localStorage.getItem('Hau Hau_seed_email') : null;
      setIsAlreadyInitialized(!!localEmail);
    });
    
    if (typeof window !== 'undefined') {
      setSeedEmail(localStorage.getItem('Hau Hau_seed_email') || '');
    }
  }, []);

  const handleInitializeDBAndAuth = async () => {
    if (!seedEmail || !seedPassword) {
      setSeedMessage('❌ Please enter your Owner Email and Password before initializing.');
      return;
    }
    if (seedPassword.length < 6) {
      setSeedMessage('❌ Password must be at least 6 characters.');
      return;
    }
    setSeedLoading(true);
    setSeedMessage(null);
    localStorage.setItem('Hau Hau_seed_email', seedEmail);
    try {
      // 1. Register the owner account in Firebase Auth
      try {
        await createUserWithEmailAndPassword(auth, seedEmail, seedPassword);
        console.log(`Registered auth account: ${seedEmail}`);
      } catch (e: any) {
        if (e.code === 'auth/email-already-in-use') {
          // Account already exists — sign in to get a fresh session token
          console.log(`Auth profile already exists for: ${seedEmail}, signing in...`);
          await signInWithEmailAndPassword(auth, seedEmail, seedPassword);
        } else {
          throw e;
        }
      }

      // Force-refresh the ID token so Firestore security rules
      // receive a fully authenticated request before any writes
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      } else {
        throw new Error('Authentication session not ready. Please try again.');
      }

      // 2. Seed Firestore Collections
      // a) Menu Catalog (menu)
      const menuRef = collection(db, "menu");
      const menuSnap = await getDocs(menuRef);
      if (menuSnap.empty) {
        // Seed default items
        for (const item of mockMenuItems) {
          const enrichedItem = {
            ...item,
            recipe: item.item_id === 'm1' ? [
              { stock_id: 'st_BasmatiRice', name: 'Premium Basmati Rice', quantity: 0.15, unit: 'kg' },
              { stock_id: 'st_BonelessChicken', name: 'Fresh Boneless Chicken', quantity: 0.1, unit: 'kg' }
            ] : item.item_id === 'm3' ? [
              { stock_id: 'st_MilkCreamer', name: 'Whole Milk Creamer', quantity: 0.25, unit: 'Liters' },
              { stock_id: 'st_CoffeeBeans', name: 'Roasted Coffee Beans', quantity: 0.015, unit: 'kg' }
            ] : item.item_id === 'm2' ? [
              { stock_id: 'st_PotatoWaffles', name: 'Belgian Potato Waffles', quantity: 1, unit: 'portions' }
            ] : [],
            customizationOptions: item.item_id === 'm4' ? [
              {
                groupName: 'Add-ons',
                options: [
                  { name: 'Extra Cheese Slice', price: 15, stock_id: 'st_CheeseSlices', quantity: 1 },
                  { name: 'Double Patty', price: 40, stock_id: 'st_ChickenPatty', quantity: 1 }
                ]
              }
            ] : []
          };
          await setDoc(doc(db, "menu", item.item_id), enrichedItem);
        }
        console.log("Seeded Menu collection.");
      }

      // b) Stock Registry (stocks)
      const stocksRef = collection(db, "stocks");
      const stocksSnap = await getDocs(stocksRef);
      if (stocksSnap.empty) {
        const initialStocks = [
          { stock_id: 'st_BasmatiRice', name: 'Premium Basmati Rice', current_quantity: 42, unit: 'kg', low_threshold: 15, last_updated: Date.now(), menu_item_id: 'm1' },
          { stock_id: 'st_BonelessChicken', name: 'Fresh Boneless Chicken', current_quantity: 8, unit: 'kg', low_threshold: 10, last_updated: Date.now(), menu_item_id: 'm1' },
          { stock_id: 'st_MilkCreamer', name: 'Whole Milk Creamer', current_quantity: 5, unit: 'Liters', low_threshold: 8, last_updated: Date.now(), menu_item_id: 'm3' },
          { stock_id: 'st_CoffeeBeans', name: 'Roasted Coffee Beans', current_quantity: 12, unit: 'kg', low_threshold: 4, last_updated: Date.now(), menu_item_id: 'm3' },
          { stock_id: 'st_PotatoWaffles', name: 'Belgian Potato Waffles', current_quantity: 48, py_qty: 48, unit: 'portions', low_threshold: 15, last_updated: Date.now(), menu_item_id: 'm2' },
          { stock_id: 'st_CheeseSlices', name: 'Cheese Slices', current_quantity: 50, unit: 'portions', low_threshold: 20, last_updated: Date.now(), menu_item_id: 'custom' },
          { stock_id: 'st_ChickenPatty', name: 'Chicken Burger Patty', current_quantity: 30, unit: 'portions', low_threshold: 10, last_updated: Date.now(), menu_item_id: 'custom' }
        ];
        for (const stock of initialStocks) {
          await setDoc(doc(db, "stocks", stock.stock_id), stock);
        }
        console.log("Seeded Stocks collection.");
      }

      // c) Store Config (config)
      const configRef = doc(db, "config", "store_settings");
      const configSnap = await getDoc(configRef);
      if (!configSnap.exists()) {
        await setDoc(configRef, mockUIConfig);
        console.log("Seeded UI store settings.");
      }

      // Seed default slider items if collection is empty
      const sliderRef = collection(db, "slider_items");
      const sliderSnap = await getDocs(sliderRef);
      if (sliderSnap.empty) {
        for (const slide of defaultSliderItems) {
          await setDoc(doc(db, "slider_items", slide.id), slide);
        }
        console.log("Seeded default slider items.");
      }

      // d) Offers (offers)
      const offersRef = collection(db, "offers");
      const offersSnap = await getDocs(offersRef);
      if (offersSnap.empty) {
        const initialOffers = [
          { code: 'Hau Hau_MONSOON', discountPercent: 15, description: '15% off warm beverages during rain spells', categoryScope: 'Beverages', isActive: true, expiryDate: '2026-06-30', outlets: { canopy: true, oasis: true, smoking: false } },
          { code: 'WELCOME_Hau Hau', discountPercent: 10, description: '10% welcome discount for new student profile signups', categoryScope: 'All', isActive: true, expiryDate: '2026-12-31', outlets: { canopy: true, oasis: true, smoking: true } },
          { code: 'BIRYANI_FEAST', discountPercent: 20, description: '20% off Special Chicken Biryani orders', categoryScope: 'Biryani', isActive: false, expiryDate: '2026-05-15', outlets: { canopy: false, oasis: true, smoking: false } }
        ];
        for (const offer of initialOffers) {
          await setDoc(doc(db, "offers", offer.code), offer);
        }
        console.log("Seeded Offers collection.");
      }

      // e) Staff Terminals (staff)
      const staffRef = collection(db, "staff");
      const staffSnap = await getDocs(staffRef);
      if (staffSnap.empty) {
        const initialStaff = [
          { id: 'st_1', name: 'Ramesh Kumar', role: 'manager', outlet: 'Oasis Canopy Hatch', passcode: '1482', status: 'active', created_at: Date.now() },
          { id: 'st_2', name: 'Amit Singh', role: 'chef', outlet: 'Central Library Canopy', passcode: '8520', status: 'active', created_at: Date.now() },
          { id: 'st_3', name: 'Vikram Seth', role: 'brewer', outlet: 'Smoking Zone Huts', passcode: '9632', status: 'active', created_at: Date.now() },
          { id: 'st_4', name: 'Rahul Dev', role: 'rider', outlet: 'Global Outlets', passcode: '7410', status: 'offline', created_at: Date.now() }
        ];
        for (const s of initialStaff) {
          await setDoc(doc(db, "staff", s.id), s);
        }
        console.log("Seeded Staff collection.");
      }

      // Write the global initialized flag to Firestore — hides setup form on ALL devices permanently
      await setDoc(doc(db, 'config', 'initialized'), {
        initialized: true,
        owner_email: seedEmail,
        initialized_at: Date.now()
      });
      setIsAlreadyInitialized(true);

      setSeedMessage(`✨ Done! Account registered for ${seedEmail}. Log in with your credentials above.`);
    } catch (err: any) {
      console.error(err);
      setSeedMessage(`❌ Seeding failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSeedLoading(false);
    }
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        const idToken = await userCredential.user.getIdToken();
        
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, action: 'init' })
        });
        
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Session creation failed');
        
        setTempIdToken(idToken);
        
        if (resData.setup_required) {
          setQrCodeDataUrl(resData.qrCodeDataUrl);
          setTotpSecret(resData.secret);
          setTotpStep('setup');
        } else if (resData.require_totp) {
          setTotpStep('verify');
        }
      }
    } catch (err: any) {
      console.error("Auth check failed: ", err);
      setAuthError(getFriendlyErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: tempIdToken, action: 'verify', totpCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      
      window.location.href = data.redirectUrl || '/admin';
    } catch (err: any) {
      setAuthError(getFriendlyErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };


  return (
    <div className="min-h-[100dvh] w-full bg-[#060403] text-[#f7dec4] flex flex-col relative overflow-x-hidden overflow-y-auto font-sans p-6 py-12 sm:py-6">
      <div className="absolute top-[-20%] left-[-20%] w-[550px] h-[550px] bg-[#f8bc51]/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[550px] h-[550px] bg-[#E8621A]/5 rounded-full filter blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md z-10 m-auto"
      >
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <span className="font-serif text-4xl text-[#f8bc51] tracking-wide">Hau Hau.</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#d4c4b0]/40">Secured Control Command Shield</span>
        </div>

        {totpStep === 'none' && (
          <form onSubmit={handleLogin} className="bg-[#120a06]/55 backdrop-blur-2xl rounded-3xl border border-[#302117]/80 p-8 shadow-2xl flex flex-col gap-6 relative">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-[#f8bc51]/10 border border-[#f8bc51]/20 flex items-center justify-center text-[#f8bc51]">
                <Lock size={20} />
              </div>
            </div>

            <div className="text-center">
              <h1 className="font-serif italic text-2xl font-bold text-white">Owner & Manager Access</h1>
              <p className="text-xs text-[#d4c4b0]/60 mt-1">Please authenticate to manage operational telemetry.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-widest text-[#d4c4b0]/70 flex justify-between">
                  <span>Admin Email</span>
                  <span className="text-[8px] text-[#d4c4b0]/40 font-mono tracking-normal">e.g. rohan.sharma@hauhaucafe.com</span>
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="e.g. rohan.sharma@hauhaucafe.com"
                  className={`px-4 py-3 text-sm rounded-xl transition-all outline-none border ${
                    email 
                      ? 'border-[#f8bc51]/40 bg-[#0d0906] text-white' 
                      : 'border-[#302117] bg-[#070402] text-[#d4c4b0]/70'
                  } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
                />
                {emailError && <span className="text-[10px] text-red-400 font-mono mt-0.5">{emailError}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-widest text-[#d4c4b0]/70 flex justify-between">
                  <span>Secure Password</span>
                  <span className="text-[8px] text-[#d4c4b0]/40 font-mono tracking-normal">Min 6 characters</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="e.g. ••••••••"
                  className={`px-4 py-3 text-sm rounded-xl transition-all outline-none border ${
                    password 
                      ? 'border-[#f8bc51]/40 bg-[#0d0906] text-white' 
                      : 'border-[#302117] bg-[#070402] text-[#d4c4b0]/70'
                  } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20 tracking-widest`}
                />
                {passwordError && <span className="text-[10px] text-red-400 font-mono mt-0.5">{passwordError}</span>}
              </div>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs text-center font-mono leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#f8bc51] hover:bg-[#ffce7b] text-[#0A0604] py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#f8bc51]/10 hover:shadow-[#f8bc51]/25 flex items-center justify-center gap-2 transition-all"
            >
              {authLoading ? 'Verifying parameters...' : 'Unlock Telemetry'}
            </button>
            <div className="border-t border-[#302117]/60 pt-4 flex flex-col gap-3">
            {isAlreadyInitialized === false && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSeedForm(v => !v)}
                  className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-[#f8bc51]/70 hover:text-[#f8bc51] px-1 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={10} />
                    First Time? Set Owner Credentials
                  </span>
                  <span className="text-[#d4c4b0]/30">{showSeedForm ? '▲' : '▼'}</span>
                </button>

                {showSeedForm && (
                  <div className="flex flex-col gap-2.5 bg-[#070402]/40 border border-[#302117]/60 rounded-2xl p-4">
                    <p className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]/50 leading-relaxed">
                      Enter your real email &amp; a strong password (min 6 chars). This becomes your permanent owner login.
                    </p>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]/70">Owner Email</label>
                      <input
                        type="email"
                        value={seedEmail}
                        onChange={e => setSeedEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]/70">Password (min 6 chars)</label>
                      <input
                        type="password"
                        value={seedPassword}
                        onChange={e => setSeedPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors tracking-widest"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleInitializeDBAndAuth}
                      disabled={seedLoading}
                      className="w-full bg-[#120a06] hover:bg-[#302117]/35 border border-[#302117] text-[#f8bc51] hover:text-[#ffce7b] py-2.5 rounded-xl font-mono font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors mt-1"
                    >
                      {seedLoading ? 'Registering...' : 'Register as Owner'}
                    </button>
                    {seedMessage && (
                      <div className="text-[10px] text-center mt-1 text-[#f8bc51] font-mono whitespace-pre-line leading-relaxed">
                        {seedMessage}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="text-center mt-2 border-t border-[#302117]/60 pt-4">
              <a
                href="/login"
                className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/40 hover:text-[#f8bc51] transition-colors"
              >
                Customer Portal? Log In / Sign Up
              </a>
            </div>
          </div>
          </form>
        )}

        {(totpStep === 'setup' || totpStep === 'verify') && (
          <form onSubmit={handleVerifyTotp} className="bg-[#120a06]/55 backdrop-blur-2xl rounded-3xl border border-[#f8bc51]/40 p-8 shadow-2xl flex flex-col gap-6 relative">
            <div className="text-center">
              <h1 className="font-serif italic text-2xl font-bold text-[#f8bc51]">2FA Required</h1>
              <p className="text-xs text-[#d4c4b0]/70 mt-2 leading-relaxed">
                {totpStep === 'setup' 
                  ? "Open Google Authenticator and scan this QR code to link your Master Admin account."
                  : "Please enter the 6-digit code from Google Authenticator to access Telemetry."}
              </p>
            </div>

            {totpStep === 'setup' && qrCodeDataUrl && (
              <div className="flex flex-col items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48 bg-white rounded-xl p-2" />
                <p className="text-[10px] font-mono text-[#d4c4b0]/50">Or enter manually: <strong className="text-white tracking-widest">{totpSecret}</strong></p>
              </div>
            )}

            <div className="flex flex-col gap-2 text-center mt-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">6-Digit Authenticator Code</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123456"
                className={`text-2xl text-center transition-all outline-none border rounded-xl px-4 py-4 tracking-[0.5em] font-mono ${
                  totpCode 
                    ? 'border-[#f8bc51]/60 bg-[#0d0906] text-white' 
                    : 'border-[#f8bc51]/30 bg-[#070402] text-[#d4c4b0]/70'
                } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
              />
              <span className="text-[9px] text-[#d4c4b0]/40 font-mono mt-1">Check your Google Authenticator app for code</span>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs text-center font-mono leading-relaxed">
                {authError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setTotpStep('none'); setTempIdToken(''); signOut(auth); }}
                className="flex-1 bg-transparent border border-[#302117] text-[#d4c4b0] hover:bg-[#302117]/50 rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={authLoading || totpCode.length !== 6}
                className="flex-1 bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center"
              >
                {authLoading ? 'Verifying...' : 'Verify & Enter'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
