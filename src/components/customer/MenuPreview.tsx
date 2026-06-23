'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { mockMenuItems } from '@/lib/mockData';
import { useStore } from '@/store/useStore';
import Image from 'next/image';
import { MenuItem } from '@/lib/types';
import CustomizationModal from './CustomizationModal';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CATEGORIES = ['All', 'Biryani', 'Momos', 'Burgers', 'Waffles', 'Snacks', 'Beverages'];

export default function MenuPreview() {
  const activeCategory = useStore((state) => state.activeCategory);
  const setActiveCategory = useStore((state) => state.setActiveCategory);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [dbMenuItems, setDbMenuItems] = useState<MenuItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const addToCart = useStore((state) => state.addToCart);
 
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = query(collection(db, 'menu'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbItems: MenuItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.deleted) {
          dbItems.push(data as MenuItem);
        }
      });
      dbItems.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setDbMenuItems(dbItems);
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, []);
 
  const menuSource = isLoaded ? dbMenuItems : [];
 
  const filteredItems = menuSource.filter(
    (item) => activeCategory === 'All' || item.category.toLowerCase() === activeCategory.toLowerCase()
  );

  return (
    <section id="menu" className="pt-4 pb-20 px-container-mobile md:px-container-desktop max-w-[1440px] mx-auto w-full relative z-10">
      <h2 className="font-serif italic text-3xl md:text-5xl mb-12 text-on-surface">What&apos;s calling you?</h2>

      {/* Category Pills */}
      <div className="flex overflow-x-auto category-scroll-container gap-3 mb-12 pb-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`relative whitespace-nowrap px-6 py-2.5 rounded-full text-xs font-mono uppercase tracking-widest transition-all duration-300 ${
              activeCategory === category
                ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(248,188,81,0.4)] border border-primary'
                : 'bg-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/10 border border-white/10'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {filteredItems.map((item) => (
          <motion.div
            key={item.item_id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -5, scale: 1.02 }}
            onClick={() => {
              if (item.is_available) {
                setCustomizingItem(item);
              }
            }}
            className={`group relative bg-white/5 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-500 hover:shadow-[0_15px_40px_-10px_rgba(248,188,81,0.3)] cursor-pointer ${
              !item.is_available ? 'opacity-50 grayscale pointer-events-none' : ''
            }`}
          >
            {/* Image Placeholder */}
            <div className="w-full aspect-[4/3] bg-surface-bright relative overflow-hidden">
              {item.image_url && (
                <Image
                  src={item.image_url}
                  alt={item.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
              )}
              {/* Premium Vignette & Card Bottom-Fade Overlays to soften bright/white photos */}
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                style={{
                  background: `
                    radial-gradient(circle at center, transparent 35%, rgba(10, 6, 4, 0.4) 100%),
                    linear-gradient(to top, var(--surface) 0%, rgba(18, 10, 6, 0.3) 15%, transparent 45%)
                  `
                }}
              />
              {/* Availability Indicator (Solid Obsidian High-Contrast Capsule) */}
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#0A0604] px-3 py-1.5 rounded-full border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-10">
                <div className={`w-1.5 h-1.5 rounded-full ${item.is_available ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-[#EF4444]'}`} />
                <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${item.is_available ? 'text-white' : 'text-[#EF4444]'}`}>
                  {item.is_available ? 'Available' : 'Sold Out'}
                </span>
              </div>
            </div>

            <div className="p-6">
              <h3 className="font-serif italic text-xl leading-tight mb-2 text-on-surface line-clamp-1">
                {item.name}
              </h3>
              <p className="text-sm text-on-surface-variant mb-6 line-clamp-2 min-h-[2.5rem]">
                {item.description}
              </p>
              
              <div className="flex items-center justify-between">
                <span className="font-mono text-primary text-lg font-bold">
                  ₹{item.price}
                </span>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Don't trigger outer card card-click
                    if (item.is_available) {
                      setCustomizingItem(item);
                    }
                  }}
                  disabled={!item.is_available}
                  className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-bright hover:text-primary hover:border-primary transition-all disabled:opacity-50 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                >
                  <Plus size={18} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Customization bottom-sheet */}
      <CustomizationModal
        item={customizingItem}
        isOpen={customizingItem !== null}
        onClose={() => setCustomizingItem(null)}
        onConfirm={(customized) => {
          addToCart({
            menuItemId: customized.menuItemId,
            name: customized.name,
            price: customized.price,
            quantity: customized.quantity,
            station: customized.station,
            modifiers: customized.modifiers,
          });
        }}
      />
    </section>
  );
}
