'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Layers, 
  Users, 
  LayoutGrid, 
  Sunset, 
  Settings, 
  Lock, 
  LogOut, 
  ArrowLeft, 
  Sliders, 
  Terminal, 
  ChevronRight,
  ShieldCheck,
  Percent,
  Sparkles,
  Download,
  History,
  Truck
} from 'lucide-react';
import Link from 'next/link';

import StaffCopilot from '@/components/admin/StaffCopilot';

// Firebase core configuration & seeding imports
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { collection, doc, setDoc, getDocs, getDoc, query, where } from 'firebase/firestore';
import { mockMenuItems, mockUIConfig, defaultSliderItems } from '@/lib/mockData';


// Import our premium modular panels
import DashboardStats from '@/components/admin/DashboardStats';
import MenuManagement from '@/components/admin/MenuManagement';
import InventoryManagement from '@/components/admin/InventoryManagement';
import CRMManagement from '@/components/admin/CRMManagement';
import UIAtmosphereManager from '@/components/admin/UIAtmosphereManager';
import OfferManagement from '@/components/admin/OfferManagement';
import StaffManagement from '@/components/admin/StaffManagement';
import OutletManagement from '@/components/admin/OutletManagement';
import ApprovalManagement from '@/components/admin/ApprovalManagement';
import OrderHistory from '@/components/admin/OrderHistory';

type TabType = 'dashboard' | 'menu' | 'offers' | 'inventory' | 'crm' | 'staff' | 'outlets' | 'atmosphere' | 'approvals' | 'orders';

