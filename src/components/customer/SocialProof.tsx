'use client';

import { useState, useEffect } from 'react';
import { streamUIConfig } from '@/lib/dbService';
import { motion } from 'framer-motion';
import { UIConfig } from '@/lib/types';

export default function SocialProof() {
  const [config, setConfig] = useState<UIConfig | null>(null);

  useEffect(() => {
    const unsubscribe = streamUIConfig((cfg) => {
      setConfig(cfg);
    });
    return () => unsubscribe();
  }, []);

  const isActive = config?.social_stats_active !== false;

  const stats = config?.social_stats || [
    { value: '3,600+', label: 'Students' },
    { value: '8 min', label: 'Avg Pickup' },
    { value: '₹115', label: 'Delivery Fee' }
  ];

  if (!isActive) return null;

  return (
    <section className="w-full relative z-20 py-6 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-5xl mx-auto bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-3xl overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-center justify-around py-10 px-8 gap-10 md:gap-4 relative overflow-hidden">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
          
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center gap-10 md:gap-16 w-full md:w-auto relative z-10">
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
                className="flex flex-col items-center text-center"
              >
                <div className="relative">
                  <span className="font-serif italic text-4xl md:text-5xl text-primary mb-2 relative z-10 drop-shadow-[0_0_15px_rgba(248,188,81,0.5)]">
                    {stat.value}
                  </span>
                  {/* Neon glow behind text */}
                  <span className="absolute inset-0 font-serif italic text-4xl md:text-5xl text-primary blur-md opacity-50 z-0">
                    {stat.value}
                  </span>
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mt-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                  {stat.label}
                </span>
              </motion.div>
              {index < stats.length - 1 && (
                <div className="hidden md:block h-16 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
              )}
              {index < stats.length - 1 && (
                <div className="block md:hidden w-32 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              )}
            </div>
          ))}

        </div>
      </motion.div>
    </section>
  );
}
