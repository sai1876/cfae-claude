'use client';

import { useStore } from '@/store/useStore';
import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';

export default function ReferralCTA() {
  const { user, userProfile } = useStore();
  const [copied, setCopied] = useState(false);

  const referralCode = userProfile?.referral_code || 'HAUHAU50';
  const referralLink = `hauhau.cafe/ref/${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
  };

  return (
    <section className="py-24 px-container-mobile md:px-container-desktop max-w-[1000px] mx-auto w-full text-center">
      {/* State 1: Not logged in */}
      {!user && (
        <div className="bg-hauhau-surface-container-low/40 backdrop-blur-xl rounded-3xl p-8 md:p-16 border border-hauhau-outline-variant/30">
          <h2 className="font-serif italic text-3xl md:text-5xl text-hauhau-cream mb-6">Join Hau Hau. It&apos;s free.</h2>
          <p className="text-hauhau-on-surface-variant mb-10 text-lg">Start earning points and rewards on every order.</p>
          <button 
            onClick={() => {
              // Scroll to menu or top so user can see bottom cart checkout auth check
              const menuSec = document.getElementById('menu-preview');
              if (menuSec) {
                menuSec.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="px-10 py-4 bg-hauhau-gold text-hauhau-surface font-medium rounded-full hover:shadow-[0_0_20px_rgba(248,188,81,0.3)] transition-all w-full sm:w-auto"
          >
            Sign Up with Phone
          </button>
        </div>
      )}

      {/* State 2: Logged in, unverified (No email added) */}
      {user && !userProfile?.email_verified && (
        <div className="bg-hauhau-surface-container-low/40 backdrop-blur-xl rounded-3xl p-8 md:p-16 border border-hauhau-gold/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-hauhau-gold/10 blur-3xl rounded-full" />
          <h2 className="font-serif italic text-3xl md:text-5xl text-hauhau-cream mb-6 relative z-10">Unlock your rewards</h2>
          <p className="text-hauhau-on-surface-variant text-lg mb-10 relative z-10 max-w-sm mx-auto">
            Add or verify your student email inside account options to access the full referral loyalty program.
          </p>
          <button className="px-10 py-4 bg-hauhau-gold text-hauhau-surface font-medium rounded-full hover:shadow-[0_0_20px_rgba(248,188,81,0.3)] transition-all w-full sm:w-auto relative z-10">
            Verify Now
          </button>
        </div>
      )}

      {/* State 3: Logged in, verified */}
      {user && userProfile?.email_verified && (
        <div className="bg-hauhau-surface-container rounded-3xl p-8 md:p-16 border border-hauhau-bamboo/20">
          <h2 className="font-serif italic text-3xl md:text-5xl text-hauhau-cream mb-4">Your Referral Link</h2>
          <p className="text-hauhau-bamboo font-mono uppercase tracking-widest text-sm mb-10">
            Share and earn 50 loyalty points on every friend invite!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center max-w-2xl mx-auto">
            <div className="bg-hauhau-surface/60 backdrop-blur-md w-full sm:w-auto px-6 py-4 rounded-xl border border-hauhau-outline-variant/30 flex items-center justify-between gap-4 font-mono text-sm text-hauhau-cream flex-1">
              <span className="truncate">{referralLink}</span>
              <button 
                onClick={handleCopy}
                className="text-hauhau-gold hover:text-hauhau-gold/80 transition-colors p-1"
              >
                {copied ? <span className="text-xs text-hauhau-bamboo">Copied!</span> : <Copy size={18} />}
              </button>
            </div>
            
            <button 
              onClick={() => window.open(`https://api.whatsapp.com/send?text=Get%20chilled%20sips%20and%20food%20modifiers%20at%20Hau%20Hau%20Cafe!%20Join%20using%20my%20link%20and%20claim%20100%20welcome%20points%20instantly:%20${encodeURIComponent(referralLink)}`, '_blank')}
              className="w-full sm:w-auto px-8 py-4 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#25D366]/90 transition-colors flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest"
            >
              <Share2 size={18} />
              Share on WhatsApp
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
