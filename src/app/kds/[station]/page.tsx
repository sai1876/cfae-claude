'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { mockActiveOrders } from '@/lib/mockData';
import { OrderDocument } from '@/lib/types';
import OrderCard from '@/components/kds/OrderCard';
import KDSHeader from '@/components/kds/KDSHeader';
import { AnimatePresence } from 'framer-motion';

const VALID_STATIONS = ['fryer', 'brewer', 'grilled or steamed', 'fastfood & biryani'];

export default function KDSStationPage({ params }: { params: { station: string } }) {
  const [orders, setOrders] = useState<OrderDocument[]>([]);
  const station = params.station.toLowerCase();

  useEffect(() => {
    if (!VALID_STATIONS.includes(station)) {
      notFound();
    }
    
    // In a real app, this would be a Firestore onSnapshot listener
    // filtered by items containing the target station
    setOrders(mockActiveOrders as OrderDocument[]);
  }, [station]);

  const handleBump = (orderId: string) => {
    // Optimistic UI update: Remove the bumped items from the order 
    // or remove the entire order if it has no more items for this station.
    setOrders(prev => prev.map(order => {
      if (order.order_id === orderId) {
        return {
          ...order,
          items: order.items.map(item => 
            item.station === station.toUpperCase() ? { ...item, status: 'bumped' as const } : item
          )
        };
      }
      return order;
    }).filter(order => order.items.some(item => item.station === station.toUpperCase() && item.status === 'pending')));
  };

  if (!VALID_STATIONS.includes(station)) return null;

  // Filter out orders that don't have pending items for this station
  const activeStationOrders = orders.filter(order => 
    order.items.some(item => item.station === station.toUpperCase() && item.status === 'pending')
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#111]">
      <KDSHeader station={station} orderCount={activeStationOrders.length} />
      
      {/* Horizontal Scroll Area */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {activeStationOrders.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-[#444] text-3xl font-bold uppercase tracking-widest">
              Station Clear
            </p>
          </div>
        ) : (
          <div className="flex gap-6 h-full items-start">
            <AnimatePresence>
              {activeStationOrders.map(order => (
                <OrderCard 
                  key={order.order_id} 
                  order={order} 
                  station={station} 
                  onBump={handleBump} 
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
