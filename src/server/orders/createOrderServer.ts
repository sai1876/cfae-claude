import { adminDb } from '@/lib/firebaseAdmin';
import { BACKUP_MENU_RECIPES } from '@/lib/constants';
import { triggerLowStockAlert } from '../notifications/triggerLowStockAlert';
import { STOCKS_COL } from '@/lib/firebase/collections';

export const createOrderServer = async (
  userId: string,
  clientExpectedTotal: number | undefined,
  promoCode: string | undefined,
  pointsRedeemed: number,
  orderType: 'dine-in' | 'pickup' | 'delivery',
  items: any[],
  hatch?: string,
  tableNo?: string,
  outlet?: string,
  deliveryAddress?: string,
  deliveryCoordinates?: { lat: number; lng: number }
) => {
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  const db = adminDb;

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  const orderRef = db.collection("orders").doc();
  const orderId = orderRef.id;

  let display_order_code = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    display_order_code = '';
    for (let i = 0; i < 8; i++) {
      display_order_code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const q = await db.collection("orders").where("display_order_code", "==", display_order_code).limit(1).get();
    if (q.empty) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error("Failed to generate a unique order code after multiple attempts.");
  }
  
  let orderData: any;

  // 1. Fetch menu items outside transaction
  const uniqueMenuItemIds = [...new Set(items.map(item => item.menuItemId || item.item_id || "").filter(Boolean))];
  const menuFetchPromises = uniqueMenuItemIds.map(id => db.collection("menu").doc(id as string).get());
  const menuSnaps = await Promise.all(menuFetchPromises);
  const menuMap = new Map<string, any>();
  menuSnaps.forEach(snap => {
    if (snap.exists) {
      menuMap.set(snap.id, snap.data());
    }
  });

  // Calculate actual price
  let serverCalculatedSubtotal = 0;
  
  for (const item of items) {
    const menuItemId = item.menu_item_id || item.menuItemId || item.id || item.item_id;
    if (!menuItemId) {
      throw { status: 400, controlledMessage: "Invalid order item." };
    }
    console.log(`[DEBUG] Processing item with menu item id: ${menuItemId}`);
    
    const quantity = item.quantity || 1;
    const menuData = menuMap.get(menuItemId);
    
    if (!menuData) {
      throw new Error(`Menu item not found: ${menuItemId}`);
    }
    if (menuData.is_available === false) {
      throw new Error(`Menu item is currently unavailable: ${menuData.name}`);
    }
    
    let itemUnitPrice = menuData.price || 0;
    
    // Add modifier prices
    if (item.modifiers && item.modifiers.length > 0) {
      for (const selectedMod of item.modifiers) {
        let modFound = false;
        
        if (menuData.customizationOptions) {
          for (const group of menuData.customizationOptions) {
            const matchedOpt = group.options.find(
              (opt: any) => opt.name.toLowerCase().trim() === selectedMod.toLowerCase().trim()
            );
            if (matchedOpt) {
              if (matchedOpt.price) {
                itemUnitPrice += matchedOpt.price;
              }
              modFound = true;
              break;
            }
          }
        }
        
        // Fallback for hardcoded CAT_CONFIG add-ons (temporary compatibility layer)
        if (!modFound) {
          const modName = selectedMod.toLowerCase().trim();
          let fallbackPrice = 0;
          if (modName === 'extra raita') fallbackPrice = 10;
          else if (modName === 'boiled egg') fallbackPrice = 15;
          else if (modName === 'large size') fallbackPrice = 30;
          
          if (fallbackPrice > 0) {
            itemUnitPrice += fallbackPrice;
            console.warn(`[WARNING] pricing_fallback_modifier_used: ${selectedMod} added ₹${fallbackPrice} via fallback`);
          }
        }
      }
    }
    
    serverCalculatedSubtotal += (itemUnitPrice * quantity);
    
    // Update the item price in the payload so it is saved correctly
    item.price = itemUnitPrice;
  }
  
  let promoDiscount = 0;
  let promoRejectReason = "";
  let acceptedPromoCode = undefined;

  if (promoCode) {
    const q = await db.collection('offers').where('code', '==', promoCode).limit(1).get();
    if (!q.empty) {
      const offer = q.docs[0].data();
      if (offer.isActive) {
        const today = new Date().toISOString().split('T')[0];
        if (offer.expiryDate >= today) {
          // Apply discount based on categoryScope
          let eligibleAmount = 0;
          if (!offer.categoryScope || offer.categoryScope === 'All') {
            eligibleAmount = serverCalculatedSubtotal;
          } else {
            for (const item of items) {
              const menuData = menuMap.get(item.menuItemId || item.item_id || "");
              if (menuData && menuData.category === offer.categoryScope) {
                eligibleAmount += item.price * (item.quantity || 1);
              }
            }
          }
          promoDiscount = Math.floor(eligibleAmount * (offer.discountPercent / 100));
          acceptedPromoCode = promoCode;
        } else {
          promoRejectReason = "expired";
        }
      } else {
        promoRejectReason = "inactive";
      }
    } else {
      promoRejectReason = "invalid";
    }
  }

  const platformFee = 5;
  const prePointsTotal = serverCalculatedSubtotal - promoDiscount + platformFee;
  const maxAllowedPoints = Math.floor(prePointsTotal * 0.20);
  const actualPointsRedeemed = Math.min(pointsRedeemed, maxAllowedPoints);
  
  const finalGrossAmount = Math.max(0, serverCalculatedSubtotal - promoDiscount - actualPointsRedeemed + platformFee);
  
  if (clientExpectedTotal !== undefined && Math.abs(clientExpectedTotal - finalGrossAmount) > 1) {
    console.warn(`Mismatch in order total. Client expected: ${clientExpectedTotal}, Server calculated: ${finalGrossAmount}`);
    if (promoCode) {
      console.warn(`Client sent promoCode: ${promoCode}. Server status: ${acceptedPromoCode ? 'Accepted' : 'Rejected (' + promoRejectReason + ')'}`);
    }
  }

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
      const qSnap = await db.collection(STOCKS_COL).where("name", "==", name).get();
      if (!qSnap.empty) {
        backupStockMap.set(name, qSnap.docs[0].id);
      }
    });
    await Promise.all(stockFetchPromises);
  }

  // 3. Accumulate required quantities
  const requiredQuantities = new Map<string, number>();
  
  for (const item of items) {
    const menuItemId = item.menu_item_id || item.menuItemId || item.id || item.item_id || "";
    const quantity = item.quantity || 1;
    const menuData = menuMap.get(menuItemId);
    const recipeIngredients = menuData?.recipe || [];
    const customGroups = menuData?.customizationOptions || [];

    if (recipeIngredients.length > 0) {
      for (const ing of recipeIngredients) {
        console.log(`[DEBUG] Item ${menuItemId} recipe requires stock_id: ${ing.stock_id}`);
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

    if (item.modifiers && item.modifiers.length > 0 && customGroups.length > 0) {
      for (const selectedMod of item.modifiers) {
        for (const group of customGroups) {
          const matchedOpt = group.options.find(
            (opt: any) => opt.name.toLowerCase().trim() === selectedMod.toLowerCase().trim()
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
    const sequenceRef = db.collection("config").doc("order_sequence");
    const userRef = db.collection("users").doc(userId);
    const configRef = db.collection("config").doc("store_settings");

    await db.runTransaction(async (transaction) => {
      // --- PHASE 1: ALL READS ---
      
      const stockIds = Array.from(requiredQuantities.keys());
      console.log(`[DEBUG] Stock collection being used: ${STOCKS_COL}`);
      
      // 1a. Fetch all required stock items
      const stockSnaps = await Promise.all(
        stockIds.map(id => {
          const docRef = db.collection(STOCKS_COL).doc(id);
          console.log(`[TX READ] ${docRef.path}`);
          return transaction.get(docRef);
        })
      );
      
      // 1b. Fetch sequence, config, and user
      console.log(`[TX READ] ${sequenceRef.path}`);
      const seqDoc = await transaction.get(sequenceRef);
      
      console.log(`[TX READ] ${configRef.path}`);
      const configSnap = await transaction.get(configRef);
      
      console.log(`[TX READ] ${userRef.path}`);
      const userSnap = await transaction.get(userRef);

      // --- PHASE 2: VALIDATION ---

      const stockDataMap = new Map<string, any>();
      stockSnaps.forEach(snap => {
        console.log(`[DEBUG] Stock snap ${snap.ref.path} exists: ${snap.exists}`);
        if (snap.exists && snap.data()) {
          stockDataMap.set(snap.id, snap.data());
        }
      });

      // Verify stock quantities
      for (const [stockId, requiredQty] of requiredQuantities.entries()) {
        const snap = stockSnaps.find(s => s.id === stockId);
        if (!snap || !snap.exists || !snap.data()) {
          throw { status: 409, controlledMessage: "Inventory configuration error. Please contact staff." };
        }
        const stockData = snap.data()!;
        if (typeof stockData.current_quantity !== 'number') {
          throw { status: 409, controlledMessage: "Inventory configuration error. Please contact staff." };
        }
        
        const currentQty = stockData.current_quantity;
        if (currentQty < requiredQty) {
          throw { status: 409, controlledMessage: "Insufficient stock. Please contact staff." };
        }
      }

      // Verify user
      if (!userSnap.exists) {
        throw new Error("User does not exist");
      }

      // --- PHASE 3: DATA PREPARATION ---
      
      // Parse sequence
      let currentSeq = 1;
      const today = new Date().toDateString();
      if (seqDoc.exists) {
        const data = seqDoc.data();
        if (data && data.date === today) {
          currentSeq = (data.last_val || 0) + 1;
        }
      }
      const tokenStr = currentSeq.toString().padStart(4, "0");

      // Parse config
      const rushModeActive = configSnap.exists ? !!configSnap.data()?.rush_mode_active : false;

      // Prepare order data
      orderData = {
        order_id: orderId,
        display_order_code: display_order_code,
        token_number: tokenStr,
        user_id: userId,
        gross_amount: finalGrossAmount,
        points_redeemed: actualPointsRedeemed,
        cash_paid: 0,
        order_type: orderType,
        subtotal_amount: serverCalculatedSubtotal,
        platform_fee: platformFee,
        ...(acceptedPromoCode ? { promo_code: acceptedPromoCode, promo_discount: promoDiscount } : {}),
        pricing_source: "server",
        ...(hatch ? { hatch } : {}),
        ...(tableNo ? { table_no: tableNo } : {}),
        outlet: outlet || "HYD CAMPUS",
        ...(deliveryAddress ? { delivery_address: deliveryAddress } : {}),
        ...(deliveryCoordinates ? { delivery_coordinates: deliveryCoordinates } : {}),
        ...(orderType === 'delivery' ? { otp: Math.floor(1000 + Math.random() * 9000).toString() } : {}),
        status: "confirmed",
        is_stock_refunded: false, 
        inventory_refunded: false,
        rush_held: rushModeActive,
        estimated_time_mins: 8,
        items: items.map(item => ({
          item_id: Math.random().toString(36).substring(7),
          menu_item_id: item.menuItemId || item.item_id || "",
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          station: item.station || "FRYER",
          item_status: "ordered",
          modifiers: item.modifiers || []
        })),
        created_at: Date.now(),
        updated_at: Date.now()
      };

      // --- PHASE 4: ALL WRITES ---
      
      for (const [stockId, requiredQty] of requiredQuantities.entries()) {
        const stockRef = db.collection(STOCKS_COL).doc(stockId);
        const stockData = stockDataMap.get(stockId)!;
        const currentQty = stockData.current_quantity;
        const newQty = Math.max(0, currentQty - requiredQty);
        
        console.log(`[TX WRITE] ${stockRef.path}`);
        transaction.update(stockRef, {
          current_quantity: newQty,
          last_updated: Date.now()
        });

        if (newQty < stockData.low_threshold && currentQty >= stockData.low_threshold) {
          alertsToTrigger.push({ name: stockData.name, current: newQty, threshold: stockData.low_threshold, unit: stockData.unit });
        }
      }

      console.log(`[TX WRITE] ${sequenceRef.path}`);
      transaction.set(sequenceRef, { date: today, last_val: currentSeq });
      
      console.log(`[TX WRITE] ${orderRef.path}`);
      transaction.set(orderRef, orderData);
    });

    // 6. Trigger low-stock emails (post-commit on server side!)
    for (const alert of alertsToTrigger) {
      await triggerLowStockAlert(alert, outlet || "HYD CAMPUS");
    }

    // 7. Process Mutual Growth Points Ledger (Post-Transaction)
    try {
      const { apply_wallet_points } = await import('@/lib/checkout');
      await apply_wallet_points(userId, prePointsTotal, actualPointsRedeemed);
    } catch (ptsErr) {
      console.error("Failed to process point ledger in Firestore:", ptsErr);
    }

    return orderData;
  } catch (error) {
    console.error("Transactional order creation failed: ", error);
    throw error;
  }
};
