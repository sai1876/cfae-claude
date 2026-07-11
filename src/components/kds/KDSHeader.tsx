'use client';

import { useState, useEffect } from 'react';

export default function KDSHeader({ station, orderCount }: { station: string, orderCount: number }) {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-[80px] bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center gap-6">
        <h1 className="font-sans font-black text-4xl text-white uppercase tracking-wider">
          {station}
        </h1>
        <div className="h-8 w-px bg-[#444]" />
        <span className="bg-[#333] px-4 py-1.5 rounded-full text-amber-400 font-bold text-lg">
          {orderCount} Orders
        </span>
      </div>
      
      <div className="font-mono text-4xl font-bold text-gray-300 tracking-widest">
        {time}
      </div>
    </header>
  );
}
