'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Coffee, User, ShoppingBag } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/',        icon: Home,        label: 'Home'    },
  { href: '/menu',    icon: Coffee,      label: 'Menu'    },
  { href: '/cart',    icon: ShoppingBag, label: 'Cart'    },
  { href: '/profile', icon: User,        label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const cart = useStore(s => s.cart);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe"
      style={{
        background: 'rgba(255,255,255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.02)'
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          const isCart = href === '/cart';

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 flex-1 py-1 relative"
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="relative mt-1">
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)', transition: 'color 0.2s' }}
                />
                {/* Cart badge */}
                {isCart && cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-black bg-primary text-primary-foreground border-2 border-white"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </div>

              <span
                className={`text-[10px] tracking-wide transition-colors ${isActive ? 'text-primary font-bold' : 'text-muted-foreground font-medium'}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
