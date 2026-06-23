import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DeliveryClient from './DeliveryClient';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export default async function DeliveryPage() {
  const cookieStore = cookies();
  const session = cookieStore.get('__session');

  if (!session) {
    redirect('/login');
  }

  const authInstance = adminAuth;
  if (!authInstance || !adminDb) {
    redirect('/login');
  }

  let decodedToken;
  try {
    decodedToken = await authInstance.verifySessionCookie(session.value, true);
  } catch (error) {
    console.error("Session verification failed", error);
    redirect('/login');
  }

  // Fetch user role from Firestore staff collection
  let userRole = 'owner';
  try {
    const staffQuery = await adminDb.collection('staff').where('email', '==', decodedToken.email).limit(1).get();
    if (!staffQuery.empty) {
      userRole = staffQuery.docs[0].data().role;
    }
  } catch (err) {
    console.error("Failed to fetch staff role", err);
  }

  // Only allow rider or owner/manager
  const validDeliveryRoles = ['rider', 'manager', 'owner'];
  if (!userRole || !validDeliveryRoles.includes(userRole)) {
    redirect('/login');
  }

  return <DeliveryClient role={userRole} riderId={decodedToken.uid} />;
}
