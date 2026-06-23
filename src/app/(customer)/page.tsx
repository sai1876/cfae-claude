'use client';

import { useState } from 'react';
import CinematicScroller from '@/components/customer/CinematicScroller';
import DynamicSliderHero from '@/components/customer/DynamicSliderHero';
import OrderTracker from '@/components/customer/OrderTracker';
import SocialProof from '@/components/customer/SocialProof';
import MenuPreview from '@/components/customer/MenuPreview';
import RewardsTeaser from '@/components/customer/RewardsTeaser';
import ReferralCTA from '@/components/customer/ReferralCTA';
import Footer from '@/components/customer/Footer';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomerLandingPage() {
  const [showMainPage, setShowMainPage] = useState(false);

  const handleComplete = () => {
    setShowMainPage(true);
    // Dispatch event to show Layout top/bottom bars
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('Hau Hau-enter-menu'));
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col pb-section-gap overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!showMainPage ? (
          <motion.div
            key="scroller"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="w-full h-screen overflow-hidden"
          >
            <CinematicScroller onComplete={handleComplete} />
          </motion.div>
        ) : (
          <motion.div
            key="main-landing"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full flex flex-col gap-section-gap relative"
          >
            {/* Ambient Animated Background */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-50">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[120px] mix-blend-screen"
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-amber-600/10 blur-[150px] mix-blend-screen"
              />
            </div>

            <div className="w-full relative z-10">
              <DynamicSliderHero />
            </div>
            
            {/* Live Order Tracker */}
            <OrderTracker />
            
            <SocialProof />
            <MenuPreview />
            <RewardsTeaser />
            <ReferralCTA />
            <Footer />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
