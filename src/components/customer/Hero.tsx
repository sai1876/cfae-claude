'use client';

import { motion } from 'framer-motion';
import { mockUIConfig } from '@/lib/mockData';
import Image from 'next/image';

export default function Hero() {
  return (
    <section className="relative w-full h-[100svh] overflow-hidden flex flex-col items-center justify-center text-center px-container-mobile md:px-container-desktop">
      {/* Dynamic Background Image */}
      {mockUIConfig.hero_image ? (
        <div className="absolute inset-0 z-0">
          <Image
            src={mockUIConfig.hero_image}
            alt="Hero Background"
            fill
            className="object-cover opacity-50"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-background to-surface opacity-80" />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-4xl mt-12 w-full">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.7, y: 0 }}
          className="text-xs md:text-sm tracking-[0.2em] text-on-surface font-mono uppercase mb-6"
        >
          NOW OPEN NEAR CAMPUS
        </motion.p>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-serif italic text-4xl md:text-6xl lg:text-7xl leading-[1.1] text-on-surface mb-8 mx-auto max-w-3xl"
        >
          {mockUIConfig.hero_headline.split('\n').map((line, i) => (
            <span key={i} className="block">{line}</span>
          ))}
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-on-surface-variant mb-12 font-sans max-w-xl mx-auto"
        >
          {mockUIConfig.hero_sub}
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-6 items-center justify-center w-full max-w-md mx-auto"
        >
          <a href="#menu" className="w-full sm:w-auto px-10 py-4 bg-primary text-primary-foreground font-medium rounded-full hover:shadow-[0_0_20px_rgba(248,188,81,0.3)] transition-all inline-block">
            Order Now
          </a>
          <a href="#menu" className="w-full sm:w-auto px-10 py-4 border border-outline text-on-surface rounded-full hover:bg-surface-bright transition-colors inline-block">
            View Menu
          </a>
        </motion.div>
      </div>

      {/* Weather Widget */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-24 md:bottom-12 right-6 md:right-12 bg-surface/60 backdrop-blur-xl border border-border px-5 py-3 rounded-full text-sm font-mono flex items-center gap-3 text-on-surface"
      >
        <span>41°C outside</span>
        <span className="text-outline">|</span>
        <span className="text-tertiary">22°C inside</span>
      </motion.div>
    </section>
  );
}
