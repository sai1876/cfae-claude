import { useState, useEffect } from 'react';
import { Plus, Sparkles, Send, AlertTriangle, CheckCircle, RefreshCw, Layers, Trash2, Settings, Play, Check, X, ClipboardList, Info, HelpCircle } from 'lucide-react';
import { sendAlertEmailAction } from '@/app/_actions/emailActions';
import { StockItem, Outlet, ConversionRecipe, DoughBatch, MenuItem, Staff } from '@/lib/types';
import { fetchStocks, fetchOutlets, calculateHistoricalUsage, getOutletCoordinates, fetchConversionRecipes, streamActiveBatches, streamBatchLogs, fetchMenuItems, fetchStaffList } from '@/lib/dbService';
import { getInventoryForecastAction } from '@/app/_actions/groqActions';
import { secureSaveStockItem, secureSaveBulkStockItems, secureDeleteStockItem, secureSaveConversionRecipe, secureStartDoughBatch, secureCompleteDoughBatch } from '@/app/_actions/secureDbActions';
import TOTPModal from './TOTPModal';
import { fetchLocalizedWeather, analyzeSmartRefill } from '@/lib/geminiService';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, query, collection, where, onSnapshot } from 'firebase/firestore';

export default function InventoryManagement({ userRole }: { userRole?: string }) {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [managerOutletId, setManagerOutletId] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [threshold, setThreshold] = useState('');
  const [editStockId, setEditStockId] = useState<string | null>(null);

  // Feature 2: Pack conversion states
  const [trackingType, setTrackingType] = useState<'bulk' | 'pack'>('bulk');
  const [piecesPerPack, setPiecesPerPack] = useState('');

  // Feature 4: Multi-outlet checkboxes
  const [formOutlets, setFormOutlets] = useState<string[]>([]);

  // Feature 5: Dough batching states
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [conversionRecipes, setConversionRecipes] = useState<ConversionRecipe[]>([]);
  const [activeBatches, setActiveBatches] = useState<DoughBatch[]>([]);
  const [batchLogs, setBatchLogs] = useState<DoughBatch[]>([]);
  const [showRecipeStockId, setShowRecipeStockId] = useState<string | null>(null);
  const [recipeMenuId, setRecipeMenuId] = useState('');
  const [recipeMin, setRecipeMin] = useState('');
  const [recipeMax, setRecipeMax] = useState('');
  const [doughQtyUsed, setDoughQtyUsed] = useState<Record<string, string>>({});
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filterDiscrepancyOnly, setFilterDiscrepancyOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'stocks' | 'batches' | 'logs'>('stocks');
  const [startingBatchId, setStartingBatchId] = useState<string | null>(null);
  const [completingBatchId, setCompletingBatchId] = useState<string | null>(null);

  // Email statuses
  const [emailStatus, setEmailStatus] = useState<Record<string, 'idle' | 'sending' | 'success' | 'failed'>>({});
  const [alertLog, setAlertLog] = useState<string[]>([]);

  // AI Forecast States
  const [forecastStatus, setForecastStatus] = useState<Record<string, 'idle' | 'loading'>>({});
  const [forecastResult, setForecastResult] = useState<Record<string, string>>({});

  // TOTP Security State
  type PendingAction = 
    | { type: 'add_stock'; item: StockItem }
    | { type: 'bulk_add_stock'; items: StockItem[] }
    | { type: 'delete_stock'; stockId: string }
    | { type: 'update_qty'; stockId: string; amount: number }
    | { type: 'save_conversion_recipe'; recipe: ConversionRecipe }
    | null;
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [selectedOutletIdForBatches, setSelectedOutletIdForBatches] = useState('');

  // Load stocks and listen to Auth on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const staffSnap = await getDoc(doc(db, 'staff', user.uid));
          if (staffSnap.exists()) {
            const staffData = staffSnap.data();
            const outletName = staffData.outlet;
            if (outletName) {
              const outletData = await fetchOutlets();
              const matchedOutlet = outletData.find(o => o.name === outletName);
              if (matchedOutlet) {
                setManagerOutletId(matchedOutlet.id);
                setSelectedOutletIdForBatches(matchedOutlet.id);
              }
            }
          }
        } catch (e) {
          console.error("Failed to load staff assigned outlet:", e);
        }
      }
      loadStocksList();
    });
    return () => unsubscribe();
  }, []);

  // Live listener for active batches and logs based on selected outlet
  useEffect(() => {
    if (!selectedOutletIdForBatches) return;
    
    const unsubscribeActive = streamActiveBatches(selectedOutletIdForBatches, (batches) => {
      setActiveBatches(batches);
    });

    const unsubscribeLogs = streamBatchLogs(selectedOutletIdForBatches, (logs) => {
      setBatchLogs(logs);
    });

    return () => {
      unsubscribeActive();
      unsubscribeLogs();
    };
  }, [selectedOutletIdForBatches]);

  // Load staff list on mount
  useEffect(() => {
    fetchStaffList().then(list => setStaffList(list)).catch(err => console.error("Failed to load staff list:", err));
  }, []);

  // Live listener for recent orders (to calculate live sales count for active batches)
  useEffect(() => {
    if (activeBatches.length === 0) {
      setRecentOrders([]);
      return;
    }
    
    const earliestStart = Math.min(...activeBatches.map(b => b.batch_start_time));
    
    const q = query(
      collection(db, "orders"),
      where("created_at", ">=", earliestStart)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const orders: any[] = [];
      snap.forEach(d => orders.push(d.data()));
      setRecentOrders(orders);
    }, (err) => {
      console.error("Failed to stream recent orders for live batch sales count:", err);
    });
    
    return () => unsubscribe();
  }, [activeBatches]);

  const countWafflesSold = (batch: DoughBatch, linkedMenuItemId: string) => {
    const outlet = outlets.find(o => o.id === batch.outlet_id);
    if (!outlet) return 0;
    const outletName = outlet.name;
    
    let count = 0;
    recentOrders.forEach(order => {
      if (!['accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'].includes(order.status)) return;
      
      const orderOutlet = order.outlet || order.hatch;
      if (orderOutlet !== outletName) return;
      if (order.created_at < batch.batch_start_time) return;

      order.items?.forEach((item: any) => {
        if (item.menu_item_id === linkedMenuItemId) {
          count += item.quantity || 0;
        }
      });
    });
    return count;
  };

  const loadStocksList = async () => {
    setLoading(true);
    setError(null);
    try {
      const stockData = await fetchStocks();
      const outletData = await fetchOutlets();
      const recipesData = await fetchConversionRecipes();
      const itemsData = await fetchMenuItems();
      
      setStocks(stockData);
      setOutlets(outletData);
      setConversionRecipes(recipesData);
      setMenuItems(itemsData);

      // If owner, default batches view to first outlet
      if (userRole === 'owner' && outletData.length > 0 && !selectedOutletIdForBatches) {
        setSelectedOutletIdForBatches(outletData[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load stock raw materials registry:", err);
      setError(err.message || 'Firestore telemetry connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePendingSecureAction = async (action: PendingAction) => {
    const lastVerified = localStorage.getItem('inventory_otp_verified_at');
    if (lastVerified && Date.now() - parseInt(lastVerified, 10) < 20 * 60 * 1000) {
      try {
        await executeSecureAction('SESSION_BYPASS', action);
        return;
      } catch (err) {
        localStorage.removeItem('inventory_otp_verified_at');
      }
    }
    setPendingAction(action);
  };

  const handleAddOrEditStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !qty || !threshold) return;
    setError(null);

    const isEdit = !!editStockId;
    const existingStock = isEdit ? stocks.find(s => s.stock_id === editStockId) : null;
    
    // Parse quantity according to tracking type
    const parsedPiecesPerPack = trackingType === 'pack' && piecesPerPack ? parseFloat(piecesPerPack) : undefined;
    const finalQuantity = parsedPiecesPerPack ? parseFloat(qty) * parsedPiecesPerPack : parseFloat(qty);
    const finalThreshold = parsedPiecesPerPack ? parseFloat(threshold) * parsedPiecesPerPack : parseFloat(threshold);

    if (isEdit) {
      const updatedStock: StockItem = {
        ...existingStock!,
        name,
        current_quantity: finalQuantity,
        unit,
        low_threshold: finalThreshold,
        tracking_type: trackingType,
        pieces_per_pack: parsedPiecesPerPack,
        last_updated: Date.now(),
      };

      if (userRole === 'manager') {
        alert('Stock update request sent to Owner for approval via email!');
        resetForm();
        return;
      }

      const action: PendingAction = { type: 'add_stock', item: updatedStock };
      await handlePendingSecureAction(action);
    } else {
      if (userRole === 'manager') {
        alert('Stock creation request sent to Owner for approval via email!');
        resetForm();
        return;
      }

      const baseId = `st_${Date.now()}`;
      if (formOutlets.length <= 1) {
        const singleOutletId = formOutlets.length === 1 ? formOutlets[0] : '';
        const newStock: StockItem = {
          stock_id: singleOutletId ? `${baseId}_${singleOutletId}` : baseId,
          menu_item_id: 'custom',
          outlet_id: singleOutletId,
          name,
          current_quantity: finalQuantity,
          unit,
          low_threshold: finalThreshold,
          tracking_type: trackingType,
          pieces_per_pack: parsedPiecesPerPack,
          last_updated: Date.now(),
        };

        const action: PendingAction = { type: 'add_stock', item: newStock };
        await handlePendingSecureAction(action);
      } else {
        const stockItems: StockItem[] = formOutlets.map(oId => ({
          stock_id: `${baseId}_${oId}`,
          menu_item_id: 'custom',
          outlet_id: oId,
          name,
          current_quantity: finalQuantity,
          unit,
          low_threshold: finalThreshold,
          tracking_type: trackingType,
          pieces_per_pack: parsedPiecesPerPack,
          last_updated: Date.now(),
        }));

        const action: PendingAction = { type: 'bulk_add_stock', items: stockItems };
        await handlePendingSecureAction(action);
      }
    }
  };
    
  const handleAIForecast = async (item: StockItem) => {
    setForecastStatus(prev => ({ ...prev, [item.stock_id]: 'loading' }));
    try {
        const usage = await calculateHistoricalUsage(item.stock_id, item.outlet_id || '', 7);
        let weatherContext = '';
        if (item.outlet_id) {
            const coords = await getOutletCoordinates(item.outlet_id);
            if (coords) weatherContext = await fetchLocalizedWeather(coords.latitude, coords.longitude);
        }
        const prediction = await getInventoryForecastAction(item.name, item.current_quantity, item.unit, usage, weatherContext);
        setForecastResult(prev => ({ ...prev, [item.stock_id]: prediction }));
    } catch (err) {
        setForecastResult(prev => ({ ...prev, [item.stock_id]: "Failed to get forecast." }));
    } finally {
        setForecastStatus(prev => ({ ...prev, [item.stock_id]: 'idle' }));
    }
  };

  const resetForm = () => {
    setName('');
    setQty('');
    setThreshold('');
    setUnit('kg');
    setEditStockId(null);
    setTrackingType('bulk');
    setPiecesPerPack('');
    setFormOutlets([]);
  };

  const handleEditClick = (item: StockItem) => {
    setEditStockId(item.stock_id);
    setName(item.name);
    
    const displayQty = item.tracking_type === 'pack' && item.pieces_per_pack
      ? (item.current_quantity / item.pieces_per_pack).toString()
      : item.current_quantity.toString();
      
    const displayThreshold = item.tracking_type === 'pack' && item.pieces_per_pack
      ? (item.low_threshold / item.pieces_per_pack).toString()
      : item.low_threshold.toString();

    setQty(displayQty);
    setUnit(item.unit);
    setThreshold(displayThreshold);
    setTrackingType(item.tracking_type || 'bulk');
    setPiecesPerPack(item.pieces_per_pack ? item.pieces_per_pack.toString() : '');
    setFormOutlets(item.outlet_id ? [item.outlet_id] : []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (stockId: string) => {
    if (userRole === 'manager') {
      alert('Delete request sent to Owner for approval via email!');
      return;
    }
    const action: PendingAction = { type: 'delete_stock', stockId };
    await handlePendingSecureAction(action);
  };

  const handleUpdateQty = async (stockId: string, amount: number) => {
    if (userRole === 'manager') {
      alert('Stock adjustment request sent to Owner for approval via email!');
      return;
    }
    const action: PendingAction = { type: 'update_qty', stockId, amount };
    await handlePendingSecureAction(action);
  };

  const executeSecureAction = async (totpCode: string, overrideAction?: PendingAction) => {
    const actionToExec = overrideAction || pendingAction;
    if (!actionToExec) return;
    setError(null);

    try {
      if (actionToExec.type === 'add_stock') {
        const newStock = actionToExec.item;
        await secureSaveStockItem(newStock, totpCode);
        
        await loadStocksList();
        resetForm();
      } 
      else if (actionToExec.type === 'bulk_add_stock') {
        const { items } = actionToExec;
        await secureSaveBulkStockItems(items, totpCode);
        
        await loadStocksList();
        resetForm();
      }
      else if (actionToExec.type === 'delete_stock') {
        const { stockId } = actionToExec;
        await secureDeleteStockItem(stockId, totpCode);
        
        await loadStocksList();
      }
      else if (actionToExec.type === 'save_conversion_recipe') {
        const { recipe } = actionToExec;
        await secureSaveConversionRecipe(recipe, totpCode);
        
        const recipesData = await fetchConversionRecipes();
        setConversionRecipes(recipesData);
        setShowRecipeStockId(null);
        setRecipeMenuId('');
        setRecipeMin('');
        setRecipeMax('');
      }
      else if (actionToExec.type === 'update_qty') {
        const { stockId, amount } = actionToExec;
        const currentItem = stocks.find(item => item.stock_id === stockId);
        if (!currentItem) return;

        const newQty = Math.max(0, currentItem.current_quantity + amount);
        const updatedItem = {
          ...currentItem,
          current_quantity: newQty,
          last_updated: Date.now()
        };

        await secureSaveStockItem(updatedItem, totpCode);

        // Update local state optimistic
        setStocks(stocks.map(item => item.stock_id === stockId ? updatedItem : item));

        // Trigger auto email alert if quantity crosses below threshold
        if (updatedItem.current_quantity < updatedItem.low_threshold && currentItem.current_quantity >= updatedItem.low_threshold) {
          triggerEmailAlert(updatedItem, updatedItem.current_quantity);
        }
      }
      // Save OTP session locally on success (if not a bypass)
      if (totpCode !== 'SESSION_BYPASS') {
        localStorage.setItem('inventory_otp_verified_at', Date.now().toString());
      }
    } catch (err: any) {
      console.error("Secure action failed:", err);
      throw err; // Let TOTPModal catch and display it
    } finally {
      if (!overrideAction) setPendingAction(null);
    }
  };

  const handleStartDoughBatch = async (stockId: string, rawQtyUsed: number, outletId: string) => {
    if (!rawQtyUsed || rawQtyUsed <= 0) {
      alert("Please enter a valid dough quantity used.");
      return;
    }
    setStartingBatchId(stockId);
    setError(null);
    try {
      await secureStartDoughBatch(stockId, rawQtyUsed, outletId);
      setDoughQtyUsed(prev => ({ ...prev, [stockId]: '' }));
      alert("Dough batch started successfully! Raw ingredient has been deducted from your stock.");
      loadStocksList();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to start dough batch.");
    } finally {
      setStartingBatchId(null);
    }
  };

  const handleCompleteDoughBatch = async (batchId: string) => {
    setCompletingBatchId(batchId);
    setError(null);
    try {
      const res = await secureCompleteDoughBatch(batchId);
      if (res.flagged) {
        alert(`Batch completed with discrepancies! Sales counted: ${res.wafflesSold} waffles. Owner has been alerted via email.`);
      } else {
        alert(`Batch completed successfully! Sales counted: ${res.wafflesSold} waffles (Within normal yield range).`);
      }
      loadStocksList();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to complete dough batch.");
    } finally {
      setCompletingBatchId(null);
    }
  };

  const handleSaveRecipeSubmit = async (stockId: string) => {
    if (!recipeMenuId || !recipeMin || !recipeMax) {
      alert("Please select a menu item and fill in both min and max yield ranges.");
      return;
    }

    const recipe: ConversionRecipe = {
      stock_id: stockId,
      linked_menu_item_id: recipeMenuId,
      yield_min_per_unit: parseFloat(recipeMin),
      yield_max_per_unit: parseFloat(recipeMax),
      last_updated: Date.now()
    };

    const action: PendingAction = { type: 'save_conversion_recipe', recipe };
    await handlePendingSecureAction(action);
  };

  const triggerEmailAlert = async (item: StockItem, quantityOverride?: number) => {
    const currentQty = quantityOverride !== undefined ? quantityOverride : item.current_quantity;
    setEmailStatus({ ...emailStatus, [item.stock_id]: 'sending' });
    
    const timestampStr = new Date().toLocaleTimeString();
    setAlertLog(prev => [`[${timestampStr}] Launching telemetry email for ${item.name}...`, ...prev]);

    let weatherContext = '';
    let aiRefillData = null;
    let outletName = 'Global Supply';

    if (item.outlet_id) {
      const matchedOutlet = outlets.find(o => o.id === item.outlet_id);
      if (matchedOutlet) {
        outletName = matchedOutlet.name;
      }
      try {
        setAlertLog(prev => [`[${timestampStr}] Fetching localized weather and historical data...`, ...prev]);
        const coords = await getOutletCoordinates(item.outlet_id);
        if (coords) {
          weatherContext = await fetchLocalizedWeather(coords.latitude, coords.longitude);
        }
        
        const usage = await calculateHistoricalUsage(item.stock_id, item.outlet_id, 7);
        setAlertLog(prev => [`[${timestampStr}] Invoking Gemini Flash AI for stock projection...`, ...prev]);
        aiRefillData = await analyzeSmartRefill(item.name, usage, weatherContext);
      } catch (err) {
        console.warn("AI context generation failed:", err);
      }
    }

    try {
      await sendAlertEmailAction({
        ingredient: item.name,
        current: currentQty,
        threshold: item.low_threshold,
        unit: item.unit,
        outletName: outletName,
        weatherContext: weatherContext,
        aiSuggestedRefill: aiRefillData?.suggested_refill_amount,
        aiReasoning: aiRefillData?.reasoning
      });

      setEmailStatus({ ...emailStatus, [item.stock_id]: 'success' });
      setAlertLog(prev => [`[${timestampStr}] ✅ Telemetry email delivered via Server Action!`, ...prev]);
      setTimeout(() => {
        setEmailStatus(prev => ({ ...prev, [item.stock_id]: 'idle' }));
      }, 4000);
      
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'SMTP offline';
      setEmailStatus({ ...emailStatus, [item.stock_id]: 'failed' });
      setAlertLog(prev => [`[${timestampStr}] ❌ Handoff failed: ${errorMessage}`, ...prev]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[#f7dec4]">
      {/* Left Columns - Stocks List */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-[#302117]/60 pb-3">
            <div>
              <h2 className="font-serif italic text-2xl text-white">Stock Raw Materials Registry</h2>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Real-Time Deductions Telemetry</p>
            </div>
            
            {/* Tab Swapping Switcher */}
            <div className="flex bg-[#060403] border border-[#302117] rounded-xl p-1 font-mono text-[10px] uppercase tracking-wider self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('stocks')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'stocks' ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
              >
                Registry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('batches')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${activeTab === 'batches' ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
              >
                Batches
                {activeBatches.length > 0 && (
                  <span className="bg-[#e8621a] text-white font-mono text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold px-1 animate-pulse">
                    {activeBatches.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'logs' ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
              >
                Audit Trail
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-5 flex flex-col gap-3 font-sans relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-white">Firestore Rules Sync Blocked</h4>
                    <p className="text-xs text-[#d4c4b0]/85 mt-1 leading-relaxed">
                      The raw materials database rejected the telemetry request: <code className="bg-black/30 px-1 py-0.5 rounded text-red-300 font-mono">{error}</code>
                    </p>
                  </div>
                </div>
                
                {!currentUser && (
                  <div className="border-t border-[#302117]/30 pt-3 flex flex-col gap-2 font-mono text-[10px] uppercase tracking-wider text-[#f8bc51] bg-[#070402]/30 p-3.5 rounded-xl border border-dashed border-[#302117]">
                    <span className="font-bold">🔒 Secure Session Status: Unauthenticated</span>
                    <p className="text-[9px] text-[#d4c4b0]/60 lowercase normal-case leading-relaxed font-sans mt-0.5">
                      Firestore security rules require a verified owner session. Since your current session is using local fallback parameters, your Firebase session is offline.
                    </p>
                    <div className="flex flex-wrap gap-2.5 mt-1">
                      <button 
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('Hau Hau_owner_session');
                          window.location.reload();
                        }}
                        className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider"
                      >
                        Return to Secure Login
                      </button>
                      <span className="text-[#d4c4b0]/30 py-1.5 font-sans lowercase">or</span>
                      <span className="text-[#d4c4b0]/60 py-1.5 normal-case font-sans text-[9px]">
                        Ensure you seeded admin credentials (click "Initialize DB" on lockscreen).
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'stocks' && (
              <div className="flex flex-col gap-3.5 animate-in fade-in duration-300">
                {stocks.length === 0 && !loading && !error && (
                  <div className="border border-dashed border-[#302117] bg-[#070402]/20 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                    <span className="text-3xl">🌾</span>
                    <div>
                      <p className="text-white text-sm font-semibold">No stock telemetry items found</p>
                      <p className="text-xs text-[#d4c4b0]/50 mt-1 max-w-xs mx-auto leading-relaxed">
                        The stock registry collection is empty. Register raw materials using the registry tool on the right to start live deductions!
                      </p>
                    </div>
                  </div>
                )}

                {stocks.map((item) => {
                  const isLow = item.current_quantity < item.low_threshold;
                  const status = emailStatus[item.stock_id] || 'idle';
                  const fStatus = forecastStatus[item.stock_id] || 'idle';
                  const fResult = forecastResult[item.stock_id];

                  return (
                    <div key={item.stock_id} className="flex flex-col gap-2">
                    <div
                      className={`bg-[#070402]/30 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${isLow ? 'border-[#e8621a]/30 bg-[#e8621a]/5 shadow-[0_0_15px_rgba(232,98,26,0.05)]' : 'border-[#302117]'}`}
                    >
                      {/* Ingredient Profile */}
                      <div className="flex items-start gap-3">
                        {isLow ? (
                          <div className="p-2.5 rounded-xl bg-[#e8621a]/10 border border-[#e8621a]/20 text-[#e8621a] animate-pulse">
                            <AlertTriangle size={16} />
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-[#302117]/30 border border-[#302117]/60 text-[#f8bc51]">
                            <CheckCircle size={16} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-serif italic text-base text-white font-bold leading-tight">{item.name}</h4>
                          <div className="flex items-center gap-2 font-mono text-[9px] text-[#d4c4b0]/50 uppercase mt-1">
                            {item.outlet_id && (
                              <>
                                <span className="text-[#f8bc51]">{outlets.find(o => o.id === item.outlet_id)?.name || 'Unknown Outlet'}</span>
                                <span>&bull;</span>
                              </>
                            )}
                            <span>
                              Threshold: {item.tracking_type === 'pack' && item.pieces_per_pack
                                ? `${item.low_threshold} ${item.unit} (${Math.round((item.low_threshold / item.pieces_per_pack) * 10) / 10} packs)`
                                : `${item.low_threshold} ${item.unit}`}
                            </span>
                            <span>&bull;</span>
                            <span>Updated: {new Date(item.last_updated).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity Telemetry & Triggers */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-[#302117]/30 pt-3 sm:pt-0">
                        <div className="flex items-center gap-2 bg-[#070402] border border-[#302117] rounded-xl p-1.5">
                          <button
                            onClick={() => {
                              const step = item.tracking_type === 'pack' && item.pieces_per_pack ? item.pieces_per_pack : 1;
                              handleUpdateQty(item.stock_id, -step);
                            }}
                            className="w-7 h-7 rounded-lg bg-[#302117]/40 hover:bg-[#302117] flex items-center justify-center font-bold text-sm text-white"
                          >
                            -
                          </button>
                          <span className="font-mono text-xs font-bold px-3 text-center min-w-[50px]">
                            {item.tracking_type === 'pack' && item.pieces_per_pack
                              ? `${item.current_quantity} ${item.unit} (${Math.round((item.current_quantity / item.pieces_per_pack) * 10) / 10} packs)`
                              : `${item.current_quantity} ${item.unit}`}
                          </span>
                          <button
                            onClick={() => {
                              const step = item.tracking_type === 'pack' && item.pieces_per_pack ? item.pieces_per_pack : 1;
                              handleUpdateQty(item.stock_id, step);
                            }}
                            className="w-7 h-7 rounded-lg bg-[#302117]/40 hover:bg-[#302117] flex items-center justify-center font-bold text-sm text-white"
                          >
                            +
                          </button>
                        </div>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleEditClick(item)}
                          className="px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider font-bold border transition-all flex items-center gap-1.5 bg-[#302117]/45 hover:bg-[#302117] text-[#d4c4b0]/70 hover:text-white border-[#302117]"
                        >
                          EDIT
                        </button>

                        {/* Recipe Settings Button for Owner (Dough validation setup) */}
                        {userRole === 'owner' && (
                          <button
                            onClick={() => {
                              const recipe = conversionRecipes.find(r => r.stock_id === item.stock_id);
                              setRecipeMenuId(recipe?.linked_menu_item_id || '');
                              setRecipeMin(recipe?.yield_min_per_unit?.toString() || '');
                              setRecipeMax(recipe?.yield_max_per_unit?.toString() || '');
                              setShowRecipeStockId(showRecipeStockId === item.stock_id ? null : item.stock_id);
                            }}
                            className={`px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider font-bold border transition-all flex items-center gap-1.5 ${
                              showRecipeStockId === item.stock_id
                                ? 'bg-[#f8bc51] text-[#070402] border-[#f8bc51]'
                                : 'bg-[#302117]/45 hover:bg-[#302117] text-[#d4c4b0]/70 hover:text-white border-[#302117]'
                            }`}
                            title="Set Conversion Recipe"
                          >
                            <Settings size={11} />
                            Recipe
                          </button>
                        )}

                        {/* Permanent Delete Button */}
                        {userRole === 'owner' && (
                          <button
                            onClick={() => handleDeleteClick(item.stock_id)}
                            className="px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider font-bold border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all flex items-center gap-1.5"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        )}

                        {/* Email Notify Button */}
                        <button
                          onClick={() => triggerEmailAlert(item)}
                          disabled={status === 'sending'}
                          className={`px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider font-bold border transition-all flex items-center gap-1.5 ${
                            status === 'sending' 
                              ? 'bg-[#302117] text-[#d4c4b0] border-[#302117]' 
                              : status === 'success'
                              ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                              : isLow 
                              ? 'bg-[#e8621a]/10 hover:bg-[#e8621a]/20 text-[#e8621a] border-[#e8621a]/30'
                              : 'bg-[#302117]/45 hover:bg-[#302117] text-[#d4c4b0]/70 hover:text-white border-[#302117]'
                          }`}
                        >
                          {status === 'sending' ? (
                            <>
                              <RefreshCw size={11} className="animate-spin" />
                              Sending...
                            </>
                          ) : status === 'success' ? (
                            <>
                              <CheckCircle size={11} />
                              Dispatched!
                            </>
                          ) : (
                            <>
                              <Send size={11} />
                              Test Email
                            </>
                          )}
                        </button>

                        {/* AI Forecast Button */}
                        <button
                          onClick={() => handleAIForecast(item)}
                          disabled={fStatus === 'loading'}
                          className={`px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider font-bold border transition-all flex items-center gap-1.5 ${
                            fStatus === 'loading'
                              ? 'bg-[#f8bc51] text-[#070402] border-[#f8bc51]'
                              : 'bg-[#302117]/45 hover:bg-[#302117] text-[#f8bc51] hover:text-[#f8bc51] border-[#302117]'
                          }`}
                        >
                          {fStatus === 'loading' ? (
                            <>
                              <RefreshCw size={11} className="animate-spin" />
                              Thinking...
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} />
                              AI Forecast
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    {/* AI Prediction Result Box */}
                    {fResult && (
                      <div className="bg-[#120a06]/80 border border-[#f8bc51]/40 rounded-xl p-3 flex items-start gap-3 mt-1 ml-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <Sparkles size={16} className="text-[#f8bc51] shrink-0 mt-0.5" />
                        <p className="text-[#f8bc51] text-xs font-mono leading-relaxed">{fResult}</p>
                      </div>
                    )}

                    {/* Conversion Recipe Setup Box (Owner Only) */}
                    {showRecipeStockId === item.stock_id && (
                      <div className="bg-[#120a06]/90 border border-[#f8bc51]/30 rounded-2xl p-4 mt-2 ml-4 flex flex-col gap-3 font-mono text-xs text-[#d4c4b0] animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center border-b border-[#302117]/50 pb-2">
                          <span className="font-bold text-[#f8bc51] flex items-center gap-1.5">
                            <Settings size={13} className="animate-spin" />
                            Conversion Recipe Setup (Owner Only)
                          </span>
                          <button type="button" onClick={() => setShowRecipeStockId(null)} className="text-[#d4c4b0]/40 hover:text-white">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60 font-semibold">Linked POS Menu Item</label>
                            <select
                              value={recipeMenuId}
                              onChange={(e) => setRecipeMenuId(e.target.value)}
                              className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                            >
                              <option value="">-- Select Item --</option>
                              {menuItems.map(m => (
                                <option key={m.item_id} value={m.item_id}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60 font-semibold">Min Yield (Waffles per {item.unit})</label>
                            <input
                              type="number"
                              value={recipeMin}
                              onChange={(e) => setRecipeMin(e.target.value)}
                              placeholder="e.g. 8"
                              className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60 font-semibold">Max Yield (Waffles per {item.unit})</label>
                            <input
                              type="number"
                              value={recipeMax}
                              onChange={(e) => setRecipeMax(e.target.value)}
                              placeholder="e.g. 10"
                              className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveRecipeSubmit(item.stock_id)}
                          className="self-end bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] font-bold px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                        >
                          Save Conversion Recipe
                        </button>
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dough Batches Panel */}
            {activeTab === 'batches' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                {/* Outlet selector for Batches (Owner Only) */}
                {userRole === 'owner' && (
                  <div className="flex flex-col gap-1.5 bg-[#070402]/30 border border-[#302117] rounded-2xl p-4 font-mono text-xs">
                    <label className="text-[10px] uppercase tracking-wider text-[#d4c4b0]/70 font-semibold mb-1 flex items-center gap-1">
                      <Layers size={12} />
                      Audited Outlet Location:
                    </label>
                    <select
                      value={selectedOutletIdForBatches}
                      onChange={(e) => setSelectedOutletIdForBatches(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono max-w-xs cursor-pointer"
                    >
                      {outlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Manager locking info */}
                {userRole === 'manager' && (
                  <div className="bg-[#302117]/30 border border-[#302117] rounded-2xl p-4 font-mono text-xs text-[#d4c4b0] flex items-center gap-2">
                    <Info size={16} className="text-[#f8bc51] shrink-0" />
                    <span>
                      Locked to assigned outlet: <strong className="text-white">{outlets.find(o => o.id === selectedOutletIdForBatches)?.name || 'Central Store'}</strong>
                    </span>
                  </div>
                )}

                {/* List raw stock items with recipes */}
                {stocks
                  .filter(item => 
                    (item.outlet_id === selectedOutletIdForBatches || (!item.outlet_id && !selectedOutletIdForBatches)) &&
                    conversionRecipes.some(r => r.stock_id === item.stock_id)
                  )
                  .map(item => {
                    const recipe = conversionRecipes.find(r => r.stock_id === item.stock_id)!;
                    const linkedItem = menuItems.find(m => m.item_id === recipe.linked_menu_item_id);
                    const activeBatch = activeBatches.find(b => b.stock_id === item.stock_id);
                    const isStarting = startingBatchId === item.stock_id;
                    const isCompleting = activeBatch ? completingBatchId === activeBatch.batch_id : false;

                    return (
                      <div
                        key={item.stock_id}
                        className="bg-[#070402]/30 border border-[#302117] rounded-2xl p-5 flex flex-col gap-4 transition-all hover:border-[#302117]/85"
                      >
                        {/* Title and yield settings */}
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="font-serif italic text-base text-white font-bold leading-tight">{item.name}</h4>
                            <p className="text-[10px] font-mono text-[#d4c4b0]/50 uppercase mt-1">
                              Yield Formula: {recipe.yield_min_per_unit} - {recipe.yield_max_per_unit} {linkedItem?.name || 'Waffles'} per {item.unit}
                            </p>
                          </div>
                          <span className="bg-[#302117]/50 text-[#f8bc51] px-2.5 py-1.5 rounded-full border border-[#302117] font-mono text-[9px]">
                            Dough Stock: {item.current_quantity} {item.unit}
                          </span>
                        </div>

                        {/* If NO active batch exists */}
                        {!activeBatch ? (
                          <div className="border border-dashed border-[#302117]/70 bg-[#070402]/10 rounded-xl p-4 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
                            <div className="flex flex-col gap-1.5 w-full sm:max-w-xs">
                              <label className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]/70 font-semibold">Raw dough used for new batch ({item.unit}) *</label>
                              <input
                                type="number"
                                placeholder={`Quantity of dough in ${item.unit}`}
                                value={doughQtyUsed[item.stock_id] || ''}
                                onChange={(e) => setDoughQtyUsed({ ...doughQtyUsed, [item.stock_id]: e.target.value })}
                                className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors w-full"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={isStarting}
                              onClick={() => handleStartDoughBatch(item.stock_id, parseFloat(doughQtyUsed[item.stock_id] || '0'), selectedOutletIdForBatches)}
                              className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] disabled:bg-[#302117]/50 disabled:text-[#d4c4b0]/40 font-mono font-bold text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                            >
                              {isStarting ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                <>
                                  <Play size={12} className="fill-current" />
                                  Start Dough Batch
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          /* If active batch EXISTS */
                          <div className="border border-[#e8621a]/30 bg-[#e8621a]/5 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden">
                            {/* Glow pulse */}
                            <div className="absolute top-0 right-0 bg-[#e8621a]/10 text-[#e8621a] px-3 py-1 rounded-bl-xl font-mono text-[8px] uppercase tracking-widest font-bold flex items-center gap-1 border-l border-b border-[#e8621a]/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#e8621a] animate-pulse" />
                              Active Batch
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                              <div className="flex flex-col font-mono text-xs">
                                <span className="text-[#d4c4b0]/50 text-[9px] uppercase tracking-widest">Dough Used</span>
                                <span className="text-white font-bold mt-0.5">{activeBatch.raw_qty_used} {item.unit}</span>
                              </div>
                              <div className="flex flex-col font-mono text-xs">
                                <span className="text-[#d4c4b0]/50 text-[9px] uppercase tracking-widest">Expected Yield</span>
                                <span className="text-[#f8bc51] font-bold mt-0.5">{activeBatch.expected_min} - {activeBatch.expected_max} pcs</span>
                              </div>
                              <div className="flex flex-col font-mono text-xs">
                                <span className="text-[#d4c4b0]/50 text-[9px] uppercase tracking-widest">Waffles Sold (POS)</span>
                                <span className="text-white font-bold mt-0.5 flex items-center gap-1.5">
                                  {countWafflesSold(activeBatch, recipe.linked_menu_item_id)} waffles
                                  <span className="text-[9px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                    LIVE
                                  </span>
                                </span>
                              </div>
                              <div className="flex flex-col font-mono text-xs">
                                <span className="text-[#d4c4b0]/50 text-[9px] uppercase tracking-widest">Started At</span>
                                <span className="text-[#d4c4b0]/80 mt-0.5">{new Date(activeBatch.batch_start_time).toLocaleTimeString()}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isCompleting}
                              onClick={() => handleCompleteDoughBatch(activeBatch.batch_id)}
                              className="bg-[#e8621a] hover:bg-[#ff7b37] text-white disabled:bg-[#302117]/50 disabled:text-[#d4c4b0]/40 font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 self-end px-5 mt-2 border border-[#e8621a]/30"
                            >
                              {isCompleting ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  Auditing & Closing...
                                </>
                              ) : (
                                <>
                                  <Check size={12} />
                                  Mark Batch Complete
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {stocks.filter(item => 
                  (item.outlet_id === selectedOutletIdForBatches || (!item.outlet_id && !selectedOutletIdForBatches)) &&
                  conversionRecipes.some(r => r.stock_id === item.stock_id)
                ).length === 0 && (
                  <div className="border border-dashed border-[#302117] bg-[#070402]/20 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                    <span className="text-3xl">🥞</span>
                    <div>
                      <p className="text-white text-sm font-semibold">No Dough ingredients registered</p>
                      <p className="text-xs text-[#d4c4b0]/50 mt-1 max-w-xs mx-auto leading-relaxed">
                        To use the Dough validation system, the Owner must configure a Conversion Recipe on a raw ingredient item (e.g. Waffle Dough in kg).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                {/* Filters Row */}
                <div className="flex justify-between items-center bg-[#070402]/30 border border-[#302117] rounded-2xl p-4 font-mono text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-[#d4c4b0] hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={filterDiscrepancyOnly}
                      onChange={(e) => setFilterDiscrepancyOnly(e.target.checked)}
                      className="accent-[#e8621a] cursor-pointer"
                    />
                    <span>Show Discrepancies Only</span>
                  </label>
                  
                  {userRole === 'owner' && (
                    <select
                      value={selectedOutletIdForBatches}
                      onChange={(e) => setSelectedOutletIdForBatches(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-[#d4c4b0] focus:outline-none focus:border-[#f8bc51] transition-colors"
                    >
                      {outlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Audit Logs list */}
                {batchLogs
                  .filter(log => !filterDiscrepancyOnly || log.batch_status === 'flagged')
                  .map(log => {
                    const isFlagged = log.batch_status === 'flagged';
                    const stockItemName = stocks.find(s => s.stock_id === log.stock_id)?.name || 'Dough Ingredient';
                    const managerName = staffList.find(s => s.id === log.manager_uid)?.name || 'Staff (ID: ' + log.manager_uid.slice(0, 6) + ')';
                    
                    return (
                      <div
                        key={log.batch_id}
                        className={`bg-[#070402]/30 border rounded-2xl p-4 flex flex-col gap-3 transition-all ${
                          isFlagged
                            ? 'border-[#ef4444]/30 bg-[#ef4444]/5'
                            : 'border-[#10B981]/20 bg-[#10B981]/5'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="font-serif italic text-sm text-white font-bold leading-tight">{stockItemName}</span>
                            <div className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase mt-0.5">
                              {new Date(log.batch_start_time).toLocaleString()} - {log.batch_end_time ? new Date(log.batch_end_time).toLocaleTimeString() : 'N/A'}
                            </div>
                          </div>
                          
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border shadow-md flex items-center gap-1 ${
                            isFlagged
                              ? 'bg-[#0A0604] text-[#ef4444] border-[#ef4444]/20 animate-pulse'
                              : 'bg-[#0A0604] text-[#10B981] border-[#10B981]/20'
                          }`}>
                            {isFlagged ? '🚨 Yield Flagged' : '✅ Audit Passed'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-[#302117]/30 pt-3 text-xs font-mono">
                          <div className="flex flex-col">
                            <span className="text-[#d4c4b0]/40 text-[9px] uppercase tracking-widest">Dough Used</span>
                            <span className="text-white font-semibold mt-0.5">{log.raw_qty_used} kg</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#d4c4b0]/40 text-[9px] uppercase tracking-widest">Expected Yield</span>
                            <span className="text-white font-semibold mt-0.5">{log.expected_min} - {log.expected_max} pcs</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#d4c4b0]/40 text-[9px] uppercase tracking-widest">Actual Sales</span>
                            <span className={`font-semibold mt-0.5 ${isFlagged ? 'text-[#ef4444]' : 'text-[#10B981]'}`}>
                              {log.waffles_sold_auto} pcs
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#d4c4b0]/40 text-[9px] uppercase tracking-widest">Audited By</span>
                            <span className="text-white font-semibold mt-0.5">{managerName}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {batchLogs.filter(log => !filterDiscrepancyOnly || log.batch_status === 'flagged').length === 0 && (
                  <div className="border border-dashed border-[#302117] bg-[#070402]/20 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                    <span className="text-3xl">📋</span>
                    <div>
                      <p className="text-white text-sm font-semibold">No audit logs found</p>
                      <p className="text-xs text-[#d4c4b0]/50 mt-1 max-w-xs mx-auto leading-relaxed">
                        There are no completed or flagged dough batch logs on record for this outlet.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Right Column - Add Raw Stock & Logs */}
      <div className="flex flex-col gap-6">
        
        {/* Add Stock Form */}
        <form
          onSubmit={handleAddOrEditStock}
          className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4"
        >
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-2">
            <h3 className="font-serif italic text-lg text-white">
              {editStockId ? 'Edit Raw Ingredient' : 'Register Raw Ingredient'}
            </h3>
            {editStockId && (
              <button 
                type="button" 
                onClick={resetForm}
                className="text-xs font-mono text-[#e8621a] hover:text-[#ff8a4a] transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Ingredient Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saffron Biryani Rice"
              className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
            />
          </div>

          {/* Outlet Selection */}
          {editStockId ? (
            <div className="flex flex-col gap-1 bg-[#070402] border border-[#302117] rounded-xl p-3.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]/50">Physical Record Location</span>
              <span className="text-white text-xs font-mono font-bold">
                📍 {stocks.find(s => s.stock_id === editStockId)?.outlet_id 
                  ? (outlets.find(o => o.id === stocks.find(s => s.stock_id === editStockId)?.outlet_id)?.name || 'Unknown Outlet')
                  : 'Central Storage / Global'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Assigned Outlets</label>
              <div className="bg-[#070402] border border-[#302117] rounded-xl p-3 flex flex-col gap-2 max-h-[140px] overflow-y-auto">
                <label className="flex items-center gap-2 text-xs font-mono cursor-pointer text-white font-semibold">
                  <input
                    type="checkbox"
                    checked={formOutlets.length === outlets.length && outlets.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormOutlets(outlets.map(o => o.id));
                      } else {
                        setFormOutlets([]);
                      }
                    }}
                    className="accent-[#f8bc51] cursor-pointer"
                  />
                  <span>-- Select All Outlets --</span>
                </label>
                <div className="border-t border-[#302117]/30 my-1" />
                {outlets.map(o => (
                  <label key={o.id} className="flex items-center gap-2 text-xs font-mono cursor-pointer text-[#d4c4b0] hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={formOutlets.includes(o.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormOutlets([...formOutlets, o.id]);
                        } else {
                          setFormOutlets(formOutlets.filter(id => id !== o.id));
                        }
                      }}
                      className="accent-[#f8bc51] cursor-pointer"
                    />
                    <span>{o.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[9px] text-[#d4c4b0]/40 font-mono">Leave unchecked for Central Storage / Global registry.</p>
            </div>
          )}

          {/* Tracking Mode */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Tracking Mode</label>
              <select
                value={trackingType}
                onChange={(e) => setTrackingType(e.target.value as 'bulk' | 'pack')}
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
              >
                <option value="bulk">Bulk (Weight/Vol)</option>
                <option value="pack">Pack Conversion</option>
              </select>
            </div>
            {trackingType === 'pack' ? (
              <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Pieces Per Pack *</label>
                <input
                  type="number"
                  required
                  value={piecesPerPack}
                  onChange={(e) => setPiecesPerPack(e.target.value)}
                  placeholder="e.g. 12"
                  className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">
                {trackingType === 'pack' ? 'Pack Quantity *' : 'Volume Quantity *'}
              </label>
              <input
                type="number"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={trackingType === 'pack' ? 'Number of packs' : 'Volume level'}
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Unit System</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
              >
                <option value="kg">kg (Basmati/Beans)</option>
                <option value="grams">grams (g) (Spices/Flour)</option>
                <option value="Liters">Liters (Milk/Syrups)</option>
                <option value="ml">milliliters (ml) (Extracts/Oils)</option>
                <option value="portions">portions (Waffles/Patties)</option>
                <option value="pcs">pieces (Eggs/Momos)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">
              {trackingType === 'pack' ? 'Low Alert Threshold (Packs) *' : 'Low Alert Threshold *'}
            </label>
            <input
              type="number"
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Trigger mail at..."
              className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 mt-2"
          >
            {editStockId ? null : <Plus size={14} />}
            {userRole === 'manager' 
              ? (editStockId ? 'Request Update' : 'Request Add To Stocks') 
              : (editStockId ? 'Save Changes' : 'Add To Stocks')}
          </button>
        </form>

        {/* Telemetry Mail Logs */}
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#302117]/60 pb-2">
            <h3 className="font-serif italic text-lg text-white">Alert Telemetry Logs</h3>
            <Sparkles size={14} className="text-[#f8bc51]" />
          </div>

          <div className="bg-[#070402] border border-[#302117] rounded-2xl p-4 font-mono text-[10px] text-[#d4c4b0]/70 flex flex-col gap-2 min-h-[150px] max-h-[220px] overflow-y-auto">
            {alertLog.length === 0 ? (
              <span className="text-[#d4c4b0]/30 italic text-center my-auto">No telemetry signals fired yet. Drop a stock past threshold to trigger auto-email!</span>
            ) : (
              alertLog.map((log, idx) => (
                <div key={idx} className="border-b border-[#302117]/20 pb-1.5 last:border-b-0 leading-relaxed">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <TOTPModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onVerify={async (code) => {
          await executeSecureAction(code);
        }}
        title={pendingAction?.type === 'add_stock' ? (editStockId ? "Update Stock Item" : "Register Stock Item") : "Update Stock Quantity"}
        description="Please enter your Google Authenticator code. Once verified, you won't be asked again for 20 minutes."
      />
    </div>
  );
}
