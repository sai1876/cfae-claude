'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Layers, 
  LayoutGrid, 
  Terminal, 
  ShieldCheck,
  History,
  Truck,
  LogOut,
  Sliders,
  Calendar,
  Coffee,
  Undo2,
  Trash2
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Import our premium modular panels
import DashboardStats from '@/components/owner/DashboardStats';
import MenuManagement from '@/components/owner/MenuManagement';
import InventoryManagement from '@/components/owner/InventoryManagement';
import StaffManagement from '@/components/owner/StaffManagement';
import OutletManagement from '@/components/owner/OutletManagement';
import OrderHistory from '@/components/owner/OrderHistory';
import OrderManagement from '@/components/owner/OrderManagement';
import RiderDispatch from '@/components/owner/RiderDispatch';
import StaffCopilot from '@/components/owner/StaffCopilot';
import ScheduleDashboard from '@/components/owner/ScheduleDashboard';
import RefundManagement from '@/components/owner/RefundManagement';
import WastageManagement from '@/components/owner/WastageManagement';
import DailyClosingManagement from '@/components/owner/DailyClosingManagement';

type TabType = 'dashboard' | 'active_orders' | 'orders' | 'dispatch' | 'menu' | 'inventory' | 'staff' | 'outlets' | 'schedule' | 'refunds' | 'wastage' | 'daily_closings';

export default function ManagerPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const navigateTo = (tab: TabType) => {
    setActiveTab(tab);
  };

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
      if (tabParam && ['dashboard', 'orders', 'active_orders', 'dispatch', 'menu', 'inventory', 'staff', 'outlets', 'schedule', 'refunds'].includes(tabParam)) {
        setActiveTab(tabParam as TabType);
      }
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        try {
          const q = query(collection(db, 'staff'), where('email', '==', user.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const validRoles = ['owner', 'manager'];
            if (!validRoles.includes(data.role)) {
              console.warn("Unauthorized access attempt by", data.role);
              window.location.href = '/login';
              return;
            }
            setIsAuthenticated(true);
          } else {
            // No staff record found, deny access
            window.location.href = '/login';
          }
        } catch (error) {
          console.error("Error fetching role", error);
          window.location.href = '/login';
        }
      } else {
        setIsAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Nav items configuration
  const navigationItems = [
    { id: 'dashboard', label: 'Live Telemetry', icon: TrendingUp, subtitle: 'Real-time charts' },
    { id: 'daily_closings', label: 'Daily Closing', icon: LogOut, subtitle: 'End of Day Audit' },
    { id: 'active_orders', label: 'Active Orders', icon: Coffee, subtitle: 'Kitchen Inflow' },
    { id: 'orders', label: 'Order History', icon: History, subtitle: 'Past transactions' },
    { id: 'dispatch', label: 'Rider Dispatch', icon: Truck, subtitle: 'Hatch handover' },
    { id: 'menu', label: 'Menu Catalog', icon: Sliders, subtitle: 'Recipe connectors' },
    { id: 'inventory', label: 'Stock Registry', icon: Layers, subtitle: 'Material thresholds' },
    { id: 'staff', label: 'Staff Terminals', icon: Terminal, subtitle: 'Key provisions' },
    { id: 'schedule', label: 'Staff Schedule', icon: Calendar, subtitle: 'Shift planner' },
    { id: 'refunds', label: 'Refund Requests', icon: Undo2, subtitle: 'Queue & Review' },
    { id: 'wastage', label: 'Wastage & Remakes', icon: Trash2, subtitle: 'Food loss log' },
    { id: 'outlets', label: 'Hatch queues', icon: LayoutGrid, subtitle: 'Morning HUD & Mood' },
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
              <span className="font-serif italic text-3xl font-black text-[#f8bc51] leading-none">Hau Hau Manager</span>
              <span className="font-mono text-[8px] uppercase tracking-widest text-[#d4c4b0]/40 mt-1">Operational Command</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#f8bc51]/10 text-[#f8bc51] border border-[#f8bc51]/25 px-2 py-0.5 rounded text-[8px] font-mono uppercase font-bold tracking-wider">
              <ShieldCheck size={10} />
              Manager Level
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

        <div className="hidden lg:flex flex-col gap-4 mt-8">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-left px-4 py-3 rounded-2xl text-[#d4c4b0]/60 hover:text-red-400 hover:bg-red-950/20 transition-colors border border-transparent"
          >
            <LogOut size={16} />
            <p className="text-xs uppercase tracking-wider font-mono font-bold">Secure Lock</p>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto overflow-x-hidden theme-scrollbar relative z-10">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full h-full flex"
          >
            {activeTab === 'dashboard' && <DashboardStats onNavigate={(t) => navigateTo(t as TabType)} />}
            {activeTab === 'active_orders' && <OrderManagement />}
            {activeTab === 'orders' && <OrderHistory />}
            {activeTab === 'dispatch' && <RiderDispatch />}
            {activeTab === 'menu' && <MenuManagement userRole="manager" />}
            {activeTab === 'inventory' && <InventoryManagement userRole="manager" />}
            {activeTab === 'staff' && <StaffManagement userRole="manager" />}
            {activeTab === 'schedule' && <ScheduleDashboard />}
            { activeTab === 'outlets' && <OutletManagement /> }
            { activeTab === 'refunds' && <RefundManagement /> }
            { activeTab === 'wastage' && <WastageManagement userRole="manager" /> }
            { activeTab === 'daily_closings' && <DailyClosingManagement outletId="hauhau-main" userRole="manager" /> }
          </motion.div>
        </div>
      </main>

      {/* Floating Copilot Button */}
      <StaffCopilot />

    </div>
  );
}
