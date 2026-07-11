# Authentication Security & Lifecycle

This document describes the security patterns, token lifecycles, and privacy rules for authentication in the Hau Hau application.

## Passwordless WhatsApp Login Flow

The passwordless login flow uses WhatsApp as a verification channel to authenticate users without requiring a password. To ensure security, it employs cryptographically strong transient tokens, atomic database transactions, and strict PII redaction.

### Token Lifecycle

A passwordless login handshake token (`auth_handshakes/{token}`) progresses through the following states:

1. **`requested` (State: `consume_state: "pending"`, `used: false`, `is_verified: false`)**
   - User requests login via `/api/auth/passwordless-login`.
   - A 32-character uppercase hex token (128-bit entropy) is generated.
   - Handshake document created in Firestore.
   - User is redirected to WhatsApp to send the token.
   - **Timeout**: The token expires in 5 minutes. If it reaches `expires_at` before verification, it is rejected by the poll route.

2. **`verified` (State: `consume_state: "pending"`, `used: false`, `is_verified: true`)**
   - The webhook receives the WhatsApp message containing the token.
   - The webhook strictly verifies the sender's phone number matches the registered user's phone number suffix.
   - If it matches, `is_verified` becomes `true`.

3. **`consuming` (State: `consume_state: "consuming"`, `used: false`, `is_verified: true`)**
   - The client polls `/api/auth/poll-status/[token]`.
   - `auth_engine.py` opens a **Firestore transaction**.
   - If the token is valid, verified, and not expired, the transaction sets `consume_state: "consuming"` to atomically reserve the token, preventing race conditions or replay attacks.

4. **`consumed` (State: `consume_state: "consumed"`, `used: true`, `is_verified: true`)**
   - After reservation, a Firebase Custom Token is generated.
   - The token is updated to `used: true` and `consume_state: "consumed"`.
   - The custom token is returned securely to the client.

5. **`consume_failed` (Error state)**
   - If generating the custom token fails *after* reservation, `consume_state` is set to `"consume_failed"`.
   - Future polling attempts will be rejected.

6. **`sender_mismatch` (Error state)**
   - If the webhook detects that the WhatsApp sender phone does not match the registered user phone, `is_verified` remains false, and a `passwordless_login_failed` event is logged.

## Rate Limiting

The `/api/auth/passwordless-login` and `/api/auth/poll-status/[token]` routes are protected by rate limiting to prevent abuse and brute force attacks.
- **Current State**: The rate limiter uses an in-memory implementation (`src/lib/rateLimit.ts`). This is **not suitable for production** because state resets per serverless function instance and cannot enforce global limits.
- **Requirement**: Production deployments must replace the in-memory limiter with a Redis-based or Upstash-based distributed rate limiter.

## Never-Log List (PII Protection)

To maintain user privacy and comply with security requirements, the following information must **never** be logged in plain text or returned in polling API responses:

- ❌ **Raw Phone Numbers**: Always mask them (e.g., `+9198****3210`).
- ❌ **Raw Email Addresses**: Do not log or return in `/api/auth/poll-status`.
- ❌ **Raw Tokens**: Mask tokens in logs (e.g., `1A2B****`).
- ❌ **Raw Addresses or Exact Lat/Lng**: Log the source of the location (e.g., "user saved address") but not exact coordinates.
- ❌ **Full Webhook Payloads**: Parse and log only safe events.
- ❌ **WhatsApp Message Body**: Do not log user chat texts to the system log.
- ❌ **Firebase Custom Tokens**: Do not log the generated JWTs.

## Business Events

Authentication flows trigger standard business events (e.g., `passwordless_login_requested`, `passwordless_login_verified`, `passwordless_login_failed`) using the `logBusinessEvent` utility. These events capture the actor, target, and masked metadata to enable secure auditing without exposing PII.
