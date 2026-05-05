# App Store Privacy Declarations

Last updated: 2026-05-05

Use this as the source checklist for Google Play Data Safety and Apple App Privacy labels. Final answers must match the hosted Privacy Policy and the actual production SDKs.

## Google Play Data Safety

Data collected:

- Personal info: name, email address, profile photo.
- Financial info / purchase history: grocery order history, grocery items, totals, taxes, discounts, invoice/order numbers.
- Files and docs: uploaded grocery invoice PDFs.
- App activity: app interactions needed for account, upload, export, delete, and household audit events.
- App info and performance: only if crash/analytics SDK is added.

Purpose:

- App functionality.
- Account management.
- Analytics/insights shown to the user.
- Fraud, abuse prevention, and security.
- Developer communications/support, if user contacts support.

Sharing:

- Google for sign-in.
- Anthropic for invoice parsing and categorization.
- Hosting/database/storage providers for service operation.
- App stores as part of app distribution.
- No sale of personal data.
- No third-party advertising or cross-app tracking in v1.

Security practices:

- Data encrypted in transit using HTTPS.
- Production database/storage must be encrypted at rest.
- Users can request deletion and can delete their account in the app.
- Users can export their data in the app.

## Apple App Privacy

Data linked to the user:

- Contact info: name, email address.
- User content: invoice PDFs.
- Purchases/financial activity: grocery purchase/order history and item-level spend.
- Identifiers: Google account ID and app user ID.
- Usage data: audit events for core account/security actions.

Data not linked to the user:

- Crash/performance diagnostics, only if collected without user identifiers.

Tracking:

- Not used in v1.
- App Tracking Transparency prompt is not required unless future SDKs track users across apps/websites.

## Store listing prerequisites

- Hosted Privacy Policy URL.
- Hosted Terms URL.
- Real support/privacy contact email.
- Current subprocessor list.
- Confirm whether any crash/analytics SDK is present before answering diagnostics questions.
