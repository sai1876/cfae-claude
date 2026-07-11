import { USERS_COL, ORDERS_COL, MENU_COL, CASH_SESSIONS_COL, EXPENSES_COL } from '@/lib/firebase/collections';
import { collection, doc, getDoc, updateDoc, query, where, orderBy, onSnapshot, getDocs, getCountFromServer, addDoc } from 'firebase/firestore';
import { OrderDocument, MenuItem } from '@/lib/types';
import { fetchOutlets } from '@/features/outlets/outletService';

import { db } from "@/lib/firebase";



/**
 * Calculates how much of a specific stock item was consumed at a specific outlet in the last X days.
 */
export const calculateHistoricalUsage = async (stockId: string, outletId: string, days: number = 7): Promise<number> => {
  const timeLimit = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  const outlets = await fetchOutlets();
  const outlet = outlets.find(o => o.id === outletId);
  if (!outlet) return 0;
  
  const outletName = outlet.name;

  const ordersRef = collection(db, ORDERS_COL);
  const q = query(ordersRef, where("created_at", ">=", timeLimit));
  const orderDocs = await getDocs(q);

  let totalConsumed = 0;

  const validOrders = [];
  const uniqueMenuIds = new Set<string>();

  for (const o of orderDocs.docs) {
    const order = o.data() as OrderDocument;
    // Only count if order belongs to this outlet (using hatch name)
    if (order.status !== 'completed' && order.status !== 'ready') continue;
    if (order.hatch !== outletName) continue;
    validOrders.push(order);
    
    for (const item of order.items) {
      if (item.menu_item_id) {
        uniqueMenuIds.add(item.menu_item_id);
      }
    }
  }

  const menuFetchPromises = Array.from(uniqueMenuIds).map(id => getDoc(doc(db, MENU_COL, id)));
  const menuSnaps = await Promise.all(menuFetchPromises);
  const menuMap = new Map<string, MenuItem>();
  
  for (const snap of menuSnaps) {
    if (snap.exists()) {
      menuMap.set(snap.id, snap.data() as MenuItem);
    }
  }

  for (const order of validOrders) {
    for (const item of order.items) {
      const menuItemId = item.menu_item_id;
      if (menuItemId) {
        const menuItem = menuMap.get(menuItemId);
        if (menuItem && menuItem.recipe) {
          for (const ingredient of menuItem.recipe) {
            if (ingredient.stock_id === stockId) {
              totalConsumed += ingredient.quantity * item.quantity;
            }
          }
        }
      }
    }
  }

  return totalConsumed;
};

// --- Real-time Dashboard Telemetry ---

