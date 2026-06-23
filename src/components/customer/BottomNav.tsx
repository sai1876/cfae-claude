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
        background: 'rgba(var(--background-rgb), 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-around h-20 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          const isCart = href === '/cart';

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 flex-1 py-2 relative"
            >
              {/* Active gold dot indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full"
                  style={{ background: 'var(--primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ color: isActive ? 'var(--primary)' : 'rgba(var(--foreground-rgb), 0.4)', transition: 'color 0.2s' }}
                />
                {/* Cart badge */}
                {isCart && cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </div>

              <span
                className="font-mono text-[9px] uppercase tracking-wider"
                style={{ color: isActive ? 'var(--primary)' : 'rgba(var(--foreground-rgb), 0.35)', transition: 'color 0.2s' }}
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
