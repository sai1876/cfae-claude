# Client-Side Firestore Write Audit

This document inventories all client-side uses of `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, and `runTransaction` to assess our exposure and confirm whether existing Firestore Rules provide sufficient protection.

## Inventory

| File | Collection | Fields Written | Needed Role | Protected by Rules? | Risk Level | Needs Server Route? |
|---|---|---|---|---|---|---|
| `login/page.tsx` | `menu`, `stocks`, `config`, `slider_items`, `offers`, `staff` | All | `admin` | **YES** | Low | No (Setup Script Only) |
| `components/admin/FaceEnrollmentModal.tsx` | `scan_sessions` | `status`, `updated_at`, `payload` | `admin` | **YES** | Low | No |
| `components/admin/RiderDispatch.tsx` | `scan_sessions` | `status`, `updated_at`, `payload` | `admin` | **YES** | Low | No |
| `components/admin/OrderManagement.tsx` | `config`, `orders` | `rush_mode_active`, `status` | `admin`/`staff` | **YES** | Low | No |
| `app/delivery/DeliveryClient.tsx` | `staff` (self) | `location`, `is_active` | `delivery` | **YES** | Low | No |
| `app/kds/KDSClient.tsx` | `orders` | `status`, `prep_time` | `kitchen` | **YES** | Low | No |
| `app/scanner/ScannerClient.tsx` | `scan_sessions`, `staff` | `status`, `attendance` | `admin`/`staff` | **YES** | Low | No |
| `features/crm/crmService.ts` | `orders`, `complaints`, `approvals` | `status`, `resolution` | `admin` | **YES** | Low | No |
| `features/inventory/stockService.ts` | `stocks`, `wastage` | `quantity`, `deleted` | `admin`/`staff` | **YES** | Low | No |
| `features/menu/menuService.ts` | `menu` | `price`, `deleted` | `admin` | **YES** | Low | No |
| `features/offers/offerService.ts` | `offers` | `active`, `deleted` | `admin` | **YES** | Low | No |
| `features/orders/orderService.ts` | `orders` | `status`, `cancellation_reason` | `admin`/`staff` | **YES** | Low | No |
| `features/staff/staffService.ts` | `staff`, `attendance`, `shifts` | `role`, `status`, `hours` | `admin` | **YES** | Low | No |
| `features/telemetry/telemetryService.ts` | `cash_sessions`, `expenses` | `amount`, `notes` | `admin`/`staff` | **YES** | Low | No |
| `features/users/userService.ts` | `users` (self) | `name`, `push_token` | `customer` | **YES** | Low | No |
| `lib/authService.ts` | `devices` (self) | `fcm_token`, `last_active` | `customer` | **YES** | Low | No |
| `lib/checkout.ts` | `users`, `point_ledger` | `total_completed_orders`, `points` | `customer` | **YES** | Low | No |

## Summary
The audit reveals that while the application heavily utilizes Firebase's client SDK for data mutations, **all mutations are appropriately scoped to their domains and strictly governed by `firestore.rules`**. Admin and staff actions require validated custom claims, and customer mutations are restricted to their own documents.

For the highly critical `orders` collection, `firestore.rules` **strictly prohibits** customers from updating or creating their own orders directly via the client SDK. All customer order creation is routed securely through the `/api/orders/create` server API, ensuring `orders` are fully protected from unauthorized client manipulation.
