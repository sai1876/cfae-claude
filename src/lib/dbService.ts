import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit, 
  getDocs,
  runTransaction,
  writeBatch,
  getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import { BACKUP_MENU_RECIPES } from "./constants";
import { OrderDocument, UserDocument, UIConfig, SliderItem, MenuItem, StockItem, Offer, Staff, IngredientRecipe, ModGroup, ModOption, Outlet, ConversionRecipe, DoughBatch } from "./types";

// --- Collection References ---
const USERS_COL = "users";
const ORDERS_COL = "orders";
const CONFIG_COL = "config";
const MENU_COL = "menu";
const STOCKS_COL = "stocks";
const OFFERS_COL = "offers";
const STAFF_COL = "staff";
const OUTLETS_COL = "outlets";
const APPROVALS_COL = "approvals";
const CONVERSION_RECIPES_COL = "conversion_recipes";
const DOUGH_BATCHES_COL = "dough_batches";
const SLIDER_ITEMS_COL = "slider_items";


// --- User Profile Actions ---

/**
 * Creates or updates a customer profile in Firestore
 */
export const createUserProfile = async (
  userId: string, 
  phone: string, 
  name?: string,
  studentEmail?: string,
  referredBy?: string
): Promise<UserDocument> => {
  const userRef = doc(db, USERS_COL, userId);
  
  // Check if profile already exists
  const existingDoc = await getDoc(userRef);
  if (existingDoc.exists()) {
    return existingDoc.data() as UserDocument;
  }

  // Find referrer first if any (Queries are easier outside transaction)
  let referrerRef = null;
  let referrerPoints = 0;
  if (referredBy) {
    const q = query(collection(db, USERS_COL), where("referral_code", "==", referredBy));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const rDoc = querySnapshot.docs[0];
      referrerRef = doc(db, USERS_COL, rDoc.id);
      referrerPoints = rDoc.data().points || 0;
    }
  }

  // Generate a distinct referral code
  const referralCode = `Hau Hau_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const newProfile: UserDocument = {
    user_id: userId,
    phone,
    name: name || "",
    student_email: studentEmail || "",
    email_verified: !!studentEmail,
    points: 100, // Welcome points!
    referral_code: referralCode,
    referred_by: referredBy || "",
    account_status: "active",
    created_at: Date.now()
  };

  try {
    const batch = writeBatch(db);
    batch.set(userRef, newProfile);
    
    if (referrerRef) {
      batch.update(referrerRef, { points: referrerPoints + 50 });
    }
    
    await batch.commit();
    return newProfile;
  } catch (error) {
    console.error("Failed to create profile atomically", error);
    throw error;
  }
};

/**
 * Retreives user metadata from Firestore
 */
export const getUserProfile = async (userId: string): Promise<UserDocument | null> => {
  const userRef = doc(db, USERS_COL, userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? (snap.data() as UserDocument) : null;
};

/**
 * Updates any field of the user's profile in Firestore
 */
export const updateUserProfile = async (
  userId: string,
  data: Partial<UserDocument>
): Promise<void> => {
  const userRef = doc(db, USERS_COL, userId);
  await updateDoc(userRef, data);
};

export const issueStressCoupon = async (userId: string): Promise<boolean> => {
  const userRef = doc(db, USERS_COL, userId);
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) return false;
      
      const userData = snap.data() as UserDocument;
      let currentUsage = userData.stress_coupons_issued;
      
      if (!currentUsage || currentUsage.month !== currentMonth) {
        currentUsage = { month: currentMonth, count: 0 };
      }
      
      if (currentUsage.count >= 2) {
        return false; // Limit reached
      }
      
      currentUsage.count += 1;
      transaction.update(userRef, { stress_coupons_issued: currentUsage });
      return true;
    });
  } catch (error) {
    console.error("Failed to issue stress coupon atomically:", error);
    return false;
  }
};

// --- Order System Actions ---

/**
 * Writes an order document into Firestore with atomic token sequencing
 */
export const createOrder = async (
  userId: string,
  grossAmount: number,
  pointsRedeemed: number,
  orderType: 'dine-in' | 'pickup' | 'delivery',
  items: {
    menuItemId: string;
    item_id?: string;
    name: string;
    quantity: number;
    price: number;
    station?: MenuItem['station'];
    modifiers?: string[];
  }[],
  hatch?: string,
  tableNo?: string,
  outlet?: string,
  deliveryAddress?: string,
  deliveryCoordinates?: { lat: number; lng: number }
): Promise<OrderDocument> => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let orderId = '';
  for (let i = 0; i < 8; i++) {
    orderId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const orderRef = doc(db, ORDERS_COL, orderId);
  
  let orderData: OrderDocument;

  // 1. Fetch menu items and identify required stocks before transaction starts
  const uniqueMenuItemIds = [...new Set(items.map(item => item.menuItemId || item.item_id || "").filter(Boolean))];
  const menuSnaps = await Promise.all(uniqueMenuItemIds.map(id => getDoc(doc(db, MENU_COL, id))));
  const menuMap = new Map<string, MenuItem>();
  menuSnaps.forEach(snap => {
    if (snap.exists()) {
      menuMap.set(snap.id, snap.data() as MenuItem);
    }
  });

  // 2. Identify required backup stock document IDs
  const backupRecipeNames = new Set<string>();
  items.forEach((item) => {
    const menuItemId = item.menuItemId || item.item_id || "";
    const menuData = menuMap.get(menuItemId);
    if (!menuData?.recipe || menuData.recipe.length === 0) {
      const overrides = BACKUP_MENU_RECIPES[menuItemId];
      if (overrides) {
        overrides.forEach(ov => backupRecipeNames.add(ov.name));
      }
    }
  });

  const backupStockMap = new Map<string, string>();
  if (backupRecipeNames.size > 0) {
    const stockFetchPromises = Array.from(backupRecipeNames).map(async name => {
      const q = query(collection(db, STOCKS_COL), where("name", "==", name));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        backupStockMap.set(name, qSnap.docs[0].id);
      }
    });
    await Promise.all(stockFetchPromises);
  }

  // 3. Accumulate required quantities for each stock ID to fetch them in transaction
  const requiredQuantities = new Map<string, number>();
  
  for (const item of items) {
    const menuItemId = item.menuItemId || item.item_id || "";
    const quantity = item.quantity || 1;
    const menuData = menuMap.get(menuItemId);
    const recipeIngredients = menuData?.recipe || [];
    const customGroups = menuData?.customizationOptions || [];

    if (recipeIngredients.length > 0) {
      for (const ing of recipeIngredients) {
        requiredQuantities.set(ing.stock_id, (requiredQuantities.get(ing.stock_id) || 0) + ing.quantity * quantity);
      }
    } else {
      const backupRecipes = BACKUP_MENU_RECIPES[menuItemId] || [];

      for (const recipe of backupRecipes) {
        const stockId = backupStockMap.get(recipe.name);
        if (stockId) {
          requiredQuantities.set(stockId, (requiredQuantities.get(stockId) || 0) + recipe.requiredQty * quantity);
        }
      }
    }

    // Process modifiers customizations
    if (item.modifiers && item.modifiers.length > 0 && customGroups.length > 0) {
      for (const selectedMod of item.modifiers) {
        for (const group of customGroups) {
          const matchedOpt = group.options.find(
            (opt: ModOption) => opt.name.toLowerCase().trim() === selectedMod.toLowerCase().trim()
          );
          if (matchedOpt && matchedOpt.stock_id && matchedOpt.quantity) {
            requiredQuantities.set(
              matchedOpt.stock_id, 
              (requiredQuantities.get(matchedOpt.stock_id) || 0) + matchedOpt.quantity * quantity
            );
          }
        }
      }
    }
  }

  const alertsToTrigger: { name: string; current: number; threshold: number; unit: string }[] = [];

  try {
    const sequenceRef = doc(db, CONFIG_COL, "order_sequence");
    const userRef = doc(db, USERS_COL, userId);
    const configRef = doc(db, CONFIG_COL, "store_settings");

    await runTransaction(db, async (transaction) => {
      // A. Fetch all required stock items inside the transaction
      const stockIds = Array.from(requiredQuantities.keys());
      const stockSnaps = await Promise.all(
        stockIds.map(id => transaction.get(doc(db, STOCKS_COL, id)))
      );
      
      const stockDataMap = new Map<string, any>();
      stockSnaps.forEach(snap => {
        if (snap.exists()) {
          stockDataMap.set(snap.id, snap.data());
        }
      });

      // B. Verify stock quantities inside the transaction
      for (const [stockId, requiredQty] of requiredQuantities.entries()) {
        const stockData = stockDataMap.get(stockId);
        if (!stockData) continue; // If stock item is not configured, skip validation
        
        const currentQty = stockData.current_quantity || 0;
        if (currentQty < requiredQty) {
          throw new Error(`Insufficient stock for ingredient: ${stockData.name}`);
        }
      }

      // C. Perform writes: update stock quantities and collect alerts
      for (const [stockId, requiredQty] of requiredQuantities.entries()) {
        const stockRef = doc(db, STOCKS_COL, stockId);
        const stockData = stockDataMap.get(stockId);
        const currentQty = stockData.current_quantity || 0;
        const newQty = Math.max(0, currentQty - requiredQty);
        
        transaction.update(stockRef, {
          current_quantity: newQty,
          last_updated: Date.now()
        });

        if (newQty < stockData.low_threshold && currentQty >= stockData.low_threshold) {
          alertsToTrigger.push({ name: stockData.name, current: newQty, threshold: stockData.low_threshold, unit: stockData.unit });
        }
      }

      // 1. Get sequence & rush mode config
      const seqDoc = await transaction.get(sequenceRef);
      let currentSeq = 1;
      const today = new Date().toDateString();

      if (seqDoc.exists()) {
        const data = seqDoc.data();
        if (data.date === today) {
          currentSeq = (data.last_val || 0) + 1;
        }
      }
      
      const tokenStr = currentSeq.toString().padStart(4, "0");

      // 2. Fetch rush mode setting
      const configSnap = await transaction.get(configRef);
      const rushModeActive = configSnap.exists() ? !!configSnap.data().rush_mode_active : false;

      // 3. Get user
      const userSnap = await transaction.get(doc(db, USERS_COL, userId));
      if (!userSnap.exists()) {
        throw new Error("User does not exist");
      }
      
      // 4. Prepare order data
      orderData = {
        order_id: orderRef.id,
        token_number: tokenStr,
        user_id: userId,
        gross_amount: grossAmount,
        points_redeemed: pointsRedeemed,
        cash_paid: 0,
        order_type: orderType,
        ...(hatch ? { hatch } : {}),
        ...(tableNo ? { table_no: tableNo } : {}),
        outlet: outlet || "HYD CAMPUS",
        ...(deliveryAddress ? { delivery_address: deliveryAddress } : {}),
        ...(deliveryCoordinates ? { delivery_coordinates: deliveryCoordinates } : {}),
        ...(orderType === 'delivery' ? { otp: Math.floor(1000 + Math.random() * 9000).toString() } : {}),
        status: "pending",
        rush_held: rushModeActive,
        estimated_time_mins: 8,
        items: items.map(item => ({
          item_id: Math.random().toString(36).substring(7),
          menu_item_id: item.menuItemId || item.item_id || "",
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          station: item.station || "GRILLED OR STEAMED",
          status: "pending",
          modifiers: item.modifiers || []
        })),
        created_at: Date.now(),
        updated_at: Date.now()
      };

      // 5. Execute all writes atomically
      transaction.set(sequenceRef, { date: today, last_val: currentSeq });
      transaction.set(orderRef, orderData);
    });

    // 6. Trigger low-stock emails (post-commit)
    for (const alert of alertsToTrigger) {
      try {
        let smtpUser = "";
        let smtpPass = "";
        let ownerEmail = "";
        if (typeof window !== "undefined") {
          smtpUser = localStorage.getItem("Hau Hau_smtp_user") || "";
          smtpPass = localStorage.getItem("Hau Hau_smtp_pass") || "";
          ownerEmail = localStorage.getItem("Hau Hau_smtp_owner_email") || "";
        }
        await fetch('/api/send-alert-email', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY}`
          },
          body: JSON.stringify({
            ingredient: alert.name,
            current: alert.current,
            threshold: alert.threshold,
            unit: alert.unit,
            smtpUser,
            smtpPass,
            ownerEmail
          })
        });
      } catch (err) {
        console.warn("Failed to trigger low stock email post-commit:", err);
      }
    }

    // 7. Process Mutual Growth Points Ledger (Post-Transaction)
    try {
      const { apply_wallet_points } = await import('./checkout');
      await apply_wallet_points(userId, grossAmount, pointsRedeemed);
    } catch (ptsErr) {
      console.error("Failed to process point ledger in Firestore:", ptsErr);
    }

    return orderData!;
  } catch (error) {
    console.error("Transactional order creation failed: ", error);
    throw error;
  }
};

