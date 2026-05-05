# Subprocessors

Last updated: 2026-05-05

This list tracks third parties that may process personal data for Ghar Kharcha. Confirm production providers before public launch and keep this list aligned with the hosted Privacy Policy.

| Provider | Purpose | Data processed | Status |
|---|---|---|---|
| Google | Google Sign-In | Google ID token, name, email, avatar URL | Implemented |
| Anthropic | Invoice parsing and item categorization | Invoice text, item names, and on fallback invoice PDF content | Implemented |
| Railway | API hosting | API requests, logs, environment variables, operational metadata | Current deployment target |
| PostgreSQL hosting provider | Application database | Account, household, upload metadata, parsed ledger, sessions, audit events | Confirm production provider |
| Upload storage / app volume | Stored invoice PDFs | Raw uploaded invoice PDFs | Current API file storage; confirm production persistence/encryption |
| Google Play | Android distribution | App listing metadata, crash/install/store data per Google policy | Before launch |
| Apple App Store | iOS distribution | App listing metadata, crash/install/store data per Apple policy | Future/iOS launch |
| Support email provider | Privacy/grievance support | User email, request contents, support history | Configure before launch |
| Crash/analytics provider | Stability monitoring | Crash logs, device/app diagnostics, possible user identifiers | Not currently implemented |

## Change process

1. Add new providers here before sending production data to them.
2. Confirm whether the provider uses data for training, advertising, or only service delivery.
3. Update the Privacy Policy and app-store declarations.
4. Confirm retention/deletion behavior and whether data is stored outside India.
5. Keep contracts, DPA terms, or public data-processing terms linked from the internal ops folder.
