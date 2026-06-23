'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle, XCircle, Clock, FileText, Settings, Layers, Box } from 'lucide-react';
import { streamApprovals, updateApprovalStatus } from '@/lib/dbService';
import { ApprovalRequest } from '@/lib/types';

export default function ApprovalManagement() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = streamApprovals((data) => {
      setRequests(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAction = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await updateApprovalStatus(requestId, status);
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status.');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pastRequests = requests.filter(r => r.status !== 'pending');

  const getActionIcon = (action_type: string) => {
    switch(action_type) {
      case 'menu_edit': return <FileText size={16} className="text-[#f8bc51]" />;
      case 'staff_edit': return <ShieldCheck size={16} className="text-[#e8621a]" />;
      case 'stock_adjustment': return <Box size={16} className="text-[#a27b5c]" />;
      default: return <Settings size={16} className="text-[#d4c4b0]" />;
    }
  };

  const getActionLabel = (action_type: string) => {
    switch(action_type) {
      case 'menu_edit': return 'Menu Edit';
      case 'staff_edit': return 'Staff Modification';
      case 'stock_adjustment': return 'Stock Adjustment';
      default: return action_type;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 text-[#f7dec4]">
      <div>
        <h2 className="font-serif italic text-3xl font-black text-white">Approvals Queue</h2>
        <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-1">Review Manager Requests</p>
      </div>

      {loading ? (
        <div className="text-sm font-mono text-[#f8bc51] animate-pulse">Loading queue...</div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Pending Section */}
          <section>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-[#f8bc51]" /> 
              Pending Review ({pendingRequests.length})
            </h3>
            
            {pendingRequests.length === 0 ? (
              <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117]/60 rounded-xl p-8 text-center text-[#d4c4b0]/50 font-mono text-xs uppercase tracking-widest">
                No pending requests
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence>
                  {pendingRequests.map(req => (
                    <motion.div
                      key={req.request_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-[#120a06]/60 backdrop-blur-xl border border-[#f8bc51]/30 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#f8bc51]/50 shadow-[0_0_10px_rgba(248,188,81,0.5)]" />
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-[#302117]/40 p-2 rounded-lg border border-[#302117]/60">
                            {getActionIcon(req.action_type)}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-white">{getActionLabel(req.action_type)}</h4>
                            <p className="text-[10px] font-mono text-[#d4c4b0]/60 uppercase tracking-widest">Requested by {req.requested_by} • {new Date(req.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        {req.reason && (
                          <div className="mt-2 pl-12">
                            <p className="text-sm text-[#d4c4b0]/80 italic">"{req.reason}"</p>
                          </div>
                        )}
                        <div className="mt-2 pl-12">
                          <div className="bg-[#070402] border border-[#302117] rounded-lg p-3 text-xs font-mono text-[#d4c4b0]/70 overflow-x-auto max-w-full">
                            {JSON.stringify(req.payload)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-4 md:mt-0 self-end md:self-auto">
                        <button 
                          onClick={() => handleAction(req.request_id, 'rejected')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                        <button 
                          onClick={() => handleAction(req.request_id, 'approved')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-[#0A0604] bg-[#f8bc51] hover:bg-[#ffce7b] transition-colors shadow-[0_0_15px_rgba(248,188,81,0.2)]"
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Past History */}
          {pastRequests.length > 0 && (
            <section>
              <h3 className="text-lg font-bold text-white mb-4 opacity-80">History</h3>
              <div className="grid grid-cols-1 gap-3">
                {pastRequests.map(req => (
                  <div
                    key={req.request_id}
                    className="bg-[#120a06]/30 backdrop-blur-xl border border-[#302117]/40 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-3">
                       <div className="bg-[#302117]/20 p-2 rounded-lg border border-[#302117]/40">
                         {getActionIcon(req.action_type)}
                       </div>
                       <div>
                         <h4 className="text-sm font-bold text-[#d4c4b0]">{getActionLabel(req.action_type)}</h4>
                         <p className="text-[9px] font-mono text-[#d4c4b0]/40 uppercase tracking-widest">{new Date(req.timestamp).toLocaleString()}</p>
                       </div>
                    </div>
                    <div className="flex items-center">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                        req.status === 'approved' ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