/**
 * Real-time listener for current customer's order history
 */
export const streamUserOrders = (
  userId: string,
  callback: (orders: OrderDocument[]) => void
) => {
  const q = query(
    collection(db, ORDERS_COL),
    where("user_id", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const orders: OrderDocument[] = [];
    snapshot.forEach((doc) => {
      orders.push(doc.data() as OrderDocument);
    });
    // Sort in memory to avoid missing index errors
    orders.sort((a, b) => b.created_at - a.created_at);
    callback(orders.slice(0, 5));
  }, (err) => {
    console.error("Failed to stream customer orders: ", err);
  });
};

/**
 * Fetch customer's order history once
 */
export const getUserOrders = async (userId: string): Promise<OrderDocument[]> => {
  const q = query(
    collection(db, ORDERS_COL),
    where("user_id", "==", userId)
  );
  const snapshot = await getDocs(q);
  const orders: OrderDocument[] = [];
  snapshot.forEach((doc) => {
    orders.push(doc.data() as OrderDocument);
  });
  // Sort in memory to avoid missing index errors
  orders.sort((a, b) => b.created_at - a.created_at);
  return orders.slice(0, 20);
};

// --- Store UI Config Streams ---

/**
 * Stream manager settings for layout and weather theme
 */
export const streamUIConfig = (callback: (config: UIConfig) => void) => {
  return onSnapshot(doc(db, CONFIG_COL, "store_settings"), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as UIConfig);
    } else {
      // Default fallback settings
      callback({
        active_theme: "default",
        hero_headline: "Your escape from the heat.",
        hero_sub: "Mist-cooling and chilled vibes.",
        banner_active: true,
        banner_text: "Beat the heat — order ready in 8 mins",
        banner_color: "golden",
        pickup_time_mins: 8,
        delivery_time_mins: 15,
        is_open: true,
        delivery_available: true,
        featured_items: [],
        social_stats: [
          { value: '3,600+', label: 'Students' },
          { value: '8 min', label: 'Avg Pickup' },
          { value: '₹15', label: 'Delivery Fee' }
        ],
        social_stats_active: true,
        updated_at: Date.now()
      });
    }
  }, (err) => {
    console.error("UI Configuration stream failed: ", err);
  });
};

