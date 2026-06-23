'use client';

import { useState, useEffect } from 'react';
import CartSheet from "@/components/customer/CartSheet";
import BottomNav from "@/components/customer/BottomNav";
import StressBusterChat from "@/components/customer/StressBusterChat";
import FloatingOrderTracker from "@/components/customer/FloatingOrderTracker";
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { updateUserProfile } from '@/lib/dbService';

export default function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [showNavigation, setShowNavigation] = useState(false);
  const { user, userProfile, setUser, setUserProfile } = useStore();

  useEffect(() => {
    // Listen for Firebase auth state changes to catch hard deletions or token expirations
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser && user) {
        setUser(null);
        setUserProfile(null);
      } else if (firebaseUser && user) {
        // Fetch current ID token to verify authentication status
        try {
          await firebaseUser.getIdToken();
          
          // Check for student email verification updates
          if (firebaseUser.emailVerified && firebaseUser.email) {
            const email = firebaseUser.email;
            const isStudentEmail = email.endsWith('.edu') || email.endsWith('.ac.in') || email.endsWith('.edu.in');
            
            if (isStudentEmail && userProfile && (!userProfile.email_verified || userProfile.student_email !== email)) {
              await updateUserProfile(user.uid, { 
                student_email: email,
                email_verified: true 
              });
              setUserProfile({
                ...userProfile,
                student_email: email,
                email_verified: true
              });
            }
          }
        } catch (error) {
          console.error("Auth token refresh failed (user likely deleted from backend):", error);
          setUser(null);
          setUserProfile(null);
          await auth.signOut();
        }
      }
    });
    return () => unsubscribe();
  }, [user, setUser, setUserProfile]);

  useEffect(() => {
    // If we've already entered in a previous session or if pathname isn't '/'
    if (pathname !== '/') {
      setShowNavigation(true);
    } else if (typeof window !== 'undefined' && sessionStorage.getItem('Hau Hau-intro-seen')) {
      setShowNavigation(true);
    }

    const handleShowNav = () => {
      setShowNavigation(true);
    };

    window.addEventListener('Hau Hau-enter-menu', handleShowNav);
    return () => {
      window.removeEventListener('Hau Hau-enter-menu', handleShowNav);
    };
  }, [pathname]);

  return (
    <>
      <div className={`relative ${showNavigation ? 'pb-24 pt-0' : 'p-0 overflow-hidden h-screen w-screen'}`}>
        {children}
        <CartSheet showTrigger={showNavigation} />
        {showNavigation && <BottomNav />}
      </div>
      {/* Real-time Order Tracker for all customer pages */}
      {showNavigation && <FloatingOrderTracker showNavigation={showNavigation} />}
      {/* Only show chatbot after the cinematic intro is complete */}
      {showNavigation && <StressBusterChat showNavigation={showNavigation} />}
    </>
  );
}