export const streamTelemetryData = (
  outletName: string | "All",
  timeRange: string = "week",
  callback: (data: any) => void
) => {
  let timeLimit = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let pointsCount = 7;
  
  if (timeRange === "today") {
    timeLimit = new Date().setHours(0,0,0,0);
    pointsCount = 12; // Show last 12 hours
  } else if (timeRange === "month") {
    timeLimit = Date.now() - 30 * 24 * 60 * 60 * 1000;
    pointsCount = 30;
  }

  const q = query(collection(db, ORDERS_COL), where("created_at", ">=", timeLimit));
  
  return onSnapshot(q, async (snapshot) => {
    let orders = snapshot.docs.map(doc => doc.data() as OrderDocument);
    
    if (outletName !== "All") {
      orders = orders.filter(o => o.outlet === outletName || (!o.outlet && o.hatch === outletName));
    }

    let totalUsers = 0;
    try {
       const userSnap = await getCountFromServer(collection(db, USERS_COL));
       totalUsers = userSnap.data().count;
    } catch (e) {
       console.error("Failed to count users", e);
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    const todayTimestamp = today.getTime();

    let todaysRevenue = 0;
    let ordersCompleted = 0;
    let activeQueueLoad = 0;
    const categoryTotals: Record<string, number> = {
      'BIRYANI': 0, 'BEVERAGES': 0, 'BURGERS': 0, 'MOMOS': 0, 'OTHERS': 0
    };

    const hourlyCounts = new Array(24).fill(0);
    const revenuePoints = new Array(pointsCount).fill(0);
    const labels = new Array(pointsCount).fill("");

    // Setup labels based on time range
    if (timeRange === "week") {
      for(let i=0; i<7; i++) {
        const d = new Date(todayTimestamp - (6-i)*24*60*60*1000);
        labels[i] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        if (i===6) labels[i] = `TODAY (${labels[i]})`;
      }
    } else if (timeRange === "today") {
      const currentHour = new Date().getHours();
      for(let i=0; i<12; i++) {
        const hr = (currentHour - 11 + i + 24) % 24;
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const displayHr = hr % 12 || 12;
        labels[i] = `${displayHr}${ampm}`;
      }
    } else if (timeRange === "month") {
      for(let i=0; i<30; i++) {
        const d = new Date(todayTimestamp - (29-i)*24*60*60*1000);
        labels[i] = i % 5 === 0 ? d.getDate().toString() : "";
      }
    }

    orders.forEach(order => {
      // Revenue Trajectory grouping
      const orderDate = new Date(order.created_at);
      
      if (timeRange === "week") {
        orderDate.setHours(0,0,0,0);
        const daysAgo = Math.round((todayTimestamp - orderDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysAgo >= 0 && daysAgo < 7) {
          revenuePoints[6 - daysAgo] += order.gross_amount || 0;
        }
      } else if (timeRange === "today") {
        const currentHour = new Date().getHours();
        const orderHour = orderDate.getHours();
        let hoursAgo = currentHour - orderHour;
        if (hoursAgo < 0) hoursAgo += 24; // If it crossed midnight
        if (hoursAgo >= 0 && hoursAgo < 12) {
          revenuePoints[11 - hoursAgo] += order.gross_amount || 0;
        }
      } else if (timeRange === "month") {
        orderDate.setHours(0,0,0,0);
        const daysAgo = Math.round((todayTimestamp - orderDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysAgo >= 0 && daysAgo < 30) {
          revenuePoints[29 - daysAgo] += order.gross_amount || 0;
        }
      }

      const isCreatedToday = order.created_at >= todayTimestamp;
      const isCompletedToday = order.status === 'completed' && 
        (order.completed_at ? order.completed_at >= todayTimestamp : order.created_at >= todayTimestamp);

      // Completed orders count specifically completed today (matches the 2 orders completed today)
      if (isCompletedToday) {
        ordersCompleted++;
      }

      // Today's stats: include orders created today OR completed today (avoiding double counting)
      if (isCreatedToday || isCompletedToday) {
        todaysRevenue += order.gross_amount || 0;
        
        if (isCreatedToday && ['pending', 'accepted', 'preparing', 'ready'].includes(order.status)) {
          activeQueueLoad++;
        }

        order.items?.forEach(item => {
          const st = item.station || 'GRILLED OR STEAMED';
          const val = item.unit_price * item.quantity;
          if (st === 'FASTFOOD & BIRYANI') categoryTotals['BIRYANI'] += val;
          else if (st === 'BREWER') categoryTotals['BEVERAGES'] += val;
          else if (st === 'FRYER') categoryTotals['BURGERS'] += val;
          else if (st === 'GRILLED OR STEAMED') categoryTotals['MOMOS'] += val;
          else categoryTotals['OTHERS'] += val;
        });

        if (isCreatedToday) {
          const orderHour = new Date(order.created_at).getHours();
          hourlyCounts[orderHour]++;
        }
      }
    });

    const totalCategoryRevenue = Object.values(categoryTotals).reduce((a,b) => a+b, 0) || 1;
    const categories = [
      { name: 'Biryani', percentage: Math.round((categoryTotals['BIRYANI']/totalCategoryRevenue)*100), color: '#f8bc51', amount: `₹${categoryTotals['BIRYANI']}` },
      { name: 'Beverages', percentage: Math.round((categoryTotals['BEVERAGES']/totalCategoryRevenue)*100), color: '#e8621a', amount: `₹${categoryTotals['BEVERAGES']}` },
      { name: 'Burgers', percentage: Math.round((categoryTotals['BURGERS']/totalCategoryRevenue)*100), color: '#e4b595', amount: `₹${categoryTotals['BURGERS']}` },
      { name: 'Momos', percentage: Math.round((categoryTotals['MOMOS']/totalCategoryRevenue)*100), color: '#a27b5c', amount: `₹${categoryTotals['MOMOS']}` },
      { name: 'Others', percentage: Math.round((categoryTotals['OTHERS']/totalCategoryRevenue)*100), color: '#413220', amount: `₹${categoryTotals['OTHERS']}` },
    ].sort((a,b) => b.percentage - a.percentage);

    const queuePeakData = [];
    for (let i = 8; i <= 22; i+=2) {
      const count = hourlyCounts[i] + (hourlyCounts[i+1] || 0);
      const ampm = i >= 12 ? 'PM' : 'AM';
      const hr = i > 12 ? i - 12 : i;
      queuePeakData.push({ hour: `${hr} ${ampm}`, orders: count });
    }

    callback({
      todaysRevenue: `₹${todaysRevenue}`,
      ordersCompleted: ordersCompleted.toString(),
      activeQueueLoad: `${activeQueueLoad} Orders`,
      loyaltyPatrons: totalUsers.toString(),
      revenuePoints: revenuePoints,
      trajectoryLabels: labels,
      queuePeakData,
      categories
    });
  });
};

// --- Approvals ---







export const createCashRegisterSession = async (sessionData: any) => {
  const docRef = await addDoc(collection(db, CASH_SESSIONS_COL), {
    ...sessionData,
    opened_at: new Date().toISOString(),
    closing_cash: null
  });
  return docRef.id;
};

export const closeCashRegisterSession = async (id: string, closingCash: number, expectedCash: number, cashNote: string) => {
  await updateDoc(doc(db, CASH_SESSIONS_COL, id), {
    closing_cash: closingCash,
    expected_cash: expectedCash,
    cash_note: cashNote,
    closed_at: new Date().toISOString()
  });
};

export const fetchCashRegisterSessions = async () => {
  const q = query(collection(db, CASH_SESSIONS_COL), orderBy('opened_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addExpenseRecord = async (expenseData: any) => {
  await addDoc(collection(db, EXPENSES_COL), {
    ...expenseData,
    timestamp: new Date().toISOString()
  });
};

export const fetchExpensesList = async () => {
  const q = query(collection(db, EXPENSES_COL), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