/**
 * Save storefront UI Configuration to Firestore
 */
export const saveUIConfig = async (config: Partial<UIConfig>): Promise<void> => {
  const docRef = doc(db, CONFIG_COL, "store_settings");
  await setDoc(docRef, {
    ...config,
    updated_at: Date.now()
  }, { merge: true });
};

/**
 * Stream all dynamic calendar events
 */
export const streamCalendarEvents = (callback: (events: any[]) => void) => {
  const q = query(collection(db, "calendar_events"));
  return onSnapshot(q, (snapshot) => {
    const events: any[] = [];
    snapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });
    callback(events);
  });
};

/**
 * Save / Update a dynamic calendar event in Firestore
 */
export const saveCalendarEvent = async (id: string, data: any): Promise<void> => {
  const docRef = doc(db, "calendar_events", id);
  await setDoc(docRef, {
    ...data,
    updated_at: Date.now()
  }, { merge: true });
};

/**
 * Delete a dynamic calendar event from Firestore
 */
export const deleteCalendarEvent = async (id: string): Promise<void> => {
  const docRef = doc(db, "calendar_events", id);
  await deleteDoc(docRef);
};


/**
 * Stream all active hero slider items
 */
export const streamSliderItems = (callback: (items: SliderItem[]) => void) => {
  const q = query(collection(db, SLIDER_ITEMS_COL), orderBy("sort_order", "asc"));
  return onSnapshot(q, (snapshot) => {
    const items: SliderItem[] = [];
    snapshot.forEach((doc) => {
      items.push(doc.data() as SliderItem);
    });
    callback(items);
  }, (err) => {
    console.error("Slider items stream failed: ", err);
  });
};

