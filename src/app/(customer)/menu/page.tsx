'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, MapPin, X, Star, ChevronRight, Check, Copy } from 'lucide-react';
import { fetchMenuItems, fetchOutlets, fetchOffers } from '@/lib/dbService';
import { useStore } from '@/store/useStore';
import { MenuItem, Offer, Outlet } from '@/lib/types';
import CustomizationModal from '@/components/customer/CustomizationModal';

const CATEGORIES = ['All', 'Biryani', 'Momos', 'Burgers', 'Waffles', 'Snacks', 'Beverages'] as const;
type Category = typeof CATEGORIES[number];

const CAT_IMAGES: Record<string, string> = {
  All: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&auto=format&fit=crop&q=80',
  Biryani: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=150&auto=format&fit=crop&q=80',
  Momos: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=150&auto=format&fit=crop&q=80',
  Burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80',
  Waffles: 'https://images.unsplash.com/photo-1562376502-6f769499c886?w=150&auto=format&fit=crop&q=80',
  Snacks: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=150&auto=format&fit=crop&q=80',
  Beverages: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=150&auto=format&fit=crop&q=80',
};


const CAT_EMOJIS: Record<string, string> = {
  All: '✨', Biryani: '🍲', Momos: '🥟', Burgers: '🍔', Waffles: '🧇', Snacks: '🍟', Beverages: '🥤',
};

