import { adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { maskEmail, maskPhone } from '@/lib/security/maskPii';
import crypto from 'crypto';

export const BUSINESS_EVENTS_COL = "business_events";

export type EventSeverity = 'info' | 'warning' | 'critical';
export type ActorType = 'customer' | 'staff' | 'manager' | 'admin' | 'owner' | 'system' | 'webhook';
export type EventSource = 'api' | 'firestore_rule_sensitive' | 'webhook' | 'cron' | 'admin_panel' | 'checkout';

export interface BusinessEventInput {
  event_type: string;
  actor_type: ActorType;
  actor_id: string;
  target_type: string;
  target_id: string;
  outlet_id?: string;
  order_id?: string;
  severity: EventSeverity;
  source: EventSource;
  metadata?: Record<string, any>;
}

/**
 * Sanitizes metadata by aggressively stripping PII and secrets
 */
function sanitizeMetadata(data: any): Record<string, any> {
  if (!data) return {};
  
  // Clone object to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  const sanitizeDeep = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        
        // Mask explicit PII keys
        if (lowerKey.includes('phone')) {
          obj[key] = maskPhone(String(obj[key]));
        } else if (lowerKey.includes('email')) {
          obj[key] = maskEmail(String(obj[key]));
        }
        
        // Nullify dangerous properties entirely
        else if (
          lowerKey.includes('token') || 
          lowerKey.includes('password') || 
          lowerKey.includes('key') ||
          lowerKey === 'lat' ||
          lowerKey === 'lng' ||
          lowerKey === 'latitude' ||
          lowerKey === 'longitude' ||
          lowerKey === 'coordinates'
        ) {
          obj[key] = '[REDACTED]';
        }
        
        else if (typeof obj[key] === 'object') {
          sanitizeDeep(obj[key]);
        }
      }
    }
  };

  sanitizeDeep(sanitized);
  return sanitized;
}

/**
 * Logs a secure business event directly to Firestore via Admin SDK.
 * This should never be called from the client SDK.
 */
export async function logBusinessEvent(eventInput: BusinessEventInput): Promise<void> {
  if (!adminDb) {
    console.warn(`[BUSINESS EVENT LOGGER] Firebase Admin DB not initialized. Cannot log event: ${eventInput.event_type}`);
    return;
  }

  try {
    const eventId = crypto.randomUUID();
    const sanitizedMetadata = sanitizeMetadata(eventInput.metadata);

    const eventPayload = {
      event_id: eventId,
      event_type: eventInput.event_type,
      actor_type: eventInput.actor_type,
      actor_id: eventInput.actor_id,
      target_type: eventInput.target_type,
      target_id: eventInput.target_id,
      ...(eventInput.outlet_id && { outlet_id: eventInput.outlet_id }),
      ...(eventInput.order_id && { order_id: eventInput.order_id }),
      severity: eventInput.severity,
      source: eventInput.source,
      metadata: sanitizedMetadata,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await adminDb.collection(BUSINESS_EVENTS_COL).doc(eventId).set(eventPayload);
  } catch (error) {
    // Failing to log a business event should generally not bring down the main request,
    // but it is a critical observability failure.
    console.error(`[BUSINESS EVENT LOGGER] Failed to log event ${eventInput.event_type}:`, error);
  }
}