/**
 * Save or update a hero slider item
 */
export const saveSliderItem = async (item: SliderItem): Promise<void> => {
  const docRef = doc(db, SLIDER_ITEMS_COL, item.id);
  await setDoc(docRef, item);
};

/**
 * Delete a hero slider item
 */
export const deleteSliderItem = async (id: string): Promise<void> => {
  const docRef = doc(db, SLIDER_ITEMS_COL, id);
  await deleteDoc(docRef);
};

// --- Menu Catalog CRUD Operations ---
export const fetchMenuItems = async (): Promise<MenuItem[]> => {
  try {
    const q = query(collection(db, MENU_COL), orderBy("sort_order", "asc"));
    const snap = await getDocs(q);
    const items: MenuItem[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (!data.deleted) {
        items.push(data as MenuItem);
      }
    });
    return items;
  } catch (err) {
    console.error("Failed to fetch menu items from Firestore: ", err);
    return [];
  }
};

export const saveMenuItem = async (item: MenuItem): Promise<void> => {
  const docRef = doc(db, MENU_COL, item.item_id);
  await setDoc(docRef, item);
};

export const deleteMenuItem = async (itemId: string): Promise<void> => {
  const docRef = doc(db, MENU_COL, itemId);
  await updateDoc(docRef, { deleted: true });
};

