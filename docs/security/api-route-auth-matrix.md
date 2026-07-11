# API Route Authorization Matrix

This document provides a comprehensive inventory of all backend API routes under `src/app/api/**` in the codebase. It details the action performed, the authentication mechanism, and the risk level for each route.

## Matrix

| Route Path | Method | Action | Type | Current Auth | Required Role | Risk | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/admin/delete-user` | `POST` | Deletes user from Auth, Firestore, and Redis | Protected | `requireRole` | `owner`, `admin` | High | OK |
| `/api/admin/h3-migration` | `GET` | Batch updates staff location hexes | Protected | `requireRole` | `owner`, `admin` | Low | OK |
| `/api/admin/morning-hud` | `GET` | Reads HUD data | Protected | `requireRole` | `owner`, `admin`, `manager` | Low | OK |
| `/api/auth/create-profile` | `POST` | Secure profile creation | Protected | Firebase ID Token + WhatsApp | User | Medium | OK |
| `/api/auth/activate-profile`| `POST` | Updates active status | Protected | Firebase ID Token (verify email) | User | High | OK |
| `/api/auth/finalize-signup`| `POST` | Grants welcome/referral bonus | Protected | Firebase ID Token | User | High | OK |
| `/api/auth/magic-link` | `POST` | Sends magic link for login | Public | None | None | Low | OK |
| `/api/auth/session` | `POST`/`DELETE` | Sets/Clears session cookie | Public | Firebase ID Token | User | High | OK |
| `/api/auth/check-availability`| `GET` | Checks if phone/email is registered | Public | None (Safe lookup) | None | Low | OK |
| `/api/orders/create` | `POST` | Creates an order | Protected | Firebase ID Token | User | High | OK |
| `/api/customer/active-route`| `GET` | Reads anonymous waypoints | Public | None (Uses URL Param) | None | Low | OK |
| `/api/expand-map-link` | `GET` | Parses maps URL to coords | Protected | Firebase Session Cookie | User | Low | OK |
| `/api/chat`, `/api/gemini` | `POST` | AI chat completions | Public / Internal | `API_SECRET_KEY` / Custom | None | Low | OK |
| `/api/cron/*` | `POST`/`GET` | Nightly db cleanups / ledger txs | Internal | `API_SECRET_KEY` | None (Cron) | Medium | OK (Internal-only) |
| `/api/notion/*` | `POST` | Notion database sync webhooks | Internal | `API_SECRET_KEY` | None (Webhook)| Low | OK (Internal-only) |
| `/api/webhook/whatsapp` | `POST` | Receives incoming WA msgs | Internal | Webhook Verification | None (Webhook)| Medium | OK (Internal-only) |
| `/api/export-backup` | `GET` | Exports firestore DB | Internal | `API_SECRET_KEY` | None | High | OK (Internal-only) |
| `/api/send-alert-email` | `POST` | Sends alerts | Internal | `API_SECRET_KEY` | None | Low | OK (Internal-only) |
| `/api/send-staff-code` | `POST` | Sends staff codes | Internal | `API_SECRET_KEY` | None | Low | OK (Internal-only) |
| `/api/voice-order/verify` | `POST` | Internal verification | Internal | `API_SECRET_KEY` | None | Medium | OK (Internal-only) |

## Notes
- "Internal-only" routes are invoked directly by our systems (Vercel Cron, external webhooks) and do not have active user sessions. They rely on symmetric static keys (`API_SECRET_KEY`).
- Most business mutations (inventory, attendance, cash, vouchers) are performed natively using the Firebase Web Client SDK, meaning they are completely governed by `firestore.rules`.
