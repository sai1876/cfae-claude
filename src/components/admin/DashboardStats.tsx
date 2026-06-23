'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingBag, Users, Clock, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { streamTelemetryData, fetchOutlets } from '@/lib/dbService';
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

  useEffect(() => {
    fetchOutlets().then(setOutlets);
  }, []);

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
    </div>
  );
}
