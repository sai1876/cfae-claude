# Business Event Logging Architecture

## Overview
To establish a robust, queryable audit trail of sensitive system actions without compromising user privacy, this application implements a strictly governed **Business Event Logging** framework. 

All logs are written exclusively via the Firebase Admin SDK to the tightly restricted `business_events` collection. **No client-side SDK writes are permitted to this collection.**

## Event Schema (`BusinessEventInput`)
Every event adheres to a strict schema enforcing traceability:

- **`event_id`**: Auto-generated UUID.
- **`event_type`**: Distinct identifier (e.g., `order_created`, `admin_user_deleted`).
- **`actor_type`**: Role of the initiator (`customer`, `staff`, `manager`, `admin`, `owner`, `system`, `webhook`).
- **`actor_id`**: UID of the initiator (or `'unknown'` if unidentified).
- **`target_type`**: Entity affected (e.g., `user`, `order`).
- **`target_id`**: ID of the affected entity.
- **`severity`**: Log level (`info`, `warning`, `critical`).
- **`source`**: Origin of the action (`api`, `webhook`, `admin_panel`, `checkout`, `cron`, `firestore_rule_sensitive`).
- **`outlet_id`** (Optional): Associated location.
- **`order_id`** (Optional): Associated order ID.
- **`metadata`**: Contextual payload (strictly sanitized).
- **`created_at`**: Server-issued timestamp.

## Strict PII Sanitization
Logging raw PII into a central audit trail creates a dangerous single-point vulnerability. Therefore, the `logBusinessEvent` helper forcefully sanitizes the `metadata` object before it hits Firestore:

1. **Masking:** Any key containing `phone` or `email` is processed through cryptographic masking helpers (`maskPhone`, `maskEmail`).
2. **Redaction:** Any key containing `token`, `password`, `key`, `lat`, `lng`, `latitude`, `longitude`, or `coordinates` is completely redacted with `[REDACTED]`.

## Covered Routes (Phase 1)
Currently, the following critical state changes are captured via server-side routes:

- **`/api/orders/create`** -> `order_created`
- **`/api/orders/update-status`** -> `order_status_changed` (Top-level only)
- **`/api/admin/delete-user`** -> `admin_user_deleted`
- **`/api/auth/create-profile`** -> `profile_created`
- **`/api/auth/activate-profile`** -> `profile_activated`
- **`/api/auth/finalize-signup-cache`** -> `signup_finalized`
- **`/api/webhook/whatsapp`** -> `whatsapp_message_received`, `whatsapp_voice_order_received`, `whatsapp_location_received`

## Phase 2 Coverage Table (Operational Flows)
The following operational mutation paths are currently driven by **client-side Firestore writes**. As per our strict security model, we *do not* allow client code to write to `business_events`. Therefore, these events are documented as **Not yet covered** and must be migrated to a server-side route before logging can be implemented.

| Event Type | Status | Reason | Future Action |
|------------|--------|--------|---------------|
| `inventory_adjusted` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `wastage_recorded` | Not yet covered | Separate future server route needed. | Move to server route before logging |
| `stock_movement_created` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `customer_created` | Covered | `auth_engine.py` (during phone login/signup) | |
| `kds_item_status_changed` | Covered | Server route: `/api/orders/update-kds-item-status` (Note: Transaction-safe) | |
| `order_status_changed` | Covered | Server route: `/api/orders/update-status` (Note: Payment changes are logged as warnings. Overrides, cancellations, and rejections require a reason) | - |
| `refund_processed` | Covered | Server route: `/api/orders/refund-payment` (Note: Monetary refund only. Food inventory is not refunded after preparation.) | |
| `staff_attendance_updated` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `shift_updated` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `cash_session_opened` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `cash_session_closed` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `expense_recorded` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `approval_created` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `approval_resolved` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `menu_item_changed` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `offer_changed` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |
| `outlet_changed` | Not yet covered | Client-side Firestore mutation | Move to server route before logging |

## Firestore Rules
The `business_events` collection is actively guarded against client manipulation:
```javascript
match /business_events/{eventId} {
  allow read: if isOwnerAdminManager();
  allow create, update, delete: if false; // Server SDK only
}
```

## Future Expansion Plan
- Expand coverage to all other `admin/*` and `staff/*` API routes.
- Hook into inventory wastage/adjustments.
- Introduce BigQuery streaming for `business_events` if data volumes exceed Firestore's comfortable querying threshold for analytics.
