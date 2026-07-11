import { STAFF_COL, ATTENDANCE_COL, SHIFTS_COL } from '@/lib/firebase/collections';
import { collection, doc, setDoc, updateDoc, query, where, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { Staff } from '@/lib/types';

import { db } from "@/lib/firebase";


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









export const logAttendance = async (staffId: string, status: string, outlet: string) => {
  await addDoc(collection(db, ATTENDANCE_COL), {
    staff_id: staffId,
    status,
    outlet,
    clock_in: new Date().toISOString(),
    clock_out: null
  });
};

export const clockOutAttendance = async (id: string, _staffId: string) => {
  await updateDoc(doc(db, ATTENDANCE_COL, id), {
    clock_out: new Date().toISOString()
  });
};

export const fetchAttendanceLogs = async (dateStr?: string) => {
  let q = query(collection(db, ATTENDANCE_COL), orderBy('clock_in', 'desc'), limit(100));
  if (dateStr) {
    q = query(collection(db, ATTENDANCE_COL), where('clock_in', '>=', dateStr), orderBy('clock_in', 'desc'), limit(100));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addShiftRecord = async (data: any) => {
  await addDoc(collection(db, SHIFTS_COL), {
    ...data,
    created_at: new Date().toISOString()
  });
};

export const fetchShiftsForDate = async (date: string) => {
  const q = query(collection(db, SHIFTS_COL), where('date', '==', date));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};