// --- Stock Registry CRUD Operations ---
export const fetchStocks = async (): Promise<StockItem[]> => {
  const snap = await getDocs(collection(db, STOCKS_COL));
  const stocks: StockItem[] = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (!data.deleted) {
      stocks.push(data as StockItem);
    }
  });
  return stocks;
};

export const saveStockItem = async (item: StockItem): Promise<void> => {
  const docRef = doc(db, STOCKS_COL, item.stock_id);
  await setDoc(docRef, item);
};

export const deleteStockItem = async (stockId: string): Promise<void> => {
  const docRef = doc(db, STOCKS_COL, stockId);
  await updateDoc(docRef, { deleted: true });
};

// --- Offer Campaigns CRUD Operations ---
export const fetchOffers = async (): Promise<Offer[]> => {
  try {
    const snap = await getDocs(collection(db, OFFERS_COL));
    const offers: Offer[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (!data.deleted) {
        offers.push(data as Offer);
      }
    });
    return offers;
  } catch (err) {
    console.error("Failed to fetch offers from Firestore: ", err);
    return [];
  }
};

export const saveOffer = async (offer: Offer): Promise<void> => {
  const docRef = doc(db, OFFERS_COL, offer.code);
  await setDoc(docRef, offer);
};

export const deleteOffer = async (code: string): Promise<void> => {
  const docRef = doc(db, OFFERS_COL, code);
  await updateDoc(docRef, { deleted: true });
};

// --- Staff CRUD Operations ---
export const fetchStaffList = async (): Promise<Staff[]> => {
  try {
    const snap = await getDocs(collection(db, STAFF_COL));
    const staff: Staff[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (!data.deleted) {
        staff.push(data as Staff);
      }
    });
    return staff;
  } catch (err) {
    console.error("Failed to fetch staff from Firestore: ", err);
    return [];
  }
};

export const saveStaff = async (staffMember: Staff): Promise<void> => {
  const docRef = doc(db, STAFF_COL, staffMember.id);
  await setDoc(docRef, staffMember);
};

export const deleteStaff = async (id: string): Promise<void> => {
  const docRef = doc(db, STAFF_COL, id);
  await updateDoc(docRef, { deleted: true });
};


// --- KDS Order State Updates & Transactional Stock Deductions ---

/**
 * Updates order status and automatically deducts ingredients when preparing starts
 */
export const updateOrderStatus = async (
  orderId: string, 
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'rejected'
): Promise<void> => {
  const orderRef = doc(db, ORDERS_COL, orderId);
  await updateDoc(orderRef, { status });

  // Automatically refund ingredients if order is rejected
  if (status === 'rejected') {
    try {
      await refundIngredientsForOrder(orderId);
    } catch (err) {
      console.error("Failed to automatically refund recipe ingredients: ", err);
    }
  }
};

/**
 * Transaction-based ingredient stock auto-deduction
 */
