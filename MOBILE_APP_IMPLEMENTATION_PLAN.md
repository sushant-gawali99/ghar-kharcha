# Grocery Analysis — Implementation Plan

## Overview

This document outlines the full implementation plan for the Grocery Analysis mobile app and its backend API, both built from scratch.

The product allows users to upload grocery invoice PDFs from Zepto and Swiggy Instamart, automatically extracts item-level data using AI, and surfaces spending analytics, order history, and repeat purchase insights through a premium mobile experience.

Both the mobile app and backend API are greenfield projects. The tech stack is chosen for fast solo development, strong type safety across the full stack, and low operational overhead.

---

## Tech Stack

### Monorepo

| Choice | What |
|---|---|
| **Turborepo** | Monorepo build orchestration |
| **pnpm** | Package manager |

**Why Turborepo + pnpm:**
- Turborepo handles task caching and dependency-aware builds with zero config. It is the simplest monorepo tool for a TypeScript-only project.
- pnpm is faster and more disk-efficient than npm/yarn, and has first-class workspace support.
- A monorepo lets the mobile app and backend share TypeScript types, Zod schemas, and constants without publishing packages.

### Mobile App

| Choice | What |
|---|---|
| **React Native + Expo SDK 52** | Cross-platform mobile framework |
| **TypeScript** | Language |
| **Expo Router v4** | File-based navigation |
| **NativeWind v4** | TailwindCSS for React Native |
| **TanStack Query v5** | Server state management |
| **Zustand** | Local client state |
| **React Hook Form + Zod** | Form handling and validation |
| **React Native Reanimated** | Animations and gestures |
| **expo-document-picker** | PDF file selection |
| **expo-secure-store** | Secure token storage |
| **react-native-gifted-charts** | Charts and visualizations |
| **expo-file-system** | File access for uploads |

**Why React Native + Expo:**
- Ships Android and iOS from one TypeScript codebase. For a solo developer, maintaining two native codebases is not viable.
- Expo SDK 52 provides a managed workflow that eliminates most native build configuration. EAS Build handles CI/CD for both platforms.
- Expo Router v4 gives file-based routing similar to Next.js, which is the most intuitive navigation model for a React developer.

**Why NativeWind v4:**
- Utility-first styling that works identically to TailwindCSS on web. Eliminates the need for StyleSheet boilerplate.
- Supports dark mode, responsive breakpoints, and theme tokens out of the box.
- Avoids the overhead of a full component library while still enabling rapid, consistent UI development.
- Building UI primitives with NativeWind is faster than adopting a component library like Gluestack or Tamagui, and gives full design control for the "premium, colorful, vibrant" visual direction in the PRD.

**Why TanStack Query:**
- Handles caching, background refetching, pagination, and optimistic updates. This is critical for the analytics dashboard and order list screens.
- Eliminates hand-written loading/error state management for every API call.
- Works naturally with Zod-validated API responses through a typed API client.

**Why Zustand:**
- Minimal boilerplate for local state (auth tokens, selected filters, UI toggles).
- Does not require providers or context wrappers. Simpler than Redux or Jotai for this scale of app.

**Why react-native-gifted-charts:**
- Purpose-built for React Native with bar, line, pie, and stacked charts. Covers all chart types needed for the analytics dashboard.
- Better maintained and more feature-complete than victory-native for mobile use cases.
- Does not depend on react-native-svg wrappers, which reduces compatibility issues.

### Backend API

| Choice | What |
|---|---|
| **Hono** | API framework |
| **TypeScript** | Language |
| **Node.js** | Runtime |
| **Drizzle ORM** | Database ORM and migrations |
| **PostgreSQL** | Database |
| **Zod** | Request/response validation |
| **Claude API** | AI-powered PDF invoice parsing |
| **pdf-parse** | PDF text extraction |
| **JWT + refresh tokens** | Authentication |
| **Cloudflare R2** | PDF file storage |

**Why Hono:**
- Lightweight, TypeScript-first API framework with Express-like ergonomics but significantly better performance and type inference.
- Built-in middleware for CORS, auth, validation, and error handling.
- Hono's RPC feature enables end-to-end type safety — the mobile app can import route types and get fully typed API calls without code generation.
- Runs on Node.js today and can be moved to Cloudflare Workers or Bun later without rewriting routes.
- For a solo developer, Hono's DX is faster than Express (less boilerplate) and more stable than Elysia/Bun-native frameworks.

**Why Drizzle ORM:**
- Type-safe SQL queries that map directly to PostgreSQL. No magic — you write SQL-like TypeScript and get full type inference on results.
- Lightweight compared to Prisma (no binary engine, no generated client). Faster cold starts and smaller deployment size.
- Built-in migration system with `drizzle-kit` that generates SQL migration files. Easy to review and version control.
- Relational query API handles the joins needed for order-detail and item-insights queries cleanly.

