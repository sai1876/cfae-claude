'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, ChefHat, ShoppingCart, Check } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { fetchMenuItems, issueStressCoupon } from '@/lib/dbService';
import { MenuItem } from '@/lib/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  recommendedItems?: MenuItem[];
  couponCode?: string;
  choices?: string[];   // Interactive choice chips from Bhai
  reactions?: Record<string, number>; // emoji → count
}

const MOOD_GRID = [
  { emoji: '😴', label: 'Neend nahi hui' },
  { emoji: '😤', label: 'Bahut stressed' },
  { emoji: '😋', label: 'Hungry hoon' },
  { emoji: '😢', label: 'Mood off hai' },
  { emoji: '🥳', label: 'Mast feel' },
  { emoji: '🌶️', label: 'Spicy chahiye' },
];

const REACTION_EMOJIS = ['😂', '❤️', '👍', '🔥'];

export default function StressBusterChat({ showNavigation = false }: { showNavigation?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingWelcome, setIsLoadingWelcome] = useState(false);
  const [menuCatalog, setMenuCatalog] = useState<MenuItem[]>([]);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [welcomeGenerated, setWelcomeGenerated] = useState(false);

  const { user, addToCart } = useStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMenuItems().then(setMenuCatalog).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      if (!welcomeGenerated) {
        generateDynamicWelcome();
      }
    }
  }, [isOpen]);

  const getWeather = async (): Promise<{temp: number, condition: string, feels: number} | null> => {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      const { latitude, longitude } = pos.coords;
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,apparent_temperature&timezone=auto`
      );
      const d = await r.json();
      const temp = Math.round(d.current.temperature_2m);
      const feels = Math.round(d.current.apparent_temperature);
      const code = d.current.weathercode;
      // WMO weather codes → human condition
      let condition = 'clear';
      if (code === 0) condition = 'sunny and clear';
      else if (code <= 3) condition = 'partly cloudy';
      else if (code <= 48) condition = 'foggy';
      else if (code <= 67) condition = 'rainy';
      else if (code <= 77) condition = 'snowy';
      else if (code <= 99) condition = 'thunderstormy';
      return { temp, condition, feels };
    } catch {
      return null;
    }
  };

  const getActiveOffers = async (): Promise<string[]> => {
    try {
      const { getDocs, collection, where, query } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const today = new Date().toISOString().split('T')[0];
      const snap = await getDocs(
        query(collection(db, 'offers'), where('isActive', '==', true))
      );
      return snap.docs
        .map(d => d.data() as import('@/lib/types').Offer)
        .filter(o => o.expiryDate >= today)
        .map(o => `${o.code} — ${o.description} (${o.discountPercent}% off)`);
    } catch {
      return [];
    }
  };

  const generateDynamicWelcome = async () => {
    setIsLoadingWelcome(true);
    setWelcomeGenerated(true);

    try {
      const [weather, offers] = await Promise.all([getWeather(), getActiveOffers()]);

      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

      const weatherLine = weather
        ? `It's ${weather.temp}°C outside (feels like ${weather.feels}°C) and ${weather.condition}.`
        : 'Weather unknown.';
      const offersLine = offers.length > 0
        ? `Running offers: ${offers.slice(0, 3).join(' | ')}`
        : 'No special offers right now.';

      const res = await fetch('/api/chat/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeOfDay, weatherLine, offersLine })
      });

      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        if (parsed.message) {
          setMessages([{ id: 'welcome', role: 'bot', content: parsed.message }]);
          return;
        }
      }
    } catch (e) {
      console.warn('Dynamic welcome failed, using fallback', e);
    }

    // Fallback welcome
    setMessages([{
      id: 'welcome',
      role: 'bot',
      content: "Arre aa gaya! 😎 Baith baith, kya scene hai aaj tera? Bol bhai — mood kaisa hai, khaana khaaya ki nahi?"
    }]);
    setIsLoadingWelcome(false);
  };

  useEffect(() => {
    if (messages.length > 0 && isLoadingWelcome) setIsLoadingWelcome(false);
  }, [messages]);

  // Call our secure backend API instead of Groq directly
  const callGroqDirect = async (userMessage: string, chatHistory: {role: string, content: string}[]): Promise<{message: string, recommendedMenuItemIds?: string[], is_highly_stressed: boolean, choices?: string[]}> => {
    const menuContext = menuCatalog.filter(i => i.is_available).length > 0
      ? `\n\nAVAILABLE MENU ITEMS (use exact IDs when recommending):\n` +
        menuCatalog.filter(i => i.is_available).map(i => `- ID: "${i.item_id}" | ${i.name} | ${i.category} | ₹${i.price}`).join('\n')
      : '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          chatHistory,
          menuContext
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API failed with status ${response.status}`);
      }

      const data = await response.json();
      const contentStr = data.choices?.[0]?.message?.content;
      if (!contentStr) throw new Error("No content from LLM");
      
      const parsed = JSON.parse(contentStr);
      return parsed;
    } catch (error) {
      console.error("LLM Call failed", error);
      throw error;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    setShowQuickReplies(false);
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const aiRes = await callGroqDirect(
        newMsg.content,
        messages.map(m => ({ role: m.role, content: m.content }))
      );

      let recommended: MenuItem[] = [];
      if (aiRes.recommendedMenuItemIds && aiRes.recommendedMenuItemIds.length > 0) {
        recommended = menuCatalog.filter(item =>
          aiRes.recommendedMenuItemIds!.includes(item.item_id)
        );
      }

      let couponCode: string | undefined;
      if (aiRes.is_highly_stressed && user) {
        const issued = await issueStressCoupon(user.uid);
        if (issued) {
          couponCode = 'STRESS_FREE_10';
          aiRes.message += `\n\nAur sun — tujhe dekh ke lagra full tension me hai bhai 😢 Le meri taraf se 10% OFF! Checkout pe 'STRESS_FREE_10' daal dena. Month mein sirf 2 baar milega!`;
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: aiRes.message,
        recommendedItems: recommended.length > 0 ? recommended : undefined,
        couponCode,
        choices: aiRes.choices?.length ? aiRes.choices : undefined
      }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: "Arey yaar, thoda busy tha 😅 Ek baar phir try kar bhai!"
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, reactions: { ...m.reactions, [emoji]: ((m.reactions?.[emoji] || 0) + 1) } }
        : m
    ));
  };

  const handleAddToCart = (item: MenuItem) => {
    addToCart({
      menuItemId: item.item_id,
      name: item.name,
      price: item.price,
      quantity: 1,
      station: item.station,
      modifiers: []
    });
    setAddedItems(prev => new Set(prev).add(item.item_id));
  };

  const btnBottom = showNavigation ? 'bottom-[88px]' : 'bottom-5';
  const panelBottom = showNavigation ? 'bottom-[152px]' : 'bottom-[76px]';

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className={`fixed right-4 ${panelBottom} z-[9998] w-[315px]`}
            style={{
              background: 'linear-gradient(160deg, #FAF6F0 0%, #F5EFEB 100%)',
              border: '1px solid var(--border)',
              borderRadius: 22,
              boxShadow: '0 20px 50px rgba(44, 26, 16, 0.08)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '430px',
            }}
          >
            {/* ── Header ── */}
            <div style={{
              background: 'linear-gradient(90deg, #EADFCE 0%, #E3D4C1 100%)',
              borderBottom: '1px solid var(--border)',
              padding: '11px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#d4a354,#a07830)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 14px rgba(212,163,84,0.28)',
                  flexShrink: 0,
                }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12.5, lineHeight: 1.2 }}>Oasis Stress-Buster</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                    <p style={{ color: 'rgba(var(--foreground-rgb), 0.5)', fontSize: 9.5 }}>Campus Counselor · Online</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  color: 'rgba(var(--foreground-rgb), 0.45)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(var(--foreground-rgb), 0.45)')}
              >
                <X size={15} />
              </button>
            </div>

            {/* ── Messages ── */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 12px 6px',
              display: 'flex', flexDirection: 'column', gap: 9,
              scrollbarWidth: 'none',
            }}>
              {/* Welcome loading shimmer */}
              {isLoadingWelcome && messages.length === 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    maxWidth: '87%', borderRadius: '16px 16px 16px 4px',
                    padding: '10px 14px', display: 'flex', gap: 5, alignItems: 'center',
                    background: 'rgba(var(--foreground-rgb), 0.04)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ width: 160, height: 10, borderRadius: 6, background: 'rgba(var(--foreground-rgb), 0.15)', animation: 'sbShimmer 1.4s ease-in-out infinite' }} />
                      <div style={{ width: 120, height: 10, borderRadius: 6, background: 'rgba(var(--foreground-rgb), 0.08)', animation: 'sbShimmer 1.4s 0.2s ease-in-out infinite' }} />
                      <div style={{ width: 80, height: 10, borderRadius: 6, background: 'rgba(var(--foreground-rgb), 0.05)', animation: 'sbShimmer 1.4s 0.4s ease-in-out infinite' }} />
                    </div>
                  </div>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22 }}
                    style={{
                      maxWidth: '87%',
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg,#e2a855,#a26b1f)'
                        : '#FFFFFF',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '9px 12px',
                      color: msg.role === 'user' ? 'var(--primary-foreground)' : 'var(--foreground)',
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      boxShadow: msg.role === 'user' ? 'none' : '0 2px 10px rgba(44, 26, 16, 0.04)',
                    }}
                  >
                    {msg.content}

                    {/* Coupon Badge */}
                    {msg.couponCode && (
                      <div style={{
                        marginTop: 10,
                        background: 'rgba(198,139,53,0.08)',
                        border: '1px dashed var(--primary)',
                        borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                      }}>
                        <p style={{ color: 'var(--primary)', fontSize: 9.5, marginBottom: 3 }}>🎟️ Your Stress Coupon</p>
                        <p style={{
                          color: 'var(--primary)', fontWeight: 800, fontSize: 13.5,
                          letterSpacing: '0.1em', fontFamily: 'monospace',
                        }}>{msg.couponCode}</p>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: 8.5, marginTop: 3 }}>10% OFF · Use at checkout</p>
                      </div>
                    )}

                    {/* Recommended Items */}
                    {msg.recommendedItems && msg.recommendedItems.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p style={{ color: 'rgba(212,163,84,0.6)', fontSize: 9.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ChefHat size={10} /> Mera suggestion hai
                        </p>
                        {msg.recommendedItems.map(item => (
                          <div key={item.item_id} style={{
                            background: 'rgba(212,163,84,0.06)',
                            border: '1px solid rgba(212,163,84,0.14)',
                            borderRadius: 10, padding: '7px 10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 11.5, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</p>
                              <p style={{ color: '#d4a354', fontSize: 11, fontWeight: 700 }}>₹{item.price}</p>
                            </div>
                            <button
                              onClick={() => handleAddToCart(item)}
                              style={{
                                background: addedItems.has(item.item_id)
                                  ? 'rgba(74,222,128,0.12)'
                                  : 'linear-gradient(135deg,#c49040,#8a5f1e)',
                                border: addedItems.has(item.item_id) ? '1px solid rgba(74,222,128,0.3)' : 'none',
                                borderRadius: 8, padding: '5px 9px',
                                color: addedItems.has(item.item_id) ? '#4ade80' : '#fff',
                                fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                                transition: 'all 0.2s',
                              }}
                            >
                              {addedItems.has(item.item_id) ? <><Check size={10} /> Added</> : <><ShoppingCart size={10} /> Add</>}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* ── Reactions + Choice Chips (below bot bubble) ── */}
                  {msg.role === 'bot' && (
                    <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {/* Reaction row */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => addReaction(msg.id, emoji)}
                            style={{
                              background: msg.reactions?.[emoji] ? 'rgba(212,163,84,0.18)' : 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(212,163,84,0.12)',
                              borderRadius: 20, padding: '2px 7px',
                              cursor: 'pointer', fontSize: 11,
                              color: 'rgba(255,255,255,0.7)',
                              transition: 'all 0.15s',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}
                          >
                            {emoji}{msg.reactions?.[emoji] ? <span style={{ fontSize: 9, color: '#d4a354' }}>{msg.reactions[emoji]}</span> : null}
                          </button>
                        ))}
                      </div>
                      {/* AI-generated choice chips */}
                      {msg.choices && msg.choices.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {msg.choices.map((choice, i) => (
                            <motion.button
                              key={i}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.08 }}
                              onClick={() => sendMessage(choice)}
                              style={{
                                background: 'linear-gradient(135deg, rgba(212,163,84,0.12), rgba(212,163,84,0.06))',
                                border: '1px solid rgba(212,163,84,0.3)',
                                borderRadius: 16, padding: '4px 10px',
                                color: '#d4a354', fontSize: 10.5, fontWeight: 500,
                                cursor: 'pointer', whiteSpace: 'nowrap',
                                transition: 'all 0.18s',
                              }}
                            >
                              {choice}
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border)',
                    borderRadius: '16px 16px 16px 4px',
                    padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center',
                    boxShadow: '0 2px 10px rgba(44, 26, 16, 0.04)',
                  }}>
                    {[0, 160, 320].map(d => (
                      <span key={d} style={{
                        width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block',
                        animation: `sbBounce 0.9s ${d}ms ease-in-out infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Mood Emoji Grid (shown before first user message) ── */}
            <AnimatePresence>
              {showQuickReplies && !isTyping && messages.length <= 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    padding: '8px 10px',
                    borderTop: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 9, textAlign: 'center', marginBottom: 6, letterSpacing: '0.05em' }}>ABHI KAISA FEEL HO RAHA HAI?</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                    {MOOD_GRID.map(({ emoji, label }) => (
                      <motion.button
                        key={label}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => sendMessage(`${emoji} ${label}`)}
                        style={{
                          background: 'rgba(198,139,53,0.05)',
                          border: '1px solid var(--border)',
                          borderRadius: 10, padding: '7px 4px',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 3,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{emoji}</span>
                        <span style={{ color: 'var(--foreground)', fontSize: 8.5, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Input ── */}
            <div style={{
              padding: '9px 10px',
              borderTop: '1px solid var(--border)',
              background: 'rgba(var(--foreground-rgb), 0.03)',
              flexShrink: 0,
              display: 'flex', gap: 7, alignItems: 'center',
            }}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(inputValue)}
                placeholder="Bol bhai, kya chal raha hai..."
                style={{
                  flex: 1,
                  background: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: 12, padding: '8px 12px',
                  color: 'var(--foreground)', fontSize: 12.5, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={isTyping || !inputValue.trim()}
                style={{
                  width: 34, height: 34, flexShrink: 0, borderRadius: 10,
                  background: !inputValue.trim() || isTyping
                    ? 'rgba(var(--foreground-rgb), 0.05)'
                    : 'linear-gradient(135deg,#e2a855,#a26b1f)',
                  border: 'none',
                  color: !inputValue.trim() || isTyping ? 'rgba(var(--foreground-rgb), 0.25)' : '#fff',
                  cursor: !inputValue.trim() || isTyping ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: !inputValue.trim() || isTyping ? 'none' : '0 4px 12px rgba(198,139,53,0.3)',
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Button ── */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed right-4 ${btnBottom} z-[9999]`}
        style={{
          width: 50, height: 50, borderRadius: '50%',
          background: isOpen ? 'var(--card)' : 'linear-gradient(135deg,#e2a855,#a26b1f)',
          border: '1.5px solid var(--border)',
          color: isOpen ? 'var(--primary)' : '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isOpen ? '0 4px 20px rgba(44,26,16,0.08)' : '0 6px 24px rgba(198,139,53,0.3)',
          transition: 'background 0.3s, box-shadow 0.3s',
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.16 }}>
                <X size={20} color="var(--primary)" />
              </motion.div>
            : <motion.div key="msg" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.16 }}>
                <MessageCircle size={22} />
              </motion.div>
          }
        </AnimatePresence>
      </motion.button>

      <style>{`
        @keyframes sbBounce {
          0%,100% { transform:translateY(0); opacity:0.35; }
          50%      { transform:translateY(-4px); opacity:1; }
        }
        @keyframes sbShimmer {
          0%,100% { opacity:0.4; }
          50%      { opacity:1; }
        }
      `}</style>
    </>
  );
}
