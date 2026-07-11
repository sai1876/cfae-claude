'use client';

import dynamic from 'next/dynamic';

const ScannerClient = dynamic(() => import('./ScannerClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#070402] text-white flex flex-col items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#f8bc51] border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-xs text-[#f8bc51] uppercase tracking-widest animate-pulse">Loading AI Scanner...</p>
      </div>
    </div>
  )
});

export default function ScannerPage() {
  return <ScannerClient />;
}
