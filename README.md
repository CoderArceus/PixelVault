# PixelVault — Paid Media Locker

A backend + Android (Expo) mobile app where users upload images, set an unlock price in coins, and other users spend coins to unlock the original — locked users see a server-generated blurred preview only.

Built for the Konvo Full Stack Developer Internship assignment ("Paid Media Locker").

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) |
| Storage | S3-compatible (Minio / s3rver) |
| Image processing | Sharp (blur + downscale for previews) |
| Frontend | React Native (Expo), Android |
| Testing | Jest + Supertest |
| Containerization | Docker + docker-compose |

---

## Setup Instructions

### Prerequisites
- Docker Desktop (running)
  > **Windows Users:** Ensure the WSL2 backend is enabled in Docker Desktop settings. If you encounter permission or path errors when running `docker-compose`, checking WSL2 is the first step.
- Node.js 18+ (only needed if running the mobile app outside a container)
- Expo Go app on an Android device, or an Android emulator

### 1. Backend + infrastructure (Docker)

```bash
git clone <repo-url>
cd pixelvault
cp .env.example .env
docker-compose up --build
```

This brings up three services in one command:
- `api` — the Express backend
- `postgres` — PostgreSQL 16
- `s3rver` (Minio) — local S3-compatible storage

On first boot, migrations run automatically and create the `users`, `posts`, `unlocks`, and `transactions` tables (see [Database Schema](#database-schema)).

The API listens on `http://localhost:<PORT>` (see `.env.example` for the default).

### 2. Mobile app (Expo)

```bash
cd mobile
npm install
npx expo start
```

Point the app at your backend:
- **Android emulator**: use `http://10.0.2.2:<PORT>` as the API base URL (the emulator can't resolve `localhost` to your host machine)
- **Physical device via Expo Go**: use your machine's LAN IP, e.g. `http://192.168.x.x:<PORT>`

Scan the QR code from `expo start` with Expo Go, or press `a` to launch the Android emulator.

### 3. Running tests

```bash
cd backend
npm test
```

Runs the full Jest + Supertest suite against a real (test) Postgres + S3 instance — see [Testing](#testing) below for what's covered.

---

## Database Schema

Four tables, designed so that correctness (no double-charging, no leaked content, inventory persistence) falls out of the schema rather than needing special-case application logic:

- **`users`** — `id`, `email`, `password_hash` (bcrypt), `coin_balance` (starts at 100), `created_at`
- **`posts`** — `id`, `owner_id`, `price` (immutable), `storage_key_original`, `storage_key_preview`, `status` (`active`/`deleted`), `created_at`, `deleted_at`
- **`unlocks`** — `id`, `user_id`, `post_id`, `price_paid`, `created_at`, with a **`UNIQUE(user_id, post_id)`** constraint
- **`transactions`** — `id`, `user_id`, `unlock_id`, `amount` (negative for spend), `balance_after`, `created_at`

Full migration SQL: see `db/migrations/`.

**Key design decision**: `unlocks` is the permanent source of truth for access. Rows are never deleted from it, even when the underlying post is soft-deleted — this is what makes "buyers keep permanent access after the seller deletes a post" work without any special-case code, it's just a join.

---

## API Documentation

Full API contract (endpoints, auth requirements, request/response shapes) is exported as a Postman collection: `docs/PixelVault.postman_collection.json` (import directly into Postman).

Summary:

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create user, initialize wallet at 100 coins |
| POST | `/auth/login` | — | Returns access + refresh token |
| POST | `/auth/refresh` | refresh token | Rotate access token |
| GET | `/users/me` | required | Profile + coin balance |
| GET | `/users/me/transactions` | required | Transaction history |
| POST | `/posts` | required | Upload image, set price, generates preview server-side |
| GET | `/posts` | required | Feed — preview URL, price, locked/unlocked/owned flag |
| GET | `/posts/:id` | required | Detail view — preview always; original only if unlocked/owned |
| DELETE | `/posts/:id` | required, owner only | Soft delete |
| POST | `/posts/:id/unlock` | required | Atomic: check balance → deduct → create unlock + transaction → return original URL |
| GET | `/users/me/inventory` | required | All unlocked posts, including ones now deleted from public feed |

Note: there is intentionally no `PATCH /posts/:id` — price and content are immutable by design.

---

## Security

Security was the primary design focus of this assignment, since preventing paid-content leakage is the core thing being evaluated. Below is what's implemented and how it's verified.

### 1. Original files are never directly reachable

- The storage bucket is **private**, never public. There is no static URL that resolves to an original file.
- On upload, the API generates two separate objects: the original, and a genuinely distinct **server-side blurred preview** (via Sharp). The preview is never a client-side blur of the original — that would still leak the real bytes over the network.
- Every response (feed, detail, inventory) returns only a **signed, time-limited URL** to whichever asset the requesting user is entitled to. The API decides preview-vs-original server-side on every request; there is no client-supplied "unlocked" flag that's ever trusted.

**Verified**: an automated test fetches `/posts/:id` as a user with no unlock record and asserts the full JSON response — not just the expected field — contains no original storage key or original URL anywhere in the payload.

### 2. Signed URLs expire and can't be forged

- URLs are scoped to a single object, generated fresh per request, and expire quickly (15 minutes / `X-Amz-Expires=900`).
- Attempting to guess/construct an original's URL by modifying a valid preview URL's path fails, because the signature doesn't match — the storage layer rejects it (`403 SignatureDoesNotMatch`), independent of anything the API does.

**Verified**: an automated test mocks a 1-second expiry window, waits past it, and confirms the storage layer (not just the API) returns `403 AccessDenied` on the now-expired URL — expiry is enforced at the storage layer, not just in application logic.

### 3. Unlocks can never double-charge

- `unlocks` has a `UNIQUE(user_id, post_id)` **database constraint** — this is enforced at the DB layer, not just checked in application code, so it holds even under concurrent requests.
- The unlock endpoint is atomic: balance check → deduct → create unlock + transaction rows happen together, so there's no window where coins are deducted but access isn't granted (or vice versa).

**Verified**: an automated test fires two concurrent unlock requests for the same user/post via `Promise.all` to specifically stress the race condition, and confirms the wallet is charged exactly once.

### 4. Ownership and access control

- `DELETE /posts/:id` checks `owner_id === req.user.id` server-side before touching a row; any other user gets `403`.
- All authenticated endpoints reject requests with no/invalid JWT (`401`).
- Insufficient balance on unlock is rejected (`402`) with no partial state — no unlock row, no transaction row, balance unchanged.

**Verified**: automated tests cover unauthenticated access, a non-owner attempting delete, and insufficient-balance unlock attempts.

### 5. Atomic Audit Logging

- Every unlock attempt (success, insufficient balance, duplicate, missing post) is persistently logged to an append-only `unlock_attempts_log` database table. (Note: this is queryable via SQL for reviewers; no dedicated GET endpoint was built to keep scope tight).
- This provides a structured, queryable security audit trail rather than ephemeral file logs.
- The success log is written **inside the same DB transaction** as the balance deduction and unlock creation, ensuring that a code path cannot successfully unlock content without generating an irrefutable audit log. Rejections are logged via independent database connections to survive any transaction rollbacks.

### 6. Soft delete preserves buyer access without leaking to new users

- Deleting a post sets `status = 'deleted'` — it's filtered out of `GET /posts` immediately, but the row and storage objects are retained.
- `GET /users/me/inventory` has no status filter; it joins through `unlocks`, so a deleted post still resolves with a valid signed URL for anyone who unlocked it before deletion.

**Verified**: an automated test deletes a post after purchase, confirms it disappears from the public feed, and confirms it still resolves with a working signed URL in the buyer's inventory.

### 7. Other hardening

- **Passwords**: bcrypt, salted, never logged.
- **JWT**: short-lived access token (15 min) + longer-lived refresh token, both signed server-side.
- **Rate limiting**: applied to `/auth/login` (brute-force protection) and `/posts/:id/unlock` (abuse protection) via `express-rate-limit` — verified via automated test that exceeding the threshold returns `429`.

---

## Testing

The Jest + Supertest suite runs against a real test Postgres + S3 instance (not mocks), so it verifies actual DB constraints and actual signed-URL behavior rather than assumptions about them. Coverage includes:

- Full end-to-end flow: register → upload → locked view → unlock → original access → owner bypass → transaction history
- Concurrent duplicate-unlock race condition (no double-charge)
- Insufficient balance (clean rejection, no partial state)
- Access control (401/403 on unauthenticated and non-owner requests; zero leakage of original URLs to unauthorized users)
- Signed URL forgery attempt (rejected by the storage layer)
- Signed URL expiry (rejected by the storage layer once expired)
- Soft delete + inventory persistence
- Rate limiting on login and unlock

Run with:

```bash
npm test
```

---

## Known Limitations / Non-Goals

Per the PRD, explicitly out of scope for this assignment:
- Real payment integration (fixed starting balance only, no top-up)
- Push notifications, social features, content moderation
- Password reset / email verification
- iOS support (Android via Expo only)

Optional/bonus items not required for correctness:
- Automated storage cleanup of orphaned original files (posts with zero unlocks) — could be a scheduled background job
- CI/CD pipeline (GitHub Actions running the test suite on push)
