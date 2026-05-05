# Security and Privacy Readiness

Last updated: 2026-05-05

This checklist tracks the production-readiness work for Ghar Kharcha's personal data, invoice, and grocery-spend data handling. It is an engineering checklist, not legal advice.

## Data handled

- Account identity: Google ID, name, email, avatar URL.
- Session data: short-lived access tokens on-device, hashed refresh tokens in Postgres.
- Uploaded documents: grocery invoice PDFs.
- Parsed ledger data: platform, invoice/order numbers, dates, item names, quantities, HSN, taxes, discounts, categories, spend totals.
- Household data: household budget, member names/emails, invite codes.
- AI processor data: invoice text and, on fallback, invoice PDF content sent to Anthropic for extraction.

## Implemented

- Google ID tokens are verified server-side before account creation.
- Access tokens are short-lived; refresh tokens are generated randomly and stored hashed.
- Native mobile token storage uses `expo-secure-store`.
- Uploads require authentication, PDF MIME/magic-byte validation, and a 10 MB limit.
- API rate limits cover auth, upload, and household invite routes.
- Household invite codes use cryptographic randomness.
- CORS is restricted by configured origins in production.
- Security headers are applied by the API.
- Users can delete individual orders and the associated stored PDF.
- Users can hard-delete their account, including orders, items, uploads, stored PDFs, and refresh tokens.
- Users can export their account, upload, order, item, household, and session metadata.
- Privacy and Terms screens are available from sign-in and Profile.
- Terms and Privacy acceptance timestamps are recorded on Google sign-in.
- Invoice uploads require explicit AI processing consent and record the latest consent timestamp.
- Refresh-token reuse detection revokes the affected token family.
- Durable audit events cover sign-in, token rotation/reuse, upload success/failure/duplicate, export, deletion, invite creation, invite acceptance, and household member removal.
- Incident response, subprocessor, and app-store declaration checklists are documented.

## Required before public launch

- Replace placeholder contact `privacy@gharkharcha.app` with a real monitored inbox.
- Publish hosted Privacy Policy and Terms URLs for app store listings.
- Review Privacy Policy and Terms with counsel before public release.
- Configure production `CORS_ORIGINS`; production defaults intentionally allow no browser origins.
- Confirm the production database enforces TLS and encryption at rest.
- Confirm the production upload volume/storage layer encrypts data at rest and is private by default.
- Confirm backups and restore procedures, including how deletion requests affect backups.
- Maintain `docs/subprocessors.md` as providers change.
- Exercise `docs/incident-response-runbook.md` before public launch.
- Retain security logs for at least 180 days where CERT-In directions apply.
- Complete Google Play Data Safety and Apple App Privacy declarations before store review using `docs/app-store-privacy-declarations.md`.
- Decide and document child-user policy. Recommended: app is for users 18+ unless verifiable parental consent is implemented.
- Add a support/grievance workflow for correction, consent withdrawal, and complaints.

## Recommended next engineering work

- Add per-route request IDs and structured error logging with no PDF text or sensitive payloads.
- Add automated dependency scanning in CI.
- Continue mobile typecheck performance work; generated native/export folders and tests are now excluded, but `tsc --noEmit` still did not finish promptly in this environment.
- Add tests for API CORS/security headers and rate-limit behavior.
- Add account export as a downloadable file when the app moves beyond current share-sheet JSON export.
