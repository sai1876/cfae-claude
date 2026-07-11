import { OFFERS_COL } from '@/lib/firebase/collections';
import { collection, doc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { Offer } from '@/lib/types';

import { db } from "@/lib/firebase";


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



