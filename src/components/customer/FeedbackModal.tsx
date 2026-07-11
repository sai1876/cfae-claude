'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, MessageSquare, CheckCircle, Loader } from 'lucide-react';
import { submitOrderFeedback } from '@/lib/dbService';
import { OrderDocument } from '@/lib/types';

interface FeedbackModalProps {
  order: OrderDocument | null;
  onClose: () => void;
  onSubmitted: (orderId: string, rating: number, comment: string) => void;
}

const QUICK_LABELS: Record<number, string> = {
  1: 'Very Poor 😞',
  2: 'Poor 😕',
  3: 'Okay 😐',
  4: 'Good 😊',
  5: 'Excellent 🤩',
};

export default function FeedbackModal({ order, onClose, onSubmitted }: FeedbackModalProps) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!order) return null;

  const handleSubmit = async () => {
    if (selectedStar === 0) return;
    setSubmitting(true);
    try {
      await submitOrderFeedback(order.order_id, selectedStar, comment);
      setSubmitted(true);
      onSubmitted(order.order_id, selectedStar, comment);
      setTimeout(onClose, 1800);
    } catch (err) {
      console.error('Feedback submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const activeStar = hoveredStar || selectedStar;

  return (
    <AnimatePresence>
      <motion.div
        key="feedback-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <motion.div
          key="feedback-sheet"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 480,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
            borderRadius: '24px 24px 0 0',
            padding: '28px 24px 40px',
            position: 'relative',
          }}
        >
          {/* Drag handle */}
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: 'rgba(var(--foreground-rgb), 0.15)',
            margin: '0 auto 24px',
          }} />

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(var(--foreground-rgb), 0.05)',
              border: 'none', borderRadius: 10,
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(var(--foreground-rgb), 0.5)', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          <AnimatePresence mode="wait">
            {submitted ? (
              /* ── Success State ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{ textAlign: 'center', padding: '24px 0' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 }}
                >
                  <CheckCircle size={60} color="#4ade80" style={{ margin: '0 auto 16px' }} />
                </motion.div>
                <h3 style={{ color: 'var(--foreground)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                  Thanks for your feedback!
                </h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
                  Your review helps us serve you better. 🙏
                </p>
              </motion.div>
            ) : (
              /* ── Rating State ── */
              <motion.div key="rating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Rate your order
                  </p>
                  <h3 style={{ color: 'var(--foreground)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    How was your experience?
                  </h3>
                  <p style={{ color: 'rgba(var(--foreground-rgb), 0.55)', fontSize: 13 }}>
                    {order.order_type === 'delivery' ? 'Order #' + order.order_id : 'Token #' + order.token_number} &nbsp;·&nbsp; {order.items.length} items &nbsp;·&nbsp; ₹{order.gross_amount}
                  </p>
                </div>

                {/* Star Row */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <motion.button
                      key={star}
                      whileTap={{ scale: 0.8 }}
                      whileHover={{ scale: 1.2 }}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setSelectedStar(star)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4,
                        filter: star <= activeStar
                          ? 'drop-shadow(0 0 8px rgba(198,139,53,0.5))'
                          : 'none',
                        transition: 'filter 0.2s',
                      }}
                    >
                      <Star
                        size={38}
                        fill={star <= activeStar ? 'var(--primary)' : 'transparent'}
                        color={star <= activeStar ? 'var(--primary)' : 'rgba(var(--foreground-rgb), 0.2)'}
                        strokeWidth={1.5}
                      />
                    </motion.button>
                  ))}
                </div>

                {/* Label */}
                <div style={{ textAlign: 'center', height: 22, marginBottom: 24 }}>
                  <AnimatePresence mode="wait">
                    {activeStar > 0 && (
                      <motion.p
                        key={activeStar}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600 }}
                      >
                        {QUICK_LABELS[activeStar]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Comment Box */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <MessageSquare size={14} color="rgba(var(--foreground-rgb),0.35)" />
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                      Share details (optional)
                    </span>
                  </div>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="What did you love? Any suggestions for us..."
                    maxLength={300}
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(var(--foreground-rgb),0.04)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      color: 'var(--foreground)', fontSize: 13,
                      resize: 'none',
                      fontFamily: 'inherit',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                  {comment.length > 0 && (
                    <p style={{ color: 'rgba(var(--foreground-rgb),0.25)', fontSize: 11, textAlign: 'right', marginTop: 4 }}>
                      {comment.length}/300
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <motion.button
                  whileTap={{ scale: selectedStar > 0 ? 0.97 : 1 }}
                  onClick={handleSubmit}
                  disabled={selectedStar === 0 || submitting}
                  style={{
                    width: '100%',
                    padding: '15px 0',
                    borderRadius: 14,
                    border: 'none',
                    fontSize: 15, fontWeight: 700,
                    cursor: selectedStar > 0 ? 'pointer' : 'not-allowed',
                    background: selectedStar > 0
                      ? 'linear-gradient(135deg, #e2a855, #a26b1f)'
                      : 'rgba(var(--foreground-rgb), 0.05)',
                    color: selectedStar > 0 ? 'var(--primary-foreground)' : 'rgba(var(--foreground-rgb), 0.25)',
                    transition: 'all 0.3s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {submitting
                    ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    : 'Submit Feedback'}
                </motion.button>

                {/* Skip */}
                <button
                  onClick={onClose}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    color: 'var(--muted-foreground)', fontSize: 13,
                    marginTop: 12, cursor: 'pointer', padding: 8,
                  }}
                >
                  Skip for now
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
