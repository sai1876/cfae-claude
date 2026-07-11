# Hau Hau OS Development PRD

Generated: 2026-06-20

Source basis: existing codebase in `E:\cafe\cafe-claude`, uploaded chat discussion file, Antigravity chat folder, and existing `Hau_Hau_High_UI_PRD.docx`.

## Executive Summary

Hau Hau is a student-first cafe operating system: a quick service food brand, a campus hangout destination, and a technology layer for ordering, loyalty, kitchen operations, inventory, branch management, and future franchising.

The current product already contains meaningful foundations: a Next.js customer app, animated landing experience, menu and cart, Firebase-backed orders and inventory, admin modules, KDS, delivery dispatch, scanner flow, referral and points logic, campaign/offer management, and a voice-order checkout path.

The biggest product gap is not ambition; it is operational closure. The codebase has many modules, but several critical campus-rush workflows are incomplete or fragmented: QR dine-in locking, meal upsell, contest/community growth, voice-order stock safety, express hatch sales, and branch-level financial controls.

This PRD converts the founder vision, prior conversations, existing PRD, and implementation audit into a development-ready plan for a team that needs to build Hau Hau as a scalable, auditable, student-friendly QSR platform.
## Product Vision

Hau Hau should become the default student third place near colleges: affordable enough for frequent visits, visually memorable enough for social sharing, fast enough for short breaks, and reliable enough for multi-branch operations.

The brand promise is: affordable food, premium garden/fish-pond ambiance, fast prepaid ordering, rewards, and belonging.

The software vision is Hau Hau OS: a single operating layer for customer acquisition, ordering, KDS, inventory, staff controls, payments, branch analytics, campaigns, and franchise readiness.
## Business Goals

Reach repeat student usage around dense college clusters, beginning with Hyderabad and expanding to additional education zones.

Increase average order value through meal combos, shakes, sides, and bundles while keeping student entry products affordable.

Reduce branch leakage by making every sale, stock movement, discount, approval, and reward auditable.

Build playbooks that allow the founder to manage many branches without being physically present at every counter.

Create a community engine through referrals, rewards, photo contests, campus campaigns, and student ambassador loops.
## Product Goals

Make ordering fast: students should complete pickup, dine-in, or voice-order checkout before the break rush reaches the hatch.

Make branch operations visible: inventory, KDS, orders, staff actions, offers, hatches, and outlet-level metrics must be available to the owner.

Make growth measurable: every referral, campaign, contest, coupon, and upsell must have conversion analytics.

Make the experience emotional: the website must communicate greenery, water, fish pond, student hangout energy, study comfort, affordability, and speed.
## User Personas

Budget Student: wants affordable daily food, simple rewards, and low-friction ordering.

Social Student: wants a place to meet friends, take photos, try colorful shakes, and share experiences.

Study Student: wants a calmer third place with seating, charging, water ambiance, and repeat drinks/snacks.

Rush Student: wants pre-paid pickup with no queue and reliable token/barcode validation.

Founder / Owner: wants centralized branch control, margin visibility, staff auditability, and growth intelligence.

Branch Staff: needs simple interfaces for KDS, hatch handoff, express sales, inventory adjustments, and approvals.
## Customer Journeys

Discovery: student sees Hau Hau through Instagram, referral link, campus friend, contest photo, or QR table card.

Ordering: student browses menu, receives burger-to-meal upsell, selects pickup/dine-in/delivery, applies rewards within the 20 percent shield, and pays digitally.

QR Dine-In: student scans table QR; app locks dine-in, auto-fills the table number, prevents channel switching, and sends the table order to KDS.

Rush Pickup: student pre-orders via PWA or voice, pays upfront, receives token/barcode, and collects at the hatch after scan verification.

Community: student posts photo contest entry, shares referral code, earns points, and returns within the 45-day reward window.

Owner Ops: owner reviews daily revenue, COGS, low-stock alerts, campaign conversion, staff approval requests, and outlet comparison.
## Existing Implementation Audit

Frontend: Next.js App Router with customer landing/menu/cart/profile, admin, manager, KDS, scanner, delivery, and voice checkout routes.

Customer experience: cinematic scroller, dynamic campaign hero, menu preview, social proof, rewards teaser, referral CTA, cart checkout, address saving, GPS delivery support, and floating order tracking.

Admin: dashboard, menu, offers/campaign coupons, inventory, CRM, staff, outlets, atmosphere/UI manager, approvals, and order management are present.

