"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ChevronLeft, ShoppingCart } from "lucide-react";

// Types
type Ingredient = {
  id: string;
  name: string;
  price: number;
  width: string;
  height: string;
  zIndex: number;
  bgPos: string;
  bgSize: string;
};

// Available Addons (Using CSS Sprites from /burger-sprite.png)
const addons: Ingredient[] = [
  // Bottom Right of the sprite sheet has both veggies and cheese. We'll use specific positions to isolate them.
  { id: "cheese", name: "Cheese", price: 1, width: "w-44", height: "h-16", zIndex: 10, bgPos: "100% 100%", bgSize: "200% auto" },
  { id: "veggies", name: "Fresh Toppings", price: 1.5, width: "w-48", height: "h-20", zIndex: 12, bgPos: "100% 70%", bgSize: "200% auto" },
  { id: "patty", name: "Extra Patty", price: 3, width: "w-48", height: "h-20", zIndex: 8, bgPos: "100% 0%", bgSize: "200% auto" },
];

export default function CustomisationDemo() {
  const [selectedAddons, setSelectedAddons] = useState<Ingredient[]>([]);
  const [animatingAddonId, setAnimatingAddonId] = useState<string | null>(null);
  const [isLifting, setIsLifting] = useState(false);

  const basePrice = 15;
  const totalPrice = basePrice + selectedAddons.reduce((sum, item) => sum + item.price, 0);

  const incomingZIndex = animatingAddonId 
    ? addons.find(a => a.id === animatingAddonId)?.zIndex || 0 
    : 0;

  const toggleAddon = (addon: Ingredient) => {
    const isRemoving = selectedAddons.find(a => a.id === addon.id);
    
    if (isRemoving) {
      setSelectedAddons(selectedAddons.filter(a => a.id !== addon.id));
    } else {
      if (isLifting) return; 
      
      setIsLifting(true);
      setAnimatingAddonId(addon.id);
      
      setTimeout(() => {
        setSelectedAddons([...selectedAddons, addon]);
        setTimeout(() => {
          setIsLifting(false);
          setAnimatingAddonId(null);
        }, 400); 
      }, 200); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col font-sans text-gray-900 overflow-hidden max-w-md mx-auto border-x border-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between p-6 pt-12 z-50">
        <button className="p-3 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-md transition">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Customize</h1>
        <button className="p-3 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-md transition relative">
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white">
            1
          </span>
        </button>
      </div>

      {/* Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-8">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/10 blur-[60px] rounded-full z-0"></div>
        
        <div className="relative w-full h-80 flex flex-col-reverse items-center justify-start gap-0 pb-6 z-10">
          
          {/* Base Bottom Bun (Heel) - Bottom Left of Sprite */}
          <motion.div 
            layout 
            className="w-48 h-16 z-[5] bg-no-repeat drop-shadow-md rounded-xl"
            style={{ backgroundImage: "url('/burger-sprite.png')", backgroundPosition: "0% 75%", backgroundSize: "200% auto" }}
          />
          
          {/* Base Patty - Top Right of Sprite */}
          <motion.div 
            layout 
            className="w-48 h-16 -mb-4 z-[6] bg-no-repeat drop-shadow-md rounded-xl"
            style={{ backgroundImage: "url('/burger-sprite.png')", backgroundPosition: "100% 20%", backgroundSize: "200% auto" }}
          />

          {/* Dynamic Addons */}
          <AnimatePresence>
            {selectedAddons
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((addon) => {
                const shouldLift = isLifting && addon.id !== animatingAddonId && addon.zIndex > incomingZIndex;
                
                return (
                  <motion.div
                    layout
                    key={addon.id}
                    initial={{ opacity: 1, y: -800, scale: 1 }}
                    animate={{ opacity: 1, y: shouldLift ? -800 : 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 600, damping: 25, mass: 1 }}
                    className={`${addon.width} ${addon.height} -mb-6 bg-no-repeat drop-shadow-md`}
                    style={{ zIndex: addon.zIndex, backgroundImage: "url('/burger-sprite.png')", backgroundPosition: addon.bgPos, backgroundSize: addon.bgSize }}
                  />
                );
            })}
          </AnimatePresence>

          {/* Base Top Bun (Crown) - Top Left of Sprite */}
          <motion.div 
            layout
            animate={{ y: isLifting ? -800 : 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 25, mass: 1 }}
            className="w-52 h-28 -mb-10 z-[30] relative bg-no-repeat drop-shadow-xl"
            style={{ backgroundImage: "url('/burger-sprite.png')", backgroundPosition: "0% 0%", backgroundSize: "200% auto" }}
          />
        </div>
      </div>

      {/* Interaction Panel */}
      <div className="bg-white rounded-t-[2.5rem] p-8 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.06)] z-20">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-black mb-1 text-gray-900 tracking-tight">Veg Regular</h2>
            <p className="text-gray-400 text-sm font-medium">Build it your way</p>
          </div>
          <div className="flex items-start">
            <span className="text-orange-500 font-bold text-xl mt-1">$</span>
            <motion.div 
              key={totalPrice}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl font-black text-gray-900"
            >
              {totalPrice}
            </motion.div>
          </div>
        </div>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Add Toppings</h3>
        
        <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {addons.map((addon) => {
            const isSelected = selectedAddons.find(a => a.id === addon.id);
            return (
              <button
                key={addon.id}
                onClick={() => toggleAddon(addon)}
                className={`relative flex-shrink-0 w-28 h-36 rounded-[1.25rem] border-2 flex flex-col items-center justify-center p-3 snap-center transition-all duration-300 ${
                  isSelected ? 'border-orange-500 bg-orange-50 shadow-[0_8px_20px_rgba(249,115,22,0.15)] scale-[1.02]' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div 
                  className={`w-16 h-12 mb-4 bg-no-repeat bg-contain bg-center drop-shadow-sm`}
                  style={{ backgroundImage: "url('/burger-sprite.png')", backgroundPosition: addon.bgPos, backgroundSize: addon.bgSize }}
                />
                <span className="text-sm font-bold text-gray-800">{addon.name}</span>
                <span className="text-xs font-bold text-orange-500 mt-1">+${addon.price}</span>
                
                {/* Selection indicator */}
                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isSelected ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </div>
              </button>
            )
          })}
        </div>

        <button className="w-full mt-6 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:bg-black transition-colors active:scale-[0.98] flex items-center justify-center gap-2">
          <span>Add to Order</span>
          <span className="w-1 h-1 bg-white rounded-full"></span>
          <span>${totalPrice}</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>
  );
}
