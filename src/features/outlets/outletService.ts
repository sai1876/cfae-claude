import { OUTLETS_COL } from '@/lib/firebase/collections';
import { collection, getDocs } from 'firebase/firestore';
import { Outlet } from '@/lib/types';

import { db } from "@/lib/firebase";


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





