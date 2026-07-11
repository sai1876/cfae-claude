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
  LogOut, 
  ArrowLeft, 
  Sliders, 
  Terminal, 
  ChevronRight,
  ShieldCheck,
  Percent,
  Download,
  History,
  Coffee,
  Undo2,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

import StaffCopilot from '@/components/owner/StaffCopilot';

// Firebase core configuration & seeding imports
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';


// Import our premium modular panels
// Import our premium modular panels
import DashboardStats from '@/components/owner/DashboardStats';
import MenuManagement from '@/components/owner/MenuManagement';
import InventoryManagement from '@/components/admin/InventoryManagement';
import CRMManagement from '@/components/admin/CRMManagement';
import UIAtmosphereManager from '@/components/owner/UIAtmosphereManager';
import OfferManagement from '@/components/owner/OfferManagement';
import StaffManagement from '@/components/admin/StaffManagement';
import OutletManagement from '@/components/admin/OutletManagement';
import ApprovalManagement from '@/components/admin/ApprovalManagement';
import OrderHistory from '@/components/owner/OrderHistory';
import OrderManagement from '@/components/owner/OrderManagement';
import RefundManagement from '@/components/owner/RefundManagement';
import WastageManagement from '@/components/owner/WastageManagement';
import DailyClosingManagement from '@/components/admin/DailyClosingManagement';

type TabType = 'dashboard' | 'menu' | 'offers' | 'inventory' | 'crm' | 'staff' | 'outlets' | 'atmosphere' | 'approvals' | 'orders' | 'active_orders' | 'refunds' | 'wastage' | 'daily_closings';

export default function AdminPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'owner' | 'manager'>('owner');

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
      if (tabParam && ['dashboard', 'menu', 'offers', 'inventory', 'crm', 'staff', 'outlets', 'atmosphere', 'approvals', 'orders', 'active_orders', 'refunds'].includes(tabParam)) {
        setActiveTab(tabParam as TabType);
      }

      setCloudName(localStorage.getItem('Hau Hau_cloudinary_cloud_name') || '');
      setUploadPreset(localStorage.getItem('Hau Hau_cloudinary_upload_preset') || '');
      setGeminiApiKey(localStorage.getItem('Hau Hau_gemini_api_key') || '');
      setOwnerEmail(localStorage.getItem('Hau Hau_smtp_owner_email') || '');
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



    return () => unsubscribe();
  }, []);



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




  // Nav items configuration
  const navigationItems = [
    { id: 'dashboard', label: 'Live Telemetry', icon: TrendingUp, subtitle: 'Real-time charts' },
    { id: 'daily_closings', label: 'Daily Closing', icon: LogOut, subtitle: 'End of Day Audit' },
    { id: 'active_orders', label: 'Active Orders', icon: Coffee, subtitle: 'Kitchen Inflow' },
    { id: 'orders', label: 'Order History', icon: History, subtitle: 'Past transactions' },
    { id: 'menu', label: 'Menu Catalog', icon: Sliders, subtitle: 'Recipe connectors' },
    { id: 'offers', label: 'Campaign Offers', icon: Percent, subtitle: 'AI Smart Coupon' },
    { id: 'inventory', label: 'Stock Registry', icon: Layers, subtitle: 'Material thresholds' },
    { id: 'crm', label: 'CRM Cohorts', icon: Users, subtitle: 'Gemini Activator' },
    { id: 'staff', label: 'Staff Terminals', icon: Terminal, subtitle: 'Key provisions' },
    { id: 'approvals', label: 'Manager Approvals', icon: ShieldCheck, subtitle: 'Review Requests' },
    { id: 'refunds', label: 'Refund Requests', icon: Undo2, subtitle: 'Queue & Review' },
    { id: 'wastage', label: 'Wastage & Remakes', icon: Trash2, subtitle: 'Food loss log' },
    { id: 'outlets', label: 'Hatch queues', icon: LayoutGrid, subtitle: 'Morning HUD & Mood' },
    { id: 'atmosphere', label: 'UI Atmosphere', icon: Sunset, subtitle: 'Weather dynamic prompt' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full max-w-full bg-[#060403] text-[#f7dec4] flex items-center justify-center font-sans overflow-hidden">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#f8bc51] border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-xs text-[#f8bc51] uppercase tracking-widest animate-pulse">Initializing Secured Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full max-w-full bg-[#060403] text-[#f7dec4] flex flex-col lg:flex-row relative font-sans overflow-hidden">
      
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent overflow-x-hidden z-10">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 max-w-[1440px] w-full mx-auto">
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
              {activeTab === 'active_orders' && <OrderManagement />}
              {activeTab === 'menu' && <MenuManagement userRole={userRole} />}
              {activeTab === 'offers' && <OfferManagement />}
              {activeTab === 'inventory' && <InventoryManagement userRole={userRole} />}
              {activeTab === 'crm' && <CRMManagement initialFilter={crmFilter} />}
              {activeTab === 'staff' && <StaffManagement userRole={userRole} />}
              {activeTab === 'approvals' && <ApprovalManagement />}
              {activeTab === 'outlets' && <OutletManagement />}
              {activeTab === 'atmosphere' && <UIAtmosphereManager />}
              {activeTab === 'orders' && <OrderHistory />}
              {activeTab === 'refunds' && <RefundManagement />}
              {activeTab === 'wastage' && <WastageManagement userRole={userRole} />}
              {activeTab === 'daily_closings' && <DailyClosingManagement outletId="hauhau-main" userRole={userRole} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      <StaffCopilot />
    </div>
  );
}