Backend: Firebase client/admin services, Firestore order creation, stock registry, offers, point ledger, Notion sync, Gemini/Groq routes, webhook routes, cron cleanup, delivery routing, voice-order verification, and export backup.

Operations: KDS station pages, order cards, order push controls, rider dispatch, scanner client, inventory low-stock alerts, conversion recipes, and manager approval concepts exist.

Security: middleware protects operational routes; Firestore rules are present; API secret protects voice verification; TOTP approval patterns appear in admin inventory flows.
## Partially Implemented Features

Loyalty and referral exist, but fraud controls, milestone visibility, reward redemption, and analytics need product hardening.

Inventory exists, but normal checkout and voice checkout do not appear to share one canonical stock reservation/deduction engine.

Campaigns/offers exist, but campaign storytelling, conversion measurement, and owner-friendly lifecycle workflows are incomplete.

Delivery exists with map/rider dispatch concepts, but campus-specific batching, OTP handoff, and route performance need full acceptance criteria.

Admin approvals exist, but audit logs and role-based permission boundaries need stronger definition.
## Missing Features

QR table ordering with URL table parsing, channel lock, manipulation prevention, and server-side validation.

Make It A Meal upsell modal with fries, milkshake, thickshake, combo prices, and conversion tracking.

Photo Of The Week contest: upload portal, admin approval, weekly winner selection, gallery, reward issue, and abuse moderation.

Express counter/hatch sale module for owner-selected items such as tea or selected snacks, with quantity capture and inventory ledger.

Combo builder and contribution-margin engine in admin.

Branch P&L dashboard: revenue, COGS, platform fees, utility share, staff costs, wastage, and contribution margin by SKU.

Founder-ready onboarding docs, SOPs, role checklists, and franchise operating controls.

## Gap Analysis Matrix

| Requirement | Current State | Missing Components | Priority | Effort | Risk |
| --- | --- | --- | --- | --- | --- |
| Dine-In QR Ordering | Cart defaults to dine-in and captures table number manually; no search param parsing found in cart page. | Parse `?table=5`, lock order type, disable pickup/delivery, persist table source, validate server-side. | P0 | M | Revenue and service errors if table orders can be spoofed. |
| Make It A Meal Upsell | Menu opens customization modal and adds items to cart; no burger-triggered meal upsell found. | Upsell modal, combo SKU/pricing rules, add-on suggestions, conversion analytics. | P0 | M | Lower average ticket size and weak combo execution. |
| Photo Of The Week Contest | Campaign/offer systems exist; no contest upload, approval, weekly winner, or reward workflow found. | Mobile upload portal, moderation queue, winner scheduler, reward issuance, gallery. | P1 | L | Missed community growth loop and unsafe user-generated content if rushed. |
| Voice Order Verification Hardening | Voice verify route creates order and points ledger transaction; normal checkout has richer stock deduction transaction. | Atomic stock validation/deduction inside payment confirmation, idempotency key, payment proof binding, replay protection. | P0 | L | Overselling, fraud, and inventory mismatch during rush. |
| Platform Fee Logic | Cart applies flat Rs 5 platform fee to all orders. | Owner-configured fee rules by channel/cart threshold/item class and clear bill labeling. | P1 | S | Student friction on low-ticket/high-frequency items. |
| Counter/Offline Hatch Items | No dedicated express counter-sale pipeline identified. | Owner-selected offline/express SKUs, quantity prompt or fast grid, staff ledger, inventory decrement, receipt audit. | P1 | M | Manual sales create leakage and invisible inventory variance. |
| Admin Panel | Admin tabs cover dashboard, menu, offers, inventory, CRM, staff, outlets, atmosphere, approvals, orders. | Contest management, QR table management, combo builder, fee rules, branch P&L, audit trails. | P1 | L | Founder cannot scale branches with current controls alone. |
| Analytics | Dashboard stats and CRM exist; offer conversion and funnel metrics are limited. | QR conversion, upsell acceptance, contest participation, cohort retention, item contribution margin. | P1 | M | Growth decisions become guesswork. |
| Database / Backend | Firestore is active; Supabase dependency exists but no deployed schema/migrations found in repo. | Canonical data model decision, migrations, RLS/security rules, idempotent server APIs. | P0 | L | Split architecture confusion and security drift. |
| Security | Middleware protects admin/manager/KDS/delivery; Firebase rules exist; device fingerprint dependency present. | Role matrix, server-side authorization for every mutation, payment verification, audit logs, device abuse controls. | P0 | L | Operational and financial abuse risk. |
## Broken / Risky Areas

