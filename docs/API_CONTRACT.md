# ORVEX API contract

HTTP interfaces of an ORVEX installation and of the vendor platform. The interfaces are
industry-agnostic; examples use the demo data (GSM vertical pack).

1. [Conventions](#1-conventions)
2. [Installation APIs](#2-installation-apis) — admin, reseller portal, storefront (implemented by the prototype's mock routes, `src/mock/installation/routes/*`)
3. [Native API v1](#3-native-api-v1), [webhooks](#34-webhooks-standard-webhooks) and the [DHRU-compatible endpoint](#35-dhru-compatible-endpoint)
4. [Vendor platform API](#4-vendor-platform-api) — `src/mock/vendor/routes.ts`
5. [License server and release protocol](#5-license-server-and-release-protocol)

Source of truth for payloads: domain types in `src/core/domain/*` and DTOs in `src/types/installation.ts`.
Architecture context: `docs/ARCHITECTURE.md`.

---

## 1. Conventions

### 1.1 Surfaces

| Surface | Base URL | Consumers | Auth |
|---|---|---|---|
| Admin API | `https://<domain>/api/admin` | The operator console | Session cookie + CSRF, role permissions |
| Reseller portal API | `https://<domain>/api/portal` | The reseller portal | Account-member session |
| Storefront API | `https://<domain>/api/store` | The public storefront | Optional customer session; guest checkout |
| Native API v1 | `https://<domain>/v1` | Resellers', businesses' and partners' systems | `Authorization: Bearer orx_live_…` |
| DHRU-compatible endpoint | `https://<domain>/api/dhru` | Legacy DHRU Fusion reseller clients | `username` + `apiaccesskey` form fields |
| Supplier callbacks | `https://<domain>/hooks/suppliers/:id` | Suppliers that push results | Supplier signature (driver-specific) |
| Payment gateway webhooks | `https://<domain>/hooks/payments/:gateway` | Payment gateways | Gateway signature, de-duplicated by event id |
| Vendor platform API | `https://account.orvex.io/api` | The vendor portal | Vendor session |
| License / release servers | `https://license.orvex.io/v1`, `https://releases.orvex.io/v1` | Installations | Ed25519 signatures, license-scoped tokens |

### 1.2 Format

* JSON, UTF-8, ISO-8601 UTC timestamps.
* **Internal APIs (admin, portal, storefront) use camelCase** and carry money as integer **micros**
  (`Micros`: 1 USD = 1 000 000), exactly as `src/types/installation.ts`.
* **Public APIs (native API v1, webhooks) use snake_case** and money as decimal strings:
  `{"amount": "0.94", "currency": "USD"}`.
* Fulfilment `status` and `financial_status` are always separate fields.

### 1.3 Errors

```json
{ "error": { "code": "validation_failed", "message": "Input validation failed", "details": { "fields": { "imei": "Invalid IMEI — Luhn check digit does not match" } } } }
```

| HTTP | `code` (examples) | Meaning |
|---|---|---|
| 401 | `missing_api_key`, `invalid_api_key`, `expired_api_key` | Missing/invalid credentials |
| 402 | `insufficient_balance` | Wallet available + credit limit too low |
| 403 | `permission_denied`, `insufficient_scope`, `ip_not_allowed`, `account_frozen`, `channel_not_enabled`, `service_not_allowed` | Authenticated but not allowed |
| 404 | `not_found`, `route_not_found` | Unknown entity or route |
| 409 | `idempotency_conflict`, `invalid_transition`, `not_refundable`, `cannot_cancel`, `service_unavailable`, `duplicate_rule` | State conflict |
| 422 | `validation_failed` | Business validation failed (`details.fields` per field) |
| 429 | `rate_limited`, `limit_exceeded` | Rate or concurrency limit |
| 500 | `internal_error` | Unexpected error (logged with request id) |

Admin permission failures return `403 permission_denied` with the missing permission
(e.g. `refunds.create`) in `details.permission` — the UI is never the only guard.

### 1.4 Identifiers

| Entity | Internal id | Public reference |
|---|---|---|
| Order | `ord_…` | `ORD-7K3P9Q` (random Crockford base-32 — never sequential) |
| Guest tracking | — | 32-character random token (`/site/track/<token>`) |
| Account | `acc_…` | `AC-10001` |
| Service | `svc_…` | code `4001` (also the DHRU service id) |
| Supplier / product / offer | `sup_…` / `sp_…` / `off_…` | — |
| Payment / refund / chargeback | `pi_…` / `rfd_…` / `cbk_…` | `PAY-…`, `RFD-…`, `CBK-…` |
| Ledger transaction | `ltx_…` | `LTX-…` |
| Verification | `ver_…` | `VER-…` |
| Webhook message | — | `msg_…` (`webhook-id` header) |
| Request | `req_…` | `X-Request-Id` |

### 1.5 Idempotency

`Idempotency-Key` (native API, portal, storefront checkout) is scoped to the **account** for 24 h —
not to the API key or channel. Same body → the original order is returned (`Idempotent-Replayed:
true`); different body → `409 idempotency_conflict`.

---

## 2. Installation APIs

Paths below are as implemented by the prototype (the mock transport is mounted at the API root, so
`/admin/orders` is served as `/api/admin/orders` in production; `/portal/*` → `/api/portal/*`,
`/store/*` → `/api/store/*`). Handlers call the Core commands (`src/core/commands/*`).

### Cockpit, orders, reviews, verifications, accounts — `routes/adminOps.ts`

| Method | Path |
|---|---|
| `GET` | `/admin/cockpit` |
| `GET` | `/admin/orders` |
| `GET` | `/admin/orders/stats` |
| `GET` | `/admin/orders/:id` |
| `POST` | `/admin/orders` |
| `POST` | `/admin/orders/:id/cancel` |
| `POST` | `/admin/orders/:id/refund` |
| `POST` | `/admin/orders/:id/review/lookup` |
| `POST` | `/admin/orders/:id/review/confirm-not-received` |
| `POST` | `/admin/orders/:id/review/reference` |
| `POST` | `/admin/orders/:id/review/resolve` |
| `GET` | `/admin/verifications` |
| `POST` | `/admin/verifications/:id/recheck` |
| `POST` | `/admin/verifications/:id/request-supplier` |
| `POST` | `/admin/verifications/:id/approve` |
| `POST` | `/admin/verifications/:id/reject` |
| `GET` | `/admin/accounts` |
| `GET` | `/admin/accounts/:id` |
| `POST` | `/admin/accounts` |
| `PATCH` | `/admin/accounts/:id` |
| `POST` | `/admin/accounts/:id/status` |
| `POST` | `/admin/accounts/:id/adjust` |
| `POST` | `/admin/accounts/:id/top-up` |
| `POST` | `/admin/accounts/:id/members` |
| `PATCH` | `/admin/members/:id` |
| `GET` | `/admin/accounts-summary` |

### Catalog, pricing, suppliers, catalog sync — `routes/adminCatalog.ts`

| Method | Path |
|---|---|
| `GET` | `/admin/categories` |
| `GET` | `/admin/services` |
| `GET` | `/admin/services/:id` |
| `POST` | `/admin/services` |
| `PATCH` | `/admin/services/:id` |
| `POST` | `/admin/services/:id/revisions` |
| `POST` | `/admin/services/:id/price` |
| `POST` | `/admin/services/:id/offers` |
| `PUT` | `/admin/services/:id/offers/order` |
| `PATCH` | `/admin/offers/:id` |
| `DELETE` | `/admin/offers/:id` |
| `GET` | `/admin/pricing` |
| `GET` | `/admin/pricing/matrix` |
| `POST` | `/admin/pricing/quote` |
| `POST` | `/admin/pricing/rules` |
| `PATCH` | `/admin/pricing/rules/:id` |
| `DELETE` | `/admin/pricing/rules/:id` |
| `GET` | `/admin/drivers` |
| `GET` | `/admin/suppliers` |
| `GET` | `/admin/suppliers/:id` |
| `POST` | `/admin/suppliers` |
| `POST` | `/admin/suppliers/:id/test` |
| `POST` | `/admin/suppliers/:id/balance` |
| `POST` | `/admin/suppliers/:id/sync` |
| `POST` | `/admin/suppliers/:id/maintenance` |
| `POST` | `/admin/suppliers/:id/circuit-reset` |
| `POST` | `/admin/suppliers/:id/credentials` |
| `PATCH` | `/admin/suppliers/:id` |
| `POST` | `/admin/suppliers/:id/top-up` |
| `GET` | `/admin/sync/changes` |
| `GET` | `/admin/sync/runs` |
| `POST` | `/admin/sync/changes/decide` |
| `GET` | `/admin/products` |

### Ledger, finance, payments, developer, notifications, audit — `routes/adminFinanceDev.ts`

| Method | Path |
|---|---|
| `GET` | `/admin/ledger/transactions` |
| `GET` | `/admin/ledger/accounts` |
| `GET` | `/admin/ledger/integrity` |
| `GET` | `/admin/finance/reconciliation` |
| `GET` | `/admin/finance/summary` |
| `GET` | `/admin/payment-methods` |
| `PATCH` | `/admin/payment-methods/:id` |
| `GET` | `/admin/payments` |
| `POST` | `/admin/payments/:id/confirm` |
| `POST` | `/admin/payments/:id/chargeback` |
| `POST` | `/admin/payments/:id/replay-webhook` |
| `GET` | `/admin/refunds` |
| `GET` | `/admin/chargebacks` |
| `POST` | `/admin/chargebacks/:id/resolve` |
| `GET` | `/admin/api-keys` |
| `POST` | `/admin/api-keys` |
| `POST` | `/admin/api-keys/:id/revoke` |
| `PATCH` | `/admin/api-keys/:id` |
| `GET` | `/admin/api-logs` |
| `GET` | `/admin/api-logs/stats` |
| `POST` | `/admin/console/native` |
| `POST` | `/admin/console/dhru` |
| `GET` | `/admin/dhru` |
| `GET` | `/admin/webhooks` |
| `POST` | `/admin/webhooks` |
| `PATCH` | `/admin/webhooks/:id` |
| `DELETE` | `/admin/webhooks/:id` |
| `POST` | `/admin/webhooks/:id/test` |
| `GET` | `/admin/webhook-deliveries` |
| `POST` | `/admin/webhook-deliveries/:id/replay` |
| `GET` | `/admin/inbound-webhooks` |
| `GET` | `/admin/notifications` |
| `GET` | `/admin/notifications/config` |
| `PATCH` | `/admin/notifications/routes/:id` |
| `PATCH` | `/admin/notifications/channels/:id` |
| `GET` | `/admin/audit` |

### Identity, users & roles, system, storefront admin, DHRU migration — `routes/adminSystem.ts`

| Method | Path |
|---|---|
| `GET` | `/admin/me` |
| `GET` | `/admin/permissions` |
| `GET` | `/admin/users` |
| `GET` | `/admin/roles` |
| `POST` | `/admin/users` |
| `POST` | `/admin/users/:id/role` |
| `POST` | `/admin/users/:id/sessions/:sid/revoke` |
| `GET` | `/admin/system/health` |
| `GET` | `/admin/system/installation` |
| `GET` | `/admin/system/license` |
| `POST` | `/admin/system/license/validate` |
| `GET` | `/admin/system/updates` |
| `POST` | `/admin/system/updates/check` |
| `POST` | `/admin/system/updates/complete` |
| `GET` | `/admin/system/settings` |
| `PATCH` | `/admin/system/settings/:section` |
| `GET` | `/admin/system/go-live` |
| `PATCH` | `/admin/system/extensions/:id` |
| `GET` | `/admin/storefront` |
| `PATCH` | `/admin/storefront/draft` |
| `PUT` | `/admin/storefront/draft/pages/:id` |
| `POST` | `/admin/storefront/draft/pages` |
| `DELETE` | `/admin/storefront/draft/pages/:id` |
| `POST` | `/admin/storefront/draft/discard` |
| `POST` | `/admin/storefront/publish` |
| `PATCH` | `/admin/storefront/settings` |
| `GET` | `/admin/migration` |
| `POST` | `/admin/migration/run` |

#### Storefront publishing model

Storefront **content** (pages, typed blocks, navigation, theme, service-page templates, SEO, languages)
is versioned as `StorefrontRevision`s (`src/core/domain/storefront.ts`). The installation always has
exactly one **draft** and one **published** revision, plus a short history of superseded ones.

* `GET /admin/storefront` returns `StorefrontEditorView`: the **draft** content + live settings +
  `publishing` (draft/published versions, `hasUnpublishedChanges`, a computed `changes` list,
  `blockers`, per-page `pageStates`, `previewPath`, history). `previewPath` is blanked for users
  without `storefront.manage`.
* `PATCH /admin/storefront/draft` (theme, nav, footerNav, templates, locales, seo) and the
  `/draft/pages` routes only ever change the **draft**. Nothing visitors see changes.
* `POST /admin/storefront/publish` `{ expectedDraftUpdatedAt }` promotes the saved draft in one step:
  validates (`blockers` — home page public, no navigation/button links or checkout terms pointing at
  hidden/deleted pages, one default template), moves the old published revision to history, and forks a
  new draft with a new preview token. `409 draft_changed` if the draft changed since the admin reviewed
  it; `409 nothing_to_publish` if the draft equals the published revision.
* `POST /admin/storefront/draft/discard` resets the draft to a copy of the published revision.
* `PATCH /admin/storefront/settings` changes **live** commerce settings (`checkout`) — not versioned.
  Media and domain are live settings too. Catalog data (services, prices, fields, availability,
  suppliers, routing) is never part of storefront content.

### Reseller portal (`/api/portal`) — `routes/portal.ts`

| Method | Path |
|---|---|
| `GET` | `/portal/me` |
| `GET` | `/portal/dashboard` |
| `GET` | `/portal/services` |
| `GET` | `/portal/services/:id` |
| `GET` | `/portal/orders` |
| `GET` | `/portal/orders/:id` |
| `POST` | `/portal/orders` |
| `POST` | `/portal/orders/bulk/validate` |
| `POST` | `/portal/orders/bulk` |
| `POST` | `/portal/orders/:id/cancel` |
| `POST` | `/portal/orders/:id/verify` |
| `GET` | `/portal/wallet` |
| `POST` | `/portal/wallet/top-up` |
| `POST` | `/portal/payments/:id/complete` |
| `GET` | `/portal/statements` |
| `GET` | `/portal/api-keys` |
| `POST` | `/portal/api-keys` |
| `POST` | `/portal/api-keys/:id/revoke` |
| `GET` | `/portal/webhooks` |
| `POST` | `/portal/webhooks` |
| `PATCH` | `/portal/webhooks/:id` |
| `DELETE` | `/portal/webhooks/:id` |
| `POST` | `/portal/webhooks/:id/test` |
| `GET` | `/portal/api-logs` |
| `GET` | `/portal/members` |
| `POST` | `/portal/members` |
| `PATCH` | `/portal/members/:id` |
| `GET` | `/portal/summary-spend` |

### Storefront (`/api/store`) — `routes/store.ts`

| Method | Path |
|---|---|
| `GET` | `/store/config` (`?preview=<token>`) |
| `POST` | `/store/catalog` |
| `GET` | `/store/search` |
| `GET` | `/store/services/:slug` (`?preview=<token>`) |
| `POST` | `/store/checkout` |
| `POST` | `/store/payments/:id/complete` |
| `POST` | `/store/orders/:token/retry-payment` |
| `GET` | `/store/track/:token` |
| `GET` | `/store/lookup` |
| `GET` | `/store/account` |
| `POST` | `/store/session` |

`/store/config` and `/store/services/:slug` resolve content from the **published** revision (hidden
pages removed). With `?preview=<token>` — the current draft's token from `publishing.previewPath` —
they resolve the **draft** instead and `revision.status` is `draft`. An invalid or rotated token is
`403 preview_invalid`; it never falls back to either version. Prices, fields and availability are
always resolved live from the catalog, in both modes.

### DEMO / SIMULATION (not part of the product) — `routes/demo.ts`

| Method | Path |
|---|---|
| `GET` | `/demo/state` |
| `POST` | `/demo/supplier-behaviour` |
| `POST` | `/demo/supplier-behaviour/clear` |
| `POST` | `/demo/supplier-state` |
| `POST` | `/demo/traffic` |
| `POST` | `/demo/payment-outcome` |
| `POST` | `/demo/verification-outcome` |
| `POST` | `/demo/fast-forward` |
| `POST` | `/demo/act-as` |
| `POST` | `/demo/portal-member` |
| `POST` | `/demo/storefront-customer` |
| `POST` | `/demo/license` |
| `POST` | `/demo/reset` |

---

## 3. Native API v1

### 3.1 Requests

* `Authorization: Bearer orx_live_…` — keys belong to accounts; scopes `services:read`,
  `orders:read`, `orders:write`, `account:read`, `webhooks:manage`; optional IP allow-list; per-key
  rate limit (`X-RateLimit-Limit`).
* `Idempotency-Key: <unique string>` on `POST /v1/orders` and `/v1/orders/batch` (account-scoped).
* Every response carries `X-Request-Id`.

### 3.2 Endpoints

| Method | Path | Scope | Notes |
|---|---|---|---|
| GET | `/v1/services` | `services:read` | Services visible to the account with **its** price and availability, input JSON schema and result fields |
| GET | `/v1/services/:id` | `services:read` | By service code |
| POST | `/v1/orders` | `orders:write` | `{service, input, client_reference}` → `201` order (`200` + `Idempotent-Replayed` on replay) |
| POST | `/v1/orders/batch` | `orders:write` | `{orders: [...]}` (≤ 100) → `207` with per-item results; item keys derive from the Idempotency-Key |
| GET | `/v1/orders` | `orders:read` | Own orders, `status`, `limit` |
| GET | `/v1/orders/:id` | `orders:read` | By `ORD-` reference |
| POST | `/v1/orders/:id/cancel` | `orders:write` | Only before a supplier has the order |
| POST | `/v1/orders/:id/verify` | `orders:write` | Open a verification request (after-care) |
| GET | `/v1/account` | `account:read` | Balance projection: available, held, credit limit; pricing tier |
| GET | `/v1/account/transactions` | `account:read` | Wallet statement lines |

### 3.3 Example

```http
POST /v1/orders
Authorization: Bearer orx_live_a3c1_…
Idempotency-Key: abc-pos-20261004-7781
Content-Type: application/json

{ "service": "4001", "input": { "imei": "356938035643809" }, "client_reference": "POS-118204" }
```

```json
{
  "id": "ORD-7K3P9Q", "object": "order", "status": "queued", "status_detail": null,
  "financial_status": "held",
  "service": { "id": "4001", "name": "iPhone 15 Carrier Check", "revision": 1 },
  "input": { "imei": "356938035643809" },
  "price": { "amount": "0.94", "currency": "USD" },
  "refunded": { "amount": "0.00", "currency": "USD" },
  "result": null, "rejection": null, "client_reference": "POS-118204", "channel": "api",
  "created_at": "2026-10-04T15:31:02.114Z", "updated_at": "2026-10-04T15:31:02.114Z", "completed_at": null
}
```

Statuses: `awaiting_payment`, `queued`, `processing` (with `status_detail` `at_supplier` or
`under_review`), `completed`, `rejected`, `cancelled`; `financial_status`: `none`, `held`,
`captured`, `released`, `partially_refunded`, `refunded`.

### 3.4 Webhooks (Standard Webhooks)

Events: `order.created`, `order.processing`, `order.completed`, `order.rejected`, `order.cancelled`,
`order.refunded`, `account.balance_low`, `service.updated`; operator endpoints may also receive
`order.needs_review`.

```http
POST https://pos.abcgsm.example/orvex/webhook
webhook-id: msg_2Lk9QpXv…
webhook-timestamp: 1759591862
webhook-signature: v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=
Content-Type: application/json

{ "type": "order.completed", "timestamp": "2026-10-04T15:31:58Z", "data": { "id": "ORD-7K3P9Q", "status": "completed", … } }
```

Verify: `base64(HMAC-SHA256(secret, webhook-id + "." + webhook-timestamp + "." + raw_body))`, constant
time comparison, reject timestamps older than 5 minutes, de-duplicate on `webhook-id`. Retries:
immediately, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h.

### 3.5 DHRU-compatible endpoint

`POST /api/dhru` (form fields): `username` (account email), `apiaccesskey` (ORVEX key with DHRU
compatibility), `action`, `requestformat=JSON`, `parameters` (XML).

| Action | Parameters | Response |
|---|---|---|
| `accountinfo` | — | `{"SUCCESS":[{"AccoutInfo":{"credit":"842.50","held":"27.00",…}}]}` |
| `imeiservicelist` | — | Groups → services with the account's `CREDIT` (live price), `TIME`, requirements |
| `placeimeiorder` | `<ID>`, `<IMEI>`, `<MODELID>`, `<PROVIDERID>`, `<SN>`, `<REFERENCE>` | `{"SUCCESS":[{"MESSAGE":"Order received","REFERENCEID":"ORD-7K3P9Q"}]}` — `REFERENCE` doubles as idempotency key |
| `getimeiorder` | `<ID>ORD-…</ID>` | `{"SUCCESS":[{"STATUS":"4","CODE":"T-Mobile · Clean"}]}` |

Status mapping (edge only): 0 ← `awaiting_payment`/`queued`, 1 ← `processing`/`needs_review`,
3 ← `rejected`/`cancelled`, 4 ← `completed`. Errors are returned DHRU-style as
`{"ERROR":[{"MESSAGE":"Insufficient credit"}]}` with HTTP 200.

---

## 4. Vendor platform API

Base URL `https://account.orvex.io/api`, portal session cookie (independent from any installation
session). Implemented in the prototype by `src/mock/vendor/routes.ts`.

| Method | Path | Purpose | Type |
|---|---|---|---|
| GET | `/public/metrics` | Marketing figures (flagged `demo`) | `PublicMetrics` |
| GET | `/public/plans` | Public plans and pricing | `Plan[]` |
| POST | `/auth/login` | Sign in to the account portal `{email, password}` (+ MFA) | `{ok, account}` |
| GET | `/account/overview` | Portal home: account, subscription, license, latest stable release, open tickets, next invoice | `VendorOverview` |
| GET | `/account` | Account and team | `VendorAccount` |
| PATCH | `/account` | Update company and contact details | `VendorAccount` |
| GET | `/subscription` | Current subscription, add-ons, payment method (brand/last 4 only), usage | `Subscription` |
| PATCH | `/subscription` | Change plan, cycle, auto-renew, add-ons | `Subscription` |
| GET | `/plans` | Plans for upgrade/downgrade | `Plan[]` |
| GET | `/invoices` | Invoices | `Invoice[]` |
| GET | `/invoices/:id` | One invoice; `:id` = id or number (`INV-2026-0418`) | `Invoice` |
| POST | `/invoices/:id/pay` | Pay an open invoice. Production: creates a payment-provider session and returns its redirect URL; the platform never handles card data | `Invoice` |
| GET | `/payments` | Payment history | `Payment[]` |
| GET | `/license` | License, key (Owner/Technical only), domains, modules, installations, signature info | `VendorLicense` |
| GET | `/installations` | Activated installations with heartbeat metadata | `InstallationRef[]` |
| GET | `/installations/:id` | One installation | `InstallationRef` |
| GET | `/releases` | Release catalogue with notes, migrations, compatibility, package checksums | `Release[]` |
| GET | `/tickets` | Support tickets | `SupportTicket[]` |
| GET | `/tickets/:id` | One ticket with messages | `SupportTicket` |
| POST | `/tickets` | Open a ticket `{subject, body, priority?, category?, installationId?}` | `SupportTicket` |
| POST | `/tickets/:id/messages` | Reply `{body}` | `SupportTicket` |

Production additions: `POST /license/domains` (add/replace a licensed domain),
`POST /license/key/rotate`, `POST /installations/:id/deactivate` (free a slot when moving servers),
`POST /support-access-grants` / `DELETE /support-access-grants/:id` (consent records),
`GET /releases/:version/manifest` (signed manifest download for air-gapped installs).

None of these endpoints accepts or returns installation business data.

---

## 5. License server and release protocol

### 5.1 Request signing

Every request from an installation (except the very first part of activation, see below) is signed
with its **instance key** (Ed25519, generated at activation, private key on the data volume):

```
ORVEX-Installation: ORVEX-DEMO-001
ORVEX-Timestamp: 2026-10-01T08:54:00Z
ORVEX-Signature: ed25519:<base64 signature over
                   METHOD \n PATH \n TIMESTAMP \n hex(SHA-256(body))>
```

The server rejects timestamps outside ±5 minutes and replayed nonces. Responses carry
`ORVEX-Response-Signature` (Ed25519, license key `orvex-license-2026`) over the response body;
Core verifies it with the public key compiled into the image.

### 5.2 `POST /v1/activate`

Called by `orvexctl init` (and on domain change). Signed with the *new* instance key as proof of
possession; authorised by the license key.

```json
{
  "licenseKey": "LX-2048-AX91-7KQ2-M3PD",
  "installationId": "ORVEX-DEMO-001",
  "name": "UnlockDesk Production",
  "domain": "portal.unlockdesk-demo.com",
  "environment": "production",
  "instancePublicKey": "ed25519-pub:Hq3V…kP0=",
  "coreVersion": "2.4.1",
  "deployment": "vendor-assisted"
}
```

`200` → the signed license document (`docs/ARCHITECTURE.md § 11.2`).
Errors: `invalid_key`, `domain_not_licensed`, `installation_limit`, `subscription_inactive`,
`license_suspended`.

### 5.3 `POST /v1/validate`

Every 24 h ± jitter (at most hourly; retries back off from 15 min to 6 h).

```json
{
  "licenseId": "LIC-4829-AX",
  "installationId": "ORVEX-DEMO-001",
  "coreVersion": "2.4.1",
  "schemaVersion": "017",
  "nonce": "n_7a91c3e2f04b"
}
```

```json
{
  "receipt": {
    "licenseId": "LIC-4829-AX",
    "installationId": "ORVEX-DEMO-001",
    "status": "active",
    "validatedAt": "2026-10-01T08:54:00Z",
    "nextValidationAt": "2026-10-02T08:54:00Z",
    "cacheValidUntil": "2026-10-15T08:54:00Z",
    "gracePeriodDays": 14,
    "nonce": "n_7a91c3e2f04b"
  },
  "license": null,
  "signature": "ed25519:mE4x…Q2Lw"
}
```

`license` contains a re-issued license document when something changed (renewal, modules, domains).
`status` may be `active`, `suspended` (→ installation `invalid`) or `expired`.

### 5.4 `POST /v1/heartbeat` (optional)

Daily when `TELEMETRY_HEARTBEAT=minimal`; never sent when `off`. Returns `204` (or advisories).

```json
{
  "installationId": "ORVEX-DEMO-001",
  "coreVersion": "2.4.1",
  "schemaVersion": "017",
  "health": "healthy",
  "updateChannel": "stable",
  "licenseStatus": "active",
  "platform": { "node": "22.11.0", "postgres": "16.4", "runtime": "docker-compose" },
  "counters": { "adminUsers": 6 }
}
```

Nothing else is ever included: no order volumes, revenue, IMEIs or other order inputs, reseller or
end-customer data, hostnames or credentials.

### 5.5 `POST /v1/deactivate`

Frees the installation slot (moving to a new server, decommissioning). The old instance key is
revoked; the next activation creates a new binding.

### 5.6 Releases and artifacts

| Method | URL | Purpose |
|---|---|---|
| GET | `https://releases.orvex.io/v1/manifests?channel=stable&current=2.4.1` | Signed manifests newer than `current` for the channel, plus advisories; respects staged rollout |
| GET | `https://releases.orvex.io/v1/manifests/2.5.0` | One signed manifest (`orvex-release/v1`, see `docs/ARCHITECTURE.md § 10.1`) |
| POST | `https://license.orvex.io/v1/registry-token` | Signed request → short-lived pull token for `registry.orvex.io/core`, limited to versions released before `updatesUntil` |
| GET | `registry.orvex.io/v2/core/manifests/sha256:…` | OCI image pull **by digest** taken from the verified manifest |

The updater verifies the manifest signature with the keys in the currently installed Core, then the
image digest, bundle SHA-256 and migration checksums, before running anything from the new release.
