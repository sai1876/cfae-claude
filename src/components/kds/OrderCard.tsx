'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderDocument } from '@/lib/types';
import { Check } from 'lucide-react';

interface OrderCardProps {
  order: OrderDocument;
  station: string;
  onBump: (orderId: string) => void;
}

export default function OrderCard({ order, station, onBump }: OrderCardProps) {
  const [elapsed, setElapsed] = useState(0);
  const [confirmBump, setConfirmBump] = useState(false);

  // Filter items for this specific station
  const stationItems = order.items.filter(item => item.station === station.toUpperCase() && item.status === 'pending');

  useEffect(() => {
    if (stationItems.length === 0) return; // Already bumped
    
    const updateTimer = () => {
      setElapsed(Math.floor((Date.now() - order.created_at) / 1000));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order.created_at, stationItems.length]);

  // Handle Double Tap Bump
  useEffect(() => {
    if (confirmBump) {
      const timer = setTimeout(() => setConfirmBump(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [confirmBump]);

  if (stationItems.length === 0) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  let borderClass = 'border-[#333]';
  if (minutes >= 8) {
    borderClass = 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse';
  } else if (minutes >= 5) {
    borderClass = 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]';
  }

  const handleBumpClick = () => {
    if (confirmBump) {
      onBump(order.order_id);
    } else {
      setConfirmBump(true);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      className={`bg-[#222] rounded-xl flex flex-col w-[320px] shrink-0 border-2 ${borderClass} transition-all duration-300 relative overflow-hidden`}
    >
      {/* Front Face */}
      <AnimatePresence mode="wait">
        {!confirmBump ? (
          <motion.div
            key="front"
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1a1a1a]">
              <span className={`font-mono font-bold tracking-wider text-white ${
                order.order_type === 'delivery' ? 'text-lg' : 'text-3xl'
              }`}>
                #{order.order_type === 'delivery' ? order.order_id : order.token_number}
              </span>
              <span className={`font-mono text-xl ${minutes >= 8 ? 'text-red-400' : minutes >= 5 ? 'text-amber-400' : 'text-gray-400'}`}>
                {timeString}
              </span>
            </div>

            {/* Items */}
            <div className="p-4 flex-1 overflow-y-auto">
              <ul className="space-y-4">
                {stationItems.map(item => (
                  <li key={item.item_id} className="flex items-start text-2xl font-medium leading-tight text-white">
                    <span className="mr-3 mt-1 text-gray-500">•</span>
                    <span className="flex-1">{item.name}</span>
                    <span className="ml-4 font-bold text-amber-400 bg-[#333] px-3 py-1 rounded-lg shrink-0">
                      × {item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Meta */}
            <div className="p-4 border-t border-[#333] bg-[#1a1a1a] flex flex-wrap gap-2">
              {order.hatch && (
                <span className="px-3 py-1 bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded uppercase font-bold text-sm">
                  {order.hatch}
                </span>
              )}
              <span className="px-3 py-1 bg-[#333] text-gray-300 rounded uppercase font-bold text-sm">
                {order.order_type}
              </span>
            </div>

            {/* Action */}
            <button
              onClick={handleBumpClick}
              className="w-full h-[80px] bg-[#333] hover:bg-[#444] border-t border-[#444] text-gray-300 font-bold text-2xl uppercase tracking-widest transition-colors flex items-center justify-center gap-3"
            >
              Bump
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full bg-green-900/90 items-center justify-center cursor-pointer"
            onClick={handleBumpClick}
          >
            <Check size={80} className="text-green-400 mb-4" />
            <span className="font-bold text-3xl text-white uppercase tracking-widest">
              Confirm Bump
            </span>
            <span className="text-green-300 mt-2 font-medium">
              Tap again to clear
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