Flat Rs 5 platform fee is currently always added in cart. This should become configurable and contextual, because the business discussion distinguishes low-ticket hatch items, platform leakage, and customer friction.

Cart state uses local client state for order type and table number; dine-in QR requirements require tamper-resistant server validation.

Voice payment confirmation creates an order inside a transaction, but stock validation/deduction requirements are not visibly enforced in that same route.

The repo contains Firebase and Supabase dependencies/discussions. The team must choose a canonical production backend path before adding more schema logic.

Some branding strings still say Oasis Cafe while vision documents say Hau Hau; brand naming must be normalized.
## Technical Debt

Large client components mix data fetching, business rules, styling, and checkout logic, increasing regression risk.

Inline styles dominate major customer screens, making design system evolution harder.

Business rules are duplicated across cart, checkout helper, voice verify route, and admin seed logic.

Generated/default README does not document actual architecture, environment setup, Firestore collections, or production runbooks.

Sensitive local files such as service account material appear in the repository tree and require immediate secret hygiene review.

Testing coverage is not evident from scripts; package scripts define lint/build but no automated unit/e2e test suite.
## Frontend Requirements

Landing page must tell the Hau Hau story in the first viewport: student cafe, fast ordering, greenery/water ambiance, affordable combos, rewards, and community.

Menu must support items, combos, availability, outlet selection, category filtering, offer display, customization, upsell, and cart persistence.

Cart must support channel-specific flows: pickup hatch, QR dine-in table lock, delivery address/GPS, platform fee rules, coupons, points, and payment handoff.

Profile must expose referrals, points, vouchers, order history, saved addresses, security settings, and contest submissions.

Admin UI must cover menu, combos, offers, contest moderation, QR table generation, inventory, staff, branch config, analytics, and approvals.
## Backend Requirements

All order creation paths must call one canonical server-side order service for validation, pricing, stock reservation/deduction, payment binding, loyalty ledger updates, and KDS emission.

Every payment confirmation must be idempotent and tied to a unique checkout session and gateway/UPI confirmation reference.

Inventory changes must be transactional where supported, auditable, outlet-scoped, and reversible only through explicit refund/cancel flows.

Admin mutations must be role-gated and logged with actor, timestamp, before/after values, outlet, and approval status.

Campaigns, contests, QR tables, combos, and platform fee rules must be stored as owner-configurable data, not hardcoded UI constants.
## Database Requirements

Core entities: users, outlets, menu_items, combo_rules, modifier_groups, carts/checkout_sessions, orders, order_items, payments, stocks, stock_movements, hatches, qr_tables, offers, campaigns, contest_entries, rewards, vouchers, point_ledger, staff, roles, approvals, audit_logs.

Each order item must retain menu item id, name snapshot, unit price, quantity, modifiers, station, status, stock deduction status, and fulfillment channel.

QR table records must include outlet_id, table_no, token/secret, active status, allowed order type, created_by, and rotation metadata.

Contest entries must include submitter, image URL, caption, branch/campus, status, moderator notes, votes/engagement, week key, winner flag, and reward id.

Stock movements must distinguish sale deduction, express counter sale, manual adjustment, spoilage, refund, batch conversion, and transfer.
## Admin Requirements

Owner dashboard: today revenue, net payable, platform fees, COGS estimate, order count, AOV, rush throughput, low stock, pending approvals, top items, campaign conversion, and branch ranking.

Menu management: SKU, price, raw making cost, station, availability, outlet scope, recipe, modifiers, image, sort order, combo eligibility.

Combo management: bundle items, displayed savings, real margin, active windows, channels, and upsell copy.

Contest management: review entries, approve/reject, select weekly winner, issue rewards, and publish gallery.

QR table management: generate, print, rotate, disable, map to physical tables, and monitor dine-in orders.

Counter sales: owner chooses eligible SKUs, staff selects item and quantity, payment is recorded, inventory decrements, and sale appears in daily ledger.
## QR Ordering System

Acceptance criteria: visiting `/cart?table=5` or equivalent route must set order type to dine-in, fill table 5, and disable pickup/delivery selectors.

The table number must not be trusted from client text alone. The server must verify a signed QR token or active QR table record.

KDS and admin screens must show table number prominently and separate dine-in from pickup/delivery where useful.

QR scans should be tracked with scan count, checkout start, order conversion, repeat order, and table revenue.
## Upsell Engine

Trigger when a standalone burger enters cart and no qualifying fries/shake combo exists.

Modal must offer Make It A Meal options: fries, milkshake, thickshake, and curated combo prices.

User can accept, decline, or choose another add-on; declining should suppress repeated prompts for that item/session.