export const deductIngredientsForOrder = async (orderId: string): Promise<void> => {
  const orderRef = doc(db, ORDERS_COL, orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) return;
  const order = orderSnap.data();
  const items = order.items || [];

  // Read local storage settings for SMTP overrides if we are in a client environment
  let smtpUser = "";
  let smtpPass = "";
  let ownerEmail = "";
  if (typeof window !== "undefined") {
    smtpUser = localStorage.getItem("Hau Hau_smtp_user") || "";
    smtpPass = localStorage.getItem("Hau Hau_smtp_pass") || "";
    ownerEmail = localStorage.getItem("Hau Hau_smtp_owner_email") || "";
  }

  const triggerLowStockEmail = async (name: string, current: number, threshold: number, unit: string) => {
    try {
      await fetch('/api/send-alert-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY}`
        },
        body: JSON.stringify({
          ingredient: name,
          current,
          threshold,
          unit,
          smtpUser,
          smtpPass,
          ownerEmail
        })
      });
      console.log(`⚠️ Alert email automatically triggered for low stock of: ${name}`);
    } catch (e) {
      console.warn("Auto stock-alert email delivery failed: ", e);
    }
  };

  const processStockDeduction = async (stockId: string, qtyToDeduct: number) => {
    const stockRef = doc(db, STOCKS_COL, stockId);
    const stockSnap = await getDoc(stockRef);
    if (stockSnap.exists()) {
      const data = stockSnap.data();
      const currentQty = data.current_quantity || 0;
      const newQty = Math.max(0, currentQty - qtyToDeduct);
      await updateDoc(stockRef, {
        current_quantity: newQty,
        last_updated: Date.now()
      });
      if (newQty < data.low_threshold && currentQty >= data.low_threshold) {
        await triggerLowStockEmail(data.name, newQty, data.low_threshold, data.unit);
      }
    }
  };

  // 1. Pre-fetch all unique menu items
  const uniqueMenuItemIds = [...new Set(items.map((item: any) => item.menu_item_id).filter(Boolean))];
  const menuFetchPromises = uniqueMenuItemIds.map(id => getDoc(doc(db, MENU_COL, id)));
  const menuSnaps = await Promise.all(menuFetchPromises);
  
  const menuMap = new Map<string, MenuItem>();
  menuSnaps.forEach(snap => {
    if (snap.exists()) {
      menuMap.set(snap.id, snap.data() as MenuItem);
    }
  });

  // 2. Pre-fetch backup recipe stocks if needed
  const backupRecipeNames = new Set<string>();
  items.forEach((item: any) => {
    const menuItemId = item.menu_item_id || "";
    const menuData = menuMap.get(menuItemId);
    if (!menuData?.recipe || menuData.recipe.length === 0) {
      const overrides = BACKUP_MENU_RECIPES[menuItemId];
      if (overrides) {
        overrides.forEach(ov => backupRecipeNames.add(ov.name));
      }
    }
  });

  const backupStockMap = new Map<string, string>();
  if (backupRecipeNames.size > 0) {
    const stockFetchPromises = Array.from(backupRecipeNames).map(async name => {
      const q = query(collection(db, STOCKS_COL), where("name", "==", name));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        backupStockMap.set(name, qSnap.docs[0].id);
      }
    });
    await Promise.all(stockFetchPromises);
  }

  // 3. Accumulate all deductions to avoid race conditions
  const deductionsMap = new Map<string, number>();
  const addDeduction = (stockId: string, qty: number) => {
    deductionsMap.set(stockId, (deductionsMap.get(stockId) || 0) + qty);
  };

  for (const item of items) {
    const menuItemId = item.menu_item_id || "";
    const quantity = item.quantity || 1;
    const menuData = menuMap.get(menuItemId);
    const recipeIngredients = menuData?.recipe || [];
    const customGroups = menuData?.customizationOptions || [];

    // Process Recipe Ingredient Deductions
    if (recipeIngredients.length > 0) {
      for (const ing of recipeIngredients) {
        addDeduction(ing.stock_id, ing.quantity * quantity);
      }
    } else {
      const backupRecipes = BACKUP_MENU_RECIPES[menuItemId] || [];

      for (const recipe of backupRecipes) {
        const stockId = backupStockMap.get(recipe.name);
        if (stockId) {
          addDeduction(stockId, recipe.requiredQty * quantity);
        }
      }
    }

    // Process Customization Modifier Options Deductions
    if (item.modifiers && item.modifiers.length > 0 && customGroups.length > 0) {
      for (const selectedMod of item.modifiers) {
        for (const group of customGroups) {
          const matchedOpt = group.options.find(
            (opt: ModOption) => opt.name.toLowerCase().trim() === selectedMod.toLowerCase().trim()
          );
          if (matchedOpt && matchedOpt.stock_id && matchedOpt.quantity) {
            addDeduction(matchedOpt.stock_id, matchedOpt.quantity * quantity);
          }
        }
      }
    }
  }

  // 4. Process all accumulated deductions concurrently
  const processingPromises = Array.from(deductionsMap.entries()).map(([stockId, qtyToDeduct]) => 
    processStockDeduction(stockId, qtyToDeduct)
  );
  await Promise.all(processingPromises);
};

/**
 * Refund deducted ingredients for a rejected order
 */
