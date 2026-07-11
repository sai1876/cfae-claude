'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingBag, Users, Clock, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { streamTelemetryData, fetchOutlets, createCashRegisterSession, closeCashRegisterSession, fetchCashRegisterSessions, addExpenseRecord, fetchExpensesList, fetchStaffList } from '@/lib/dbService';
import { Outlet } from '@/lib/types';

export default function DashboardStats({ onNavigate }: { onNavigate?: (tab: any, filter?: string) => void }) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('All');
  const [timeRange, setTimeRange] = useState<string>('week');
  const [telemetry, setTelemetry] = useState<any>(null);

  const getDayLabel = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const name = dayNames[d.getDay()];
    if (daysAgo === 0) {
      return `Today (${name})`;
    }
    return name;
  };

  // Till Register & Expenses States
  const [staffList, setStaffList] = useState<any[]>([]);
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [cashShift, setCashShift] = useState<'morning' | 'evening'>('morning');
  const [closingCash, setClosingCash] = useState('');
  const [expectedCash, setExpectedCash] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [cashStaffId, setCashStaffId] = useState('');
  const [isOpeningTill, setIsOpeningTill] = useState(false);
  const [isClosingTill, setIsClosingTill] = useState(false);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseCategory, setExpenseCategory] = useState('utilities');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseMethod, setExpenseMethod] = useState('upi');
  const [expenseStaffId, setExpenseStaffId] = useState('');
  const [isLoggingExpense, setIsLoggingExpense] = useState(false);

  useEffect(() => {
    fetchOutlets().then(setOutlets);
    fetchStaffList().then(setStaffList).catch(err => console.error(err));
    loadCashAndExpenses();
  }, []);

  const loadCashAndExpenses = async () => {
    try {
      const [sessions, expensesData] = await Promise.all([
        fetchCashRegisterSessions(),
        fetchExpensesList()
      ]);
      setCashSessions(sessions);
      setExpenses(expensesData);
      
      const open = sessions.find((s: any) => s.closing_cash === null);
      if (open) {
        setActiveSession(open);
      } else {
        setActiveSession(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenTill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingCash || !cashStaffId) return;
    setIsOpeningTill(true);
    try {
      await createCashRegisterSession({
        outlet: selectedOutlet === 'All' ? 'Oasis College Hatch' : selectedOutlet,
        shift: cashShift,
        opening_cash: parseFloat(openingCash),
        staff_id: cashStaffId
      });
      alert("Opened till session successfully!");
      setOpeningCash('');
      await loadCashAndExpenses();
    } catch (err) {
      alert("Failed to open till session.");
    } finally {
      setIsOpeningTill(false);
    }
  };

  const handleCloseTill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !closingCash || !expectedCash) return;
    setIsClosingTill(true);
    try {
      await closeCashRegisterSession(
        activeSession.id,
        parseFloat(closingCash),
        parseFloat(expectedCash),
        cashNote
      );
      alert("Closed till session successfully!");
      setClosingCash('');
      setExpectedCash('');
      setCashNote('');
      await loadCashAndExpenses();
    } catch (err) {
      alert("Failed to close till session.");
    } finally {
      setIsClosingTill(false);
    }
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !expenseDesc || !expenseStaffId) return;
    setIsLoggingExpense(true);
    try {
      await addExpenseRecord({
        outlet: selectedOutlet === 'All' ? 'Oasis College Hatch' : selectedOutlet,
        category: expenseCategory,
        amount: parseFloat(expenseAmount),
        description: expenseDesc,
        payment_method: expenseMethod,
        staff_id: expenseStaffId
      });
      alert("Expense logged successfully!");
      setExpenseAmount('');
      setExpenseDesc('');
      await loadCashAndExpenses();
    } catch (err) {
      alert("Failed to log expense.");
    } finally {
      setIsLoggingExpense(false);
    }
  };

  useEffect(() => {
    const unsubscribe = streamTelemetryData(selectedOutlet, timeRange, (data) => {
      setTelemetry(data);
    });
    return () => unsubscribe();
  }, [selectedOutlet, timeRange]);

  const stats = telemetry ? [
    { label: 'Today\'s Revenue', value: telemetry.todaysRevenue, change: 'Live', icon: DollarSign, trend: 'up' },
    { label: 'Orders Completed', value: telemetry.ordersCompleted, change: 'Live', icon: ShoppingBag, trend: 'up' },
    { label: 'Active Queue Load', value: telemetry.activeQueueLoad, change: 'Live', icon: Clock, trend: 'stable' },
    { label: 'Loyalty Patrons', value: telemetry.loyaltyPatrons, change: 'Global', icon: Users, trend: 'up', onClick: () => onNavigate && onNavigate('crm', 'loyal') },
  ] : [
    { label: 'Today\'s Revenue', value: '₹--', change: 'Loading...', icon: DollarSign, trend: 'up' },
    { label: 'Orders Completed', value: '--', change: 'Loading...', icon: ShoppingBag, trend: 'up' },
    { label: 'Active Queue Load', value: '--', change: 'Loading...', icon: Clock, trend: 'stable' },
    { label: 'Loyalty Patrons', value: '--', change: 'Loading...', icon: Users, trend: 'up' },
  ];

  // SVG Chart Data - Revenue Trajectory
  const revenuePoints = telemetry?.revenuePoints || [0, 0, 0, 0, 0, 0, 0];
  const chartWidth = 500;
  const chartHeight = 180;
  const padding = 20;

  const minVal = Math.min(...revenuePoints) * 0.8;
  const maxVal = Math.max(Math.max(...revenuePoints) * 1.1, minVal + 100); // Prevent division by zero if all values are 0

  const pointsString = revenuePoints
    .map((val: number, index: number) => {
      const x = padding + (index / (revenuePoints.length - 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((val - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  // Gradient area path
  const areaPointsString = `${padding},${chartHeight - padding} ${pointsString} ${chartWidth - padding},${chartHeight - padding}`;

  // Queue Load Peak Hours
  const queuePeakData = telemetry?.queuePeakData || [
    { hour: '10 AM', orders: 0 },
    { hour: '12 PM', orders: 0 },
    { hour: '2 PM', orders: 0 },
    { hour: '4 PM', orders: 0 },
    { hour: '6 PM', orders: 0 },
    { hour: '8 PM', orders: 0 },
    { hour: '10 PM', orders: 0 },
  ];
  const maxPeakOrders = Math.max(...queuePeakData.map((d: any) => d.orders), 1);

  // Category Distribution Ring
  const categories = telemetry?.categories || [
    { name: 'Loading', percentage: 100, color: '#302117', amount: '₹0' },
  ];

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header and Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-[#120a06]/40 border border-[#302117]/60 rounded-xl px-4 py-2 backdrop-blur-xl">
          <MapPin size={16} className="text-[#f8bc51]" />
          <select 
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="bg-transparent text-white font-mono text-sm outline-none cursor-pointer"
          >
            <option value="All" className="bg-[#120a06]">🌍 All Outlets</option>
            {outlets.map(o => (
              <option key={o.id} value={o.name} className="bg-[#120a06]">{o.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Telemetry KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={stat.onClick}
              className={`bg-[#120a06]/40 backdrop-blur-xl border border-[#302117]/60 hover:border-[#f8bc51]/40 transition-colors duration-500 rounded-2xl p-6 relative overflow-hidden group ${stat.onClick ? 'cursor-pointer hover:bg-[#120a06]/80' : ''}`}
            >
              {/* Mesh back glow */}
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#f8bc51]/5 rounded-full filter blur-xl group-hover:bg-[#f8bc51]/10 transition-all duration-700" />
              
              <div className="flex justify-between items-start mb-4">
                <span className="font-mono text-xs uppercase tracking-wider text-[#d4c4b0]/60">
                  {stat.label}
                </span>
                <div className="p-2 rounded-xl bg-[#302117]/40 border border-[#302117]/60 text-[#f8bc51] group-hover:scale-110 transition-transform duration-500">
                  <Icon size={16} />
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white font-sans">{stat.value}</span>
                <span className={`text-xs font-mono font-bold flex items-center ${stat.trend === 'up' ? 'text-[#10B981]' : 'text-[#f8bc51]'}`}>
                  {stat.change}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Advanced Telemetry Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Trajectory SVG Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-[#120a06]/45 backdrop-blur-xl border border-[#302117]/60 rounded-3xl p-6 relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-serif italic text-xl text-white">Revenue Trajectory</h3>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Live Income Sequence</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-1.5 flex items-center gap-2">
                <Calendar size={12} className="text-[#d4c4b0]/40" />
                <select 
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none font-mono uppercase tracking-wider cursor-pointer"
                >
                  <option className="bg-[#120a06] text-white" value="today">Today</option>
                  <option className="bg-[#120a06] text-white" value="week">Past 7 Days</option>
                  <option className="bg-[#120a06] text-white" value="month">This Month</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-[#302117]/40 px-3 py-1 rounded-full border border-[#302117]/60 font-mono text-[9px] text-[#f8bc51]">
                <TrendingUp size={10} />
                TARGET: +15%
              </div>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full relative">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f8bc51" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f8bc51" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#e8621a" />
                  <stop offset="50%" stopColor="#f8bc51" />
                  <stop offset="100%" stopColor="#ffce7b" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              {[0, 1, 2, 3].map((g) => {
                const y = padding + (g / 3) * (chartHeight - padding * 2);
                return (
                  <line
                    key={g}
                    x1={padding}
                    y1={y}
                    x2={chartWidth - padding}
                    y2={y}
                    stroke="#302117"
                    strokeWidth="0.5"
                    strokeDasharray="4,4"
                  />
                );
              })}

              {/* Gradient Fill Area */}
              <polygon points={areaPointsString} fill="url(#areaGradient)" />

              {/* Glowing Line Path */}
              <path
                d={`M ${pointsString}`}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="3.5"
                filter="url(#glow)"
              />

              {/* Interaction Nodes */}
              {revenuePoints.map((val: number, idx: number) => {
                const x = padding + (idx / (revenuePoints.length - 1)) * (chartWidth - padding * 2);
                const y = chartHeight - padding - ((val - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);
                const isHovered = hoveredPoint === idx;

                return (
                  <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredPoint(idx)} onMouseLeave={() => setHoveredPoint(null)}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 8 : 4.5}
                      fill="#060403"
                      stroke={isHovered ? '#ffce7b' : '#f8bc51'}
                      strokeWidth="2"
                      className="transition-all duration-300"
                    />
                    {isHovered && (
                      <g>
                        <rect
                          x={x - 40}
                          y={y - 35}
                          width="80"
                          height="24"
                          rx="6"
                          fill="#120a06"
                          stroke="#302117"
                          strokeWidth="1"
                        />
                        <text
                          x={x}
                          y={y - 19}
                          fill="#f8bc51"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ₹{val}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between font-mono text-[9px] text-[#d4c4b0]/40 uppercase mt-4 border-t border-[#302117]/35 pt-3 overflow-x-auto hide-scrollbar">
            {telemetry?.trajectoryLabels ? telemetry.trajectoryLabels.map((lbl: string, idx: number) => (
              <span key={idx}>{lbl}</span>
            )) : [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => (
              <span key={daysAgo}>{getDayLabel(daysAgo)}</span>
            ))}
          </div>
        </motion.div>

        {/* Category Sales Distribution Donut */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-[#120a06]/45 backdrop-blur-xl border border-[#302117]/60 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between"
        >
          <div>
            <h3 className="font-serif italic text-xl text-white">Sales Categories</h3>
            <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Category Volume Rings</p>
          </div>

          {/* Donut rings */}
          <div className="flex justify-center items-center my-6 relative">
            <svg width="150" height="150" viewBox="0 0 100 100" className="transform -rotate-90">
              {/* Concentric layered glowing circles representing proportions */}
              {categories.map((cat: any, idx: number) => {
                const radius = 38 - idx * 6;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (cat.percentage / 100) * circumference;
                return (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={cat.color}
                    strokeWidth="3.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="opacity-80"
                    style={{ filter: `drop-shadow(0 0 4px ${cat.color}33)` }}
                  />
                );
              })}
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/40">Top category</span>
              <span className="text-base font-bold text-white font-serif italic">
                {telemetry?.categories?.[0] && telemetry.categories[0].percentage > 0 ? telemetry.categories[0].name : 'None'}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#302117]/35">
            {categories.map((cat: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-white font-medium">{cat.name}</span>
                </div>
                <div className="flex items-center gap-3 text-[#d4c4b0]/60 font-mono text-[10px]">
                  <span>{cat.amount}</span>
                  <span className="text-[#f8bc51] font-bold">{cat.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* KDS Peak Hour Load Indicator Bars */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-[#120a06]/45 backdrop-blur-xl border border-[#302117]/60 rounded-3xl p-6 relative overflow-hidden"
      >
        <div>
          <h3 className="font-serif italic text-xl text-white">Peak Hour Load (KDS Telemetry)</h3>
          <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Order distribution bar chart</p>
        </div>

        {/* Custom Glowing Bar Chart */}
        <div className="flex justify-between items-end h-40 gap-4 mt-8 pt-4">
          {queuePeakData.map((d: any, idx: number) => {
            const barHeight = (d.orders / maxPeakOrders) * 100;
            const isPeak = d.orders === maxPeakOrders;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-3 group">
                <div className="w-full relative flex flex-col justify-end h-28">
                  {/* Tooltip on hover */}
                  <span className="absolute -top-6 text-[10px] font-mono text-[#f8bc51] opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                    {d.orders} ord
                  </span>
                  
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${barHeight}%` }}
                    transition={{ duration: 1, delay: idx * 0.05 }}
                    className={`w-full rounded-t-lg transition-colors relative ${
                      isPeak 
                        ? 'bg-gradient-to-t from-[#e8621a] to-[#f8bc51] shadow-[0_0_15px_rgba(248,188,81,0.3)]' 
                        : 'bg-[#302117] group-hover:bg-[#f8bc51]/40'
                    }`}
                  >
                    {isPeak && (
                      <div className="absolute inset-0 bg-white/20 animate-pulse rounded-t-lg" />
                    )}
                  </motion.div>
                </div>
                
                <span className="font-mono text-[9px] text-[#d4c4b0]/50 tracking-wider">
                  {d.hour}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Till Register & Expenses Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Cash Register Till Sessions Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#120a06]/45 backdrop-blur-xl border border-[#302117]/60 rounded-3xl p-6 flex flex-col gap-6"
        >
          <div>
            <h3 className="font-serif italic text-xl text-white">Cash Register Till Sessions</h3>
            <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Till opening, closing, and reconciliation</p>
          </div>

          {activeSession ? (
            /* Close Till Session Form */
            <form onSubmit={handleCloseTill} className="bg-[#070402]/30 border border-[#e8621a]/30 rounded-2xl p-4 flex flex-col gap-3 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-[#302117]/50 pb-2">
                <span className="font-bold text-[#e8621a] flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e8621a]" />
                  Active Till: Shift {activeSession.shift.toUpperCase()}
                </span>
                <span className="text-[10px] text-[#d4c4b0]/50">Opened: {new Date(activeSession.created_at).toLocaleTimeString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Actual Closing Cash (Rs.) *</label>
                  <input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    required
                    placeholder="Enter physical cash..."
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Expected System Cash (Rs.) *</label>
                  <input
                    type="number"
                    value={expectedCash}
                    onChange={(e) => setExpectedCash(e.target.value)}
                    required
                    placeholder="Enter system ledger total..."
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Till Reconciliation Notes</label>
                <textarea
                  value={cashNote}
                  onChange={(e) => setCashNote(e.target.value)}
                  placeholder="Note any cash discrepancies or reasons..."
                  rows={2}
                  className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors resize-none text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isClosingTill}
                className="bg-red-500 hover:bg-red-600 transition-colors text-white rounded-lg py-2.5 font-bold uppercase tracking-widest text-[10px] mt-1 border border-red-500/20"
              >
                {isClosingTill ? "Closing Till..." : "Close Register & Audit"}
              </button>
            </form>
          ) : (
            /* Open Till Session Form */
            <form onSubmit={handleOpenTill} className="bg-[#070402]/30 border border-[#302117] rounded-2xl p-4 flex flex-col gap-3 font-mono text-xs">
              <h4 className="font-serif italic text-xs text-[#f8bc51] border-b border-[#302117]/40 pb-1.5 uppercase tracking-wider">Open Till Session</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Opening Cash (Rs.) *</label>
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    required
                    placeholder="e.g. 2000"
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Roster Shift *</label>
                  <select
                    value={cashShift}
                    onChange={(e) => setCashShift(e.target.value as 'morning' | 'evening')}
                    className="bg-[#070402] border border-[#302117] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Opening Operator Staff *</label>
                <select
                  value={cashStaffId}
                  onChange={(e) => setCashStaffId(e.target.value)}
                  required
                  className="bg-[#070402] border border-[#302117] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                >
                  <option value="">-- Choose Operator --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isOpeningTill}
                className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] transition-colors rounded-lg py-2.5 font-bold uppercase tracking-widest text-[10px] mt-1"
              >
                {isOpeningTill ? "Opening Till..." : "Open Register Session"}
              </button>
            </form>
          )}

          {/* Till Sessions Ledger */}
          <div className="bg-[#070402]/30 border border-[#302117] rounded-2xl p-4">
            <h4 className="font-serif italic text-xs text-[#f8bc51] border-b border-[#302117]/40 pb-1.5 uppercase tracking-wider mb-2">Registry Till Session Audits</h4>
            {cashSessions.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-[#d4c4b0]/30 font-mono italic">No register sessions recorded.</div>
            ) : (
              <div className="max-h-[160px] overflow-y-auto pr-1">
                <table className="w-full font-mono text-[10px] text-[#d4c4b0]">
                  <thead>
                    <tr className="border-b border-[#302117]/40 text-[#f8bc51] uppercase text-left">
                      <th className="pb-1.5">Date</th>
                      <th className="pb-1.5">Shift</th>
                      <th className="pb-1.5">Opening</th>
                      <th className="pb-1.5">Closing</th>
                      <th className="pb-1.5">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashSessions.map((s, idx) => {
                      const isDiscrepant = s.difference !== null && s.difference !== 0;
                      return (
                        <tr key={s.id || idx} className="border-b border-[#302117]/10 last:border-b-0 hover:bg-[#070402]/20 transition-colors">
                          <td className="py-2">{s.date}</td>
                          <td className="py-2 capitalize">{s.shift}</td>
                          <td className="py-2">Rs. {s.opening_cash}</td>
                          <td className="py-2">{s.closing_cash !== null ? `Rs. ${s.closing_cash}` : "Open"}</td>
                          <td className={`py-2 font-bold ${isDiscrepant ? "text-red-400" : "text-[#10B981]"}`}>
                            {s.difference !== null ? `Rs. ${s.difference}` : "--"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

        {/* Daily Miscellaneous Expenses Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#120a06]/45 backdrop-blur-xl border border-[#302117]/60 rounded-3xl p-6 flex flex-col gap-6"
        >
          <div>
            <h3 className="font-serif italic text-xl text-white">Daily Outgoings & Expenses</h3>
            <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Log minor cash/UPI branch expenses</p>
          </div>

          {/* Expenses logging form */}
          <form onSubmit={handleLogExpense} className="bg-[#070402]/30 border border-[#302117] rounded-2xl p-4 flex flex-col gap-3 font-mono text-xs">
            <h4 className="font-serif italic text-xs text-[#f8bc51] border-b border-[#302117]/40 pb-1.5 uppercase tracking-wider">Log Branch Expense</h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Outlay Amount (Rs.) *</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                  placeholder="e.g. 350"
                  className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Payment Method *</label>
                <select
                  value={expenseMethod}
                  onChange={(e) => setExpenseMethod(e.target.value)}
                  className="bg-[#070402] border border-[#302117] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                >
                  <option value="cash">Cash In Hand</option>
                  <option value="upi">UPI / Scanner</option>
                  <option value="card">Corporate Card</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Category *</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="bg-[#070402] border border-[#302117] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                >
                  <option value="utilities">Utilities & Aromas</option>
                  <option value="minor_repairs">Repairs & Filters</option>
                  <option value="supplier">Supplier Cash Out</option>
                  <option value="staff_break">Staff Meals / Tea</option>
                  <option value="others">Other Outlays</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Authorized Staff *</label>
                <select
                  value={expenseStaffId}
                  onChange={(e) => setExpenseStaffId(e.target.value)}
                  required
                  className="bg-[#070402] border border-[#302117] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors font-mono"
                >
                  <option value="">-- Choose Staff --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Expense Details *</label>
              <input
                type="text"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                required
                placeholder="Briefly state purchase details..."
                className="bg-[#070402] border border-[#302117] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f8bc51] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingExpense}
              className="bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] transition-colors rounded-lg py-2.5 font-bold uppercase tracking-widest text-[10px] mt-1"
            >
              {isLoggingExpense ? "Logging purchase..." : "Submit Expense"}
            </button>
          </form>

          {/* Expenses History Table */}
          <div className="bg-[#070402]/30 border border-[#302117] rounded-2xl p-4">
            <h4 className="font-serif italic text-xs text-[#f8bc51] border-b border-[#302117]/40 pb-1.5 uppercase tracking-wider mb-2">Daily Outgoings Ledger</h4>
            {expenses.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-[#d4c4b0]/30 font-mono italic">No expenses recorded.</div>
            ) : (
              <div className="max-h-[120px] overflow-y-auto pr-1">
                <table className="w-full font-mono text-[10px] text-[#d4c4b0]">
                  <thead>
                    <tr className="border-b border-[#302117]/40 text-[#f8bc51] uppercase text-left">
                      <th className="pb-1.5">Date</th>
                      <th className="pb-1.5">Category</th>
                      <th className="pb-1.5">Details</th>
                      <th className="pb-1.5">Method</th>
                      <th className="pb-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e, idx) => (
                      <tr key={e.id || idx} className="border-b border-[#302117]/10 last:border-b-0 hover:bg-[#070402]/20 transition-colors">
                        <td className="py-2">{e.date}</td>
                        <td className="py-2 capitalize">{e.category.replace('_', ' ')}</td>
                        <td className="py-2 max-w-[100px] truncate">{e.description}</td>
                        <td className="py-2 uppercase">{e.payment_method}</td>
                        <td className="py-2 text-red-400 font-bold">Rs. {e.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