Analytics must track prompt shown, accepted, declined, option selected, incremental revenue, and margin.
## Contest System

Mobile upload portal must accept photo, caption, branch/campus, and consent for display.

Admin approval is mandatory before public display.

Weekly winner selection can begin manual; future automation can score engagement, votes, and moderation rules.

Reward issuance must create a voucher or point ledger entry and notify the winner.

Public gallery should reinforce Hau Hau's water/greenery/shake/story world without exposing unsafe or unapproved content.
## Campaign System

Campaigns must support seasonal hero layouts, coupon codes, category scope, start/end date, branch scope, media, push/WhatsApp copy, and conversion analytics.

Exam stress campaigns should target comfort items and time windows.

Referral campaigns should expose milestone rewards such as fries, shake, and popcorn/drink unlocks.

Campaign content should be editable by owner but deployed through safe templates to prevent broken hero layouts.
## Analytics System

Core metrics: daily active ordering students, repeat purchase rate, average order value, combo attach rate, burger-to-meal conversion, QR table conversion, voice checkout completion, pickup wait time, KDS prep time, contest participation, referral activation, and branch margin.

Operational metrics: stock variance, spoilage, low-stock events, staff approval actions, canceled sessions, expired voice orders, and refund frequency.

Dashboards must support outlet, date range, order channel, category, campaign, and student cohort filters.
## Security Requirements

Require server-side auth and role authorization for all admin, staff, KDS, scanner, delivery, inventory, and payment confirmation APIs.

Protect reward abuse through device fingerprinting, referral fraud checks, campus email verification where applicable, and rate limits.

Bind payment confirmations to checkout sessions and order amounts; never trust client-submitted totals.

Move secrets out of source control and rotate any exposed credentials before production.

Maintain audit logs for discounts, stock changes, manual counter sales, role changes, approvals, QR table rotations, and refunds.
## Performance Requirements

Customer pages must be mobile-first and fast on low-end Android devices near campuses.

KDS and counter screens must update in near real time and remain readable during rush.

Checkout and voice confirmation should complete within seconds under normal load.

Images must be optimized; heavy hero animation should degrade gracefully on weaker devices.

Offline/poor-network states should show clear retry and no double-order behavior.
## Mobile Requirements

Primary flows must be thumb-friendly: browse, add, customize, upsell, pay, track, scan pickup, and reorder.

QR dine-in must open directly into the correct context without requiring students to understand order-type settings.

Photo contest upload must work from phone gallery/camera with progress and retry states.

Profile, referral sharing, rewards, and order tracker must be compact and scannable.
## Design System

Keep the Hau Hau brand distinct from generic dark cafe UI: greenery, water, student third-place energy, food photography, and warm affordable premium cues.

Normalize remaining Oasis naming to Hau Hau.

Create reusable components for buttons, tabs, modals, item cards, bill rows, reward cards, approval rows, stat cards, and KDS tickets.

Accessibility: maintain readable contrast, focus states, keyboard navigation for admin, alt text for uploaded imagery, and clear error states.
## API Requirements

`POST /api/checkout/session`: create priced checkout session from cart, channel, outlet, table token, and discounts.

`POST /api/payment/confirm`: verify payment, finalize order, deduct stock, update points, and emit KDS ticket idempotently.

`POST /api/qr/resolve`: validate QR token and return locked dine-in context.

`POST /api/contest/entries`: upload/record contest submission.

`POST /api/counter-sales`: create express hatch sale with SKU, quantity, staff id, payment reference, stock movement.

`GET /api/analytics/*`: owner dashboards for funnel, branch, campaign, inventory, and contest metrics.
## Development Roadmap

Phase 0: security and architecture cleanup. Choose canonical backend path, document collections, rotate secrets, define roles, add env/runbook docs.

Phase 1: order core hardening. Build canonical checkout service, idempotent payment confirmation, stock transaction, and QR dine-in lock.

Phase 2: revenue features. Add combo builder, make-it-a-meal upsell, platform fee rules, and analytics.

Phase 3: community growth. Launch contest system, referral milestone UX, campaign dashboards, and public gallery.

Phase 4: branch OS. Add counter sales, branch P&L, audit logs, SOP screens, franchise controls, and multi-outlet benchmarking.

Phase 5: scale readiness. Load testing, e2e tests, monitoring, backups, privacy review, deployment playbooks, and staff training materials.
## Development Sprint Plan

Sprint 1: architecture decision record, README/runbook, secret hygiene, route inventory, data model freeze, and acceptance test skeletons.