export const refundIngredientsForOrder = async (orderId: string): Promise<void> => {
  const orderRef = doc(db, ORDERS_COL, orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) return;
  const order = orderSnap.data();
  const items = order.items || [];

  const processStockRefund = async (stockId: string, qtyToRefund: number) => {
    const stockRef = doc(db, STOCKS_COL, stockId);
    const stockSnap = await getDoc(stockRef);
    if (stockSnap.exists()) {
      const data = stockSnap.data();
      const currentQty = data.current_quantity || 0;
      const newQty = currentQty + qtyToRefund;
      await updateDoc(stockRef, {
        current_quantity: newQty,
        last_updated: Date.now()
      });
    }
  };

  // 1. Pre-fetch all unique menu items
  const uniqueMenuItemIds = [...new Set(items.map((item: any) => item.menu_item_id).filter(Boolean))];
  const menuFetchPromises = uniqueMenuItemIds.map(id => getDoc(doc(db, MENU_COL, id)));
  const menuSnaps = await Promise.all(menuFetchPromises);
  
  const menuMap = new Map<string, MenuItem>();
  menuSnaps.forEach(snap => {
    if (snap.exists()) {
      menuMap.set(snap.id, snap.data() as MenuItem);
    }
  });

  // 2. Pre-fetch backup recipe stocks if needed
  const backupRecipeNames = new Set<string>();
  items.forEach((item: any) => {
    const menuItemId = item.menu_item_id || "";
    const menuData = menuMap.get(menuItemId);
    if (!menuData?.recipe || menuData.recipe.length === 0) {
      const overrides = BACKUP_MENU_RECIPES[menuItemId];
      if (overrides) {
        overrides.forEach(ov => backupRecipeNames.add(ov.name));
      }
    }
  });

  const backupStockMap = new Map<string, string>();
  if (backupRecipeNames.size > 0) {
    const stockFetchPromises = Array.from(backupRecipeNames).map(async name => {
      const q = query(collection(db, STOCKS_COL), where("name", "==", name));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        backupStockMap.set(name, qSnap.docs[0].id);
      }
    });
    await Promise.all(stockFetchPromises);
  }

  // 3. Accumulate all refunds
  const refundsMap = new Map<string, number>();
  const addRefund = (stockId: string, qty: number) => {
    refundsMap.set(stockId, (refundsMap.get(stockId) || 0) + qty);
  };

  for (const item of items) {
    const menuItemId = item.menu_item_id || "";
    const quantity = item.quantity || 1;
    const menuData = menuMap.get(menuItemId);
    const recipeIngredients = menuData?.recipe || [];
    const customGroups = menuData?.customizationOptions || [];

    // Process Recipe Ingredient Refunds
    if (recipeIngredients.length > 0) {
      for (const ing of recipeIngredients) {
        addRefund(ing.stock_id, ing.quantity * quantity);
      }
    } else {
      const backupRecipes = BACKUP_MENU_RECIPES[menuItemId] || [];

      for (const recipe of backupRecipes) {
        const stockId = backupStockMap.get(recipe.name);
        if (stockId) {
          addRefund(stockId, recipe.requiredQty * quantity);
        }
      }
    }

    // Process Customization Modifier Options Refunds
    if (item.modifiers && item.modifiers.length > 0 && customGroups.length > 0) {
      for (const selectedMod of item.modifiers) {
        for (const group of customGroups) {
          const matchedOpt = group.options.find(
            (opt: ModOption) => opt.name.toLowerCase().trim() === selectedMod.toLowerCase().trim()
          );
          if (matchedOpt && matchedOpt.stock_id && matchedOpt.quantity) {
            addRefund(matchedOpt.stock_id, matchedOpt.quantity * quantity);
          }
        }
      }
    }
  }

  // 4. Process all refunds concurrently
  const processingPromises = Array.from(refundsMap.entries()).map(([stockId, qtyToRefund]) => 
    processStockRefund(stockId, qtyToRefund)
  );
  await Promise.all(processingPromises);
};

// --- Outlet Management ---

export const fetchOutlets = async (): Promise<Outlet[]> => {
  try {
    const snap = await getDocs(collection(db, OUTLETS_COL));
    const outlets: Outlet[] = [];
    snap.forEach((doc) => {
      outlets.push(doc.data() as Outlet);
    });
    return outlets;
  } catch (err) {
    console.error("Failed to fetch outlets from Firestore: ", err);
    return [];
  }
};

export const getOutletCoordinates = async (outletId: string): Promise<{latitude: number, longitude: number} | null> => {
  const outlets = await fetchOutlets();
  const outlet = outlets.find(o => o.id === outletId);
  if (outlet) {
    return { latitude: outlet.latitude, longitude: outlet.longitude };
  }
  return null;
};

// --- Delivery Actions ---

export const bulkDispatchOrders = async (orderIds: string[], riderId: string): Promise<void> => {
  const batch = writeBatch(db);
  orderIds.forEach(orderId => {
    const orderRef = doc(db, ORDERS_COL, orderId);
    batch.update(orderRef, {
      status: 'out_for_delivery',
      rider_id: riderId,
      updated_at: Date.now()
    });
  });
  await batch.commit();
};

