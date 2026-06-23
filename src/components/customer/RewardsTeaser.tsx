'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const milestones = [
  { friends: 5, reward: 'Free Fries', icon: '🍟' },
  { friends: 8, reward: 'Free Shake', icon: '🥤' },
  { friends: 15, reward: 'Free Popcorn Basket', icon: '🍿' },
];

export default function RewardsTeaser() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-24 px-container-mobile md:px-container-desktop w-full bg-surface-container border-y border-outline-variant">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
        
        {/* Left Side (Text) */}
        <div className="flex-1 text-center lg:text-left">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            className="font-serif italic text-4xl md:text-5xl lg:text-6xl text-on-surface mb-6"
          >
            Eat. Refer. Earn.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-lg text-on-surface-variant mb-10 max-w-md mx-auto lg:mx-0"
          >
            Bring 5 friends. Get free fries. It pays to share Hau Hau.
          </motion.p>
          <Link href="/profile">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.2 }}
              className="px-10 py-4 bg-primary text-primary-foreground font-medium rounded-full hover:shadow-[0_0_20px_rgba(248,188,81,0.3)] transition-all"
            >
              See How It Works
            </motion.button>
          </Link>
        </div>

        {/* Right Side (Milestones) */}
        <div ref={ref} className="flex-1 w-full max-w-md flex flex-col gap-6">
          {milestones.map((item, i) => (
            <motion.div
              key={item.friends}
              initial={{ opacity: 0, x: 50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.15, type: 'spring' }}
              className="relative p-6 rounded-2xl bg-surface/60 backdrop-blur-md border border-outline-variant flex items-center gap-6"
            >
              {/* Connector Line */}
              {i !== milestones.length - 1 && (
                <div className="absolute left-[39px] top-[70px] bottom-[-24px] w-0.5 bg-outline-variant z-0" />
              )}
              
              <div className="relative z-10 w-14 h-14 shrink-0 rounded-full bg-surface-bright flex items-center justify-center text-2xl border-2 border-primary/30 text-primary shadow-[0_0_15px_rgba(248,188,81,0.1)]">
                {item.friends}
              </div>
              
              <div>
                <p className="text-on-surface-variant text-xs font-mono uppercase tracking-widest mb-1">
                  {item.friends} Friends
                </p>
                <p className="text-primary font-medium text-lg flex items-center gap-2">
                  {item.icon} {item.reward}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