function CustomSelect({ value, options, onChange, style, dropdownStyle, optionStyle, activeOptionStyle }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setOpen(!open)}
        style={{ ...style, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {options.find((o: any) => o.value === value)?.label || value}
        <ChevronDown size={14} style={{ color: style?.color || 'rgba(212,163,84,0.5)', opacity: 0.8 }} />
      </button>
      
      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                background: 'rgba(20,16,12,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(212,163,84,0.15)',
                borderRadius: 12,
                overflow: 'hidden',
                zIndex: 50,
                minWidth: 160,
                boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
                ...dropdownStyle
              }}
            >
              {options.map((opt: any) => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: style?.fontFamily || 'inherit',
                    ...(opt.value === value ? activeOptionStyle : optionStyle)
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc'>('default');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { cart, addToCart, customerOutlet, setCustomerOutlet } = useStore();
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  useEffect(() => {
    Promise.all([
      fetchMenuItems().then(data => setItems(data.sort((a, b) => {
        const orderA = a.sort_order ?? 0;
        const orderB = b.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return b.item_id.localeCompare(a.item_id); // Fallback: newer IDs tend to be lexically higher, putting them at the top
      }))),
      fetchOutlets().then(setOutlets),
      fetchOffers().then(data => setOffers(data.filter(o => o.isActive)))
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = items.filter(item => {
      const matchCat = activeCategory === 'All' || item.category === activeCategory;
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });

    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else {
      result.sort((a, b) => {
        const orderA = a.sort_order ?? 0;
        const orderB = b.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return b.item_id.localeCompare(a.item_id);
      });
    }

    return result;
  }, [items, activeCategory, search, sortBy]);

  const handleAddItem = (item: MenuItem) => {
    if (!item.is_available) return;
    setSelectedItem(item);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', paddingBottom: 100 }}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-lg font-black tracking-tight m-0">OASIS CAFE</h1>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
              <MapPin size={10} className="text-primary" />
              <CustomSelect 
                value={customerOutlet} 
                onChange={(val: string) => setCustomerOutlet(val)}
                options={[
                  { value: "HYD CAMPUS", label: "HYD CAMPUS" },
                  ...outlets.filter(o => o.name !== 'HYD CAMPUS').map(o => ({ value: o.name, label: o.name.toUpperCase() }))
                ]}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--primary)',
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', outline: 'none', cursor: 'pointer', padding: 0
                }}
                optionStyle={{ color: 'var(--foreground)', background: 'transparent' }}
                activeOptionStyle={{ color: 'var(--primary)', background: 'var(--primary)/10' }}
                dropdownStyle={{ left: 0, right: 'auto', minWidth: 140 }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 rounded-full px-2.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
            <span className="text-[#10B981] text-[10px] font-bold tracking-wide uppercase">Open</span>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for biryani, burgers, waffles..."
              className="w-full bg-white border border-border rounded-xl py-2.5 pl-9 pr-8 text-foreground text-sm font-medium outline-none focus:border-primary transition-colors shadow-sm placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                <X size={14} />
              </button>
            )}
          </div>
          
          <CustomSelect 
            value={sortBy} 
            onChange={(val: string) => setSortBy(val as any)}
            options={[
              { value: 'default', label: 'Recommended' },
              { value: 'price_asc', label: 'Price: Low to High' },
              { value: 'price_desc', label: 'Price: High to Low' }
            ]}
            style={{
              background: 'white', border: '1px solid var(--border)', borderRadius: 12,
              padding: '10px 12px', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            optionStyle={{ color: 'var(--foreground)', background: 'transparent' }}
            activeOptionStyle={{ color: 'var(--primary)', background: 'var(--primary)/10' }}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col gap-2">
        {/* Categories */}
        <div className="bg-white px-4 py-4 mb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-foreground text-lg font-black tracking-tight m-0">What's on your mind?</h2>
          </div>
          
          <div 
            ref={categoryScrollRef}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
          >
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat;
              return (
                <div
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <div className={`w-[72px] h-[72px] rounded-full overflow-hidden flex items-center justify-center bg-muted transition-transform ${active ? 'border-2 border-primary scale-105' : 'border border-border'}`}>
                    <img src={CAT_IMAGES[cat]} alt={cat} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-[11px] font-bold transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {cat}
                  </span>
                </div>
              );
            })}
          </div>
        </div>        {/* Active promotions carousel */}
        {offers.length > 0 && (
          <div className="bg-white px-4 py-4 mb-2">
            <h2 className="text-foreground text-lg font-black tracking-tight mb-3">Top Offers</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {offers.map(offer => (
                <div 
                  key={offer.code}
                  className="flex-shrink-0 w-[260px] bg-white border border-border rounded-2xl p-3 flex gap-3 items-center shadow-sm"
                >
                  <div className="w-[52px] h-[52px] rounded-xl overflow-hidden flex-shrink-0 bg-primary/5 flex items-center justify-center">
                    {offer.imageUrl ? (
                      <img src={offer.imageUrl} alt={offer.code} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🎉</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-foreground font-black text-sm uppercase tracking-wide truncate">{offer.code}</span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-tight line-clamp-2 font-medium mb-1.5">
                      {offer.discountPercent}% OFF • {offer.description}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(offer.code);
                        setCopiedCode(offer.code);
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className="text-primary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 active:opacity-70"
                    >
                      {copiedCode === offer.code ? (
                        <><Check size={12} /> COPIED</>
                      ) : (
                        <><Copy size={12} /> COPY CODE</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}          <div className="bg-white">
          {loading ? (
            /* Skeleton */
            <div className="px-4 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-muted/50 border border-border mb-4 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
              <span className="text-5xl mb-2">🍽️</span>
              <p className="text-foreground text-base font-bold">No items found</p>
              <p className="text-muted-foreground text-sm">Try a different category or search term</p>
              {search && (
                <button onClick={() => setSearch('')} className="mt-2 px-6 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wide">
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="px-4 py-3 sticky top-[138px] bg-white z-30 border-b border-border/50">
                <h2 className="text-foreground text-base font-black tracking-tight m-0">{activeCategory === 'All' ? 'Recommended for You' : activeCategory}</h2>
              </div>
              <div className="flex flex-col">
                {filtered.map((item, i) => (
                  <motion.div
                    key={item.item_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(i * 0.02, 0.2) }}
                    onClick={() => handleAddItem(item)}
                    className="bg-white border-b border-border/50 p-4 flex gap-4 cursor-pointer relative"
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          {item.is_featured && (
                            <div className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded text-primary text-[10px] font-bold tracking-wide uppercase">
                              <Star size={10} fill="currentColor" /> Bestseller
                            </div>
                          )}
                        </div>
                        <h3 className="text-foreground text-base font-bold leading-tight mb-1.5">{item.name}</h3>
                        <p className="text-foreground font-semibold text-sm mb-2">₹{item.price}</p>
                        <p className="text-muted-foreground text-xs leading-snug line-clamp-2">{item.description}</p>
                      </div>
                    </div>
                    
                    {/* Image & Add Button */}
                    <div className="relative w-[118px] h-[118px] rounded-2xl flex-shrink-0 bg-muted border border-border/50 mb-3">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl bg-muted rounded-2xl">
                          {CAT_EMOJIS[item.category] || '🍽️'}
                        </div>
                      )}
                      
                      {/* Overlapping Add Button */}
                      {item.is_available && (
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAddItem(item); }}
                            className="bg-white border border-border text-primary shadow-sm text-sm font-black rounded-xl px-7 py-2 uppercase tracking-wide whitespace-nowrap active:scale-95 transition-transform"
                          >
                            ADD
                          </button>
                        </div>
                      )}
                      
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-10">
                           <span className="text-foreground text-xs font-bold px-2 py-1 bg-white rounded-md border border-border">Sold Out</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Cart Pill ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{ position: 'fixed', bottom: 96, left: 16, right: 16, zIndex: 30 }}
          >
            <Link href="/cart" style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'linear-gradient(135deg,#e2a855,#a26b1f)',
                borderRadius: 16, padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 8px 32px rgba(196,144,64,0.35)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.2)', borderRadius: 8,
                    padding: '4px 10px', color: '#fff', fontWeight: 700, fontSize: 13,
                  }}>
                    {cartCount} item{cartCount > 1 ? 's' : ''}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>View Cart</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>₹{cartTotal}</span>
                  <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
                </div>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customization Modal */}
      <CustomizationModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onConfirm={(customizedItem) => {
          addToCart(customizedItem);
          setSelectedItem(null);
        }}
      />

      <style>{`
        @keyframes menuPulse {
          0%,100% { opacity: 0.4; } 50% { opacity: 0.8; }
        }
        input::placeholder { color: rgba(var(--foreground-rgb),0.35); }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
