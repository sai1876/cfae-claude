import { create } from 'zustand';
import { UserDocument, OrderDocument, MenuItem } from '@/lib/types';

interface CartItem {
  id: string; // Internal cart ID
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  station: MenuItem['station'];
  modifiers?: string[]; // Selected customizations
}

interface AppState {
  // Auth state
  user: { uid: string; phone: string } | null;
  userProfile: UserDocument | null;
  setUser: (user: { uid: string; phone: string } | null) => void;
  setUserProfile: (profile: UserDocument | null) => void;
  
  // Outlet state
  customerOutlet: string;
  setCustomerOutlet: (outlet: string) => void;
  
  // UI Theme (Weather / Occasion driven)
  theme: 'default' | 'scorching' | 'raining' | 'night' | 'exam' | 'fest' | 'valentines';
  setTheme: (theme: AppState['theme']) => void;

  // Category filter state
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  
  // Cart state
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;

  // Real-time Cloud Sync
  activeOrders: OrderDocument[];
  setActiveOrders: (orders: OrderDocument[]) => void;
}

import { persist } from 'zustand/middleware';

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      userProfile: null,
      setUser: (user) => set({ user }),
      setUserProfile: (userProfile) => set({ userProfile }),
      
      customerOutlet: 'HYD CAMPUS', // Default
      setCustomerOutlet: (customerOutlet) => set({ customerOutlet }),
      
      theme: 'default',
      setTheme: (theme) => set({ theme }),

      activeCategory: 'All',
      setActiveCategory: (activeCategory) => set({ activeCategory }),
      
      cart: [],
      addToCart: (item) => set((state) => {
        // Check if identical item (same itemId and modifiers) is already in the cart
        const existingIndex = state.cart.findIndex(
          (i) => i.menuItemId === item.menuItemId && 
          JSON.stringify(i.modifiers || []) === JSON.stringify(item.modifiers || [])
        );

        if (existingIndex > -1) {
          const updatedCart = [...state.cart];
          updatedCart[existingIndex].quantity += item.quantity;
          return { cart: updatedCart };
        }

        return {
          cart: [...state.cart, { ...item, id: Math.random().toString(36).substring(7) }]
        };
      }),
      removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter((i) => i.id !== id)
      })),
      updateQuantity: (id, delta) => set((state) => ({
        cart: state.cart.map((item) => {
          if (item.id === id) {
            const newQuantity = Math.max(1, item.quantity + delta);
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
      })),
      clearCart: () => set({ cart: [] }),

      activeOrders: [],
      setActiveOrders: (activeOrders) => set({ activeOrders })
    }),
    {
      name: 'Hau Hau-cafe-storage',
      partialize: (state) => ({ 
        cart: state.cart, 
        user: state.user, 
        userProfile: state.userProfile,
        theme: state.theme,
        customerOutlet: state.customerOutlet
      }),
    }
  )
);
