import { MENU_COL } from '@/lib/firebase/collections';
import { collection, doc, setDoc, updateDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { MenuItem } from '@/lib/types';

import { db } from "@/lib/firebase";


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













