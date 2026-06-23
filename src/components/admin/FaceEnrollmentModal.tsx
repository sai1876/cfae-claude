'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { X, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
  onSuccess: () => void;
}

export default function FaceEnrollmentModal({ isOpen, onClose, staffId, staffName, onSuccess }: Props) {
  const [enrollSessionId, setEnrollSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && staffId) {
      const sid = 'enroll_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      setEnrollSessionId(sid);
      
      setDoc(doc(db, 'scan_sessions', sid), {
        status: 'pending',
        type: 'enroll',
        staff_id: staffId,
        created_at: Date.now()
      }).catch(console.error);
    } else {
      setEnrollSessionId(null);
    }
  }, [isOpen, staffId]);

  useEffect(() => {
    if (isOpen && enrollSessionId) {
      const unsubscribe = onSnapshot(doc(db, 'scan_sessions', enrollSessionId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'success') {
            onSuccess();
            onClose();
          }
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen, enrollSessionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#120a06] border border-[#302117] rounded-3xl p-6 md:p-8 max-w-md w-full relative overflow-hidden shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-[#d4c4b0]/60 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          <div>
            <h3 className="text-xl font-serif italic text-[#f8bc51] font-bold">Enroll Biometrics</h3>
            <p className="text-[10px] font-mono text-[#d4c4b0]/60 uppercase tracking-widest mt-1">
              Registering: {staffName}
            </p>
          </div>

          <div className="bg-white p-4 rounded-3xl mx-auto shadow-[0_0_30px_rgba(248,188,81,0.2)] mt-4">
            <QRCodeSVG 
              value={`http://192.168.1.188:3000/scanner?session_id=${enrollSessionId}`}
              size={220}
              level="H"
              includeMargin={false}
              fgColor="#0A0604"
            />
          </div>

          <div className="mt-2">
            <h3 className="text-sm font-mono text-[#f8bc51] font-bold flex justify-center items-center gap-2">
              <QrCode size={16} />
              High-Res Mobile Capture
            </h3>
            <p className="text-[10px] font-mono text-[#d4c4b0]/60 uppercase tracking-widest mt-2 px-4 leading-relaxed">
              Scan with your phone to use its high-resolution camera for biometric registration.
            </p>
          </div>
          
          <div className="mt-2 bg-[#f8bc51]/10 border border-[#f8bc51]/30 py-2 px-6 rounded-xl">
             <a 
               href={`http://192.168.1.188:3000/scanner?session_id=${enrollSessionId}`}
               target="_blank"
               rel="noreferrer"
               className="text-[#f8bc51] font-mono text-[9px] uppercase tracking-widest hover:underline flex justify-center items-center gap-1"
             >
               Open on this PC (Testing)
             </a>
          </div>
        </div>
      </div>
    </div>
  );
}