**Why PostgreSQL:**
- The analytics-heavy workload (aggregations by month/category/platform, trend calculations, item frequency analysis) benefits from PostgreSQL's superior query planner and aggregate functions compared to MySQL.
- Native JSON/JSONB support for storing raw parsed invoice data alongside structured data.
- Better support for full-text search (useful for item name search in insights).
- Array types and CTEs simplify complex analytics queries.
- Wide hosting support: Neon (serverless), Supabase, Railway, Render, or any VPS.

**Why Claude API for PDF parsing:**
- Grocery invoice formats vary between platforms and change without notice. Rule-based parsers break when Zepto or Swiggy Instamart update their invoice layout.
- Claude can extract structured data (items, quantities, prices, fees, taxes, discounts, order metadata) from invoice text with high accuracy using a single prompt with structured output.
- The parsing prompt can be iterated without code changes — just update the prompt and schema.
- Fallback: if Claude API is unavailable, the system can queue the invoice for retry. Parse failures are surfaced transparently to the user per the PRD.
- Cost is minimal at the expected volume (personal use, tens of invoices per month).

**Why pdf-parse:**
- Lightweight library to extract raw text from PDF files before sending to Claude API. No heavy dependencies like Puppeteer or pdf.js.
- Extracts text reliably from the digitally-generated PDFs that Zepto and Swiggy Instamart produce (these are not scanned images).

**Why JWT + refresh tokens (not a third-party auth service):**
- The app needs Google sign-in and potentially email/OTP later. JWT auth with refresh tokens is straightforward to implement for this scope.
- Avoids vendor lock-in and monthly costs from Auth0, Clerk, or Firebase Auth.
- Refresh token rotation gives secure session persistence without requiring users to re-login.
- For a personal project with a small user base, custom auth is appropriate and keeps the stack simple.

**Why Cloudflare R2:**
- S3-compatible object storage with zero egress fees. Ideal for storing uploaded invoice PDFs.
- Free tier covers the expected volume easily (personal/small-scale usage).
- Simpler and cheaper than running a dedicated S3 bucket or managing local file storage.

### Infrastructure and Deployment

| Choice | What |
|---|---|
| **Neon** | Serverless PostgreSQL hosting |
| **Railway** | API hosting |
| **Cloudflare R2** | File storage |
| **EAS Build** | Mobile app builds |
| **EAS Submit** | App store submission |
| **EAS Update** | Over-the-air updates |
| **Sentry** | Crash reporting and error monitoring |

**Why Neon:**
- Serverless PostgreSQL that scales to zero when not in use. For a personal project, this means near-zero cost during development and low cost in production.
- Branching support allows creating isolated database copies for testing migrations or features.
- Standard PostgreSQL wire protocol — can switch to any other PostgreSQL host later without code changes.

**Why Railway:**
- One-click deploy from GitHub for Node.js apps. Handles environment variables, logging, and scaling.
- Simpler than AWS/GCP for a solo developer. No Dockerfiles or Kubernetes needed.
- Affordable for small-scale: usage-based pricing, not reserved instances.

**Why Sentry:**
- Industry-standard crash and error monitoring for both React Native and Node.js.
- Free tier is sufficient for early-stage usage.
- Captures stack traces, breadcrumbs, and device info — critical for debugging mobile issues without physical access to the device.

### Shared Packages

The monorepo will contain these shared packages:

| Package | Purpose |
|---|---|
| `packages/shared-types` | TypeScript types and Zod schemas shared between mobile and API |
| `packages/api-client` | Typed HTTP client for the mobile app, generated from Hono RPC types |

**Why shared packages:**
- Zod schemas defined once are used for API request validation (backend) and response parsing (mobile). A change to an API contract is caught at build time on both sides.
- The Hono RPC client gives the mobile app fully typed API calls without maintaining a separate OpenAPI spec or running code generation.

---

## Project Structure

