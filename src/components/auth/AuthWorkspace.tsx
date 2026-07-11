'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Lock,
  Mail,
  Users,
  ArrowRight,
  CheckCircle,
  
  
  Smartphone,
  Check,
  Send,
  Loader2,
  Key,
  ShieldCheck,
  
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '@/store/useStore';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getUserProfileByPhone } from '@/features/users/userService';

// Get backend URL from env (Force clean Vercel build configuration)
const BACKEND_URL = process.env.NEXT_PUBLIC_AUTH_ENGINE_URL || '';

interface AuthWorkspaceProps {
  defaultTab?: 'signup' | 'login';
  isModal?: boolean;
  onClose?: () => void;
}

export default function AuthWorkspace({ defaultTab = 'signup', isModal = false, onClose }: AuthWorkspaceProps) {
  const { setUser, setUserProfile } = useStore();

  // Tab: 'login' or 'signup'
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab);

  // Signup State Machine Steps: 'phone' | 'handshake' | 'profile' | 'lockout' | 'dashboard'
  const [signupStep, setSignupStep] = useState<'phone' | 'handshake' | 'profile' | 'lockout' | 'dashboard'>('phone');

  // Login State Machine Steps: 'credentials' | 'handshake_login' | 'handshake_login_poll'
  const [loginStep, setLoginStep] = useState<'credentials' | 'handshake_login'>('credentials');

  // Input states
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [referral, setReferral] = useState('');

  // Handshake tracking states
  const [handshakeToken, setHandshakeToken] = useState('');
  const [handshakeUrl, setHandshakeUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingSecondsLeft, setPollingSecondsLeft] = useState(600); // 10 mins

  // General Status & UI Feedbacks
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [emailSentUrl, setEmailSentUrl] = useState<string | null>(null);

  // Poll status for SignUp/Login handshakes
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPolling && handshakeToken) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/poll-status/${handshakeToken}`);
          if (!res.ok) {
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
              const data = await res.json();
              throw new Error(data.detail || 'Polling failed');
            } else {
              throw new Error(`Polling failed with status: ${res.status}`);
            }
          }

          const data = await res.json();
          if (data.is_phone_verified) {
            setIsPolling(false);
            clearInterval(intervalId);

            if (tab === 'signup') {
              setSignupStep('profile');
            } else {
              // Option B Passwordless Login success
              setSuccessMessage("Ustaad! Instant Login Authenticated.");

              if (data.custom_token) {
                const { signInWithCustomToken } = await import('firebase/auth');
                const credential = await signInWithCustomToken(auth, data.custom_token);
                setUser({ uid: credential.user.uid, phone: data.user_profile?.phone || phone });
                if (data.user_profile) {
                  setUserProfile(data.user_profile);
                }
              } else {
                const mockUser = { uid: "user_" + phone.replace(/\D/g, ""), phone };
                setUser(mockUser);
                if (data.user_profile) {
                  setUserProfile(data.user_profile);
                }
              }

              setTimeout(() => {
                window.location.href = '/menu';
              }, 1500);
            }
          }
        } catch (e: any) {
          console.error("Polling error:", e);
          setError(e.message || "Session verification failed. Please try again.");
          setIsPolling(false);
        }
      }, 1500); // Poll every 1.5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPolling, handshakeToken, tab, phone, setUser]);

  // Polling lifespan countdown (10 minutes)
  useEffect(() => {
    if (!isPolling) return;
    const timer = setInterval(() => {
      setPollingSecondsLeft(s => {
        if (s <= 1) {
          setIsPolling(false);
          setError("Verification token expired. Please retry.");
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPolling]);

  // Phase 1: Check phone availability & generate WhatsApp handshake token
  const handleCheckPhoneAndHandshake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Initial Redis Cache Boundary Check (Fast Path)
      const cacheCheckRes = await fetch(`/api/auth/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const cacheCheckData = await cacheCheckRes.json();
      if (!cacheCheckRes.ok || cacheCheckData.available === false) {
        throw new Error(cacheCheckData.detail || "This phone number is already linked to an active account.");
      }

      // 1.5. Fallback Auth Engine Boundary Check
      const checkRes = await fetch(`${BACKEND_URL}/api/auth/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.detail || "This phone number is already linked to an active account.");
      }

      // 2. Generate WhatsApp Handshake Token
      const hsRes = await fetch(`${BACKEND_URL}/api/auth/whatsapp-handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const hsData = await hsRes.json();
      if (!hsRes.ok) {
        throw new Error(hsData.detail || "Handshake generation failed.");
      }

      setHandshakeToken(hsData.token);
      setHandshakeUrl(hsData.redirect_url);
      setSignupStep('handshake');
      setIsPolling(true);
      setPollingSecondsLeft(600); // 10 minutes TTL
    } catch (err: any) {
      setError(err.message || "Communication error with Auth Engine.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 4: Submit profile credentials & Referral code
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Full Name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    setError(null);

    try {
      // 0. Redis Cache Boundary Check for Email
      const emailCheckRes = await fetch(`/api/auth/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const emailCheckData = await emailCheckRes.json();
      if (!emailCheckRes.ok || emailCheckData.available === false) {
        throw new Error(emailCheckData.detail || "This email is already linked to an active account.");
      }

      // 1. Create User in Firebase Auth directly
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      // 2. Send Native Firebase verification mail
      await sendEmailVerification(user);
      
      const idToken = await user.getIdToken();

      // 3. Create profile document in Firestore (secure backend)
      const createRes = await fetch(`/api/auth/create-profile`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ phone, name, email, referredBy: referral, handshakeToken })
      });

      if (!createRes.ok) {
        const createData = await createRes.json();
        throw new Error(createData.detail || "Failed to create user profile.");
      }

      // 3.5. Finalize cache and grant welcome points securely (backend)
      try {
        const finalizeRes = await fetch(`/api/auth/finalize-signup-cache`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          }
        });
        if (!finalizeRes.ok) {
          console.warn("Failed to finalize cache/points securely. Proceeding anyway.");
        }
      } catch (err) {
        console.warn("Failed to reach finalize-signup-cache route:", err);
      }

      // 4. Staging complete, move to lockout screen
      setSignupStep('lockout');
      setEmailSentUrl("native_firebase"); // Set to non-null value so status button displays
    } catch (err: any) {
      console.error("Client signup failed:", err);
      setError(err.message || "Failed to submit profile details.");
    } finally {
      setLoading(false);
    }
  };

  // Check Email Activation trigger (polls or manual action check)
  const handleMockEmailVerification = async () => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated session found. Please try logging in again.");
      }

      await user.reload(); // Reload user state to get latest emailVerified status
      
      if (!user.emailVerified) {
        throw new Error("Email has not been verified yet. Please check your inbox and click the verification link.");
      }

      // Success! Account is now active. Securely update backend status.
      const idToken = await user.getIdToken(true); // Force refresh to ensure latest token
      
      const activateRes = await fetch('/api/auth/activate-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!activateRes.ok) {
        const errData = await activateRes.json();
        throw new Error(errData.detail || "Failed to activate profile securely.");
      }

      const mockUser = { uid: user.uid, phone: user.phoneNumber || phone };
      setUser(mockUser);
      // Fetch the updated profile to set it in the store
      try {
        const profile = await getUserProfileByPhone(mockUser.phone);
        if (profile) setUserProfile(profile);
      } catch (e) {
        console.warn("Failed to fetch profile during mock verification", e);
      }
      
      setSuccessMessage("Ustaad! Account activated successfully. Welcome to Hau Hau!");
      setSignupStep('dashboard');

      setTimeout(() => {
        window.location.href = '/menu';
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Email verification status check failed.");
    } finally {
      setLoading(false);
    }
  };

  // Option A Login: Phone & Password Credential Fallback
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError("Please fill in both Phone and Password fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loginRes = await fetch('/api/auth/login-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await loginRes.json();
      
      if (!loginRes.ok) {
        if (data.detail && data.detail.includes('inactive')) {
          setSignupStep('lockout');
          throw new Error("Account inactive. Please check email to verify profile.");
        }
        throw new Error(data.detail || "Incorrect phone number or password.");
      }

      if (!data.custom_token) {
        throw new Error("Invalid response from server. Missing authentication token.");
      }

      // 2. Authenticate securely via custom token
      const { signInWithCustomToken } = await import('firebase/auth');
      const credential = await signInWithCustomToken(auth, data.custom_token);
      
      const safeUser = { uid: credential.user.uid, phone };
      setUser(safeUser);
      if (data.user_profile) {
        setUserProfile(data.user_profile);
      }

      setSuccessMessage("Identity verified. Welcome back!");
      setTimeout(() => {
        window.location.href = '/menu';
      }, 1500);

    } catch (err: any) {
      console.error("Client-side login failed:", err);
      // Friendly messages for common errors
      setError(err.message || "Login authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  // Option B: Initiate Passwordless WhatsApp login handshake
  const handlePasswordlessLoginInit = async () => {
    if (!phone || phone.length < 10) {
      setError("Please enter your registered 10-digit phone number.");
      return;
    }

    setLoading(true);
    setError(null);

    // Open a blank tab immediately to bypass popup blockers on desktop
    const whatsappWindow = window.open('about:blank', '_blank');

    try {
      const res = await fetch('/api/auth/passwordless-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await res.json();
      if (res.status === 403) {
        if (whatsappWindow) whatsappWindow.close();
        setSignupStep('lockout');
        setError(data.detail || "Account inactive. Please verify email first.");
        return;
      }

      if (!res.ok) {
        if (whatsappWindow) whatsappWindow.close();
        throw new Error(data.detail || "Verification initialization failed.");
      }

      setHandshakeToken(data.token);
      setHandshakeUrl(data.redirect_url);
      setWhatsappUrl(data.whatsapp_url);
      setLoginStep('handshake_login');
      setIsPolling(true);
      setPollingSecondsLeft(300); // 5 minutes login TTL

      // Immediately attempt redirect
      if (data.whatsapp_url) {
        if (whatsappWindow) {
          whatsappWindow.location.href = data.whatsapp_url;
        } else {
          setError("Popup blocked. Tap Open WhatsApp below.");
        }
      }
    } catch (err: any) {
      if (whatsappWindow && whatsappWindow.location.href === 'about:blank') {
        whatsappWindow.close();
      }
      setError(err.message || "Login handshake failed.");
    } finally {
      setLoading(false);
    }
  };

  // Reset helper
  const handleResetFlow = () => {
    setIsPolling(false);
    setSignupStep('phone');
    setLoginStep('credentials');
    setError(null);
    setSuccessMessage(null);
    setPhone('');
    setPassword('');
    setName('');
    setEmail('');
    setReferral('');
  };

  // Format mm:ss
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={isModal ? "w-full" : "min-h-[100dvh] w-full bg-[#2d394a] text-[#f7efe2] flex flex-col relative overflow-x-hidden overflow-y-auto font-sans p-6 py-12"}>
      {!isModal && (
        <>
          <div className="absolute top-[-20%] left-[-20%] w-[550px] h-[550px] bg-[#f8bc51]/5 rounded-full filter blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[550px] h-[550px] bg-[#E8621A]/5 rounded-full filter blur-[120px] pointer-events-none" />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10 m-auto"
      >
        {/* Branding Headers */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <span className="font-serif text-4xl text-[#e2a12d] tracking-wider">Hau Hau.</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-[rgba(247,239,226,0.55)]">Dual-Channel Gateway</span>
        </div>

        {/* Global tab toggles for Initial state */}
        {signupStep === 'phone' && loginStep === 'credentials' && (
          <div className="flex bg-[#24231f] border-[1.5px] border-[rgba(255,244,224,0.65)] rounded-2xl p-1 mb-8">
            <button
              onClick={() => { setTab('signup'); setError(null); }}
              className={`flex-1 py-2 rounded-xl text-xs uppercase tracking-widest font-mono font-bold transition-all ${tab === 'signup' ? 'bg-[#e2a12d] text-[#ffffff] font-extrabold shadow-md' : 'text-[#f7efe2]/75 hover:text-[#f7efe2] font-bold'}`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 py-2 rounded-xl text-xs uppercase tracking-widest font-mono font-bold transition-all ${tab === 'login' ? 'bg-[#e2a12d] text-[#ffffff] font-extrabold shadow-md' : 'text-[#f7efe2]/75 hover:text-[#f7efe2] font-bold'}`}
            >
              Log In
            </button>
          </div>
        )}

        {/* MAIN PANEL CONTENT */}
        <div className="bg-[#1f1e1b] backdrop-blur-2xl rounded-3xl border-[1.5px] border-[rgba(255,244,224,0.65)] p-8 shadow-2xl relative">
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-[rgba(247,239,226,0.55)] hover:text-white rounded-full transition-colors z-20"
              aria-label="Close modal"
              type="button"
            >
              <X size={16} />
            </button>
          )}

          <AnimatePresence mode="wait">

            {/* SIGNUP STEP 1: PHONE COLLECTION */}
            {tab === 'signup' && signupStep === 'phone' && (
              <motion.form
                key="signup-phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleCheckPhoneAndHandshake}
                className="flex flex-col gap-6"
              >
                <div className="text-center">
                  <h1 className="font-serif italic text-[28px] font-extrabold text-[#f7efe2] mb-1">Create Account</h1>
                  <p className="text-[13px] text-[#f7efe2]/75 leading-relaxed">Enter your phone number to initialize verification.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Phone Number</label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-4 text-[#8d98a5]" size={16} />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 919876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#fffaf3] border-2 border-[rgba(255,255,255,0.9)] rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-[#1d1d1d] placeholder:text-[#8d98a5] focus:outline-none focus:border-[#e2a12d] focus:ring-4 focus:ring-[rgba(226,161,45,0.22)] transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-[#ef4444]/15 border-[1.5px] border-[#ef4444]/30 text-[#fca5a5] p-3.5 font-semibold rounded-xl text-xs font-mono text-center leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#e2a12d] hover:bg-[#f0b13d] text-[#ffffff] py-4 mt-2 rounded-xl font-mono font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {loading ? 'Validating...' : 'Next Step'} <ArrowRight size={14} />
                </button>
              </motion.form>
            )}

            {/* SIGNUP STEP 2: WHATSAPP HANDSHAKEA REDIRECT & POLL */}
            {tab === 'signup' && signupStep === 'handshake' && (
              <motion.div
                key="signup-handshake"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6 text-center"
              >
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-xl bg-[#e2a12d]/15 border-[1.5px] border-[#e2a12d]/30 flex items-center justify-center text-[#e2a12d] animate-pulse">
                    <Smartphone size={18} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h1 className="font-serif italic text-[28px] font-extrabold text-[#f7efe2] mb-1">WhatsApp Verification</h1>
                  <p className="text-xs text-[rgba(247,239,226,0.72)] px-4 leading-relaxed">
                    Send the pre-filled verification message to our bot line to activate your registration form.
                  </p>
                </div>

                {/* QR Code and link buttons */}
                <div className="bg-[#24231f] border-[1.5px] border-[rgba(255,244,224,0.65)] p-6 rounded-3xl flex flex-col items-center gap-4">
                  {showQR ? (
                    <div className="bg-white p-3.5 rounded-xl border border-white/10 shadow-lg">
                      <QRCodeSVG value={handshakeUrl} size={160} />
                      <div className="text-[9px] text-black font-bold font-mono tracking-wider mt-2">SCAN WITH SMARTPHONE</div>
                    </div>
                  ) : (
                    <a
                      href={handshakeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#e2a12d] text-[#ffffff] hover:bg-[#f0b13d] py-4 rounded-xl text-sm uppercase tracking-widest font-mono font-black flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      <Send size={14} /> Send WhatsApp Ref
                    </a>
                  )}

                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="text-[11px] uppercase font-mono tracking-wider font-bold text-[rgba(247,239,226,0.65)] hover:text-[#e2a12d] transition-colors"
                  >
                    {showQR ? 'Hide QR Code' : 'Display QR Code fallback'}
                  </button>
                </div>

                {/* Polling Spinner info */}
                <div className="flex flex-col items-center gap-2 border-t border-[#302117]/60 pt-4">
                  <div className="flex items-center gap-2 text-xs text-[#e2a12d] font-mono">
                    <Loader2 className="animate-spin" size={14} />
                    <span>Awaiting your WhatsApp message...</span>
                  </div>
                  <span className="text-[9px] font-mono text-[rgba(247,239,226,0.55)]">Tokens expire in: {formatTimer(pollingSecondsLeft)}</span>
                </div>

                {error && (
                  <div className="bg-[#ef4444]/15 border-[1.5px] border-[#ef4444]/30 text-[#fca5a5] p-3.5 font-semibold rounded-xl text-xs font-mono">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleResetFlow}
                  className="text-[11px] font-mono uppercase tracking-wider font-bold text-[rgba(247,239,226,0.65)] hover:text-white transition-colors"
                >
                  Cancel &amp; Restart
                </button>
              </motion.div>
            )}

            {/* SIGNUP STEP 3: UNIFIED PROFILE FORM */}
            {tab === 'signup' && signupStep === 'profile' && (
              <motion.form
                key="signup-profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleRegisterProfile}
                className="flex flex-col gap-4"
              >
                <div className="text-center mb-2">
                  <h1 className="font-serif italic text-[28px] font-extrabold text-[#f7efe2] mb-1">Profile Setup</h1>
                  <p className="text-[13px] text-[#f7efe2]/75 leading-relaxed">Provide your student profile credentials.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Phone Number (Locked)</label>
                  <div className="bg-[#070402] border border-[#302117]/60 rounded-xl px-4 py-3 text-xs text-[rgba(247,239,226,0.55)] font-mono flex items-center justify-between">
                    <span>{phone}</span>
                    <CheckCircle className="text-[#10B981]" size={14} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#f8bc51] text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Verify Email Address</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 text-[#8d98a5]" size={16} />
                    <input
                      type="email"
                      required
                      placeholder="name@univ.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#fffaf3] border-2 border-[rgba(255,255,255,0.9)] rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-[#1d1d1d] placeholder:text-[#8d98a5] focus:outline-none focus:border-[#e2a12d] focus:ring-4 focus:ring-[rgba(226,161,45,0.22)] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Password</label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 text-[#8d98a5]" size={16} />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#fffaf3] border-2 border-[rgba(255,255,255,0.9)] rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-[#1d1d1d] placeholder:text-[#8d98a5] focus:outline-none focus:border-[#e2a12d] focus:ring-4 focus:ring-[rgba(226,161,45,0.22)] transition-all tracking-widest font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Referral Code (Optional)</label>
                  <div className="relative flex items-center">
                    <Users className="absolute left-4 text-[#8d98a5]" size={16} />
                    <input
                      type="text"
                      placeholder="e.g. HAU HAU_F5T1"
                      value={referral}
                      onChange={(e) => setReferral(e.target.value.toUpperCase())}
                      className="w-full bg-[#fffaf3] border-2 border-[rgba(255,255,255,0.9)] rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-[#1d1d1d] placeholder:text-[#8d98a5] focus:outline-none focus:border-[#e2a12d] focus:ring-4 focus:ring-[rgba(226,161,45,0.22)] transition-all font-mono uppercase"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-[#ef4444]/15 border-[1.5px] border-[#ef4444]/30 text-[#fca5a5] p-3.5 font-semibold rounded-xl text-xs font-mono text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#e2a12d] hover:bg-[#f0b13d] text-[#ffffff] py-4 mt-3 rounded-xl font-mono font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {loading ? 'Creating Staged Profile...' : 'Complete Signup'}
                </button>
              </motion.form>
            )}

            {/* SIGNUP STEP 4: MANDATORY EMAIL VERIFICATION LOCKOUT */}
            {signupStep === 'lockout' && (
              <motion.div
                key="signup-lockout"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6 text-center"
              >
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 animate-pulse">
                    <Mail size={22} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <h1 className="font-serif italic text-[28px] font-extrabold text-[#f7efe2] mb-1">Verification Link Sent</h1>
                  <p className="text-xs text-[#d4c4b0]/70 px-4 leading-relaxed">
                    Please check your campus inbox to activate your profile. Your account is currently locked in an inactive state.
                  </p>
                </div>

                {/* Email Verification Status Check */}
                {emailSentUrl && (
                  <div className="bg-[#070402]/60 border border-[#302117] p-5 rounded-2xl flex flex-col gap-3">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[rgba(247,239,226,0.55)]">Verify Status</div>
                    <button
                      onClick={handleMockEmailVerification}
                      disabled={loading}
                      className="w-full bg-[#E8621A]/20 hover:bg-[#E8621A]/35 border border-[#E8621A]/40 text-[#f7dec4] py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'I\'ve Verified My Email 📧'}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-xs font-mono">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleResetFlow}
                  className="text-[11px] font-mono uppercase tracking-wider font-bold text-[rgba(247,239,226,0.65)] hover:text-white transition-colors"
                >
                  Return to Home
                </button>
              </motion.div>
            )}

            {/* LOGIN TAB CORE SCREEN */}
            {tab === 'login' && loginStep === 'credentials' && (
              <motion.form
                key="login-credentials"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleLoginSubmit}
                className="flex flex-col gap-6"
              >
                <div className="text-center">
                  <h1 className="font-serif italic text-[28px] font-extrabold text-[#f7efe2] mb-1">Welcome Back</h1>
                  <p className="text-[13px] text-[#f7efe2]/75 leading-relaxed">Authenticate to access dining orders.</p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Phone Number</label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-4 text-[#8d98a5]" size={16} />
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 919876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-[#fffaf3] border-2 border-[rgba(255,255,255,0.9)] rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-[#1d1d1d] placeholder:text-[#8d98a5] focus:outline-none focus:border-[#e2a12d] focus:ring-4 focus:ring-[rgba(226,161,45,0.22)] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f7efe2]/85 mb-0.5">Password</label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-4 text-[#8d98a5]" size={16} />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#fffaf3] border-2 border-[rgba(255,255,255,0.9)] rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-[#1d1d1d] placeholder:text-[#8d98a5] focus:outline-none focus:border-[#e2a12d] focus:ring-4 focus:ring-[rgba(226,161,45,0.22)] transition-all tracking-widest font-mono"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-[#ef4444]/15 border-[1.5px] border-[#ef4444]/30 text-[#fca5a5] p-3.5 font-semibold rounded-xl text-xs font-mono text-center leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#e2a12d] hover:bg-[#f0b13d] text-[#ffffff] py-4 mt-2 rounded-xl font-mono font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {loading ? 'Verifying credentials...' : 'Unlock Workspace'}
                </button>

                <div className="border-t border-[#fff4e0]/15 pt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handlePasswordlessLoginInit}
                    disabled={loading}
                    className="w-full bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(226,161,45,0.12)] border-[1.5px] border-[rgba(255,244,224,0.72)] text-[rgba(255,244,224,0.82)] hover:border-[#e2a12d] py-3.5 mt-2 rounded-xl font-mono text-[11px] uppercase tracking-wider font-extrabold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Key size={12} /> Option B: Passwordless WhatsApp Login
                  </button>
                  <div className="text-center mt-2">
                    <a
                      href="/login?staff=true"
                      className="text-[11px] font-mono uppercase tracking-wider font-bold text-[rgba(247,239,226,0.65)] hover:text-[#e2a12d] transition-colors"
                    >
                      Operational Staff? Login here
                    </a>
                  </div>
                </div>
              </motion.form>
            )}

            {/* LOGIN STEP: PASSWORDLESS WHATSAPP VERIFY & POLL */}
            {tab === 'login' && loginStep === 'handshake_login' && (
              <motion.div
                key="login-handshake"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6 text-center"
              >
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-xl bg-[#e2a12d]/15 border-[1.5px] border-[#e2a12d]/30 flex items-center justify-center text-[#e2a12d] animate-pulse">
                    <Key size={18} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h1 className="font-serif italic text-[28px] font-extrabold text-[#f7efe2] mb-1">Opening WhatsApp...</h1>
                  <p className="text-xs text-[rgba(247,239,226,0.72)] px-4 leading-relaxed">
                    If WhatsApp did not open automatically, tap the button below to send your login code.
                  </p>
                </div>

                <div className="bg-[#24231f] border-[1.5px] border-[rgba(255,244,224,0.65)] p-6 rounded-3xl flex flex-col items-center gap-4">
                  {showQR ? (
                    <div className="bg-white p-3.5 rounded-xl border border-white/10 shadow-lg">
                      <QRCodeSVG value={handshakeUrl} size={160} />
                      <div className="text-[9px] text-black font-bold font-mono tracking-wider mt-2">SCAN TO LOGIN</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener,noreferrer'); }}
                      className="w-full bg-[#e2a12d] text-[#ffffff] hover:bg-[#f0b13d] py-4 rounded-xl text-sm uppercase tracking-widest font-mono font-black flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      <Send size={14} /> Open WhatsApp
                    </button>
                  )}

                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="text-[11px] uppercase font-mono tracking-wider font-bold text-[rgba(247,239,226,0.65)] hover:text-[#e2a12d] transition-colors"
                  >
                    {showQR ? 'Hide QR Code' : 'Display Login QR Code'}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-2 border-t border-[#302117]/60 pt-4">
                  <div className="flex items-center gap-2 text-xs text-[#e2a12d] font-mono">
                    <Loader2 className="animate-spin" size={14} />
                    <span>Awaiting WhatsApp Login confirmation...</span>
                  </div>
                  <span className="text-[9px] font-mono text-[rgba(247,239,226,0.55)]">Expires in: {formatTimer(pollingSecondsLeft)}</span>
                </div>

                {error && (
                  <div className="bg-[#ef4444]/15 border-[1.5px] border-[#ef4444]/30 text-[#fca5a5] p-3.5 font-semibold rounded-xl text-xs font-mono">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleResetFlow}
                  className="text-[11px] font-mono uppercase tracking-wider font-bold text-[rgba(247,239,226,0.65)] hover:text-white transition-colors"
                >
                  Return to credentials form
                </button>
              </motion.div>
            )}

            {/* DASHBOARD TRANSITION FEEDBACK */}
            {signupStep === 'dashboard' && (
              <motion.div
                key="signup-dashboard"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 text-center py-6"
              >
                <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-[#10B981]">
                  <ShieldCheck size={36} className="animate-bounce" />
                </div>
                <h1 className="font-serif italic text-[28px] font-extrabold text-[#f7efe2] mb-1">Access Granted</h1>
                <p className="text-xs text-[#d4c4b0]/70 max-w-xs leading-relaxed">
                  Welcome to the active campus dining portal! Your 30-day secure session token is registered in the browser cache.
                </p>
                <div className="flex items-center gap-2 text-xs text-[#e2a12d] font-mono mt-2">
                  <Loader2 className="animate-spin" size={12} />
                  <span>Configuring dining dashboard workspace...</span>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Success messages floating banner */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-6 right-6 bottom-6 bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] p-3.5 rounded-2xl text-[11px] font-mono text-center flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Check size={12} /> {successMessage}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}
