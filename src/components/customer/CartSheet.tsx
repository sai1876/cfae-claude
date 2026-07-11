'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronUp } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { usePathname, useRouter } from 'next/navigation';
import { calculatePricingPreview } from '@/features/checkout/clientPricingPreview';

export default function CartSheet({ showTrigger = true }: { showTrigger?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const isCartPage = pathname === '/cart';

  const { cart } = useStore();

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  
  // Use the shared helper just for the base subtotal to avoid duplicating the reduce logic
  const { subtotal: subtotalAmount } = calculatePricingPreview({
    cart,
    platformFee: 5,
    promoApplied: false,
    promoDiscountPercent: 0,
    promoScope: 'All',
    activeBalance: 0,
    pointsInput: 0,
    menuItems: []
  });

  if (totalItems === 0) return null;

  return (
    <AnimatePresence>
      {showTrigger && cart.length > 0 && !isCartPage && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={() => router.push('/cart')}
          className="fixed bottom-20 left-4 right-4 z-40 bg-hauhau-surface-container-highest shadow-[0_12px_40px_rgba(0,0,0,0.7)] rounded-2xl p-4 flex items-center justify-between cursor-pointer border border-hauhau-gold/20"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="text-hauhau-gold" size={24} />
              <span className="absolute -top-2 -right-2 bg-hauhau-gold text-hauhau-surface text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {totalItems}
              </span>
            </div>
            <div>
              <p className="text-hauhau-on-surface-variant font-medium text-xs font-mono tracking-wider uppercase">Your Escape Basket</p>
              <p className="text-hauhau-gold font-bold text-sm">₹{subtotalAmount}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-hauhau-gold font-mono text-xs uppercase tracking-widest bg-hauhau-gold/10 px-3 py-1.5 rounded-full border border-hauhau-gold/20">
            Review & Pay
            <ChevronUp size={16} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
