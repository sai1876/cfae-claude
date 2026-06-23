'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Sparkles, Send, MessageSquare, TrendingUp, CheckCircle, RefreshCw } from 'lucide-react';

interface Patron {
  id: string;
  name: string;
  phone: string;
  visits: number;
  spending: number;
  lastVisitDaysAgo: number;
  status: 'loyal' | 'slipping' | 'churned';
  preferredItem: string;
}

export default function CRMManagement({ initialFilter = 'all' }: { initialFilter?: 'all' | 'loyal' }) {
  const [patrons] = useState<Patron[]>([
    { id: 'p_1', name: 'Cheru', phone: '+91 98765 43210', visits: 12, spending: 2160, lastVisitDaysAgo: 2, status: 'loyal', preferredItem: 'Hau Hau Special Biryani' },
    { id: 'p_2', name: 'Arjun Rao', phone: '+91 91234 56789', visits: 3, spending: 340, lastVisitDaysAgo: 9, status: 'slipping', preferredItem: 'Iced Latte' },
    { id: 'p_3', name: 'Priya Sharma', phone: '+91 98123 45678', visits: 15, spending: 2980, lastVisitDaysAgo: 4, status: 'loyal', preferredItem: 'Steamed Chicken Momos' },
    { id: 'p_4', name: 'Siddharth M', phone: '+91 99456 78901', visits: 1, spending: 60, lastVisitDaysAgo: 24, status: 'churned', preferredItem: 'Classic Fries' },
  ]);

  const [selectedPatron, setSelectedPatron] = useState<Patron | null>(null);
  const [promptTone, setPromptTone] = useState<'cozy' | 'exotic' | 'urgent'>('cozy');
  const [draftMessage, setDraftMessage] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [transmissionStatus, setTransmissionStatus] = useState<'idle' | 'transmitting' | 'success'>('idle');

  // Trigger Gemini-driven draft message (Local fallback if Gemini API is empty)
  const handleDraftMessage = () => {
    if (!selectedPatron) return;
    setDrafting(true);
    
    setTimeout(() => {
      let draft = '';
      if (promptTone === 'cozy') {
        draft = `☕ Hey ${selectedPatron.name}! We noticed it's been ${selectedPatron.lastVisitDaysAgo} days since we last saw you at the Hau Hau Canopy. We've got a fresh batch of your favorite "${selectedPatron.preferredItem}" steaming hot. Here's a custom code: COZY_Hau Hau for 20% off your next visit. Warm up with us today!`;
      } else if (promptTone === 'exotic') {
        draft = `✨ Salutations ${selectedPatron.name}! Elevate your campus afternoon with a delicious culinary retreat. It's been over a week, and your beloved "${selectedPatron.preferredItem}" is calling you. Tap coupon exotic code ESCAPE_Hau Hau for a free upgrade to Large size. Let's make it a premium day!`;
      } else {
        draft = `⚠️ Flash Deal for ${selectedPatron.name}! We miss your vibrant energy at Oasis Hub. For the next 24 HOURS only, score a flat 30% discount on "${selectedPatron.preferredItem}" using the coupon code RUSH_Hau Hau. Quick, grab yours before the queue peaks!`;
      }
      setDraftMessage(draft);
      setDrafting(false);
    }, 1500);
  };

  const handleTransmit = () => {
    if (!draftMessage) return;
    setTransmissionStatus('transmitting');
    setTimeout(() => {
      setTransmissionStatus('success');
      setTimeout(() => {
        setTransmissionStatus('idle');
        setDraftMessage('');
        setSelectedPatron(null);
      }, 3000);
    }, 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[#f7dec4]">
      {/* Customer lifetime radar */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h2 className="font-serif italic text-2xl text-white">Patron Lifetime Value Radar</h2>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">AI Retention Engine & Cohorts</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#f8bc51] font-mono bg-[#302117]/45 px-3 py-1 border border-[#302117] rounded-xl">
              <TrendingUp size={13} />
              CLV Active
            </div>
          </div>

          {/* Grid list of customers */}
          <div className="flex flex-col gap-3">
            {patrons
              .filter(p => initialFilter === 'all' || (initialFilter === 'loyal' && p.status === 'loyal'))
              .map((patron) => {
              const isSlipping = patron.status === 'slipping' || patron.status === 'churned';
              return (
                <div
                  key={patron.id}
                  onClick={() => { setSelectedPatron(patron); setDraftMessage(''); }}
                  className={`bg-[#070402]/30 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 cursor-pointer ${
                    selectedPatron?.id === patron.id 
                      ? 'border-[#f8bc51] bg-[#f8bc51]/5 shadow-[0_0_15px_rgba(248,188,81,0.08)]' 
                      : 'border-[#302117] hover:border-[#f8bc51]/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      patron.status === 'loyal' 
                        ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' 
                        : patron.status === 'slipping'
                        ? 'bg-[#e8621a]/10 border-[#e8621a]/20 text-[#e8621a]'
                        : 'bg-[#504536]/20 border-[#504536]/30 text-[#d4c4b0]/60'
                    }`}>
                      <Users size={16} />
                    </div>
                    <div>
                      <h4 className="font-serif italic text-base text-white font-bold leading-tight flex items-center gap-2">
                        {patron.name}
                        {isSlipping && (
                          <span className="bg-[#e8621a]/15 text-[#e8621a] border border-[#e8621a]/25 px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider">
                            {patron.visits === 3 ? 'AI ALERT: SLIPPING' : 'CHURN RISK'}
                          </span>
                        )}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2.5 font-mono text-[9px] text-[#d4c4b0]/50 uppercase mt-1">
                        <span>Visits: {patron.visits}</span>
                        <span>&bull;</span>
                        <span>Spend: ₹{patron.spending}</span>
                        <span>&bull;</span>
                        <span>Favorite: {patron.preferredItem}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    <div className="text-right">
                      <p className="font-mono text-xs text-[#d4c4b0]/70 font-semibold">{patron.lastVisitDaysAgo} days ago</p>
                      <p className="font-mono text-[8px] text-[#d4c4b0]/40 uppercase mt-0.5">Last interaction</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Right Column - Gemini CRM message builder */}
      <div className="flex flex-col gap-6">
        
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-5 relative overflow-hidden">
          
          {/* Glass mesh background */}
          <div className="absolute top-[-20%] right-[-20%] w-32 h-32 bg-[#f8bc51]/5 rounded-full filter blur-xl" />

          <div className="flex items-center justify-between border-b border-[#302117]/60 pb-2">
            <h3 className="font-serif italic text-lg text-white">Gemini Activator Console</h3>
            <Sparkles size={14} className="text-[#f8bc51]" />
          </div>

          {selectedPatron ? (
            <div className="flex flex-col gap-4">
              {/* Patron Card brief */}
              <div className="bg-[#070402] border border-[#302117] p-3 rounded-xl flex items-center justify-between">
                <div className="font-mono text-[10px]">
                  <p className="text-white font-bold">{selectedPatron.name}</p>
                  <p className="text-[#d4c4b0]/60 mt-0.5">Prefers: {selectedPatron.preferredItem}</p>
                </div>
                <span className="text-[9px] text-[#f8bc51] font-mono border border-[#f8bc51]/30 bg-[#f8bc51]/5 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Active context</span>
              </div>

              {/* Tone settings selector */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]">Select Campaign Tone</span>
                <div className="grid grid-cols-3 gap-2 bg-[#060403] border border-[#302117] p-1 rounded-xl text-[10px] font-mono">
                  <button
                    onClick={() => setPromptTone('cozy')}
                    className={`py-1.5 rounded-lg transition-colors font-bold ${promptTone === 'cozy' ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
                  >
                    Cozy
                  </button>
                  <button
                    onClick={() => setPromptTone('exotic')}
                    className={`py-1.5 rounded-lg transition-colors font-bold ${promptTone === 'exotic' ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
                  >
                    Exotic
                  </button>
                  <button
                    onClick={() => setPromptTone('urgent')}
                    className={`py-1.5 rounded-lg transition-colors font-bold ${promptTone === 'urgent' ? 'bg-[#f8bc51] text-[#0A0604]' : 'text-[#d4c4b0] hover:text-white'}`}
                  >
                    Urgent
                  </button>
                </div>
              </div>

              {/* Action Draft trigger */}
              <button
                onClick={handleDraftMessage}
                disabled={drafting}
                className="w-full border border-[#f8bc51]/40 text-[#f8bc51] hover:bg-[#f8bc51]/5 rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              >
                {drafting ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Synthesizing text...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Draft Activator Offer
                  </>
                )}
              </button>

              {/* Message Draft visualizer text area */}
              <AnimatePresence>
                {draftMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-3 pt-2 border-t border-[#302117]/30"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#d4c4b0]/60">Draft Preview</span>
                      <textarea
                        rows={5}
                        value={draftMessage}
                        onChange={(e) => setDraftMessage(e.target.value)}
                        className="w-full bg-[#070402] border border-[#302117] rounded-xl p-3 text-xs text-white leading-relaxed resize-none focus:outline-none focus:border-[#f8bc51]"
                      />
                    </div>

                    {/* Transmission Row */}
                    <button
                      onClick={handleTransmit}
                      disabled={transmissionStatus !== 'idle'}
                      className={`w-full rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                        transmissionStatus === 'transmitting'
                          ? 'bg-[#302117] text-[#d4c4b0] border border-[#302117]'
                          : transmissionStatus === 'success'
                          ? 'bg-[#10B981] text-white'
                          : 'bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] shadow-lg shadow-[#f8bc51]/10'
                      }`}
                    >
                      {transmissionStatus === 'transmitting' ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          Broadcasting mock sms/email...
                        </>
                      ) : transmissionStatus === 'success' ? (
                        <>
                          <CheckCircle size={12} />
                          Dispatched successfully!
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          Transmit Alert Offer
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10 border border-dashed border-[#302117] rounded-2xl bg-[#070402]/20 text-center">
              <MessageSquare className="text-[#d4c4b0]/35 w-8 h-8" />
              <div className="max-w-[200px]">
                <p className="text-white text-xs font-semibold">Select a slipping patron</p>
                <p className="text-[10px] text-[#d4c4b0]/50 mt-1 leading-relaxed">Choose a patron from the list to analyze their cohort and draft marketing offers!</p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
