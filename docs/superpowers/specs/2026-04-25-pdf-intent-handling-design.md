# PDF Intent Handling — Design Spec

**Date:** 2026-04-25
**Platform:** Android only
**Status:** Approved

## Overview

Allow users to open a PDF downloaded from Zepto (or any app) directly into ghar-kharcha via Android's "Open with" dialog. When the user selects the app, a confirmation bottom sheet appears and the invoice is automatically parsed and added to their expense tracker.

---

## User Flow

### Happy path (user is signed in)

1. User downloads a Zepto invoice PDF in another app (e.g. Chrome, Zepto app)
2. Taps "Open with" → selects ghar-kharcha
3. App opens; confirmation bottom sheet appears showing the filename
4. User taps **Add Invoice**
5. Spinner + "Parsing your invoice…" while upload is in progress
6. On success: sheet dismisses, app navigates to the Orders tab

### Auth-resume path (user is not signed in)

1–2. Same as above
3. Pending file URI is stored in Zustand; auth guard redirects to sign-in
4. User signs in
5. Root layout detects `isAuthenticated = true` + `pendingUri` set → shows confirmation bottom sheet
6–7. Same as happy path from step 4 onwards

---

## Architecture

### AndroidManifest.xml change

Add a second `<intent-filter>` on `MainActivity`, alongside the existing deep-link filter:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="application/pdf" />
</intent-filter>
```

### Linking handler (`apps/mobile/app/_layout.tsx`)

Two cases handled at app root:

- **Cold start:** `Linking.getInitialURL()` — called once on mount, returns `content://` URI if app was launched via intent
- **Warm start:** `Linking.addEventListener('url', handler)` — fires when app is foregrounded via intent

Both paths funnel into the same `handleIncomingUri` function:

1. Detect if URI looks like a PDF (`content://` scheme or `.pdf` extension)
2. Copy to local cache: `FileSystem.copyAsync({ from: contentUri, to: FileSystem.cacheDirectory + 'pending-invoice.pdf' })`
3. Discard original `content://` URI; store local `file://` path via `pendingPdfStore.setPending(localPath)`

### Pending PDF store (`apps/mobile/stores/pendingPdfStore.ts`)

New Zustand store:

```typescript
interface PendingPdfState {
  pendingUri: string | null;   // local file:// path after copy from content://
  setPending: (uri: string) => void;
  clearPending: () => void;
}
```

Root `_layout.tsx` subscribes to both `authStore.isAuthenticated` and `pendingPdfStore.pendingUri`. When both are truthy, renders `<PdfConfirmSheet />`. No changes to the auth store or auth guard.

### Confirmation bottom sheet (`apps/mobile/components/PdfConfirmSheet.tsx`)

Four UI states, driven by local component state:

| State | Trigger | Actions available |
|-------|---------|-------------------|
| `idle` | Sheet opens | Cancel, Add Invoice |
| `parsing` | User taps Add Invoice | Cancel (disabled), Add Invoice (disabled); sheet is non-dismissible (back gesture + back button blocked) |
| `duplicate` | API returns `status: "duplicate"` | Dismiss |
| `error` | Network failure or parse failure | Dismiss, Retry |

On success (`status: "success"`):
1. Call `pendingPdfStore.clearPending()`
2. Dismiss sheet
3. Navigate to `/(auth)/(tabs)/orders`

### Upload integration

The bottom sheet calls the existing upload mutation (`POST /api/upload`, `multipart/form-data`). The local cached file path is passed directly as the file field. No changes to the API or upload hook.

---

## Files Changed

| File | Change |
|------|--------|
| `android/app/src/main/AndroidManifest.xml` | Add PDF `VIEW` intent filter |
| `apps/mobile/app/_layout.tsx` | Linking handler + render `<PdfConfirmSheet />` |
| `apps/mobile/stores/pendingPdfStore.ts` | New Zustand store |
| `apps/mobile/components/PdfConfirmSheet.tsx` | New bottom sheet component |

---

## Error Handling

- **Duplicate invoice:** API returns `status: "duplicate"`. Sheet shows "Already added" state with Dismiss only.
- **Parse failure:** API returns `status: "failed"`. Sheet shows error state with Retry and Dismiss.
- **Network error:** Upload mutation throws. Sheet shows error state with Retry and Dismiss.
- **Non-PDF intent:** `handleIncomingUri` silently ignores URIs that are not PDFs.
- **File copy failure:** If `FileSystem.copyAsync` throws, do not set pending URI; log the error silently.

---

## Testing

### Unit tests

- `pendingPdfStore` — set, clear, initial state is null
- `PdfConfirmSheet` — render each of the 4 states with mocked props; verify buttons present/absent per state

### Manual testing checklist

1. Download Zepto PDF in Chrome → share → ghar-kharcha → confirm happy path navigates to Orders
2. Sign out → repeat step 1 → verify redirect to sign-in → sign in → confirm bottom sheet appears
3. Share same PDF twice → verify duplicate state shown
4. Enable airplane mode → share PDF → verify error state with Retry
5. Cold start (force-stop app first) → share PDF → verify cold-start Linking path works

---

## Out of Scope

- iOS support (different mechanism — share extension)
- Handling PDFs from other grocery platforms in a platform-specific way (parsing already handles zepto/swiggy/other)
- Background processing without user confirmation
