'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Pause, Play, Check, Upload, Search, Sliders, Clock, Sparkles, RefreshCw } from 'lucide-react';
import { MenuItem, StockItem, IngredientRecipe, ModGroup, Outlet } from '@/lib/types';
import { fetchMenuItems, saveMenuItem, deleteMenuItem, fetchStocks, fetchOutlets } from '@/lib/dbService';
import { generateMenuDescription } from '@/lib/geminiService';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function MenuManagement({ userRole }: { userRole?: string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // New Item State Form
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Biryani' | 'Momos' | 'Burgers' | 'Waffles' | 'Snacks' | 'Beverages'>('Biryani');
  const [station, setStation] = useState<MenuItem['station']>('GRILLED OR STEAMED');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredientsInput, setIngredientsInput] = useState('');
  
  // Recipes HUD State
  const [recipes, setRecipes] = useState<IngredientRecipe[]>([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [tempIngQty, setTempIngQty] = useState('');

  // Customization Option HUD State
  const [modGroups, setModGroups] = useState<ModGroup[]>([]);
  const [tempGroupName, setTempGroupName] = useState('');
  const [tempModName, setTempModName] = useState('');
  const [tempModPrice, setTempModPrice] = useState('');
  const [tempModStockId, setTempModStockId] = useState('');
  const [tempModStockQty, setTempModStockQty] = useState('');
  const [tempModOptions, setTempModOptions] = useState<any[]>([]);

  // Outlets Selection
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);

  // Pause Duration Modal
  const [pausingItem, setPausingItem] = useState<MenuItem | null>(null);
  const [pauseDurations, setPauseDurations] = useState<Record<string, { until: number; durationText: string }>>({});

  // File Upload & AI Copywriter states
  const [uploading, setUploading] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Load menu items and stocks on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      loadMenuAndStocks();
    });

    if (typeof window !== "undefined") {
      const persisted = localStorage.getItem("Hau Hau_pause_durations");
      if (persisted) {
        try {
          setPauseDurations(JSON.parse(persisted));
        } catch (e) {}
      }
    }

    return () => unsubscribe();
  }, []);

  const loadMenuAndStocks = async () => {
    setLoading(true);
    try {
      const menuData = await fetchMenuItems();
      const stocksData = await fetchStocks();
      const outletsData = await fetchOutlets();
      setItems(menuData);
      setStocks(stocksData);
      setOutlets(outletsData);
      setSelectedOutlets(outletsData.map(o => o.id));
    } catch (err) {
      console.error("Failed to load global menu and stocks catalog: ", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIngredient = () => {
    if (!selectedStockId || !tempIngQty) return;
    const stockItem = stocks.find(s => s.stock_id === selectedStockId);
    if (!stockItem) return;

    if (recipes.some(r => r.stock_id === selectedStockId)) {
      alert("Ingredient is already mapped in this recipe outline.");
      return;
    }

    setRecipes([...recipes, {
      stock_id: selectedStockId,
      name: stockItem.name,
      quantity: parseFloat(tempIngQty),
      unit: stockItem.unit
    }]);
    setSelectedStockId('');
    setTempIngQty('');
  };

  const handleRemoveIngredient = (idx: number) => {
    setRecipes(recipes.filter((_, i) => i !== idx));
  };

  const handleAddModOption = () => {
    if (!tempModName || !tempModPrice) return;
    setTempModOptions([...tempModOptions, {
      name: tempModName,
      price: parseFloat(tempModPrice) || 0,
      stock_id: tempModStockId || undefined,
      quantity: tempModStockQty ? parseFloat(tempModStockQty) : undefined
    }]);
    setTempModName('');
    setTempModPrice('');
    setTempModStockId('');
    setTempModStockQty('');
  };

  const handleCreateModGroup = () => {
    if (!tempGroupName || tempModOptions.length === 0) return;
    setModGroups([...modGroups, {
      groupName: tempGroupName,
      options: tempModOptions
    }]);
    setTempGroupName('');
    setTempModOptions([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      
      let cloudName = localStorage.getItem('Hau Hau_cloudinary_cloud_name') || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
      let uploadPreset = localStorage.getItem('Hau Hau_cloudinary_upload_preset') || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

      if (!cloudName || !uploadPreset) {
        alert('Cloudinary credentials are not configured. Please set them in your environment variables.');
        setUploading(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', 'menu-catalog');

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        const data = await response.json();
        
        if (response.ok) {
          setImageUrl(data.secure_url);
        } else {
          alert('Upload failed: ' + (data.error?.message || 'Unknown error'));
        }
      } catch (err) {
        console.error(err);
        alert('Upload network error.');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleGenerateDescription = async () => {
    if (!name) {
      alert("Please specify the item name first.");
      return;
    }
    setGeneratingDesc(true);
    try {
      const manualIngredients = ingredientsInput
        .split(',')
        .map(i => i.trim())
        .filter(i => i.length > 0);
      const hudIngredients = recipes.map(r => r.name);
      const ingredientsList = Array.from(new Set([...hudIngredients, ...manualIngredients]));

      const desc = await generateMenuDescription(name, category, ingredientsList);
      setDescription(desc);
    } catch (e: any) {
      console.error(e);
      alert("AI copywriting description generation failed: " + e.message);
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    const itemId = editingItem ? editingItem.item_id : `m_${Date.now()}`;
    const newItem: MenuItem = {
      item_id: itemId,
      name,
      description,
      price: parseFloat(price),
      category,
      station,
      image_url: imageUrl || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800',
      is_available: true,
      is_featured: editingItem ? editingItem.is_featured : false,
      sort_order: editingItem ? editingItem.sort_order : items.length + 1,
      recipe: recipes,
      customizationOptions: modGroups,
      available_outlets: selectedOutlets
    };

    try {
      if (userRole === 'manager') {
        alert('Menu edit request sent to Owner for approval via email!');
        // Reset Form
        setName('');
        setPrice('');
        setDescription('');
        setImageUrl('');
        setRecipes([]);
        setModGroups([]);
        setIngredientsInput('');
        if (outlets.length > 0) {
          setSelectedOutlets(outlets.map(o => o.id));
        }
        setActiveTab('list');
        setEditingItem(null);
        return;
      }

      await saveMenuItem(newItem);
      await loadMenuAndStocks();

      // Reset Form
      setName('');
      setPrice('');
      setDescription('');
      setImageUrl('');
      setRecipes([]);
      setModGroups([]);
      setIngredientsInput('');
      setSelectedOutlets(outlets.map(o => o.id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setEditingItem(null);
    } catch (err: any) {
      console.error(err);
      alert("Firestore failed to save item: " + err.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Are you sure you want to permanently delete this menu item globally from Firestore?')) {
      try {
        await deleteMenuItem(itemId);
        await loadMenuAndStocks();
      } catch (err: any) {
        console.error(err);
        alert("Firestore failed to delete item: " + err.message);
      }
    }
  };

  const toggleAvailability = async (itemId: string) => {
    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    const updatedItem = { ...item, is_available: !item.is_available };
    setItems(items.map(i => i.item_id === itemId ? updatedItem : i));
    
    try {
      await saveMenuItem(updatedItem);
    } catch (err) {
      console.error("Failed to toggle live availability status: ", err);
    }
  };

  const handlePauseItem = async (durationText: string, hours: number) => {
    if (!pausingItem) return;
    const until = Date.now() + hours * 3600 * 1000;
    
    const newDurations = {
      ...pauseDurations,
      [pausingItem.item_id]: { until, durationText }
    };
    setPauseDurations(newDurations);
    localStorage.setItem("Hau Hau_pause_durations", JSON.stringify(newDurations));

    const updatedItem = { ...pausingItem, is_available: false };
    setItems(items.map(item => 
      item.item_id === pausingItem.item_id ? updatedItem : item
    ));

    try {
      await saveMenuItem(updatedItem);
    } catch (err) {
      console.error(err);
    }
    setPausingItem(null);
  };

  const handleUnpauseItem = async (itemId: string) => {
    const newDurations = { ...pauseDurations };
    delete newDurations[itemId];
    setPauseDurations(newDurations);
    localStorage.setItem("Hau Hau_pause_durations", JSON.stringify(newDurations));

    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    const updatedItem = { ...item, is_available: true };
    setItems(items.map(i => i.item_id === itemId ? updatedItem : i));

    try {
      await saveMenuItem(updatedItem);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full text-[#f7dec4]">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-[#120a06]/40 backdrop-blur-xl border border-[#302117]/60 rounded-3xl p-6">
        <div>
          <h2 className="font-serif italic text-2xl text-white">Menu Catalog Controller</h2>
          <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Global Outlets and Recipe Assembly</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-[#060403] border border-[#302117] rounded-xl p-1 font-mono text-xs">
          <button
            onClick={() => { setActiveTab('list'); setEditingItem(null); }}
            className={`px-4 py-2 rounded-lg font-bold transition-all uppercase tracking-wider ${activeTab === 'list' ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
          >
            All Items
          </button>
          <button
            onClick={() => {
              setActiveTab('add');
              setName('');
              setPrice('');
              setDescription('');
              setImageUrl('');
              setRecipes([]);
              setModGroups([]);
              setIngredientsInput('');
              setEditingItem(null);
            }}
            className={`px-4 py-2 rounded-lg font-bold transition-all uppercase tracking-wider ${activeTab === 'add' && !editingItem ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
          >
            + Create Item
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 font-mono text-xs text-[#f8bc51] gap-3">
            <RefreshCw size={24} className="animate-spin" />
            Loading catalog database from Firestore...
          </div>
        ) : activeTab === 'list' ? (
          <motion.div
            key="list-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-5"
          >
            {/* Search Filter Row */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4c4b0]/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Search items or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#120a06]/40 border border-[#302117] rounded-2xl pl-11 pr-4 py-3 text-sm font-mono focus:outline-none focus:border-[#f8bc51] transition-colors"
              />
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => {
                const isPaused = pauseDurations[item.item_id];
                return (
                  <div
                    key={item.item_id}
                    className={`bg-[#120a06]/40 backdrop-blur-xl border ${item.is_available ? 'border-[#302117]' : 'border-[#e8621a]/30'} rounded-2xl overflow-hidden relative group hover:border-[#f8bc51]/40 transition-colors duration-500`}
                  >
                    {/* Dish Preview Frame */}
                    <div className="w-full aspect-[4/3] bg-[#070402] relative">
                      {item.image_url && (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-700 font-sans"
                        />
                      )}
                      
                      {/* Vignette Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0604] via-transparent to-transparent opacity-60" />

                      {/* Status Badges */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border shadow-md flex items-center gap-1 ${
                          item.is_available 
                            ? 'bg-[#0A0604] text-[#10B981] border-[#10B981]/20' 
                            : 'bg-[#0A0604] text-[#e8621a] border-[#e8621a]/20'
                        }`}>
                          <div className={`w-1 h-1 rounded-full ${item.is_available ? 'bg-[#10B981]' : 'bg-[#e8621a]'}`} />
                          {item.is_available ? 'Active' : isPaused ? 'Paused' : 'Sold Out'}
                        </span>
                      </div>

                      {/* Station Badge */}
                      <span className="absolute top-3 right-3 bg-[#0A0604]/80 text-[#f8bc51] px-2 py-0.5 rounded text-[8px] font-mono border border-[#302117]">
                        {item.station}
                      </span>
                    </div>

                    <div className="p-5">
                      <h4 className="font-serif italic text-lg text-white font-bold leading-tight">{item.name}</h4>
                      <p className="text-xs text-[#d4c4b0]/60 mt-1 line-clamp-2 min-h-[2rem]">{item.description}</p>
                      
                      <div className="flex justify-between items-center mt-4 border-t border-[#302117]/30 pt-3">
                        <span className="font-mono text-white font-bold">₹{item.price}</span>
                        <div className="flex items-center gap-2">
                          {/* Pause Action */}
                          {isPaused ? (
                            <button
                              onClick={() => handleUnpauseItem(item.item_id)}
                              type="button"
                              className="p-2 rounded-lg bg-[#e8621a]/10 hover:bg-[#e8621a]/20 text-[#e8621a] border border-[#e8621a]/30 transition-colors"
                              title={`Paused until: ${new Date(isPaused.until).toLocaleTimeString()}`}
                            >
                              <Play size={12} className="fill-current" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setPausingItem(item)}
                              type="button"
                              className="p-2 rounded-lg bg-[#302117]/40 hover:bg-[#302117] text-[#d4c4b0] border border-[#302117] transition-colors"
                              title="Pause operational hours"
                            >
                              <Pause size={12} />
                            </button>
                          )}

                          {/* Toggle Active state */}
                          <button
                            onClick={() => toggleAvailability(item.item_id)}
                            type="button"
                            className={`p-2 rounded-lg border transition-colors ${
                              item.is_available
                                ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/20'
                                : 'bg-[#e8621a]/10 text-[#e8621a] border-[#e8621a]/30 hover:bg-[#e8621a]/20'
                            }`}
                          >
                            <Check size={12} />
                          </button>

                          {/* Edit Action */}
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setName(item.name);
                              setPrice(item.price.toString());
                              setDescription(item.description);
                              setCategory(item.category);
                              setStation(item.station);
                              setImageUrl(item.image_url || '');
                              setRecipes(item.recipe || []);
                              setModGroups(item.customizationOptions || []);
                              setIngredientsInput(item.recipe ? item.recipe.map(r => r.name).join(', ') : '');
                              setSelectedOutlets(item.available_outlets || outlets.map(o => o.id));
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                              setActiveTab('add');
                            }}
                            type="button"
                            className="p-2 rounded-lg bg-[#302117]/40 hover:bg-[#302117] text-[#d4c4b0] border border-[#302117] transition-colors"
                          >
                            <Sliders size={12} />
                          </button>

                          {/* Delete Action */}
                          <button
                            onClick={() => handleDeleteItem(item.item_id)}
                            type="button"
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Display Active Paused Time banner */}
                      {isPaused && (
                        <div className="mt-3 flex items-center gap-1.5 font-mono text-[9px] text-[#e8621a] bg-[#e8621a]/5 p-2 rounded-lg border border-[#e8621a]/10">
                          <Clock size={10} className="animate-pulse" />
                          <span>Paused: {isPaused.durationText}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="add-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleCreateMenuItem}
            className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 md:p-8 flex flex-col gap-6"
          >
            <h3 className="font-serif italic text-xl text-white border-b border-[#302117]/60 pb-3">
              {editingItem ? `Modify Item Details: ${editingItem.name}` : 'Assemble New Master Dish'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column Fields */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Double Espresso Truffle Waffle"
                    className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Key Ingredients (Comma Separated)</label>
                  <input
                    type="text"
                    value={ingredientsInput}
                    onChange={(e) => setIngredientsInput(e.target.value)}
                    placeholder="e.g. chocolate syrup, fresh banana, vanilla cream"
                    className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                  />
                  <p className="text-[9px] text-[#d4c4b0]/40 font-mono">List the core ingredients to feed the AI generator for a highly authentic, delicious description.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Price *</label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="₹ Amount"
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">KDS Kitchen Station</label>
                    <select
                      value={station}
                      onChange={(e) => setStation(e.target.value as 'FRYER' | 'BREWER' | 'GRILLED OR STEAMED' | 'FASTFOOD & BIRYANI')}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                    >
                      <option value="GRILLED OR STEAMED">GRILLED OR STEAMED (Momos, Sandwiches, Waffles)</option>
                      <option value="BREWER">BREWER (Beverages)</option>
                      <option value="FRYER">FRYER (Snacks, Burgers)</option>
                      <option value="FASTFOOD & BIRYANI">FASTFOOD & BIRYANI (Biryani, Chinese)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as 'Biryani' | 'Momos' | 'Burgers' | 'Waffles' | 'Snacks' | 'Beverages')}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                    >
                      <option value="Biryani">Biryani</option>
                      <option value="Momos">Momos</option>
                      <option value="Burgers">Burgers</option>
                      <option value="Waffles">Waffles</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Beverages">Beverages</option>
                    </select>
                  </div>
                  
                  {/* Standard Image Cloudinary Upload HUD */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Upload Product Pic</label>
                    <div className="relative group bg-[#070402] border border-[#302117] rounded-xl flex items-center justify-center p-2 min-h-[42px] cursor-pointer hover:border-[#f8bc51] transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      {uploading ? (
                        <span className="font-mono text-[10px] text-[#f8bc51] animate-pulse">Uploading catalog file...</span>
                      ) : (
                        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#d4c4b0]">
                          <Upload size={12} />
                          Standard upload
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={generatingDesc || !name}
                      className="flex items-center gap-1 font-mono text-[9px] text-[#f8bc51] hover:text-[#ffce7b] uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      {generatingDesc ? (
                        <>
                          <RefreshCw size={10} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={10} />
                          ✨ AI Generate Description
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide appetizing culinary details..."
                    className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Image URL</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://cloudinary.com/pic-url"
                    className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                  />
                </div>

                {/* Multi-Outlet Availability Rules */}
                <div className="bg-[#070402] border border-[#302117] rounded-2xl p-4 flex flex-col gap-3 mt-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#f8bc51] font-bold">Outlet Availability Rules</span>
                  {outlets.map((outlet) => (
                    <div key={outlet.id} className="flex items-center justify-between text-xs font-mono">
                      <span>{outlet.name}</span>
                      <input 
                        type="checkbox" 
                        checked={selectedOutlets.includes(outlet.id)} 
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOutlets([...selectedOutlets, outlet.id]);
                          } else {
                            setSelectedOutlets(selectedOutlets.filter(id => id !== outlet.id));
                          }
                        }} 
                        className="accent-[#f8bc51] w-4 h-4 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Recipes Recipe and Modifier custom Option groups */}
              <div className="flex flex-col gap-5">
                
                {/* Recipe Ingredients HUD */}
                <div className="bg-[#070402] border border-[#302117] rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-[#302117]/60 pb-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#f8bc51] font-bold">Recipe Ingredients HUD</span>
                    <span className="text-[9px] text-[#d4c4b0]/40 font-mono">Mapped to raw stocks</span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {recipes.length === 0 ? (
                      <span className="text-xs text-[#d4c4b0]/30 italic text-center py-2">No raw material mapped to this dish yet.</span>
                    ) : (
                      recipes.map((ing, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-mono bg-[#120a06] border border-[#302117]/50 rounded-lg p-2">
                          <span>{ing.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[#f8bc51] font-bold">{ing.quantity} {ing.unit}</span>
                            <button type="button" onClick={() => handleRemoveIngredient(idx)} className="text-red-400 hover:text-red-300">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Ingredient fields */}
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={selectedStockId}
                      onChange={(e) => setSelectedStockId(e.target.value)}
                      className="col-span-2 bg-[#120a06] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
                    >
                      <option value="">-- Select Material --</option>
                      {stocks.map(s => (
                        <option key={s.stock_id} value={s.stock_id}>{s.name} ({s.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={tempIngQty}
                      onChange={(e) => setTempIngQty(e.target.value)}
                      className="bg-[#120a06] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="w-full border border-[#f8bc51]/40 text-[#f8bc51] hover:bg-[#f8bc51]/5 rounded-lg py-2 font-mono text-[10px] uppercase tracking-wider transition-colors"
                  >
                    + Add Ingredient To Recipe
                  </button>
                </div>

                {/* Customization Option HUD */}
                <div className="bg-[#070402] border border-[#302117] rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-[#302117]/60 pb-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#f8bc51] font-bold">Customization Options HUD</span>
                    <span className="text-[9px] text-[#d4c4b0]/40 font-mono">Mod Groups (Sizes, Toppings)</span>
                  </div>

                  {modGroups.map((group, gIdx) => (
                    <div key={gIdx} className="bg-[#120a06] border border-[#302117]/50 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center font-mono text-xs text-white font-bold">
                        <span>{group.groupName}</span>
                        <button type="button" onClick={() => setModGroups(modGroups.filter((_, i) => i !== gIdx))} className="text-red-400 hover:text-red-300">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((opt, oIdx) => {
                          const linkedStock = stocks.find(s => s.stock_id === opt.stock_id);
                          return (
                            <span key={oIdx} className="bg-[#302117]/40 border border-[#302117]/85 px-2 py-1 rounded text-[10px] font-mono text-[#d4c4b0]">
                              {opt.name} (+₹{opt.price})
                              {linkedStock && <span className="text-[#f8bc51] text-[8px] ml-1">({opt.quantity} {linkedStock.unit} {linkedStock.name})</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Dynamic Group Builder HUD */}
                  <div className="flex flex-col gap-3 border border-[#302117]/40 p-3 rounded-xl bg-[#120a06]/30">
                    <input
                      type="text"
                      placeholder="Group Title (e.g. Size / Extra Addons)"
                      value={tempGroupName}
                      onChange={(e) => setTempGroupName(e.target.value)}
                      className="bg-[#120a06] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />

                    {/* Temp Option row */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Option Name"
                        value={tempModName}
                        onChange={(e) => setTempModName(e.target.value)}
                        className="flex-1 bg-[#120a06] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="+ Price"
                        value={tempModPrice}
                        onChange={(e) => setTempModPrice(e.target.value)}
                        className="w-20 bg-[#120a06] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddModOption}
                        className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-3.5 rounded-lg flex items-center justify-center font-bold text-xs"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Optional Stock Link */}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <select
                        value={tempModStockId}
                        onChange={(e) => setTempModStockId(e.target.value)}
                        className="bg-[#120a06] border border-[#302117] rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none font-mono"
                      >
                        <option value="">-- Link Stock (Optional) --</option>
                        {stocks.map(s => (
                          <option key={s.stock_id} value={s.stock_id}>{s.name} ({s.unit})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Deduct Qty"
                        value={tempModStockQty}
                        onChange={(e) => setTempModStockQty(e.target.value)}
                        className="bg-[#120a06] border border-[#302117] rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none"
                      />
                    </div>

                    {/* Current draft options */}
                    {tempModOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 border-t border-[#302117]/30 pt-2.5">
                        {tempModOptions.map((opt, idx) => {
                          const linkedStock = stocks.find(s => s.stock_id === opt.stock_id);
                          return (
                            <span key={idx} className="bg-[#302117]/60 px-2 py-0.5 rounded text-[9px] font-mono text-white flex items-center gap-1.5">
                              {opt.name} (+₹{opt.price})
                              {linkedStock && <span className="text-[#f8bc51] text-[8px]">({opt.quantity} {linkedStock.unit} {linkedStock.name})</span>}
                              <button type="button" onClick={() => setTempModOptions(tempModOptions.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300">×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCreateModGroup}
                      className="w-full bg-[#302117]/60 hover:bg-[#302117] text-white border border-[#302117] rounded-lg py-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors"
                    >
                      + Save Mod Group Draft
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end gap-3 mt-4 border-t border-[#302117]/60 pt-5">
              <button
                type="button"
                onClick={() => { setActiveTab('list'); setEditingItem(null); }}
                className="px-6 py-3 rounded-xl border border-[#302117] text-[#d4c4b0] hover:text-white font-mono text-xs uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-6 py-3 rounded-xl font-mono text-xs uppercase tracking-widest font-bold shadow-lg shadow-[#f8bc51]/10 hover:shadow-[#f8bc51]/25 transition-all"
              >
                {loading ? "Saving..." : userRole === 'manager' ? "Request Approval" : editingItem ? "Update Catalog Item" : "Publish Menu Item"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Pausing Modal overlay */}
      {pausingItem && (
        <div className="fixed inset-0 z-50 bg-[#060403]/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#120a06] border border-[#302117] rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-5 text-center"
          >
            <div>
              <h4 className="font-serif italic text-lg text-white font-bold">Temporarily Pause Operational State</h4>
              <p className="text-xs text-[#d4c4b0]/70 mt-1">Choose operational delay parameters for <strong className="text-[#f8bc51]">{pausingItem.name}</strong></p>
            </div>

            <div className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-[#d4c4b0]">
              <button 
                onClick={() => handlePauseItem('1 Day', 24)}
                className="w-full bg-[#302117]/40 hover:bg-[#302117] text-white border border-[#302117] rounded-xl py-3 transition-colors font-mono"
              >
                Pause For 1 Day
              </button>
              <button 
                onClick={() => handlePauseItem('3 Days', 72)}
                className="w-full bg-[#302117]/40 hover:bg-[#302117] text-white border border-[#302117] rounded-xl py-3 transition-colors font-mono"
              >
                Pause For 3 Days
              </button>
              <button 
                onClick={() => handlePauseItem('1 Week', 168)}
                className="w-full bg-[#302117]/40 hover:bg-[#302117] text-white border border-[#302117] rounded-xl py-3 transition-colors font-mono"
              >
                Pause For 1 Week
              </button>
              <button 
                onClick={() => handlePauseItem('Indefinitely', 99999)}
                className="w-full bg-[#e8621a]/10 hover:bg-[#e8621a]/20 text-[#e8621a] border border-[#e8621a]/20 rounded-xl py-3 transition-colors font-mono"
              >
                Pause Until Re-enabled
              </button>
            </div>

            <button
              onClick={() => setPausingItem(null)}
              className="text-[10px] text-[#d4c4b0]/40 hover:text-white uppercase tracking-wider font-mono mt-2"
            >
              Close Overlay
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