Sprint 2: canonical checkout pricing and order service; move cart totals server-side; add idempotency and payment session state.

Sprint 3: QR dine-in flow including signed QR table records, locked cart UI, server validation, and KDS display.

Sprint 4: voice-order stock hardening; reuse canonical order service; add replay/payment fraud tests.

Sprint 5: combo data model, admin combo builder, burger upsell modal, and conversion analytics.

Sprint 6: contest upload, moderation, weekly winner, reward issuance, public gallery, and abuse controls.

Sprint 7: express counter sales with quantity flow, staff ledger, stock movement, and daily reconciliation.

Sprint 8: owner analytics dashboard, branch P&L, campaign metrics, and release hardening.
## Team Structure Recommendation

Product Manager: owns PRD, acceptance criteria, backlog, campus pilot learning, and tradeoff decisions.

Tech Lead / Full-stack Architect: owns data model, API boundaries, security posture, and code review.

Frontend Engineer: owns customer PWA, admin UI, KDS/counter screens, responsiveness, and accessibility.

Backend Engineer: owns checkout, payments, inventory, loyalty ledger, analytics APIs, and integrations.

QA Engineer: owns regression suite, rush-flow e2e tests, payment/idempotency tests, and device testing.

UI/Brand Designer: owns Hau Hau storytelling, design system, food/ambiance visual language, and campaign templates.

Operations Lead: owns SOPs, branch role definitions, inventory process, staff training, and launch readiness.
## Skill Requirements Per Team Member

PM: QSR operations, funnel metrics, student consumer behavior, backlog writing, launch analytics.

Tech Lead: Next.js, Firebase/Supabase decisioning, transactional data modeling, security, payments, observability.

Frontend: React, TypeScript, mobile-first UI, state management, animation restraint, forms, accessibility.

Backend: Firestore or Postgres, transactions, idempotency, auth, payment webhooks, queue/event design.

QA: Playwright, API testing, concurrency testing, mobile browser testing, test data generation.

Designer: product storytelling, food-commerce UX, component systems, responsive layouts, campaign design.

Ops: inventory controls, KDS workflows, staff training, theft prevention, branch reporting.
## Estimated Development Effort

MVP hardening for first controlled pilot: 6-8 focused sprints with 3-5 builders.

Full Hau Hau OS with contest, counter sales, branch P&L, and scalable analytics: 10-14 sprints depending on payment integration complexity.

Highest-risk work: payment verification, stock concurrency, role security, secret cleanup, and QR tamper prevention.

Fastest wins: brand naming cleanup, README/runbook, QR table UI shell, upsell modal prototype, and analytics event definitions.
## Recommended Architecture

Use Next.js as the application shell with server routes for trusted pricing, payment, and operations mutations.

Adopt one canonical database strategy for production. If staying on Firebase, formalize Firestore collections, security rules, transaction limits, and cloud functions. If migrating to Supabase, create migrations, RLS policies, edge functions, and typed clients before feature expansion.

Create a domain service layer: pricing service, checkout service, inventory service, loyalty service, campaign service, contest service, analytics service.

Keep clients thin: UI sends intent; server computes price, validates permissions, applies discounts, writes ledgers, and emits order events.

Add observability: structured logs, payment audit events, inventory variance reports, and error dashboards.
## Success Metrics

QR dine-in manipulation rate: zero accepted spoofed table orders in QA.

Voice order stock mismatch: zero oversold paid orders in concurrency tests.

Upsell attach rate: target 20-35 percent of standalone burger adds during pilot.

Contest participation: 25+ approved entries per campus per week after launch campaign.

Repeat purchase: increase 30-day repeat rate through points/referrals/campaigns.

Branch audit: daily reconciliation shows revenue, stock movement, manual sales, and approvals without unexplained variance.

## Implementation Evidence
- `src/app/(customer)/cart/page.tsx`: orderType/tableNo client state, flat platform fee, createOrder call.
- `src/lib/dbService.ts`: normal createOrder transaction with stock validation/deduction and low-stock alerts.
- `src/app/api/voice-order/verify/route.ts`: voice confirmation transaction creates order/points ledger but requires stock hardening.
- `src/components/admin/*`: existing admin modules for menu, offers, inventory, CRM, staff, outlets, atmosphere, approvals, orders.
- `src/components/customer/*`: landing, hero, menu preview, rewards, referral, order tracker, cart sheet, auth modal.
- `Pasted text(2).txt`: founder discussions on pricing, college locations, mist/greenery/fish pond theme, shakes, combos, QR ordering, hatch operations, security, and payments.
