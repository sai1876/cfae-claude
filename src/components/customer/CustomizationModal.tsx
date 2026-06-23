'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { MenuItem } from '@/lib/types';

interface CustomizationModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customizedItem: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    station: MenuItem['station'];
    modifiers: string[];
  }) => void;
}

interface ModifierOption {
  name: string;
  price: number;
  selected: boolean;
}

export default function CustomizationModal({
  item,
  isOpen,
  onClose,
  onConfirm,
}: CustomizationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<'Regular' | 'Large'>('Regular');
  
  // Custom states for options based on categories
  const [addOns, setAddOns] = useState<ModifierOption[]>([]);
  const [preference, setPreference] = useState<string>('');

  useEffect(() => {
    if (!item) return;
    setQuantity(1);
    setSize('Regular');

    // Populate modifiers based on category
    if (item.category === 'Burgers') {
      setAddOns([
        { name: 'Extra Cheese', price: 15, selected: false },
        { name: 'Double Patty', price: 40, selected: false },
        { name: 'Caramelised Onions', price: 10, selected: false },
      ]);
      setPreference('Spicy Mayo');
    } else if (item.category === 'Beverages') {
      setAddOns([
        { name: 'Whipped Cream', price: 15, selected: false },
        { name: 'Chocolate Drizzle', price: 10, selected: false },
        { name: 'Extra Shot Espresso', price: 25, selected: false },
      ]);
      setPreference('Medium Sweetness');
    } else if (item.category === 'Momos') {
      setAddOns([
        { name: 'Fiery Red Chutney Extra', price: 5, selected: false },
        { name: 'Pan Fried', price: 15, selected: false },
      ]);
      setPreference('Steamed');
    } else if (item.category === 'Snacks') {
      setAddOns([
        { name: 'Cheese Sauce Drizzle', price: 20, selected: false },
        { name: 'Peri Peri Hau Hau Dust', price: 10, selected: false },
      ]);
      setPreference('Salted');
    } else {
      setAddOns([]);
      setPreference('');
    }
  }, [item, isOpen]);

  if (!item) return null;

  // Pricing calculations
  const sizeSurcharge = size === 'Large' ? 30 : 0;
  const addonsTotal = addOns
    .filter((a) => a.selected)
    .reduce((sum, curr) => sum + curr.price, 0);
  
  const unitPrice = item.price + sizeSurcharge + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const handleToggleAddon = (idx: number) => {
    setAddOns((prev) =>
      prev.map((opt, i) => (i === idx ? { ...opt, selected: !opt.selected } : opt))
    );
  };

  const handleConfirm = () => {
    const selectedModifiers: string[] = [];
    if (size === 'Large') selectedModifiers.push('Large Size');
    if (preference) selectedModifiers.push(preference);
    
    addOns.forEach((a) => {
      if (a.selected) selectedModifiers.push(a.name);
    });

    onConfirm({
      menuItemId: item.item_id,
      name: item.name,
      price: unitPrice,
      quantity,
      station: item.station,
      modifiers: selectedModifiers,
    });
    
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(60);
    }
    
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 z-[100] max-w-[600px] mx-auto bg-surface/80 backdrop-blur-3xl rounded-t-[40px] border-t border-border shadow-[0_-15px_60px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[95dvh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-border/50 bg-gradient-to-b from-foreground/5 to-transparent">
              <div>
                <span className="font-mono text-[10px] tracking-widest uppercase text-primary mb-2 block opacity-80">Customize Selection</span>
                <h3 className="font-serif italic text-3xl text-on-surface leading-tight">{item.name}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-3 bg-foreground/5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-foreground/10 transition-colors border border-border/50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
              {/* Category 1: Size */}
              {item.category !== 'Snacks' && (
                <div className="space-y-3">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-hauhau-on-surface-variant">Choose Size</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(['Regular', 'Large'] as const).map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setSize(sz)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          size === sz
                            ? 'bg-hauhau-gold/10 border-hauhau-gold text-hauhau-gold shadow-[0_0_15px_rgba(248,188,81,0.08)]'
                            : 'bg-hauhau-surface-bright/50 border-hauhau-outline-variant/20 text-hauhau-on-surface hover:bg-hauhau-surface-bright'
                        }`}
                      >
                        <span className="font-medium text-sm">{sz}</span>
                        <span className="font-mono text-xs mt-1 opacity-70">
                          {sz === 'Regular' ? 'Standard Price' : '+ ₹30'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 2: Preparation Preference */}
              {preference && (
                <div className="space-y-3">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-hauhau-on-surface-variant">Vibe Preference</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.category === 'Burgers' &&
                      ['Mild Mayo', 'Spicy Mayo', 'Secret Sauce'].map((pref) => (
                        <button
                          key={pref}
                          onClick={() => setPreference(pref)}
                          className={`px-4 py-2.5 rounded-full text-xs font-medium border transition-all ${
                            preference === pref
                              ? 'bg-hauhau-gold text-hauhau-surface border-hauhau-gold'
                              : 'bg-hauhau-surface-bright/40 border-hauhau-outline-variant/20 text-hauhau-on-surface-variant hover:text-hauhau-cream'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    {item.category === 'Beverages' &&
                      ['Sugar Free', 'Less Sweet', 'Medium Sweetness', 'Extra Sweet'].map((pref) => (
                        <button
                          key={pref}
                          onClick={() => setPreference(pref)}
                          className={`px-4 py-2.5 rounded-full text-xs font-medium border transition-all ${
                            preference === pref
                              ? 'bg-hauhau-gold text-hauhau-surface border-hauhau-gold'
                              : 'bg-hauhau-surface-bright/40 border-hauhau-outline-variant/20 text-hauhau-on-surface-variant hover:text-hauhau-cream'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    {item.category === 'Momos' &&
                      ['Steamed', 'Fried (+ ₹15)', 'Jhol Momos (+ ₹20)'].map((pref) => (
                        <button
                          key={pref}
                          onClick={() => setPreference(pref)}
                          className={`px-4 py-2.5 rounded-full text-xs font-medium border transition-all ${
                            preference === pref
                              ? 'bg-hauhau-gold text-hauhau-surface border-hauhau-gold'
                              : 'bg-hauhau-surface-bright/40 border-hauhau-outline-variant/20 text-hauhau-on-surface-variant hover:text-hauhau-cream'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    {item.category === 'Snacks' &&
                      ['Salted', 'Peri Peri Spiced'].map((pref) => (
                        <button
                          key={pref}
                          onClick={() => setPreference(pref)}
                          className={`px-4 py-2.5 rounded-full text-xs font-medium border transition-all ${
                            preference === pref
                              ? 'bg-hauhau-gold text-hauhau-surface border-hauhau-gold'
                              : 'bg-hauhau-surface-bright/40 border-hauhau-outline-variant/20 text-hauhau-on-surface-variant hover:text-hauhau-cream'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Category 3: Addons */}
              {addOns.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-hauhau-on-surface-variant">Add Extra Goodies</h4>
                  <div className="space-y-2">
                    {addOns.map((opt, idx) => (
                      <div
                        key={opt.name}
                        onClick={() => handleToggleAddon(idx)}
                        className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          opt.selected
                            ? 'bg-hauhau-gold/5 border-hauhau-gold/50 text-hauhau-cream'
                            : 'bg-hauhau-surface-bright/30 border-hauhau-outline-variant/10 text-hauhau-on-surface-variant hover:border-hauhau-outline-variant/35'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            opt.selected ? 'bg-hauhau-gold border-hauhau-gold text-hauhau-surface' : 'border-hauhau-outline-variant/50'
                          }`}>
                            {opt.selected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <span className="text-sm font-medium">{opt.name}</span>
                        </div>
                        <span className="font-mono text-xs text-hauhau-gold font-bold">+ ₹{opt.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Footer */}
            <div className="p-6 border-t border-border flex gap-4 items-center bg-background/80 backdrop-blur-md">
                {/* Quantity */}
                <div className="flex items-center bg-foreground/5 rounded-full border border-border p-1">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-foreground/10 flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-on-surface font-bold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-10 h-10 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-foreground/10 flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
  
                {/* Add Button */}
                <button
                  onClick={handleConfirm}
                  className="relative flex-1 group overflow-hidden rounded-full p-[1px]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-primary via-amber-400 to-primary rounded-full opacity-70 group-hover:opacity-100 blur-[2px] transition-opacity" />
                  <div className="relative py-4 bg-primary text-primary-foreground font-bold rounded-full hover:shadow-[0_0_30px_rgba(198,139,53,0.35)] transition-all flex items-center justify-between px-8 bg-gradient-to-r from-primary to-amber-500">
                    <span className="tracking-wide uppercase text-sm">Add to Cart</span>
                    <span className="font-mono text-lg">₹{totalPrice}</span>
                  </div>
                </button>
              </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
