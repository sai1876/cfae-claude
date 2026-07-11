import { USERS_COL } from '@/lib/firebase/collections';
import { collection, doc, getDoc, updateDoc, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { UserDocument } from '@/lib/types';

import { db } from "@/lib/firebase";


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

  // Generate a distinct referral code
  const referralCode = `Hau Hau_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const newProfile: UserDocument = {
    user_id: userId,
    phone,
    name: name || "",
    student_email: studentEmail || "",
    email: studentEmail || "",
    email_verified: false,
    points: 100, // Welcome points recorded in profile!
    referral_code: referralCode,
    referred_by: referredBy || "",
    account_status: "inactive",
    status: "inactive",
    is_active: false,
    is_email_verified: false,
    created_at: Date.now()
  };

  // We do NOT write to Firestore here because firestore.rules blocks client-side creates.
  // Profile creation is strictly handled by the secure backend route: /api/auth/create-profile
  // This function is kept for legacy compatibility if called from trusted contexts, 
  // but it will fail if called from the public frontend.
  console.warn("Client-side profile creation is deprecated and will fail due to security rules. Use /api/auth/create-profile.");
  
  return newProfile;
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
 * Retrieves user profile from Firestore by querying phone variations
 */
export const getUserProfileByPhone = async (phone: string): Promise<UserDocument | null> => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return null;
  
  const variations = [cleanPhone, `+${cleanPhone}`];
  if (cleanPhone.length === 10) {
    variations.push(`+91${cleanPhone}`);
    variations.push(`91${cleanPhone}`);
  } else if (cleanPhone.length > 10) {
    const last10 = cleanPhone.slice(-10);
    variations.push(last10);
    variations.push(`+91${last10}`);
    variations.push(`91${last10}`);
  }

  // Filter unique variations
  const uniqueVariations = Array.from(new Set(variations));

  // Query phone field
  const q1 = query(collection(db, USERS_COL), where("phone", "in", uniqueVariations));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) {
    return snap1.docs[0].data() as UserDocument;
  }

  // Query phone_number field
  const q2 = query(collection(db, USERS_COL), where("phone_number", "in", uniqueVariations));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    return snap2.docs[0].data() as UserDocument;
  }

  return null;
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