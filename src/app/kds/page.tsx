import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import KDSClient from './KDSClient';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export default async function KDSPage() {
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

  // Fetch user details from Firestore staff collection
  let staffDetails: any = null;
  let userRole = 'owner';
  try {
    const staffQuery = await adminDb.collection('staff').where('email', '==', decodedToken.email).limit(1).get();
    if (!staffQuery.empty) {
      staffDetails = { id: staffQuery.docs[0].id, ...staffQuery.docs[0].data() };
      userRole = staffDetails.role;
    } else {
      // Fallback for owner if no staff doc exists
      staffDetails = {
        id: 'owner',
        name: 'Cafe Owner',
        email: decodedToken.email,
        role: 'owner',
        number: 'N/A'
      };
    }
  } catch (err) {
    console.error("Failed to fetch staff details", err);
  }

  // Only allow KDS roles
  const validKDSRoles = ['deep_fryer', 'grill_fryer', 'biryani_master', 'brewer', 'manager', 'owner'];
  if (!userRole || !validKDSRoles.includes(userRole)) {
    redirect('/login');
  }

  return <KDSClient role={userRole} staffDetails={staffDetails} />;
}
