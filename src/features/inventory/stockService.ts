import { STOCKS_COL, CONVERSION_RECIPES_COL, DOUGH_BATCHES_COL, STOCK_MOVEMENTS_COL, WASTAGE_COL } from '@/lib/firebase/collections';
import { collection, doc, setDoc, updateDoc, query, where, orderBy, onSnapshot, limit, getDocs, addDoc } from 'firebase/firestore';
import { StockItem, ConversionRecipe, DoughBatch } from '@/lib/types';

import { db } from "@/lib/firebase";


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









export const fetchStockMovements = async () => {
  const q = query(collection(db, STOCK_MOVEMENTS_COL), orderBy('timestamp', 'desc'), limit(100));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};



export const addWastageRecord = async (wastageData: any) => {
  await addDoc(collection(db, WASTAGE_COL), {
    ...wastageData,
    created_at: new Date().toISOString()
  });
};

export const fetchWastageList = async () => {
  const q = query(collection(db, WASTAGE_COL), orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};





