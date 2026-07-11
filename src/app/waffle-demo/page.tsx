"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ChevronLeft, ShoppingCart } from "lucide-react";

// Types
type Ingredient = {
  id: string;
  name: string;
  price: number;
  color: string;
  height: string;
  width: string;
  borderRadius?: string;
  zIndex: number;
  classes?: string;
  type: 'side' | 'topping';
  sidePosition?: { top?: string; left?: string; bottom?: string; right?: string };
  content?: React.ReactNode;
};

// Available Addons for Waffle (Using Emojis to look more "real" without actual transparent PNGs)
const addons: Ingredient[] = [
  { 
    id: "nutella", name: "Nutella Cup", price: 1.5, color: "bg-[#4A2511]", height: "h-14", width: "w-14", borderRadius: "rounded-full", zIndex: 10, type: 'side', sidePosition: { top: "10px", left: "10px" }, classes: "border-4 border-gray-50 shadow-[0_5px_15px_rgba(0,0,0,0.15)]",
    content: <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#8A5A44]">N</div>
  },
  { 
    id: "strawberry", name: "Strawberries", price: 1, color: "bg-transparent", height: "h-44", width: "w-44", borderRadius: "rounded-full", zIndex: 15, type: 'topping', classes: "",
    content: (
      <div className="w-full h-full relative text-3xl drop-shadow-md">
        <span className="absolute top-0 left-1/2 -translate-x-1/2">🍓</span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2">🍓</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2">🍓</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">🍓</span>
        <span className="absolute top-6 left-6">🍓</span>
        <span className="absolute top-6 right-6">🍓</span>
        <span className="absolute bottom-6 left-6">🍓</span>
        <span className="absolute bottom-6 right-6">🍓</span>
      </div>
    )
  },
  { 
    id: "banana", name: "Bananas", price: 1, color: "bg-transparent", height: "h-32", width: "w-32", borderRadius: "rounded-full", zIndex: 16, type: 'topping', classes: "",
    content: (
      <div className="w-full h-full relative text-3xl drop-shadow-md">
        <span className="absolute top-0 left-1/2 -translate-x-1/2">🍌</span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2">🍌</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2">🍌</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">🍌</span>
      </div>
    )
  },
  { 
    id: "syrup", name: "Maple Syrup", price: 0.5, color: "bg-amber-600", height: "h-14", width: "w-14", borderRadius: "rounded-full", zIndex: 30, type: 'side', sidePosition: { bottom: "10px", right: "10px" }, classes: "border-4 border-gray-50 shadow-[0_5px_15px_rgba(0,0,0,0.15)] opacity-90"
  },
  { 
    id: "whipped", name: "Whipped Cream", price: 1, color: "bg-transparent", height: "h-24", width: "w-24", borderRadius: "rounded-full", zIndex: 20, type: 'topping', classes: "flex items-center justify-center text-7xl drop-shadow-xl",
    content: "☁️"
  },
  { 
    id: "icecream", name: "Vanilla Scoop", price: 2, color: "bg-transparent", height: "h-16", width: "w-16", borderRadius: "rounded-full", zIndex: 25, type: 'topping', classes: "flex items-center justify-center text-6xl drop-shadow-lg",
    content: "🍨"
  },
];

