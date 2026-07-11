import { createUserProfile } from "./dbService";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification } from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const otpRequestCounts = new Map<string, { count: number; timestamp: number }>();

/**
 * Simulates sending OTP code to user phone
 */
export const sendOTPCode = async (phone: string): Promise<string> => {
  const now = Date.now();
  const record = otpRequestCounts.get(phone);
  
  if (record) {
    if (now - record.timestamp > 3600000) { // 1 hour cooldown
      otpRequestCounts.set(phone, { count: 1, timestamp: now });
    } else if (record.count >= 3) {
      throw new Error("Too many OTP requests. Please try again in an hour.");
    } else {
      otpRequestCounts.set(phone, { count: record.count + 1, timestamp: record.timestamp });
    }
  } else {
    otpRequestCounts.set(phone, { count: 1, timestamp: now });
  }

  console.log(`[AUTH] Initiating OTP sequence for ${phone}...`);
  
  // Generates a mock 6-digit OTP code for local logging
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[AUTH] Verification code for ${phone} is: ${code}`);
  
  return new Promise((resolve) => setTimeout(() => resolve(code), 2000));
};

/**
 * Logs in a customer using their email and password.
 */
export const loginCustomer = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return {
    uid: userCredential.user.uid,
    email
  };
};

/**
 * Signs up a new customer using Phone + Password + real email.
 */
export const signupCustomer = async (
  phone: string, 
  name: string,
  password: string, 
  email: string,
  referredBy?: string,
  deviceId?: string
) => {
  const sanitizedPhone = phone.replace(/[^0-9]/g, "");

  // [FIREWALL] Check Device Fingerprint in Firestore
  if (deviceId) {
    const deviceRef = doc(db, 'device_registry', deviceId);
    const deviceSnap = await getDoc(deviceRef);
    
    if (deviceSnap.exists()) {
      const deviceData = deviceSnap.data();
      if (deviceData && deviceData.accounts_created >= 3) {
        const err = new Error("auth/device-limit-reached");
        (err as any).code = "auth/device-limit-reached";
        throw err;
      }
    }
  }
  
  // Enforce unique phone number strictly in Firestore before creating Auth account
  const q = query(collection(db, 'users'), where("phone", "==", sanitizedPhone));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const err = new Error("auth/phone-already-in-use");
    (err as any).code = "auth/phone-already-in-use";
    throw err;
  }

  // 1. Create the user in Firebase Auth using the real email
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;

  // 2. Create the user profile in Firestore
  const isStudentEmail = email.endsWith('.edu') || email.endsWith('.ac.in') || email.endsWith('.edu.in');
  const studentEmailToPass = isStudentEmail ? email : undefined;
  await createUserProfile(uid, phone, name, studentEmailToPass, referredBy);

  // [FIREWALL] Log device usage in Firestore
  if (deviceId) {
    const deviceRef = doc(db, 'device_registry', deviceId);
    const deviceSnap = await getDoc(deviceRef);
    
    if (deviceSnap.exists()) {
      const deviceData = deviceSnap.data();
      const existingUids = deviceData.uids || [];
      await updateDoc(deviceRef, {
        accounts_created: (deviceData.accounts_created || 0) + 1,
        uids: [...existingUids, uid]
      });
    } else {
      await setDoc(deviceRef, {
        device_id: deviceId,
        accounts_created: 1,
        uids: [uid]
      });
    }
  }

  // 3. Send email verification if it's a student email
  if (isStudentEmail) {
    await sendEmailVerification(userCredential.user);
  }

  return {
    uid,
    email
  };
};

/**
 * Updates a user's email to a student email by re-authenticating them and sending a verification link.
 */
export const updateStudentEmail = async (password: string, newEmail: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("You must be logged in to update your email.");
  }

  // Re-authenticate user
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  // Send verification to the new email and prepare update
  await verifyBeforeUpdateEmail(user, newEmail);
};
