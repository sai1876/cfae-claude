import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Calendar, History, BookOpen, HelpCircle, FileText, CheckCircle, Clock } from 'lucide-react';
import { OrderDocument } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface KDSProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  completedOrders: OrderDocument[];
  staffDetails: any;
}

type TabType = 'details' | 'schedule' | 'leave' | 'history' | 'recipes' | 'help';

export default function KDSProfileModal({ isOpen, onClose, role, completedOrders, staffDetails }: KDSProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveSubmitted, setLeaveSubmitted] = useState(false);

  const [historyPeriod, setHistoryPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [historyOrders, setHistoryOrders] = useState<OrderDocument[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const isAllowedItem = (item: any) => {
    if (role === 'manager' || role === 'owner') return true;
    const stationUpper = (item.station || '').toUpperCase();
    if (role === 'deep_fryer') return stationUpper === 'FRYER';
    if (role === 'grill_fryer') return stationUpper === 'GRILLED OR STEAMED';
    if (role === 'biryani_master') return stationUpper === 'FASTFOOD & BIRYANI';
    if (role === 'brewer') return stationUpper === 'BREWER';
    return false;
  };

  useEffect(() => {
    if (activeTab === 'history') {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const now = Date.now();
          let timeLimit = 0;
          if (historyPeriod === 'today') {
             timeLimit = now - 24 * 60 * 60 * 1000;
          } else if (historyPeriod === 'week') {
             timeLimit = now - 7 * 24 * 60 * 60 * 1000;
          } else if (historyPeriod === 'month') {
             timeLimit = now - 30 * 24 * 60 * 60 * 1000;
          }

          let q;
          if (historyPeriod === 'all') {
            q = query(collection(db, 'orders'));
          } else {
            q = query(collection(db, 'orders'), where('created_at', '>=', timeLimit));
          }

          const snap = await getDocs(q);
          const fetched = snap.docs.map(d => d.data() as OrderDocument);
          
          const filtered = fetched.filter(order => 
            order.items.some((item: any) => isAllowedItem(item) && item.status === 'bumped')
          ).sort((a, b) => b.created_at - a.created_at);
          
          setHistoryOrders(filtered);
        } catch (e) {
          console.error('Failed to fetch history orders:', e);
        } finally {
          setIsLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [activeTab, historyPeriod, role]);

  // Real employee details
  const employee = {
    id: staffDetails?.employee_id || staffDetails?.id || 'N/A',
    name: staffDetails?.name || 'Unknown',
    number: staffDetails?.phone || staffDetails?.number || 'N/A',
    email: staffDetails?.email || 'N/A',
  };

  // Schedule from DB
  const schedule = staffDetails?.schedule || [];

  // Mock recipes
  const recipes = [
    { name: 'Classic Burger', ingredients: ['Brioche Bun', 'Beef Patty', 'Cheddar', 'Lettuce', 'Tomato'], steps: ['Grill patty for 4 mins each side', 'Toast bun', 'Assemble with veggies on top'] },
    { name: 'Iced Latte', ingredients: ['Espresso', 'Milk', 'Ice', 'Vanilla Syrup'], steps: ['Fill cup with ice', 'Add milk and syrup', 'Pour double espresso over ice'] },
    { name: 'Spicy Fries', ingredients: ['Fries', 'Spicy Seasoning', 'Chili Flakes'], steps: ['Deep fry for 3 mins', 'Toss with seasoning immediately'] },
  ];

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here we would normally save to Firebase
    setLeaveSubmitted(true);
    setTimeout(() => {
      setLeaveSubmitted(false);
      setLeaveDate('');
      setLeaveReason('');
    }, 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-[900px] h-full max-h-[700px] bg-[#0A0604] border border-[#302117] rounded-3xl flex overflow-hidden shadow-2xl pointer-events-auto"
            >
            {/* Sidebar Navigation */}
            <div className="w-64 bg-[#120a06] border-r border-[#302117] p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-full bg-[#f8bc51]/20 flex items-center justify-center text-[#f8bc51]">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-[#f7dec4] font-bold">{employee.name}</h3>
                  <p className="text-[#f8bc51] text-xs uppercase tracking-widest">{role.replace('_', ' ')}</p>
                </div>
              </div>

              <nav className="flex flex-col gap-2">
                {[
                  { id: 'details', icon: User, label: 'My Details' },
                  { id: 'schedule', icon: Calendar, label: 'Schedule' },
                  { id: 'leave', icon: FileText, label: 'Request Leave' },
                  { id: 'history', icon: History, label: 'Order History' },
                  { id: 'recipes', icon: BookOpen, label: 'Recipe Checker' },
                  { id: 'help', icon: HelpCircle, label: 'Help & Support' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as TabType)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-[#f8bc51] text-[#0A0604] font-bold'
                        : 'text-[#d4c4b0] hover:bg-[#302117]/50'
                    }`}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </button>
                ))}
              </nav>

              <button
                onClick={onClose}
                className="mt-auto flex items-center gap-2 text-[#d4c4b0] hover:text-white px-4 py-3 cursor-pointer"
              >
                <X size={18} />
                Close Profile
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 overflow-y-auto custom-scroll">
              
              {/* My Details */}
              {activeTab === 'details' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Employee Details</h2>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-[#120a06] p-5 rounded-2xl border border-[#302117]">
                      <p className="text-[#d4c4b0]/50 text-xs uppercase tracking-widest mb-1">Employee ID</p>
                      <p className="text-xl text-white">{employee.id}</p>
                    </div>
                    <div className="bg-[#120a06] p-5 rounded-2xl border border-[#302117]">
                      <p className="text-[#d4c4b0]/50 text-xs uppercase tracking-widest mb-1">Full Name</p>
                      <p className="text-xl text-white">{employee.name}</p>
                    </div>
                    <div className="bg-[#120a06] p-5 rounded-2xl border border-[#302117]">
                      <p className="text-[#d4c4b0]/50 text-xs uppercase tracking-widest mb-1">Phone Number</p>
                      <p className="text-xl text-white">{employee.number}</p>
                    </div>
                    <div className="bg-[#120a06] p-5 rounded-2xl border border-[#302117]">
                      <p className="text-[#d4c4b0]/50 text-xs uppercase tracking-widest mb-1">Email Address</p>
                      <p className="text-xl text-white">{employee.email}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Schedule */}
              {activeTab === 'schedule' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Upcoming Shifts</h2>
                  {schedule.length === 0 ? (
                    <div className="text-center py-10 text-[#d4c4b0]/50 border border-dashed border-[#302117] rounded-2xl">
                      <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                      No upcoming shifts scheduled.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {schedule.map((shift: any, i: number) => (
                        <div key={shift.id || i} className={`p-4 rounded-2xl border flex justify-between items-center ${
                          shift.time === 'Off' ? 'bg-[#120a06]/50 border-[#302117]/50 opacity-60' : 'bg-[#120a06] border-[#302117]'
                        }`}>
                          <div>
                            <p className="text-white font-bold">{shift.day}, {shift.date}</p>
                            <p className="text-[#d4c4b0] text-sm mt-1">{shift.type}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-mono ${shift.time === 'Off' ? 'text-[#d4c4b0]' : 'text-[#f8bc51]'}`}>
                              {shift.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Request Leave */}
              {activeTab === 'leave' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Request Leave</h2>
                  {leaveSubmitted ? (
                    <div className="bg-[#10B981]/10 border border-[#10B981]/30 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                      <CheckCircle className="text-[#10B981] mb-4" size={48} />
                      <h3 className="text-xl font-bold text-[#10B981]">Request Submitted</h3>
                      <p className="text-[#d4c4b0] mt-2">Your manager will review your request shortly.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleLeaveSubmit} className="space-y-5 bg-[#120a06] p-6 rounded-2xl border border-[#302117]">
                      <div>
                        <label className="block text-[#d4c4b0] mb-2 text-sm">Date(s) of Leave</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Oct 28 - Oct 30"
                          value={leaveDate}
                          onChange={e => setLeaveDate(e.target.value)}
                          required
                          className="w-full bg-[#0A0604] border border-[#302117] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8bc51]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#d4c4b0] mb-2 text-sm">Reason for Leave</label>
                        <textarea 
                          rows={4}
                          placeholder="Please provide details..."
                          value={leaveReason}
                          onChange={e => setLeaveReason(e.target.value)}
                          required
                          className="w-full bg-[#0A0604] border border-[#302117] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8bc51] resize-none"
                        />
                      </div>
                      <button 
                        type="submit"
                        className="bg-[#f8bc51] text-[#0A0604] font-bold px-6 py-3 rounded-xl hover:bg-[#ffce7b] transition-colors w-full cursor-pointer"
                      >
                        Submit Request
                      </button>
                    </form>
                  )}
                </motion.div>
              )}

              {/* Order History */}
              {activeTab === 'history' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 flex flex-col h-full">
                  <div className="flex justify-between items-end shrink-0">
                    <div>
                      <h2 className="text-2xl font-bold text-white">My Completed Orders</h2>
                      <p className="text-[#d4c4b0] mt-1">Orders bumped by this station.</p>
                    </div>
                    <select
                      value={historyPeriod}
                      onChange={(e) => setHistoryPeriod(e.target.value as any)}
                      className="bg-[#120a06] border border-[#302117] text-[#f8bc51] rounded-xl px-4 py-2 font-mono text-xs uppercase tracking-widest outline-none focus:border-[#f8bc51] cursor-pointer"
                    >
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scroll">
                    {isLoadingHistory ? (
                      <div className="text-center py-10 text-[#d4c4b0]/50 font-mono text-sm uppercase tracking-widest animate-pulse">
                        Fetching records...
                      </div>
                    ) : historyOrders.length === 0 ? (
                      <div className="text-center py-10 text-[#d4c4b0]/50">
                        <History size={48} className="mx-auto mb-4 opacity-20" />
                        No completed orders found for this period.
                      </div>
                    ) : (
                      historyOrders.map(order => (
                        <div key={order.order_id} className="bg-[#120a06] border border-[#302117] p-4 rounded-2xl flex justify-between items-center">
                          <div>
                            <span className="text-[#f8bc51] font-bold text-lg mr-3">#{order.token_number || order.order_id.slice(-4)}</span>
                            <span className="text-white">{order.items.length} items</span>
                            <div className="text-[#d4c4b0]/50 text-xs mt-1">
                              {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                          <div className="bg-[#10B981]/20 text-[#10B981] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <CheckCircle size={12} />
                            Completed
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* Recipe Checker */}
              {activeTab === 'recipes' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Recipe Checker</h2>
                  <div className="space-y-4">
                    {recipes.map((recipe, idx) => (
                      <div key={idx} className="bg-[#120a06] border border-[#302117] p-5 rounded-2xl">
                        <h3 className="text-xl font-bold text-[#f8bc51] mb-3">{recipe.name}</h3>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-white text-sm mb-2 uppercase tracking-widest font-bold opacity-70">Ingredients</h4>
                            <ul className="list-disc list-inside text-[#d4c4b0] space-y-1">
                              {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-white text-sm mb-2 uppercase tracking-widest font-bold opacity-70">Steps</h4>
                            <ol className="list-decimal list-inside text-[#d4c4b0] space-y-1">
                              {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
                            </ol>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Help & Support */}
              {activeTab === 'help' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <h2 className="text-2xl font-bold text-white mb-6">Help & Support</h2>
                  <div className="bg-[#120a06] border border-[#302117] p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-2">Need Manager Assistance?</h3>
                    <p className="text-[#d4c4b0] mb-4">If you have an issue with your station, missing inventory, or a hardware problem, you can page the manager directly.</p>
                    <button className="bg-red-500/20 text-red-500 border border-red-500/50 font-bold px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-colors cursor-pointer">
                      Alert Manager Now
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-white font-bold mt-8 mb-4">Frequently Asked Questions</h3>
                    {[
                      { q: "How do I void an item?", a: "Only managers can void items. Please use the alert button above." },
                      { q: "What if the printer is out of paper?", a: "Spare rolls are kept under station 1. Please replace it and press the feed button." },
                      { q: "How do I mark an item out of stock?", a: "You can do this from the main manager portal, or ask the manager to update it in the system." }
                    ].map((faq, i) => (
                      <div key={i} className="bg-[#120a06]/50 p-4 rounded-xl border border-[#302117]">
                        <p className="text-white font-bold mb-1">{faq.q}</p>
                        <p className="text-[#d4c4b0] text-sm">{faq.a}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

            </div>
            </motion.div>
          </div>
        </>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #302117; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #f8bc51; }
      `}} />
    </AnimatePresence>
  );
}