export default function WaffleDemo() {
  const [selectedAddons, setSelectedAddons] = useState<Ingredient[]>([]);
  const [animatingAddonId, setAnimatingAddonId] = useState<string | null>(null);
  const [isLifting, setIsLifting] = useState(false);

  const basePrice = 8;
  const totalPrice = basePrice + selectedAddons.reduce((sum, item) => sum + item.price, 0);

  // Find the zIndex of the ingredient currently being added
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
    <div className="min-h-screen bg-[#FDF8F5] flex flex-col font-sans text-gray-900 overflow-hidden max-w-md mx-auto border-x border-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between p-6 pt-12 z-50">
        <button className="p-3 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-md transition">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Waffle Bar</h1>
        <button className="p-3 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-md transition relative">
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white">
            1
          </span>
        </button>
      </div>

      {/* Visualizer Area (TOP-DOWN) */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-8">
        
        {/* Glow effect behind plate */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-pink-500/10 blur-[60px] rounded-full z-0"></div>
        
        {/* Top-Down Container */}
        <div className="relative w-64 h-64 flex items-center justify-center z-10">
          
          {/* Base Plate */}
          <div className="absolute inset-0 bg-gray-50 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-gray-200 z-[4]"></div>
          
          {/* Base Waffle (Top Down) */}
          <div className="absolute w-56 h-56 bg-[#E8B85C] rounded-full shadow-inner z-[5] overflow-hidden flex items-center justify-center border-4 border-[#D9A34A]">
            {/* Waffle Grid Pattern */}
            <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-2 p-2 rotate-[15deg] scale-125">
              {[...Array(25)].map((_, i) => (
                <div key={i} className="bg-[#D9A34A] rounded-md shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] opacity-90"></div>
              ))}
            </div>
            {/* Waffle Emoji Overlay to look more real */}
            <div className="absolute inset-0 flex items-center justify-center text-[12rem] opacity-30 pointer-events-none mix-blend-overlay">🧇</div>
          </div>

          {/* Dynamic Addons */}
          <AnimatePresence>
            {selectedAddons
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((addon) => {
                const shouldLift = addon.type === 'topping' && isLifting && addon.id !== animatingAddonId && addon.zIndex > incomingZIndex;
                
                return (
                  <motion.div
                    key={addon.id}
                    initial={{ opacity: 1, y: -800, scale: 1 }}
                    animate={{ opacity: 1, y: shouldLift ? -800 : 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 600, damping: 25, mass: 1 }}
                    className={`absolute ${addon.width} ${addon.height} ${addon.color} ${addon.borderRadius || "rounded-full"} ${addon.classes || ""}`}
                    style={addon.type === 'side' ? { zIndex: addon.zIndex, ...addon.sidePosition } : { zIndex: addon.zIndex }}
                  >
                     {/* Render the Emoji/Content if it exists */}
                     {addon.content}
                     
                     {/* Gloss reflection for liquids */}
                     {addon.type === 'side' && !addon.content && (
                        <div className="absolute top-1 left-2 w-3 h-3 bg-white/30 rounded-full"></div>
                     )}
                  </motion.div>
                );
            })}
          </AnimatePresence>

        </div>
      </div>

      {/* Interaction Panel */}
      <div className="bg-white rounded-t-[2.5rem] p-8 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.06)] z-20">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-black mb-1 text-gray-900 tracking-tight">Belgian Waffle</h2>
            <p className="text-gray-400 text-sm font-medium">Sweeten your day</p>
          </div>
          <div className="flex items-start">
            <span className="text-pink-500 font-bold text-xl mt-1">$</span>
            <motion.div 
              key={totalPrice}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl font-black text-gray-900"
            >
              {totalPrice.toFixed(2)}
            </motion.div>
          </div>
        </div>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Add Sweet Toppings</h3>
        
        <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {addons.map((addon) => {
            const isSelected = selectedAddons.find(a => a.id === addon.id);
            const previewColor = addon.id === 'strawberry' ? 'bg-red-500' : addon.id === 'banana' ? 'bg-yellow-300' : addon.color;
            
            return (
              <button
                key={addon.id}
                onClick={() => toggleAddon(addon)}
                className={`relative flex-shrink-0 w-28 h-36 rounded-[1.25rem] border-2 flex flex-col items-center justify-center p-3 snap-center transition-all duration-300 ${
                  isSelected ? 'border-pink-500 bg-pink-50 shadow-[0_8px_20px_rgba(236,72,153,0.15)] scale-[1.02]' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div className={`w-14 h-14 mb-4 rounded-full flex items-center justify-center shadow-inner ${previewColor} border border-black/5 overflow-hidden text-2xl`}>
                  {addon.content ? addon.content : <div className="w-10 h-10 rounded-full bg-white/20 blur-[2px]"></div>}
                </div>
                <span className="text-sm font-bold text-gray-800 text-center leading-tight">{addon.name}</span>
                <span className="text-xs font-bold text-pink-500 mt-1">+${addon.price.toFixed(2)}</span>
                
                {/* Selection indicator */}
                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  isSelected ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-400'
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
          <span>${totalPrice.toFixed(2)}</span>
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
