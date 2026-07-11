import { CONFIG_COL, SLIDER_ITEMS_COL } from '@/lib/firebase/collections';
import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { UIConfig, SliderItem } from '@/lib/types';

import { db } from "@/lib/firebase";


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