```
ghar-kharcha/
├── apps/
│   └── mobile/                 # Expo React Native app
│       ├── app/                # Expo Router file-based routes
│       │   ├── (auth)/         # Auth-gated screens
│       │   │   ├── (tabs)/     # Tab navigator
│       │   │   │   ├── home.tsx
│       │   │   │   ├── orders.tsx
│       │   │   │   ├── upload.tsx
│       │   │   │   ├── insights.tsx
│       │   │   │   └── profile.tsx
│       │   │   └── orders/
│       │   │       └── [id].tsx
│       │   ├── welcome.tsx
│       │   ├── sign-in.tsx
│       │   └── _layout.tsx
│       ├── components/
│       │   ├── ui/             # Design system primitives
│       │   ├── analytics/      # Dashboard charts and cards
│       │   ├── orders/         # Order list and detail components
│       │   └── upload/         # Upload flow components
│       ├── lib/
│       │   ├── api.ts          # API client instance
│       │   ├── auth.ts         # Auth store and helpers
│       │   └── query.ts        # TanStack Query config
│       ├── hooks/              # Custom hooks
│       ├── constants/          # App constants and config
│       └── assets/             # Images, fonts, icons
├── packages/
│   ├── api/                    # Hono backend API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── upload.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── analytics.ts
│   │   │   │   └── items.ts
│   │   │   ├── services/
│   │   │   │   ├── invoice-parser.ts    # Claude API integration
│   │   │   │   ├── analytics.ts         # Aggregation queries
│   │   │   │   └── storage.ts           # R2 file storage
│   │   │   ├── db/
│   │   │   │   ├── schema.ts            # Drizzle schema
│   │   │   │   ├── migrations/          # SQL migrations
│   │   │   │   └── index.ts             # DB connection
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts              # JWT middleware
│   │   │   └── index.ts                 # App entry
│   │   └── drizzle.config.ts
│   ├── shared-types/           # Shared Zod schemas and TS types
│   │   └── src/
│   │       ├── orders.ts
│   │       ├── analytics.ts
│   │       ├── items.ts
│   │       ├── upload.ts
│   │       ├── categories.ts
│   │       └── platforms.ts
│   └── api-client/             # Typed API client from Hono RPC
│       └── src/
│           └── index.ts
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Database Schema

### Core Tables

**users**
- id, email, name, avatar_url, google_id, created_at, updated_at

**refresh_tokens**
- id, user_id, token_hash, expires_at, created_at

**uploads**
- id, user_id, filename, storage_key, status (pending/processing/success/failed/duplicate), error_message, created_at

**orders**
- id, user_id, upload_id, platform (zepto/swiggy_instamart/other), invoice_number, order_date, total_amount, subtotal, delivery_fee, handling_fee, taxes, discount, item_count, raw_parsed_data (jsonb), created_at

**order_items**
- id, order_id, name, normalized_name, quantity, unit, price, category, brand (nullable), created_at

---

## API Endpoints

All endpoints under `/api/v1/`

### Auth
- `POST /auth/google` — Google sign-in (exchange Google token for JWT + refresh token)
- `POST /auth/refresh` — Refresh access token
- `POST /auth/logout` — Revoke refresh token

### Upload
- `POST /upload` — Upload one or more invoice PDFs (multipart)
- `GET /upload/history` — List upload history with status

### Orders
- `GET /orders` — Paginated orders list with month/year filters
- `GET /orders/:id` — Order detail with items
- `DELETE /orders/:id` — Delete order and associated items
- `GET /orders/summary` — Summary strip (total orders, total spend for period)

### Analytics
- `GET /analytics/dashboard` — Aggregated dashboard data (summary metrics, category breakdown, platform comparison, monthly trend, top recurring items, insight cards)
- `GET /analytics/trends` — Monthly spending trend data

### Items
- `GET /items` — Item insights with search, category filter, month/year filter, pagination
- `GET /items/categories` — Available categories with item counts

---

## Invoice Parsing Strategy

### Flow

1. User selects PDF files on mobile → uploads to API
2. API stores PDF in Cloudflare R2 and creates upload record with `pending` status
3. API extracts raw text from PDF using `pdf-parse`
4. API sends extracted text to Claude API with a structured extraction prompt
5. Claude returns structured JSON: order metadata + itemized list
6. API validates response against Zod schema
7. API checks for duplicate invoice (by invoice_number + platform + user)
8. API writes order and items to database
9. API updates upload status to `success`, `duplicate`, or `failed`
10. Mobile polls or receives result

### Claude API Prompt Strategy

- System prompt defines the extraction schema and expected output format
- User message contains the raw PDF text
- Use `tool_use` with a Zod-derived JSON schema to enforce structured output
- Handle edge cases: missing fields default to null, unknown categories map to "Other"
- Log raw Claude responses for debugging parse issues

### Duplicate Detection

- Match on `invoice_number + platform + user_id`
- If duplicate found, mark upload as `duplicate` and skip insertion
- Return duplicate order reference in response

---

## Authentication Flow

### Google Sign-In

1. Mobile app initiates Google sign-in using `expo-auth-session`
2. Google returns ID token
3. Mobile sends ID token to `POST /auth/google`
4. Backend verifies token with Google, creates or finds user
5. Backend returns JWT access token (15 min expiry) + refresh token (30 day expiry)
6. Mobile stores both tokens in `expo-secure-store`
7. Access token sent as `Authorization: Bearer <token>` on all API calls
8. On 401, mobile uses refresh token to get new access token
9. On refresh failure, user is redirected to sign-in

---

## Security and Compliance

This app handles personal financial data (grocery spending, order history, purchase patterns) and uploaded invoice documents. Security is not a post-launch concern — it is built into every layer from day one.

### Applicable Regulations

**India's Digital Personal Data Protection Act (DPDPA) 2023**
- The primary data protection law for Indian users. Since the target audience is Indian consumers, DPDPA compliance is mandatory.
- Requires: lawful purpose for data collection, explicit consent, data minimization, right to erasure, breach notification, and a grievance officer for user complaints.

**Google Play and Apple App Store Policies**
- Both stores require a privacy policy, data safety declarations, and transparent data handling disclosures.
- Google Play requires a Data Safety section listing all data collected, shared, and retained.
- Apple requires App Privacy labels (nutrition labels) and App Tracking Transparency compliance.

**PCI DSS — Not Applicable**
- The app does not process, store, or transmit payment card data. No PCI compliance required.

### Data Classification

| Data Type | Sensitivity | Storage | Retention |
|---|---|---|---|
| Email, name, avatar | Personal | PostgreSQL (encrypted at rest) | Until account deletion |
| Google OAuth tokens | Credential | Never stored on backend — used only for verification | Not retained |
| JWT access tokens | Session | Mobile device only (expo-secure-store) | 15 minutes |
| Refresh tokens | Session | PostgreSQL (hashed) + mobile (expo-secure-store) | 30 days |
| Invoice PDFs | Personal/Financial | Cloudflare R2 (encrypted at rest) | Until user deletes order or account |
| Parsed order data | Personal/Financial | PostgreSQL (encrypted at rest) | Until user deletes order or account |
| Raw parsed AI responses | Diagnostic | PostgreSQL JSONB (encrypted at rest) | Until user deletes order or account |
| Analytics event logs | Usage | Sentry / analytics service | Per service retention policy |

### Authentication Security

**Token Management**
- JWT access tokens: short-lived (15 minute expiry), signed with RS256 (asymmetric keys), contain only user ID and email — no sensitive data in payload.
- Refresh tokens: long-lived (30 day expiry), stored as bcrypt hash in database, single-use with rotation on every refresh call.
- Refresh token reuse detection: if a previously used refresh token is presented, revoke the entire token family for that user (indicates token theft).
- On logout, refresh token is revoked server-side and deleted from device.

**Google OAuth**
- Google ID tokens are verified server-side using Google's public keys (JWKS endpoint). Never trust the token without verification.
- The backend does not store Google access tokens or refresh tokens — only the Google user ID for account linking.

**Mobile Token Storage**
- All tokens stored in `expo-secure-store`, which uses iOS Keychain and Android Keystore (hardware-backed encryption where available).
- Tokens are never stored in AsyncStorage, local storage, or any unencrypted medium.
- Tokens are cleared on logout and on auth failure.

### API Security

**Transport**
- All API communication over HTTPS/TLS 1.2+ only. HTTP requests are rejected, not redirected.
- HSTS headers enforced on all responses.

**Input Validation**
- Every API endpoint validates request body, query params, and path params using Zod schemas. Invalid input is rejected with structured error responses before reaching business logic.
- File uploads validated for: MIME type (application/pdf only), file extension (.pdf only), file size (max 10 MB per file, max 50 MB per request), file count (max 10 files per upload).
- PDF content validated after upload: pdf-parse must successfully extract text, otherwise the file is rejected.

**Rate Limiting**
- Global rate limit: 100 requests/minute per user.
- Upload endpoint: 10 uploads/hour per user (prevents abuse of Claude API credits).
- Auth endpoints: 10 requests/minute per IP (brute force protection).
- Rate limits enforced via Hono middleware using sliding window counters.

**CORS**
- Strict CORS policy allowing only the mobile app's origin in production.
- No wildcard origins in production.

**Request Headers**
- API version header (`X-API-Version`) required on all mobile requests.
- User-Agent validation to identify mobile app requests.

**Error Responses**
- Structured error responses with consistent error codes. Never leak stack traces, SQL errors, or internal paths in production responses.
- Validation errors return field-level details. Server errors return a generic message with a correlation ID for debugging.

### Database Security

**Access Control**
- Database credentials stored as environment variables, never in code or version control.
- Application connects with a least-privilege database role: SELECT, INSERT, UPDATE, DELETE on application tables only. No CREATE, DROP, or ALTER permissions at runtime.
- Separate migration role with schema modification permissions, used only during deployments.

**Encryption**
- Neon PostgreSQL encrypts data at rest using AES-256 by default.
- All connections use SSL/TLS (enforced, not optional).

**Query Safety**
- Drizzle ORM uses parameterized queries exclusively. No raw SQL string concatenation.
- All user-supplied values (search terms, filter values, IDs) pass through Zod validation before reaching any query.

**Row-Level Isolation**
- Every query that touches user data includes a `WHERE user_id = ?` clause. Users can never access another user's orders, items, or uploads.
- This is enforced at the service layer and verified in integration tests.

**Backups**
- Neon provides automatic daily backups with point-in-time recovery.
- Before destructive migrations, a manual backup snapshot is created.

### File Storage Security

**Upload Security**
- PDFs are stored in Cloudflare R2 with private access (no public URLs).
- Each file is stored with a unique key: `{user_id}/{upload_id}/{uuid}.pdf`. Users cannot guess or enumerate other users' files.
- Files are accessed only through the API, which verifies ownership before generating a signed URL or streaming the file.

**Content Validation**
- Uploaded files are validated for PDF magic bytes (not just MIME type from the client) to prevent disguised file uploads.
- Maximum file size enforced at both Hono middleware level and R2 upload level.

**Retention**
- PDFs are retained as long as the associated order exists. When a user deletes an order, the associated PDF is deleted from R2.
- On account deletion, all user PDFs are deleted from R2.

### AI / Claude API Security

**Data Sent to Claude API**
- Only extracted text from PDFs is sent to Claude — not the raw PDF binary, not the user's identity, and not any authentication tokens.
- The prompt does not include user ID, email, or any PII beyond what is on the invoice itself (name/address on invoices is part of the document).

**Data Retention by Anthropic**
- Claude API with the default API usage policy does not use input/output data for model training.
- Review Anthropic's data retention policy periodically and document it in the privacy policy.

**Response Validation**
- Claude API responses are validated against a strict Zod schema before any database write. Malformed or unexpected responses are rejected and logged as parse failures.

### Mobile App Security

**Secure Storage**
- Tokens: `expo-secure-store` (Keychain / Keystore).
- No sensitive data in AsyncStorage, MMKV, or any unencrypted store.

**Network Security**
- Certificate pinning is not implemented in v1 (Expo managed workflow limitation), but the API uses HSTS and TLS 1.2+ to mitigate downgrade attacks.
- All API calls go through the typed API client which enforces the base URL from environment config — no dynamic URL construction from user input.

**Screen Security**
- Sensitive screens (order detail with financial data) are excluded from the app switcher preview on iOS (blur/hide content in `AppState` inactive handler).
- No sensitive data is logged to the console in production builds.

**Deep Link Safety**
- Auth callback deep links validate the state parameter to prevent CSRF attacks on the OAuth flow.
- No deep links expose internal IDs or allow unauthenticated actions.

**Build Security**
- Production builds strip all console.log statements.
- Source maps are uploaded to Sentry only (not bundled in the app binary).
- EAS Build uses secure environment variable injection — no secrets in `app.config.ts` or committed `.env` files.

### Privacy and Consent

**User Consent**
- On first launch, users are shown a clear explanation of what data the app collects and why, before sign-in.
- Consent is obtained before uploading any invoice data.
- The privacy policy is accessible from the sign-in screen and from the settings screen at all times.

**Privacy Policy**
- Hosted on a public URL (linked from app stores and in-app).
- Covers: data collected, purpose, storage, third-party sharing (Anthropic for parsing), retention, user rights, deletion process, grievance officer contact.
- Written in plain language per DPDPA requirements.

**Data Minimization**
- The app collects only what is needed: email and name from Google (for account identity), invoice PDFs (for parsing), and derived analytics data.
- No contact list access, no location tracking, no device identifiers beyond what Sentry collects for crash reports.
- Analytics events do not contain PII — only event names, timestamps, and anonymous session IDs.

**Right to Erasure**
- Users can delete individual orders (and associated items + PDFs) from the order detail screen.
- Users can delete their entire account from settings. Account deletion removes: user record, all orders, all items, all uploads, all PDFs from R2, and all refresh tokens. This is a hard delete, not a soft delete.
- Account deletion is processed immediately (synchronous) and confirmed to the user.

**Data Export**
- Not in v1 scope, but the data model supports it. Can be added in v2 as a JSON/CSV export of all user data per DPDPA right to access.

### App Store Compliance

**Google Play Data Safety**
- Declare: email, name (collected for account), grocery purchase history (collected for core functionality), crash logs (collected for app stability).
- Declare: data is encrypted in transit, users can request deletion.
- Declare: data shared with Anthropic (invoice text only, for parsing — disclosed as service provider).

**Apple App Privacy Labels**
- Data Used to Track You: None.
- Data Linked to You: email, name, purchase history.
- Data Not Linked to You: crash data, performance data.

**App Tracking Transparency**
- Not required in v1 — the app does not track users across other apps or websites.

### Security Checklist by Week

This checklist is integrated into the weekly roadmap tasks below.

| Week | Security Tasks |
|---|---|
| 1 | Environment variable management, `.env` in `.gitignore`, database SSL enforced, R2 private bucket |
| 2 | RS256 JWT signing, bcrypt refresh token hashing, token rotation, reuse detection, secure mobile storage |
| 3 | File upload validation (type, size, magic bytes), PDF content validation, R2 ownership-scoped keys, rate limiting on upload |
| 4 | Row-level user isolation in analytics queries, no PII in analytics events |
| 5 | Ownership check on order detail/delete, cascade delete for PDFs on order deletion |
| 6 | Input sanitization on search queries, parameterized full-text search |
| 7 | Security audit of all endpoints, error response sanitization, Sentry PII scrubbing, rate limiting review |
| 8 | Privacy policy, app store data declarations, account deletion flow, production security headers |

---

## Implementation Roadmap (8 Weeks)

### Week 1 — Foundation

**Goals:** Set up monorepo, mobile app shell, backend API shell, database, and shared packages.

**Backend tasks:**
- Initialize Hono project with TypeScript
- Set up Drizzle ORM with PostgreSQL (Neon)
- Define database schema and run initial migration
- Set up Cloudflare R2 connection
- Create health check endpoint
- Set up shared-types package with Zod schemas for categories, platforms, and base DTOs

**Mobile tasks:**
- Initialize Expo app with TypeScript and Expo Router v4
- Set up NativeWind v4
- Set up TanStack Query client
- Set up Zustand auth store
- Set up environment config
- Build design system primitives: Screen, Card, Button, Badge, MetricCard, EmptyState, Loader, SectionHeader
- Define theme tokens: colors, spacing, typography, radius

**Monorepo tasks:**
- Initialize Turborepo with pnpm workspaces
- Configure shared-types and api-client packages
- Set up TypeScript project references

**Security tasks:**
- Add `.env` to `.gitignore`, set up environment variable management for all secrets (DB URL, R2 keys, Claude API key, JWT signing keys)
- Enforce SSL on all database connections
- Configure R2 bucket as private (no public access)
- Generate RS256 key pair for JWT signing

**Deliverable:** App runs on simulators with navigation shell. API responds to health check. Database is provisioned with schema. All secrets managed via environment variables.

### Week 2 — Authentication

**Goals:** Users can sign in with Google and stay signed in.

**Backend tasks:**
- Implement `POST /auth/google` — verify Google ID token, upsert user, issue JWT + refresh token
- Implement `POST /auth/refresh` — rotate refresh token
- Implement `POST /auth/logout` — revoke refresh token
- Add JWT auth middleware for protected routes
- Create users and refresh_tokens tables migration

**Mobile tasks:**
- Implement Google sign-in with `expo-auth-session`
- Build welcome screen with value proposition
- Build sign-in screen
- Implement session restore on app launch
- Add auth guard to protected routes
- Build basic profile/settings screen with logout
- Wire up API client with auth headers and token refresh interceptor

**Security tasks:**
- Sign JWTs with RS256 (asymmetric keys), 15-minute expiry
- Hash refresh tokens with bcrypt before database storage
- Implement refresh token rotation (single-use tokens, new token issued on each refresh)
- Implement refresh token reuse detection (revoke token family on reuse)
- Store tokens in `expo-secure-store` only — never AsyncStorage
- Validate Google ID tokens server-side using Google JWKS
- Add auth middleware that rejects expired/malformed tokens with proper error codes
- Rate limit auth endpoints: 10 requests/minute per IP

**Deliverable:** User can sign in with Google, access the app, and remain signed in across relaunches. Auth is secure with token rotation.

### Week 3 — Invoice Upload

**Goals:** Users can upload grocery invoice PDFs and see structured results.

**Backend tasks:**
- Implement `POST /upload` — accept multipart PDF uploads, store in R2, queue for parsing
- Implement invoice parsing service: pdf-parse → Claude API → Zod validation → database insert
- Implement duplicate detection by invoice_number + platform + user
- Implement `GET /upload/history` — list uploads with status
- Return per-file results: success (with order summary), duplicate (with existing order reference), failed (with error message)

**Mobile tasks:**
- Build upload screen with `expo-document-picker` for multi-PDF selection
- Show selected files list with remove action
- Upload button with progress indicator
- Per-file result display: success, duplicate, failed
- Upload history list
- Handle edge cases: invalid file type, oversized file, network failure

**Security tasks:**
- Validate uploaded files: MIME type check, file extension check, PDF magic bytes verification, max 10 MB per file, max 50 MB per request, max 10 files per upload
- Store files in R2 with ownership-scoped keys: `{user_id}/{upload_id}/{uuid}.pdf`
- Rate limit upload endpoint: 10 uploads/hour per user
- Strip PII from data sent to Claude API — send only extracted invoice text, no user ID or email
- Validate Claude API response against strict Zod schema before any database write
- Reject and log malformed AI responses as parse failures

**Deliverable:** User can upload PDFs from phone and see parsed results with clear status per file. Uploads are validated and securely stored.

### Week 4 — Analytics Dashboard

**Goals:** Build the main value screen — the analytics home.

**Backend tasks:**
- Implement `GET /analytics/dashboard` — single aggregated endpoint returning:
  - summary metrics (total spend, orders, items, avg spend/order)
  - fee/tax/discount totals
  - category-wise spend breakdown
  - platform-wise comparison
  - monthly trend (last 6-12 months)
  - top recurring items
- Support month/year query params and all-time mode
- Optimize with indexed queries and materialized calculations where needed

**Mobile tasks:**
- Build analytics home screen with month/year filter
- Summary metric cards (total spend, orders, items, avg spend)
- Fee/tax/discount secondary metrics
- Category spend pie/donut chart
- Platform comparison bar chart
- Monthly trend line chart
- Recurring items section
- Insight cards (e.g., "You spent ₹X on delivery fees this month")
- Loading skeletons and empty states

**Security tasks:**
- Enforce `WHERE user_id = ?` on every analytics query — verify no cross-user data leakage
- Ensure analytics event tracking contains no PII (no email, no names — only event names, timestamps, anonymous session IDs)

**Deliverable:** Analytics home powered by real data from parsed invoices. All queries scoped to authenticated user.

### Week 5 — Orders and Order Detail

**Goals:** Users can browse order history and inspect any order.

**Backend tasks:**
- Implement `GET /orders` — paginated, filterable by month/year and platform
- Implement `GET /orders/summary` — summary strip for selected period
- Implement `GET /orders/:id` — full order with items, fees, breakdown
- Implement `DELETE /orders/:id` — soft or hard delete with cascade to items
- Ensure analytics recalculate correctly after deletion

**Mobile tasks:**
- Build orders list screen with:
  - summary strip (total orders, total spend for period)
  - month/year filter
  - order cards (date, platform, invoice number, amount, item count)
  - pull-to-refresh and infinite scroll pagination
- Build order detail screen with:
  - order summary card
  - invoice metadata (platform, invoice number, date)
  - fee/tax/discount breakdown
  - itemized list with category badges
- Delete order with confirmation dialog
- Optimistic UI updates on delete

**Security tasks:**
- Ownership check on `GET /orders/:id` — return 404 (not 403) if order belongs to another user (prevents user ID enumeration)
- Ownership check on `DELETE /orders/:id` — same 404 pattern
- Cascade delete: when order is deleted, delete associated items from DB and PDF from R2
- Verify delete confirmation dialog on mobile prevents accidental deletion

**Deliverable:** Orders list and detail screens work end to end. All access is ownership-verified.

### Week 6 — Items Insights

**Goals:** Users can explore repeat purchases and item-level spending.

**Backend tasks:**
- Implement `GET /items` — item insights with:
  - search by name
  - filter by category
  - filter by month/year
  - pagination
  - per-item: purchase frequency, total spend, avg price, last purchased
- Implement `GET /items/categories` — category list with item counts
- Item normalization: lowercase, trim, handle minor spelling variations

**Mobile tasks:**
- Build items insights screen with:
  - search bar
  - category filter chips (scrollable horizontal)
  - month/year filter
  - item cards showing: name, frequency, total spend, avg price, last purchased
  - grouped by category view option
- Empty state for no results
- Debounced search

**Security tasks:**
- Sanitize search input — parameterized full-text search queries only, no raw string interpolation
- Enforce user_id scoping on all item queries

**Deliverable:** Users can search and explore item-level data across all their orders. Search is injection-safe.

### Week 7 — Polish, Edge Cases, and Observability

**Goals:** Harden the app, handle all edge cases, add monitoring.

**Backend tasks:**
- Add structured error responses with consistent error codes
- Add request logging
- Add Sentry error monitoring
- Rate limiting on upload endpoint
- Input validation hardening
- Performance: add database indexes, optimize slow queries

**Mobile tasks:**
- Implement all empty states per PRD (no uploads, no orders, no analytics, no search results)
- Implement all status states (processing, success, duplicate, failed, delete confirmation)
- Add Sentry crash reporting
- Add analytics event tracking (app_opened, upload_started, upload_completed, dashboard_viewed, etc.)
- Performance: list virtualization, image caching, query cache tuning
- Responsive layout testing on different screen sizes
- Loading skeleton polish

**Security tasks:**
- Security audit: review all endpoints for missing auth checks, missing ownership checks, missing input validation
- Sanitize all error responses — no stack traces, SQL errors, or internal paths in production
- Configure Sentry PII scrubbing — strip emails, names, tokens from error reports
- Review and tighten rate limits based on observed usage patterns
- Verify no `console.log` with sensitive data in production builds
- Exclude sensitive screens from app switcher preview (iOS AppState blur)
- Verify source maps are uploaded to Sentry only, not bundled in app binary

**Deliverable:** App is stable, observable, handles all edge cases, and passes security review.

### Week 8 — QA and Release Preparation

**Goals:** Ship a beta-ready build for Android and iOS.

**Tasks:**
- End-to-end QA across all flows on real devices
- Fix edge cases: invalid PDF, corrupt file, slow network, empty states, retry paths
- App icon and splash screen
- App store screenshots
- Store listing copy
- Configure EAS Build profiles (development, preview, production)
- Build and test on TestFlight (iOS)
- Build and test on Android internal testing track
- Backend deployment to production environment
- Database backup strategy
- Final smoke test on production

**Security and compliance tasks:**
- Write and host privacy policy covering: data collected, purpose, storage, third-party sharing (Anthropic), retention, user rights, deletion process, contact info
- Implement account deletion flow in settings: hard delete of user record, all orders, all items, all uploads, all PDFs from R2, all refresh tokens — immediate and confirmed
- Add HSTS, X-Content-Type-Options, X-Frame-Options, and Content-Security-Policy headers to all API responses
- Prepare Google Play Data Safety declaration (email, name, purchase history collected; data encrypted in transit; deletion available; Anthropic as service provider)
- Prepare Apple App Privacy labels (no tracking; email/name/purchase history linked to user; crash data not linked)
- Verify deep link auth callbacks validate state parameter (CSRF protection)
- Final security checklist sign-off before beta release

**Deliverable:** Beta release candidate ready for internal testing on both platforms. Privacy policy live. App store compliance declarations prepared. Account deletion working.

---

## MVP Feature Summary

| Feature | Included in v1 |
|---|---|
| Google sign-in | Yes |
| Welcome / onboarding | Yes |
| Invoice upload (PDF) | Yes |
| Analytics dashboard | Yes |
| Orders list | Yes |
| Order detail | Yes |
| Items insights | Yes |
| Profile / settings | Yes |
| Empty / loading / error states | Yes |
| Event tracking | Yes |
| Crash reporting | Yes |
| Budget tracking | No — v2 |
| Push notifications | No — v2 |
| Price trend by item | No — v2 |
| Household sharing | No — v2 |
| Image receipt OCR | No — v2 |

---

## Post-MVP Priorities

1. Monthly grocery budget with overspend alerts
2. Item price trend tracking
3. Platform-wise savings insights
4. Monthly grocery report card
5. Repeat purchase reminders via push notifications
6. Smart savings suggestions
7. Support for additional platforms (BigBasket, Blinkit)
8. Premium subscription features
9. Household sharing
10. Image receipt OCR

---

## Key Technical Decisions Summary

| Decision | Choice | Primary Reason |
|---|---|---|
| Monorepo | Turborepo + pnpm | Shared types and schemas across mobile + API |
| Mobile framework | React Native + Expo | Single codebase for Android + iOS, managed workflow |
| Mobile styling | NativeWind v4 | Fastest UI development, full design control |
| API framework | Hono | TypeScript-first, end-to-end type safety via RPC |
| Database | PostgreSQL | Superior analytics queries, JSON support |
| ORM | Drizzle | Type-safe, lightweight, SQL-like |
| PDF parsing | Claude API | Handles format changes, structured extraction, high accuracy |
| Auth | Custom JWT | Simple, no vendor lock-in, appropriate for project scale |
| File storage | Cloudflare R2 | S3-compatible, zero egress fees, generous free tier |
| DB hosting | Neon | Serverless PostgreSQL, scales to zero, branching support |
| API hosting | Railway | Simple deploy, usage-based pricing |
| Mobile builds | EAS Build/Submit | Expo-native CI/CD for both platforms |
