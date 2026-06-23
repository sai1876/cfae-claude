'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AuthWorkspace from '@/components/auth/AuthWorkspace';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mounted, setMounted] = useState(false);

  // Set mounted status on client-side to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#000000]/70 backdrop-blur-sm z-[999]"
          />

          {/* Modal Container holding the AuthWorkspace */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[1000] max-h-[90vh] overflow-y-auto px-4 outline-none">
            <AuthWorkspace 
              isModal={true} 
              onClose={onClose} 
              defaultTab="login" 
            />
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
