'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Lock, Mail, Users, ArrowRight, Key } from 'lucide-react';
import { sendOTPCode, loginCustomer, signupCustomer } from '@/lib/authService';
import { useStore } from '@/store/useStore';
import { getUserProfile, createUserProfile } from '@/lib/dbService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import fpPromise from '@fingerprintjs/fingerprintjs';
import { getFriendlyErrorMessage } from '@/lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { setUser, setUserProfile } = useStore();
  
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  
  // Form fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [referral, setReferral] = useState('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    // 1. Check for referral code in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
        setReferral(refCode.toUpperCase());
      }

      // 2. Initialize FingerprintJS
      const getFingerprint = async () => {
        const fp = await fpPromise.load();
        const result = await fp.get();
        setDeviceId(result.visitorId);
      };
      getFingerprint();
    }
  }, []);

  // UI state variables
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [otpError, setOtpError] = useState('');

  const handlePhoneChange = (val: string) => {
    const sanitized = val.replace(/[^0-9]/g, '');
    setPhone(sanitized);
    if (sanitized && sanitized.length !== 10) {
      setPhoneError('Please enter a valid 10-digit phone number');
    } else {
      setPhoneError('');
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val && val.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (val && val.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
    } else {
      setNameError('');
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (val) {
      const isStudent = val.endsWith('.edu') || val.endsWith('.ac.in') || val.endsWith('.edu.in');
      const isValid = /\S+@\S+\.\S+/.test(val);
      if (!isValid) {
        setEmailError('Please enter a valid email address');
      } else if (!isStudent) {
        setEmailError('Preferred: Student email (.edu, .ac.in)');
      } else {
        setEmailError('');
      }
    } else {
      setEmailError('');
    }
  };

  const handleOtpChange = (val: string) => {
    const sanitized = val.replace(/[^0-9]/g, '');
    setOtp(sanitized);
    if (sanitized && sanitized.length !== 6) {
      setOtpError('OTP code must be 6 digits');
    } else {
      setOtpError('');
    }
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (isOpen) {
      setTab('login');
      setStep('phone');
      setPhone('');
      setPassword('');
      setName('');
      setOtp('');
      setEmail('');
      setReferral('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!password || password.length < 6) {
      setError('Please enter a valid password (min 6 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sanitizedPhone = phone.replace(/[^0-9]/g, "");
      const q = query(collection(db, 'users'), where("phone", "==", sanitizedPhone));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Incorrect phone number or password.');
        setLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.student_email || userData.email;
      if (!userEmail) {
        setError('Incorrect phone number or password.');
        setLoading(false);
        return;
      }

      const authResult = await loginCustomer(userEmail, password);
      await completeAuth(authResult.uid);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Incorrect phone number or password.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if phone already exists in Firestore before sending OTP
      const sanitizedPhone = phone.replace(/[^0-9]/g, "");
      const q = query(collection(db, 'users'), where("phone", "==", sanitizedPhone));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setError('An account with this phone number already exists. Please Sign In.');
        setLoading(false);
        return;
      }

      const code = await sendOTPCode(phone);
      setGeneratedCode(code);
      setStep('otp');
      setCountdown(30);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Enter the 6-digit verification code');
      return;
    }

    if (otp !== generatedCode) {
      setError('Incorrect verification code. Please check again.');
      return;
    }

    // OTP Verified! Move to profile setup
    setError('');
    setStep('profile');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!password || password.length < 6) {
      setError('Please enter a secure password (min 6 characters)');
      return;
    }
    if (!email || !email.trim()) {
      setError('Email address is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const authResult = await signupCustomer(phone, name, password, email, referral, deviceId);
      await completeAuth(authResult.uid);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email address already exists. Please Sign In or use another email.');
      } else if (err.code === 'auth/phone-already-in-use') {
        setError('An account with this phone number already exists. Please Sign In.');
      } else if (err.code === 'auth/device-limit-reached') {
        setError('Maximum account limit reached for this device. Please use an existing account.');
      } else {
        setError('Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const completeAuth = async (uid: string) => {
    let profile = await getUserProfile(uid);
    if (!profile) {
      // Self-heal: create Firestore user profile using state data
      console.log(`[AUTH SELF-HEAL] No Firestore profile found for UID ${uid}. Creating one...`);
      profile = await createUserProfile(uid, phone, name || "Oasis Patron", email || undefined, referral || undefined);
    }
    if (profile) {
      setUser({ uid, phone: profile.phone || phone });
      setUserProfile(profile);

      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([100, 50, 100]);
      }

      if (onSuccess) onSuccess();
      onClose();
    } else {
      setError('Failed to load user profile.');
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-45%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-45%' }}
            className="fixed top-1/2 left-1/2 z-[110] w-[calc(100%-32px)] max-w-[420px] bg-Hau Hau-surface-container/90 backdrop-blur-2xl rounded-3xl border border-Hau Hau-outline-variant shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-Hau Hau-gold/5 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-Hau Hau-canopy/10 blur-3xl rounded-full pointer-events-none" />

            {/* Tabs */}
            <div className="flex border-b border-Hau Hau-outline-variant/30">
              <button
                onClick={() => { setTab('login'); setStep('phone'); setError(''); }}
                className={`flex-1 py-4 text-xs font-mono tracking-widest uppercase transition-colors ${tab === 'login' ? 'text-Hau Hau-gold border-b-2 border-Hau Hau-gold' : 'text-Hau Hau-on-surface-variant hover:text-Hau Hau-cream'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab('signup'); setStep('phone'); setError(''); }}
                className={`flex-1 py-4 text-xs font-mono tracking-widest uppercase transition-colors ${tab === 'signup' ? 'text-Hau Hau-gold border-b-2 border-Hau Hau-gold' : 'text-Hau Hau-on-surface-variant hover:text-Hau Hau-cream'}`}
              >
                Create Account
              </button>
            </div>

            <div className="p-8 relative z-10 overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-Hau Hau-gold mb-1 block">Oasis Sanctuary</span>
                  <h3 className="font-serif italic text-3xl text-Hau Hau-cream">
                    {tab === 'login' ? 'Welcome Back' : 'Join Hau Hau'}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-Hau Hau-surface-bright rounded-full text-Hau Hau-on-surface-variant hover:text-Hau Hau-cream transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs font-mono">
                  ⚠️ {error}
                </div>
              )}

              {/* Login View */}
              {tab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between">
                      <span>Mobile Number</span>
                      <span className="text-[10px] text-[#f8bc51] lowercase font-mono">e.g. 9876543210</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="e.g. 9876543210"
                        maxLength={10}
                        className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border ${
                          phone 
                            ? 'border-[#f8bc51]/40 text-white' 
                            : 'border-Hau Hau-outline-variant/20'
                        } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
                        disabled={loading}
                      />
                    </div>
                    {phoneError && <span className="text-[10px] text-red-400 font-mono mt-1 block">{phoneError}</span>}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between">
                      <span>Password</span>
                      <span className="text-[10px] text-[#f8bc51] lowercase font-mono">min 6 chars</span>
                    </label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        placeholder="e.g. ••••••••"
                        className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border ${
                          password 
                            ? 'border-[#f8bc51]/40 text-white' 
                            : 'border-Hau Hau-outline-variant/20'
                        } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20 tracking-widest`}
                        disabled={loading}
                      />
                    </div>
                    {passwordError && <span className="text-[10px] text-red-400 font-mono mt-1 block">{passwordError}</span>}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-Hau Hau-gold text-Hau Hau-surface font-bold rounded-xl hover:shadow-[0_0_20px_rgba(248,188,81,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                    disabled={loading}
                  >
                    {loading ? 'Authenticating...' : 'Sign In'}
                    {!loading && <ArrowRight size={18} />}
                  </button>
                </form>
              )}

              {/* Signup View */}
              {tab === 'signup' && (
                <>
                  {/* Step 1: Input Phone */}
                  {step === 'phone' && (
                    <form onSubmit={handleSendOTP} className="space-y-5">
                      <div className="space-y-2">
                        <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between">
                          <span>Mobile Number</span>
                          <span className="text-[10px] text-[#f8bc51] lowercase font-mono">e.g. 9876543210</span>
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                          <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="e.g. 9876543210"
                            maxLength={10}
                            className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border ${
                              phone 
                                ? 'border-[#f8bc51]/40 text-white' 
                                : 'border-Hau Hau-outline-variant/20'
                            } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
                            disabled={loading}
                          />
                        </div>
                        {phoneError && <span className="text-[10px] text-red-400 font-mono mt-1 block">{phoneError}</span>}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 bg-Hau Hau-gold text-Hau Hau-surface font-bold rounded-xl hover:shadow-[0_0_20px_rgba(248,188,81,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        disabled={loading}
                      >
                        {loading ? 'Transmitting code...' : 'Generate OTP'}
                        {!loading && <ArrowRight size={18} />}
                      </button>
                    </form>
                  )}

                  {/* Step 2: Verification */}
                  {step === 'otp' && (
                    <form onSubmit={handleVerifyOTP} className="space-y-5">
                      <div className="space-y-2">
                        <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between">
                          <span>Verification Code</span>
                          {countdown > 0 ? (
                            <span className="text-Hau Hau-gold text-[10px]">Resend in {countdown}s</span>
                          ) : (
                            <span className="text-[10px] text-[#f8bc51] lowercase font-mono">e.g. 123456</span>
                          )}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                          <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={otp}
                            onChange={(e) => handleOtpChange(e.target.value)}
                            placeholder="e.g. 123456"
                            maxLength={6}
                            className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border tracking-[0.3em] font-mono text-center text-lg ${
                              otp 
                                ? 'border-[#f8bc51]/40 text-white' 
                                : 'border-Hau Hau-outline-variant/20'
                            } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
                            disabled={loading}
                          />
                        </div>
                        {otpError && <span className="text-[10px] text-red-400 font-mono mt-1 block">{otpError}</span>}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 bg-Hau Hau-gold text-Hau Hau-surface font-bold rounded-xl hover:shadow-[0_0_20px_rgba(248,188,81,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        disabled={loading}
                      >
                        {loading ? 'Verifying...' : 'Verify OTP'}
                        {!loading && <ArrowRight size={18} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setStep('phone')}
                        className="w-full text-center text-xs text-Hau Hau-on-surface-variant/60 hover:text-Hau Hau-cream transition-colors mt-2 block"
                        disabled={loading}
                      >
                        ← Change Phone Number
                      </button>
                    </form>
                  )}

                  {/* Step 3: Setup Profile */}
                  {step === 'profile' && (
                    <form onSubmit={handleSignup} className="space-y-5">
                      <div className="space-y-2">
                        <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between">
                          <span>Full Name</span>
                          <span className="text-[10px] text-[#f8bc51] lowercase font-mono">e.g. Rohan Sharma</span>
                        </label>
                        <div className="relative">
                          <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                          <input
                            type="text"
                            autoComplete="name"
                            autoCapitalize="words"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="e.g. Rohan Sharma"
                            className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border ${
                              name 
                                ? 'border-[#f8bc51]/40 text-white' 
                                : 'border-Hau Hau-outline-variant/20'
                            } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
                            disabled={loading}
                            required
                          />
                        </div>
                        {nameError && <span className="text-[10px] text-red-400 font-mono mt-1 block">{nameError}</span>}
                      </div>

                      <div className="space-y-2">
                        <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between">
                          <span>Create Password</span>
                          <span className="text-[10px] text-[#f8bc51] lowercase font-mono">min 6 chars</span>
                        </label>
                        <div className="relative">
                          <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => handlePasswordChange(e.target.value)}
                            placeholder="e.g. ••••••••"
                            className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border ${
                              password 
                                ? 'border-[#f8bc51]/40 text-white' 
                                : 'border-Hau Hau-outline-variant/20'
                            } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20 tracking-widest`}
                            disabled={loading}
                          />
                        </div>
                        {passwordError && <span className="text-[10px] text-red-400 font-mono mt-1 block">{passwordError}</span>}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between w-full">
                            <span>Email Address</span>
                            <span className="text-[10px] text-[#f8bc51] lowercase font-mono">e.g. rohan.sharma@domain.edu</span>
                          </label>
                        </div>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                          <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            placeholder="e.g. rohan.sharma@domain.edu"
                            className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border ${
                              email 
                                ? 'border-[#f8bc51]/40 text-white' 
                                : 'border-Hau Hau-outline-variant/20'
                            } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
                            disabled={loading}
                            required
                          />
                        </div>
                        {emailError && <span className="text-[10px] text-red-400 font-mono mt-1 block">{emailError}</span>}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="font-mono text-xs text-Hau Hau-on-surface-variant uppercase tracking-widest flex justify-between w-full">
                            <span>Referral Code (Optional)</span>
                            <span className="text-[10px] text-[#f8bc51] lowercase font-mono">e.g. HAUHAU12</span>
                          </label>
                        </div>
                        <div className="relative">
                          <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-Hau Hau-on-surface-variant" size={18} />
                          <input
                            type="text"
                            value={referral}
                            onChange={(e) => setReferral(e.target.value.toUpperCase())}
                            placeholder="e.g. HAUHAU12"
                            className={`w-full bg-[#0d0906]/60 rounded-xl py-4 pl-12 pr-4 text-[#f7dec4] placeholder-[#d4c4b0]/30 outline-none transition-all border uppercase tracking-widest ${
                              referral 
                                ? 'border-[#f8bc51]/40 text-white' 
                                : 'border-Hau Hau-outline-variant/20'
                            } focus:border-[#f8bc51] focus:ring-2 focus:ring-[#f8bc51]/20`}
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 bg-Hau Hau-gold text-Hau Hau-surface font-bold rounded-xl hover:shadow-[0_0_20px_rgba(248,188,81,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                        disabled={loading}
                      >
                        {loading ? 'Creating Account...' : 'Create Account'}
                        {!loading && <ArrowRight size={18} />}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
