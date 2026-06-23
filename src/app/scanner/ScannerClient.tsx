'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function MobileScanner() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<'verify' | 'enroll'>('verify');
  const [enrollStaffId, setEnrollStaffId] = useState<string | null>(null);
  const [riderDescriptor, setRiderDescriptor] = useState<Float32Array | null>(null);
  const [status, setStatus] = useState<'initializing' | 'loading_models' | 'fetching_rider' | 'scanning' | 'success' | 'failed' | 'expired'>('initializing');
  const [errorMsg, setErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    if (sid) {
      setSessionId(sid);
      initializeScanner(sid);
    } else {
      setStatus('expired');
      setErrorMsg('Invalid QR Code. No session ID found.');
    }
    
    return () => {
      stopCamera();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'scanning') {
      stopCamera();
      startCamera();
    }
  }, [facingMode]);

  const initializeScanner = async (sid: string) => {
    try {
      setStatus('loading_models');
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);

      setStatus('fetching_rider');
      const sessionRef = doc(db, 'scan_sessions', sid);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) {
        setStatus('expired');
        setErrorMsg('Session expired or not found.');
        return;
      }
      const data = sessionSnap.data();
      
      if (data.status !== 'pending') {
        setStatus('expired');
        setErrorMsg('Session already completed.');
        return;
      }

      if (data.type === 'enroll') {
        if (!data.staff_id) {
          setStatus('expired');
          setErrorMsg('Invalid session data. No staff attached.');
          return;
        }
        setSessionType('enroll');
        setEnrollStaffId(data.staff_id);
        setStatus('scanning');
        startCamera();
        return;
      }

      if (!data.rider_id) {
        setStatus('expired');
        setErrorMsg('Invalid session data. No rider attached.');
        return;
      }

      const riderRef = doc(db, 'staff', data.rider_id);
      const riderSnap = await getDoc(riderRef);
      if (!riderSnap.exists()) {
        setStatus('expired');
        setErrorMsg('Rider has not enrolled biometrics. Please use Passcode fallback.');
        await updateDoc(sessionRef, { status: 'failed', updated_at: Date.now() });
        return;
      }
      const riderData = riderSnap.data();
      if (!riderData || !riderData.faceDescriptor) {
        setStatus('expired');
        setErrorMsg('Rider has not enrolled biometrics. Please use Passcode fallback.');
        await updateDoc(sessionRef, { status: 'failed', updated_at: Date.now() });
        return;
      }

      setRiderDescriptor(new Float32Array(riderData.faceDescriptor));
      setStatus('scanning');
      startCamera();
    } catch (e) {
      console.error(e);
      setStatus('failed');
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
        
        // Start recognition loop
        intervalRef.current = setInterval(performRecognition, 1000);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Camera error: ${errorMessage}`);
      setStatus('failed');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const performRecognition = async () => {
    // Only perform if scanning
    if (!videoRef.current || status === 'success' || status === 'failed') return;

    try {
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
      if (detection) {
        if (sessionType === 'enroll' && enrollStaffId) {
          const descriptorArray = Array.from(detection.descriptor);
          const staffRef = doc(db, 'staff', enrollStaffId);
          await updateDoc(staffRef, {
            faceDescriptor: descriptorArray
          });
          sendResult('success');
          return;
        }

        if (sessionType === 'verify' && riderDescriptor) {
          const distance = faceapi.euclideanDistance(detection.descriptor, riderDescriptor);
          if (distance < 0.55) {
            sendResult('success');
          }
        }
      }
    } catch (e) {
      console.error("Detection error:", e);
    }
  };

  const sendResult = async (result: 'success' | 'failed') => {
    if (!sessionId) return;
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus(result);
    stopCamera();
    
    try {
      const sessionRef = doc(db, 'scan_sessions', sessionId);
      await updateDoc(sessionRef, {
        status: result,
        updated_at: Date.now()
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070402] text-white flex flex-col font-sans">
      <header className="p-5 border-b border-[#302117] flex justify-center items-center bg-[#120a06]">
        <h1 className="font-serif italic text-[#f8bc51] text-2xl font-black">Hau Hau AI Scanner</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {status === 'initializing' && (
          <div className="flex flex-col items-center text-[#d4c4b0]/50 gap-4">
            <RefreshCw className="animate-spin" size={32} />
            <span className="font-mono text-xs uppercase tracking-widest">Connecting to session...</span>
          </div>
        )}
        
        {status === 'loading_models' && (
          <div className="flex flex-col items-center text-[#f8bc51] gap-4">
            <RefreshCw className="animate-spin" size={32} />
            <span className="font-mono text-xs uppercase tracking-widest">Loading Neural Networks...</span>
          </div>
        )}

        {status === 'fetching_rider' && (
          <div className="flex flex-col items-center text-[#60A5FA] gap-4">
            <RefreshCw className="animate-spin" size={32} />
            <span className="font-mono text-xs uppercase tracking-widest">Fetching Rider Profile...</span>
          </div>
        )}

        {status === 'expired' && (
          <div className="flex flex-col items-center text-red-400 gap-4 text-center">
            <AlertTriangle size={48} />
            <h2 className="text-xl font-bold font-mono">Invalid Session</h2>
            <p className="text-sm font-mono opacity-70">{errorMsg}</p>
          </div>
        )}

        {status === 'scanning' && (
          <div className="flex flex-col items-center w-full h-full justify-between gap-8">
            <div className="text-center">
              <h2 className="font-mono uppercase tracking-widest text-sm text-[#60A5FA]">
                {sessionType === 'enroll' ? 'Biometric Enrollment' : 'Identity Verification'}
              </h2>
              <p className="text-[#d4c4b0]/60 text-xs mt-2 font-mono">
                {sessionType === 'enroll' ? 'AI Active. Hold still to register face.' : 'AI Active. Look at the camera.'}
              </p>
            </div>
            
            <div className="relative w-full max-w-sm aspect-[3/4] bg-[#120a06] rounded-3xl overflow-hidden border-4 border-[#60A5FA] shadow-[0_0_50px_rgba(96,165,250,0.2)]">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover bg-black"
              />
              
              <div className="absolute inset-0 border-2 border-[#60A5FA] rounded-3xl animate-ping opacity-10 pointer-events-none"></div>
              <div className="absolute top-0 left-0 w-full h-[3px] bg-[#60A5FA] shadow-[0_0_15px_#60A5FA] pointer-events-none" style={{ animation: 'scan 1.5s linear infinite' }}>
                <style>{`
                  @keyframes scan {
                    0% { top: 0%; }
                    50% { top: 98%; }
                    100% { top: 0%; }
                  }
                `}</style>
              </div>

              {!streamRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <span className="font-mono text-xs uppercase tracking-widest text-[#60A5FA] animate-pulse">Waiting for camera...</span>
                </div>
              )}
            </div>
            
            {/* Fail button kept for hard overrides/testing timeout manually if needed */}
            <div className="w-full max-w-sm flex gap-4">
              <button 
                onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                className="w-1/2 bg-[#1e1511] hover:bg-[#302117] text-[#f8bc51] border border-[#f8bc51]/30 py-4 rounded-2xl font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw size={20} /> Flip
              </button>
              <button 
                onClick={() => sendResult('failed')}
                className="w-1/2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-4 rounded-2xl font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <XCircle size={20} /> Fail
              </button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center text-[#10B981] gap-6 text-center bg-[#10B981]/5 border border-[#10B981]/20 p-10 rounded-3xl">
            <CheckCircle size={64} className="animate-bounce" />
            <div>
              <h2 className="text-2xl font-bold font-mono uppercase tracking-widest">
                {sessionType === 'enroll' ? 'Face Registered' : 'Match Confirmed'}
              </h2>
              <p className="text-xs font-mono text-[#d4c4b0]/70 mt-2 uppercase">
                {sessionType === 'enroll' ? 'Biometrics successfully saved.' : 'The terminal has been authorized.'}
              </p>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center text-red-400 gap-6 text-center bg-red-500/5 border border-red-500/20 p-10 rounded-3xl">
            <XCircle size={64} className="animate-pulse" />
            <div>
              <h2 className="text-2xl font-bold font-mono uppercase tracking-widest">Scan Failed</h2>
              <p className="text-xs font-mono text-[#d4c4b0]/70 mt-4 break-words">
                {errorMsg || 'The terminal has registered a failure.'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
