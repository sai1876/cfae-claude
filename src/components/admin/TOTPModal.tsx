import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFriendlyErrorMessage } from '@/lib/utils';

interface TOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  title: string;
  description?: string;
}

export default function TOTPModal({ isOpen, onClose, onVerify, title, description }: TOTPModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    
    setLoading(true);
    setError(null);
    try {
      await onVerify(code);
      setCode('');
      onClose();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0604]/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#120a06] border border-[#f8bc51]/40 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#d4c4b0]/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center gap-4 text-center mt-2">
            <div className="w-14 h-14 rounded-2xl bg-[#f8bc51]/10 border border-[#f8bc51]/20 flex items-center justify-center text-[#f8bc51]">
              <ShieldAlert size={28} />
            </div>
            
            <div>
              <h2 className="font-serif italic text-2xl font-bold text-[#f8bc51]">{title}</h2>
              <p className="text-xs text-[#d4c4b0]/70 mt-1.5 leading-relaxed">
                {description || "This action requires authorization. Please enter your 6-digit Google Authenticator code."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 mt-2">
              <input
                type="text"
                autoFocus
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="bg-[#070402] border border-[#f8bc51]/50 rounded-xl px-4 py-4 text-3xl text-center text-white focus:outline-none tracking-[0.5em] font-mono w-full"
              />

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl text-xs text-center font-mono">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 rounded-xl py-3.5 font-mono font-bold text-xs uppercase tracking-widest transition-colors mt-2"
              >
                {loading ? 'Verifying...' : 'Authorize Action'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
