'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Star, ShoppingBag, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { fetchMenuItems, fetchOutlets, fetchOffers } from '@/lib/dbService';
import { useStore } from '@/store/useStore';
import { MenuItem, Offer, Outlet } from '@/lib/types';
import CustomizationModal from '@/components/customer/CustomizationModal';
import { MapPin, Ticket, Copy, Check } from 'lucide-react';

const CATEGORIES = ['All', 'Biryani', 'Momos', 'Burgers', 'Waffles', 'Snacks', 'Beverages'] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLORS: Record<string, [string, string]> = {
  Biryani:   ['#7c3f0e', '#4a1f05'],
  Momos:     ['#1e3a5f', '#0d1f36'],
  Burgers:   ['#5f1e1e', '#3a0d0d'],
  Waffles:   ['#5c4a0f', '#3a2d05'],
  Snacks:    ['#2d4a1e', '#1a2d0d'],
  Beverages: ['#1e3f5c', '#0d1f36'],
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
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(var(--background-rgb),0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ color: 'var(--primary)', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>Oasis Cafe</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(232,98,26,0.08)', border: '1px solid rgba(232,98,26,0.15)', borderRadius: 12, padding: '2px 8px' }}>
                <MapPin size={9} color="#e8621a" />
                <CustomSelect 
                  value={customerOutlet} 
                  onChange={(val: string) => setCustomerOutlet(val)}
                  options={[
                    { value: "HYD CAMPUS", label: "HYD CAMPUS" },
                    ...outlets.filter(o => o.name !== 'HYD CAMPUS').map(o => ({ value: o.name, label: o.name.toUpperCase() }))
                  ]}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e8621a',
                    fontFamily: 'monospace',
                    fontSize: 8.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    outline: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  optionStyle={{ color: 'var(--foreground)', background: 'transparent' }}
                  activeOptionStyle={{ color: '#e8621a', background: 'rgba(232,98,26,0.1)' }}
                  dropdownStyle={{ left: 0, right: 'auto', minWidth: 140 }}
                />
              </div>
            </div>
            <h1 style={{ color: 'var(--foreground)', fontSize: 22, fontWeight: 700, lineHeight: 1.2, margin: '4px 0 0' }}>Our Menu</h1>
          </div>
          <div style={{
            background: 'rgba(212,163,84,0.08)', border: '1px solid rgba(212,163,84,0.15)',
            borderRadius: 20, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 600 }}>Kitchen Open</span>
          </div>
        </div>

        {/* Search & Sort */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(var(--foreground-rgb), 0.4)' }} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu..."
              style={{
                width: '100%', background: 'rgba(var(--foreground-rgb),0.04)',
                border: '1px solid var(--border)', borderRadius: 12,
                padding: '10px 36px 10px 36px', color: 'var(--foreground)',
                fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(var(--foreground-rgb),0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            )}
          </div>
          
          <CustomSelect 
            value={sortBy} 
            onChange={(val: string) => setSortBy(val as any)}
            options={[
              { value: 'default', label: 'Sort: Default' },
              { value: 'price_asc', label: 'Price: Low to High' },
              { value: 'price_desc', label: 'Price: High to Low' }
            ]}
            style={{
              background: 'rgba(var(--foreground-rgb),0.04)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '10px 12px',
              color: 'var(--foreground)',
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer'
            }}
            optionStyle={{ color: 'var(--foreground)', background: 'transparent' }}
            activeOptionStyle={{ color: 'var(--primary)', background: 'rgba(198,139,53,0.08)' }}
          />
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'rgba(198,139,53,0.1)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                  fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 13 }}>{CAT_EMOJIS[cat]}</span> {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Active promotions carousel */}
        {offers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ticket size={13} color="var(--primary)" />
              <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Active Special Offers</span>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
              {offers.map(offer => (
                <div 
                  key={offer.code}
                  style={{
                    flexShrink: 0,
                    width: 280,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 10,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    boxShadow: '0 4px 15px rgba(44, 26, 16, 0.03)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', background: 'var(--muted)' }}>
                    {offer.imageUrl ? (
                      <img src={offer.imageUrl} alt={offer.code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(198,139,53,0.05)' }}>
                        🎟️
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifySpaceBetween: 'space-between' } as any}>
                      <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offer.code}</span>
                      <span style={{ background: 'rgba(198,139,53,0.08)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 4px', color: 'var(--primary)', fontSize: 8, fontWeight: 700, fontFamily: 'monospace' }}>
                        {offer.discountPercent}% OFF
                      </span>
                    </div>
                    <p style={{ color: 'var(--muted-foreground)', fontSize: 10.5, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
                      {offer.description}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(offer.code);
                        setCopiedCode(offer.code);
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      style={{
                        background: copiedCode === offer.code ? 'rgba(110,156,98,0.12)' : 'rgba(198,139,53,0.05)',
                        border: `1px solid ${copiedCode === offer.code ? 'rgba(110,156,98,0.25)' : 'rgba(198,139,53,0.15)'}`,
                        borderRadius: 6,
                        padding: '3px 8px',
                        color: copiedCode === offer.code ? 'var(--secondary)' : 'var(--primary)',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        width: 'fit-content',
                        marginTop: 4,
                        transition: 'all 0.2s'
                      }}
                    >
                      {copiedCode === offer.code ? (
                        <><Check size={9} /> Copied!</>
                      ) : (
                        <><Copy size={9} /> Copy Code</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {loading ? (
          /* Skeleton */
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              height: 90, borderRadius: 16,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              animation: 'menuPulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
          ))
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: 56 }}>🍽️</span>
            <p style={{ color: 'var(--foreground)', fontSize: 16, fontWeight: 600 }}>No items found</p>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Try a different category or search term</p>
            {search && (
              <button onClick={() => setSearch('')} style={{ padding: '8px 20px', borderRadius: 20, background: 'rgba(198,139,53,0.08)', border: '1px solid var(--border)', color: 'var(--primary)', fontSize: 12, cursor: 'pointer' }}>
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filtered.map((item, i) => {
            const [from, to] = CAT_COLORS[item.category] || ['#333', '#111'];
            return (
              <motion.div
                key={item.item_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(i * 0.05, 0.4) }}
                onClick={() => handleAddItem(item)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'stretch',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 4px 20px rgba(44, 26, 16, 0.04)',
                  borderRadius: 16, overflow: 'hidden', cursor: item.is_available ? 'pointer' : 'default',
                  position: 'relative', transition: 'border-color 0.2s',
                }}
              >
                {/* Image / Gradient */}
                <div style={{
                  width: 88, flexShrink: 0, position: 'relative',
                  background: `linear-gradient(135deg, ${from}, ${to})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 28 }}>{CAT_EMOJIS[item.category]}</span>
                  )}
                  {!item.is_available && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sold Out</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, padding: '12px 12px 12px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <p style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</p>
                      {item.is_featured && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 2,
                          background: 'rgba(198,139,53,0.08)', border: '1px solid var(--border)',
                          borderRadius: 10, padding: '1px 6px',
                          color: 'var(--primary)', fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                        }}>
                          <Star size={7} fill="var(--primary)" /> FEATURED
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'var(--muted-foreground)', fontSize: 11.5, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifySpaceBetween: 'space-between' } as any}>
                    <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>₹{item.price}</p>
                    {item.is_available && (
                      <button
                        onClick={e => { e.stopPropagation(); handleAddItem(item); }}
                        style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: 'linear-gradient(135deg,#e2a855,#a26b1f)',
                          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(196,144,64,0.3)',
                        }}
                      >
                        <Plus size={16} color="#fff" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
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
