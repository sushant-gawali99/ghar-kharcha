# Google Play release checklist

## Build configuration

- Android package: `com.gharkharcha.app`
- Current release version: `1.0.0`
- Target SDK: Android 15 / API 35
- Release artifact: Android App Bundle from `pnpm --filter @ghar-kharcha/mobile build:android:bundle`

Release bundles must be signed with a Play upload key. Keep the keystore outside git and provide these values through environment variables or local Gradle properties:

```sh
GHAR_KHARCHA_UPLOAD_STORE_FILE=/absolute/path/to/upload-keystore.jks
GHAR_KHARCHA_UPLOAD_STORE_PASSWORD=...
GHAR_KHARCHA_UPLOAD_KEY_ALIAS=...
GHAR_KHARCHA_UPLOAD_KEY_PASSWORD=...
```

The release build must not use the debug keystore.

## Before production review

- Deploy the API behind HTTPS and set `EXPO_PUBLIC_API_URL` to that production origin.
- Register release SHA-1 and SHA-256 certificate fingerprints for Google Sign-In.
- Host public Privacy Policy, Terms, and account/data deletion request pages. The API exposes `/privacy`, `/terms`, and `/delete-account`; set `PRIVACY_CONTACT_EMAIL` before production.
- Complete Play Console Data safety, content rating, target audience, ads, and app access declarations.
- Upload store listing assets: icon, feature graphic, phone screenshots, short description, and full description.
- Run internal testing, then closed testing if required for the Play developer account.
- Verify account deletion, data export, PDF upload, Google Sign-In, token refresh, and sign-out on a real Android device.