export default function AdminPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'owner' | 'manager'>('owner');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [crmFilter, setCrmFilter] = useState<'all' | 'loyal'>('all');

  const navigateTo = (tab: TabType, filter?: string) => {
    setActiveTab(tab);
    if (tab === 'crm' && filter) {
      setCrmFilter(filter as any);
    } else {
      setCrmFilter('all');
    }
  };

  // Cloudinary credentials, persisted in localStorage
  const [cloudName, setCloudName] = useState<string>('');
  const [uploadPreset, setUploadPreset] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [ownerEmail, setOwnerEmail] = useState<string>('');

  // DB Seeding States
  const [seedLoading, setSeedLoading] = useState<boolean>(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedEmail, setSeedEmail] = useState<string>('');
  const [seedPassword, setSeedPassword] = useState<string>('');
  const [showSeedForm, setShowSeedForm] = useState<boolean>(false);
  // null = still checking, true = already initialized (locked for all devices), false = first time
  const [isAlreadyInitialized, setIsAlreadyInitialized] = useState<boolean | null>(null);

  const handleLogout = async () => {
    setIsAuthenticated(false);
    try {
      await fetch('/api/auth/session', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      await signOut(auth);
      window.location.href = '/login';
    } catch (err) {
      console.error(err);
    }
  };

  // Inactivity timeout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      // 5 minutes = 300,000 milliseconds
      timeoutId = setTimeout(() => {
        handleLogout();
      }, 300000);
    };

    // Listen for activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Set initial timeout
    resetTimeout();
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['dashboard', 'menu', 'offers', 'inventory', 'crm', 'staff', 'outlets', 'atmosphere', 'approvals', 'orders'].includes(tabParam)) {
        setActiveTab(tabParam as TabType);
      }

      setCloudName(localStorage.getItem('Hau Hau_cloudinary_cloud_name') || '');
      setUploadPreset(localStorage.getItem('Hau Hau_cloudinary_upload_preset') || '');
      setGeminiApiKey(localStorage.getItem('Hau Hau_gemini_api_key') || '');
      setOwnerEmail(localStorage.getItem('Hau Hau_smtp_owner_email') || '');
      setSeedEmail(localStorage.getItem('Hau Hau_seed_email') || '');
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        try {
          const q = query(collection(db, 'staff'), where('email', '==', user.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const validAdminRoles = ['owner'];
            if (!validAdminRoles.includes(data.role)) {
              console.warn("Unauthorized access attempt by", data.role);
              window.location.href = '/login';
              return;
            }
            setUserRole('owner');
          } else {
            setUserRole('owner');
          }
        } catch (error) {
          console.error("Error fetching role", error);
          setUserRole('owner');
        }
        setIsAuthenticated(true);
      } else {
        // Just in case middleware lets it slip or user logs out
        setIsAuthenticated(false);
      }
    });

    // Check Firestore initialization flag — shared across ALL devices
    // If this doc exists, no device can ever show the setup form again
    getDoc(doc(db, 'config', 'initialized')).then((snap) => {
      setIsAlreadyInitialized(snap.exists());
    }).catch(() => {
      // If Firestore unreachable, fall back to localStorage check
      const localEmail = typeof window !== 'undefined' ? localStorage.getItem('Hau Hau_seed_email') : null;
      setIsAlreadyInitialized(!!localEmail);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      // Authenticate with real Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        const idToken = await userCredential.user.getIdToken();
        
        // Exchange ID token for session cookie
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        
        if (!res.ok) throw new Error('Session creation failed');
        
        setIsAuthenticated(true);
        // Refresh page or redirect to trigger middleware
        window.location.href = '/admin';
      }
    } catch (err: any) {
      console.error("Firebase auth check failed: ", err);
      setAuthError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/export-backup');
      if (!res.ok) throw new Error('Backup failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cafe-backup-${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Failed to download backup');
    }
  };

  const saveSettings = () => {
    localStorage.setItem('Hau Hau_cloudinary_cloud_name', cloudName);
    localStorage.setItem('Hau Hau_cloudinary_upload_preset', uploadPreset);
    localStorage.setItem('Hau Hau_gemini_api_key', geminiApiKey);
    localStorage.setItem('Hau Hau_smtp_owner_email', ownerEmail);
    setShowSettings(false);
  };

  // Seeding Database & Firebase Auth Profiles
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
          { stock_id: 'st_PotatoWaffles', name: 'Belgian Potato Waffles', current_quantity: 48, unit: 'portions', low_threshold: 15, last_updated: Date.now(), menu_item_id: 'm2' },
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
      setSeedMessage(`❌ Seeding failed: ${err.message || err}`);
    } finally {
      setSeedLoading(false);
    }
  };


  // Nav items configuration
  const navigationItems = [
    { id: 'dashboard', label: 'Live Telemetry', icon: TrendingUp, subtitle: 'Real-time charts' },
    { id: 'orders', label: 'Order History', icon: History, subtitle: 'Past transactions' },
    { id: 'menu', label: 'Menu Catalog', icon: Sliders, subtitle: 'Recipe connectors' },
    { id: 'offers', label: 'Campaign Offers', icon: Percent, subtitle: 'AI Smart Coupon' },
    { id: 'inventory', label: 'Stock Registry', icon: Layers, subtitle: 'Material thresholds' },
    { id: 'crm', label: 'CRM Cohorts', icon: Users, subtitle: 'Gemini Activator' },
    { id: 'staff', label: 'Staff Terminals', icon: Terminal, subtitle: 'Key provisions' },
    { id: 'approvals', label: 'Manager Approvals', icon: ShieldCheck, subtitle: 'Review Requests' },
    { id: 'outlets', label: 'Hatch queues', icon: LayoutGrid, subtitle: 'Morning HUD & Mood' },
    { id: 'atmosphere', label: 'UI Atmosphere', icon: Sunset, subtitle: 'Weather dynamic prompt' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-[#060403] text-[#f7dec4] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#f8bc51] border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-xs text-[#f8bc51] uppercase tracking-widest animate-pulse">Initializing Secured Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#060403] text-[#f7dec4] flex flex-col lg:flex-row relative font-sans">
      
      {/* Dynamic luxury mesh glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#f8bc51]/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#E8621A]/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Sidebar Nav Dock */}
      <aside className="w-full lg:w-72 bg-[#120a06]/55 backdrop-blur-2xl border-b lg:border-b-0 lg:border-r border-[#302117]/85 p-6 flex flex-col justify-between shrink-0 z-20">
        <div className="flex flex-col gap-6 w-full">
          {/* Brand header */}
          <div className="flex justify-between items-center pb-5 border-b border-[#302117]/60">
            <div className="flex flex-col">
              <span className="font-serif text-3xl text-[#f8bc51] leading-none">Hau Hau.</span>
              <span className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]/40 mt-1">Operational Command</span>
            </div>
            <div className={`flex items-center gap-1.5 ${userRole === 'owner' ? 'bg-[#f8bc51]/10 text-[#f8bc51] border-[#f8bc51]/25' : 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/25'} border px-2 py-0.5 rounded text-[8px] font-mono uppercase font-bold tracking-wider animate-pulse`}>
              <ShieldCheck size={10} />
              {userRole === 'owner' ? 'Owner Level' : 'Manager Level'}
            </div>
          </div>

          {/* Sidebar Nav items */}
          <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible category-scroll-container gap-1 py-2 lg:py-0">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id as TabType)}
                  className={`flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 text-left px-4 py-3 rounded-2xl transition-all border shrink-0 ${
                    isActive 
                      ? 'bg-[#f8bc51] text-[#0A0604] border-[#f8bc51] shadow-[0_4px_20px_rgba(248,188,81,0.15)] font-bold' 
                      : 'bg-transparent text-[#d4c4b0]/80 hover:text-white border-transparent hover:bg-[#302117]/25'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-[#0A0604]' : 'text-[#f8bc51]'} />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-mono lg:text-xs leading-tight font-bold">{item.label}</p>
                    <p className={`hidden lg:block text-[8px] font-mono uppercase mt-0.5 tracking-wider ${isActive ? 'text-[#0a0604]/60' : 'text-[#d4c4b0]/40'}`}>{item.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer - Settings and Logout */}
        <div className="flex flex-col gap-3 mt-6 lg:mt-0 pt-5 border-t border-[#302117]/60">
          {/* Cloudinary credentials config panel trigger */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-[#f8bc51] hover:text-[#ffce7b] py-2 border border-dashed border-[#302117] rounded-xl px-3 transition-colors bg-[#070402]/30"
          >
            <span className="flex items-center gap-1.5">
              <Settings size={12} className={showSettings ? 'animate-spin' : ''} />
              API Cloud Config
            </span>
            <ChevronRight size={10} className={`transform transition-transform ${showSettings ? 'rotate-90' : ''}`} />
          </button>

          {/* Config fields expansion */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden flex flex-col gap-3.5 pt-2 border-t border-[#302117]/40 text-[10px]"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]">Cloud Name</span>
                  <input
                    type="text"
                    value={cloudName}
                    onChange={(e) => setCloudName(e.target.value)}
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]">Upload Preset</span>
                  <input
                    type="text"
                    value={uploadPreset}
                    onChange={(e) => setUploadPreset(e.target.value)}
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]">Gemini API Key</span>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy... (optional custom key)"
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-sans"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]">Owner Alert Target Email</span>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@hauhaucafe.com"
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-sans"
                  />
                </div>
                <button
                  onClick={saveSettings}
                  className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] rounded-lg py-2 font-mono font-bold uppercase tracking-wider text-[9px]"
                >
                  Save Config
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout Action */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-between text-[#d4c4b0]/60 hover:text-white font-mono text-[10px] uppercase tracking-widest py-2 px-3 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded-xl transition-all"
          >
            <span className="flex items-center gap-1.5">
              <LogOut size={12} />
              Session Lock
            </span>
          </button>
        </div>
      </aside>

      {/* Master View Area */}
      <main className="flex-1 flex flex-col min-w-0 z-10">
        {/* Header telemetry status bar */}
        <header className="bg-[#120a06]/20 backdrop-blur-xl border-b border-[#302117]/60 py-4 px-6 md:px-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#f8bc51] hover:text-[#ffce7b] transition-colors"
            >
              <ArrowLeft size={12} />
              Cafe front
            </Link>
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#10B981] hover:text-[#34D399] transition-colors"
            >
              <Download size={12} />
              Export Backup
            </button>
          </div>

          <div className="flex items-center gap-4 font-mono text-[10px]">
            <span className="hidden sm:inline text-[#d4c4b0]/40 uppercase tracking-widest">KDS Signal Status:</span>
            <div className="flex items-center gap-2 bg-[#070402] border border-[#302117] rounded-full px-3 py-1 font-bold text-[#10B981]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              ONLINE 100%
            </div>
          </div>
        </header>

        {/* Dynamic Panel renderer */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="w-full h-full flex"
            >
              {activeTab === 'dashboard' && <DashboardStats onNavigate={navigateTo} />}
              {activeTab === 'menu' && <MenuManagement userRole={userRole} />}
              {activeTab === 'offers' && <OfferManagement />}
              {activeTab === 'inventory' && <InventoryManagement userRole={userRole} />}
              {activeTab === 'crm' && <CRMManagement initialFilter={crmFilter} />}
              {activeTab === 'staff' && <StaffManagement userRole={userRole} />}
              {activeTab === 'approvals' && <ApprovalManagement />}
              {activeTab === 'outlets' && <OutletManagement />}
              {activeTab === 'atmosphere' && <UIAtmosphereManager />}
              {activeTab === 'orders' && <OrderHistory />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      <StaffCopilot />
    </div>
  );
}