export const logSecurityAlert = async (managerId: string, managerName: string, actionDetails: string): Promise<void> => {
  const alertId = `alert_${Date.now()}`;
  const docRef = doc(db, APPROVALS_COL, alertId);
  await setDoc(docRef, {
    request_id: alertId,
    requested_by: managerId,
    timestamp: Date.now(),
    action_type: 'security_alert',
    status: 'pending',
    reason: 'Suspicious Activity Detected',
    payload: { details: actionDetails, managerName }
  });
};

export const markOrderAsDelivered = async (orderId: string): Promise<void> => {
  const orderRef = doc(db, ORDERS_COL, orderId);
  await updateDoc(orderRef, {
    status: 'delivered',
    completed_at: Date.now()
  });
};

// --- Customer Feedback ---

/**
 * Submits a star rating + optional comment on a delivered order
 */
export const submitOrderFeedback = async (
  orderId: string,
  rating: number,
  comment: string
): Promise<void> => {
  const orderRef = doc(db, ORDERS_COL, orderId);
  await updateDoc(orderRef, {
    feedback: {
      rating,
      comment: comment.trim(),
      submitted_at: Date.now(),
    },
  });
};

// --- Smart Refill AI Helper ---

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
    if (order.status !== 'delivered' && order.status !== 'ready') continue;
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
      const orderTimestamp = order.created_at;
      
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
      const isCompletedToday = order.status === 'delivered' && 
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
import { ApprovalRequest } from './types';

export const streamApprovals = (callback: (data: ApprovalRequest[]) => void) => {
  const q = query(collection(db, APPROVALS_COL));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => doc.data() as ApprovalRequest);
    data.sort((a, b) => b.timestamp - a.timestamp);
    callback(data);
  }, (err) => {
    console.error("Failed to fetch approvals: ", err);
  });
};

export const updateApprovalStatus = async (requestId: string, status: 'approved' | 'rejected') => {
  const ref = doc(db, APPROVALS_COL, requestId);
  await updateDoc(ref, { status });
};

export const submitApprovalRequest = async (request: Omit<ApprovalRequest, 'request_id' | 'timestamp' | 'status'>) => {
  const requestId = `req_${Date.now()}`;
  const fullRequest: ApprovalRequest = {
    ...request,
    request_id: requestId,
    timestamp: Date.now(),
    status: 'pending'
  };
  await setDoc(doc(db, APPROVALS_COL, requestId), fullRequest);
  return requestId;
};

// --- Dough Conversion Recipes & Batches telemetry ---

export const fetchConversionRecipes = async (): Promise<ConversionRecipe[]> => {
  try {
    const snap = await getDocs(collection(db, CONVERSION_RECIPES_COL));
    const recipes: ConversionRecipe[] = [];
    snap.forEach((doc) => {
      recipes.push(doc.data() as ConversionRecipe);
    });
    return recipes;
  } catch (err) {
    console.error("Failed to fetch conversion recipes: ", err);
    return [];
  }
};

export const streamActiveBatches = (
  outletId: string,
  callback: (batches: DoughBatch[]) => void
) => {
  const q = query(
    collection(db, DOUGH_BATCHES_COL),
    where("outlet_id", "==", outletId),
    where("batch_status", "==", "active")
  );
  return onSnapshot(q, (snapshot) => {
    const batches: DoughBatch[] = [];
    snapshot.forEach((doc) => {
      batches.push(doc.data() as DoughBatch);
    });
    callback(batches);
  }, (err) => {
    console.error("Failed to stream active batches: ", err);
  });
};

export const streamBatchLogs = (
  outletId: string,
  callback: (batches: DoughBatch[]) => void
) => {
  const q = query(
    collection(db, DOUGH_BATCHES_COL),
    where("outlet_id", "==", outletId)
  );
  return onSnapshot(q, (snapshot) => {
    const batches: DoughBatch[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as DoughBatch;
      if (data.batch_status !== 'active') {
        batches.push(data);
      }
    });
    // Sort completed/flagged logs in reverse chronological order
    batches.sort((a, b) => (b.batch_end_time || 0) - (a.batch_end_time || 0));
    callback(batches);
  }, (err) => {
    console.error("Failed to stream batch logs: ", err);
  });
};

export const streamAllBatches = (
  callback: (batches: DoughBatch[]) => void
) => {
  const q = query(collection(db, DOUGH_BATCHES_COL));
  return onSnapshot(q, (snapshot) => {
    const batches: DoughBatch[] = [];
    snapshot.forEach((doc) => {
      batches.push(doc.data() as DoughBatch);
    });
    batches.sort((a, b) => b.created_at - a.created_at);
    callback(batches);
  }, (err) => {
    console.error("Failed to stream all batches: ", err);
  });
};
