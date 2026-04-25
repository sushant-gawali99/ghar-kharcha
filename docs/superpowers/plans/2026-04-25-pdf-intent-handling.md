# PDF Intent Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register ghar-kharcha as an Android "Open with" handler for PDF files so that a PDF downloaded from Zepto automatically shows a confirmation bottom sheet and gets parsed into the expense tracker.

**Architecture:** Add a `VIEW` intent filter for `application/pdf` to `AndroidManifest.xml`. The root `_layout.tsx` handles incoming `content://` URIs via `expo-linking`, copies the file to cache via `expo-file-system`, and stores the local path in a new `pendingPdfStore` (Zustand). A new `PdfConfirmSheet` modal renders whenever the store has a pending URI and the user is authenticated — it drives the upload to the existing `/api/upload` endpoint and navigates to the Orders tab on success.

**Tech Stack:** React Native, Expo Router v4, expo-linking, expo-file-system, Zustand, authFetch (existing), jest-expo + @testing-library/react-native

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/mobile/android/app/src/main/AndroidManifest.xml` | Modify | Register PDF MIME type intent filter |
| `apps/mobile/stores/pendingPdfStore.ts` | Create | Hold the pending local file URI across auth transitions |
| `apps/mobile/stores/pendingPdfStore.test.ts` | Create | Unit tests for the store |
| `apps/mobile/components/PdfConfirmSheet.tsx` | Create | Bottom sheet with 4 states: idle → parsing → success/duplicate/error |
| `apps/mobile/components/PdfConfirmSheet.test.tsx` | Create | Unit tests for the sheet component |
| `apps/mobile/app/_layout.tsx` | Modify | Linking handler (cold + warm start) + render `<PdfConfirmSheet />` |

---

## Task 1: Add PDF intent filter to AndroidManifest.xml

**Files:**
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add intent filter**

  Open `apps/mobile/android/app/src/main/AndroidManifest.xml`. After the existing deep-link `<intent-filter>` block (the one with `gharkharcha` and `com.gharkharcha.app` schemes), add a new intent filter:

  ```xml
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/pdf" />
  </intent-filter>
  ```

  The `<activity>` block should now look like this:

  ```xml
  <activity android:name=".MainActivity" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode" android:launchMode="singleTask" android:windowSoftInputMode="adjustResize" android:theme="@style/Theme.App.SplashScreen" android:exported="true" android:screenOrientation="portrait">
    <intent-filter>
      <action android:name="android.intent.action.MAIN"/>
      <category android:name="android.intent.category.LAUNCHER"/>
    </intent-filter>
    <intent-filter>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.DEFAULT"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="gharkharcha"/>
      <data android:scheme="com.gharkharcha.app"/>
    </intent-filter>
    <intent-filter>
      <action android:name="android.intent.action.VIEW" />
      <category android:name="android.intent.category.DEFAULT" />
      <data android:mimeType="application/pdf" />
    </intent-filter>
  </activity>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/mobile/android/app/src/main/AndroidManifest.xml
  git commit -m "feat(android): register PDF VIEW intent filter"
  ```

---

## Task 2: Create pendingPdfStore

**Files:**
- Create: `apps/mobile/stores/pendingPdfStore.ts`
- Create: `apps/mobile/stores/pendingPdfStore.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `apps/mobile/stores/pendingPdfStore.test.ts`:

  ```typescript
  import { usePendingPdfStore } from './pendingPdfStore';

  beforeEach(() => {
    usePendingPdfStore.setState({ pendingUri: null });
  });

  it('starts with pendingUri null', () => {
    expect(usePendingPdfStore.getState().pendingUri).toBeNull();
  });

  it('setPending stores the uri', () => {
    usePendingPdfStore.getState().setPending('file:///cache/pending-invoice.pdf');
    expect(usePendingPdfStore.getState().pendingUri).toBe('file:///cache/pending-invoice.pdf');
  });

  it('clearPending resets uri to null', () => {
    usePendingPdfStore.getState().setPending('file:///cache/pending-invoice.pdf');
    usePendingPdfStore.getState().clearPending();
    expect(usePendingPdfStore.getState().pendingUri).toBeNull();
  });
  ```

- [ ] **Step 2: Run test — expect failure**

  ```bash
  cd apps/mobile && pnpm test stores/pendingPdfStore.test.ts
  ```

  Expected: `Cannot find module './pendingPdfStore'`

- [ ] **Step 3: Implement the store**

  Create `apps/mobile/stores/pendingPdfStore.ts`:

  ```typescript
  import { create } from 'zustand';

  interface PendingPdfState {
    pendingUri: string | null;
    setPending: (uri: string) => void;
    clearPending: () => void;
  }

  export const usePendingPdfStore = create<PendingPdfState>((set) => ({
    pendingUri: null,
    setPending: (uri) => set({ pendingUri: uri }),
    clearPending: () => set({ pendingUri: null }),
  }));
  ```

- [ ] **Step 4: Run test — expect pass**

  ```bash
  cd apps/mobile && pnpm test stores/pendingPdfStore.test.ts
  ```

  Expected: `PASS  stores/pendingPdfStore.test.ts` — 3 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/mobile/stores/pendingPdfStore.ts apps/mobile/stores/pendingPdfStore.test.ts
  git commit -m "feat: add pendingPdfStore for cross-auth URI handoff"
  ```

---

## Task 3: Create PdfConfirmSheet component

**Files:**
- Create: `apps/mobile/components/PdfConfirmSheet.tsx`
- Create: `apps/mobile/components/PdfConfirmSheet.test.tsx`

- [ ] **Step 1: Install @testing-library/react-native**

  ```bash
  cd apps/mobile && pnpm add -D @testing-library/react-native
  ```

- [ ] **Step 2: Write the failing tests**

  Create `apps/mobile/components/PdfConfirmSheet.test.tsx`:

  ```typescript
  import React from 'react';
  import { render, fireEvent, waitFor } from '@testing-library/react-native';
  import { PdfConfirmSheet } from './PdfConfirmSheet';
  import { usePendingPdfStore } from '@/stores/pendingPdfStore';
  import { authFetch } from '@/lib/auth-fetch';
  import { router } from 'expo-router';

  jest.mock('@/stores/pendingPdfStore');
  jest.mock('@/lib/auth-fetch');
  jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

  const mockUsePendingPdfStore = usePendingPdfStore as jest.MockedFunction<typeof usePendingPdfStore>;
  const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;

  function makeStore(overrides: Partial<{ pendingUri: string | null; clearPending: () => void }> = {}) {
    return {
      pendingUri: 'file:///cache/pending-invoice.pdf',
      clearPending: jest.fn(),
      setPending: jest.fn(),
      ...overrides,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when pendingUri is null', () => {
    mockUsePendingPdfStore.mockReturnValue(makeStore({ pendingUri: null }) as any);
    const { queryByText } = render(<PdfConfirmSheet />);
    expect(queryByText('Add Invoice')).toBeNull();
  });

  it('shows idle state with filename and action buttons when pendingUri is set', () => {
    mockUsePendingPdfStore.mockReturnValue(makeStore() as any);
    const { getByText } = render(<PdfConfirmSheet />);
    expect(getByText('pending-invoice.pdf')).toBeTruthy();
    expect(getByText('Add Invoice')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('Cancel calls clearPending', () => {
    const clearPending = jest.fn();
    mockUsePendingPdfStore.mockReturnValue(makeStore({ clearPending }) as any);
    const { getByText } = render(<PdfConfirmSheet />);
    fireEvent.press(getByText('Cancel'));
    expect(clearPending).toHaveBeenCalledTimes(1);
  });

  it('Add Invoice shows parsing state then navigates to orders on success', async () => {
    const clearPending = jest.fn();
    mockUsePendingPdfStore.mockReturnValue(makeStore({ clearPending }) as any);
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', total: '450.00', itemCount: 12, platform: 'zepto' }),
    } as Response);

    const { getByText } = render(<PdfConfirmSheet />);
    fireEvent.press(getByText('Add Invoice'));

    expect(getByText('Parsing your invoice…')).toBeTruthy();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/(tabs)/orders'));
    expect(clearPending).toHaveBeenCalledTimes(1);
  });

  it('shows duplicate state when API returns status duplicate', async () => {
    mockUsePendingPdfStore.mockReturnValue(makeStore() as any);
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'duplicate', invoiceNo: 'INV-001' }),
    } as Response);

    const { getByText } = render(<PdfConfirmSheet />);
    fireEvent.press(getByText('Add Invoice'));

    await waitFor(() => expect(getByText('Already added')).toBeTruthy());
  });

  it('shows error state when fetch throws', async () => {
    mockUsePendingPdfStore.mockReturnValue(makeStore() as any);
    mockAuthFetch.mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<PdfConfirmSheet />);
    fireEvent.press(getByText('Add Invoice'));

    await waitFor(() => expect(getByText("Couldn't parse invoice")).toBeTruthy());
    expect(getByText('Retry')).toBeTruthy();
  });

  it('Retry returns to idle state', async () => {
    mockUsePendingPdfStore.mockReturnValue(makeStore() as any);
    mockAuthFetch.mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<PdfConfirmSheet />);
    fireEvent.press(getByText('Add Invoice'));
    await waitFor(() => expect(getByText('Retry')).toBeTruthy());

    fireEvent.press(getByText('Retry'));
    expect(getByText('Add Invoice')).toBeTruthy();
  });
  ```

- [ ] **Step 3: Run tests — expect failure**

  ```bash
  cd apps/mobile && pnpm test components/PdfConfirmSheet.test.tsx
  ```

  Expected: `Cannot find module './PdfConfirmSheet'`

- [ ] **Step 4: Implement PdfConfirmSheet**

  Create `apps/mobile/components/PdfConfirmSheet.tsx`:

  ```typescript
  import { useEffect, useState } from 'react';
  import {
    ActivityIndicator,
    BackHandler,
    Modal,
    Pressable,
    Text,
    View,
  } from 'react-native';
  import { router } from 'expo-router';
  import { authFetch } from '@/lib/auth-fetch';
  import { usePendingPdfStore } from '@/stores/pendingPdfStore';
  import { FONTS, T } from '@/lib/theme';

  type SheetState = 'idle' | 'parsing' | 'duplicate' | 'error';

  export function PdfConfirmSheet() {
    const pendingUri = usePendingPdfStore((s) => s.pendingUri);
    const clearPending = usePendingPdfStore((s) => s.clearPending);
    const [state, setState] = useState<SheetState>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
      if (pendingUri) setState('idle');
    }, [pendingUri]);

    useEffect(() => {
      if (state !== 'parsing') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [state]);

    if (!pendingUri) return null;

    const fileName = pendingUri.split('/').pop() ?? 'invoice.pdf';

    const handleConfirm = async () => {
      setState('parsing');
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: pendingUri,
          name: fileName,
          type: 'application/pdf',
        } as unknown as Blob);
        const res = await authFetch('/api/upload', { method: 'POST', body: formData });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMessage(body.error ?? `Upload failed (${res.status})`);
          setState('error');
          return;
        }
        if (body.status === 'duplicate') {
          setState('duplicate');
          return;
        }
        clearPending();
        router.replace('/(auth)/(tabs)/orders');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Please try again.');
        setState('error');
      }
    };

    const handleDismiss = () => {
      clearPending();
      setState('idle');
    };

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={state === 'parsing' ? () => {} : handleDismiss}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: T.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: T.paper2, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

            {state === 'idle' && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <View style={{ width: 40, height: 48, backgroundColor: T.card, borderRadius: 4, borderWidth: 0.5, borderColor: T.rule, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: FONTS.serifBold, fontSize: 9, color: T.terracotta }}>PDF</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink }} numberOfLines={1}>{fileName}</Text>
                    <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: T.ink3, marginTop: 2 }}>application/pdf</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, marginBottom: 20 }}>
                  Add this invoice to your expense tracker?
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={handleDismiss} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleConfirm} style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: T.ink, alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.paper }}>Add Invoice</Text>
                  </Pressable>
                </View>
              </>
            )}

            {state === 'parsing' && (
              <>
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <ActivityIndicator size="large" color={T.ink} style={{ marginBottom: 16 }} />
                  <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink }}>Parsing your invoice…</Text>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: T.ink3, marginTop: 6 }}>This usually takes a few seconds</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, alignItems: 'center', opacity: 0.4 }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Cancel</Text>
                  </View>
                  <View style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, alignItems: 'center', opacity: 0.4 }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Add Invoice</Text>
                  </View>
                </View>
              </>
            )}

            {state === 'duplicate' && (
              <>
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
                  <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink }}>Already added</Text>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                    {'This invoice is already in your\nexpense tracker.'}
                  </Text>
                </View>
                <Pressable onPress={handleDismiss} style={{ paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, alignItems: 'center' }}>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Dismiss</Text>
                </Pressable>
              </>
            )}

            {state === 'error' && (
              <>
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={{ fontSize: 32, marginBottom: 12 }}>❌</Text>
                  <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink }}>Couldn't parse invoice</Text>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: T.ink3, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                    {errorMessage || 'Something went wrong. You can\nretry or add it manually.'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={handleDismiss} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Dismiss</Text>
                  </Pressable>
                  <Pressable onPress={() => setState('idle')} style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: T.ink, alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.paper }}>Retry</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }
  ```

- [ ] **Step 5: Run tests — expect pass**

  ```bash
  cd apps/mobile && pnpm test components/PdfConfirmSheet.test.tsx
  ```

  Expected: `PASS  components/PdfConfirmSheet.test.tsx` — 6 tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/mobile/components/PdfConfirmSheet.tsx apps/mobile/components/PdfConfirmSheet.test.tsx
  git commit -m "feat: add PdfConfirmSheet with idle/parsing/duplicate/error states"
  ```

---

## Task 4: Wire Linking handler into _layout.tsx

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Replace _layout.tsx with updated version**

  Replace the full contents of `apps/mobile/app/_layout.tsx` with:

  ```typescript
  import "../global.css";
  import { Stack } from "expo-router";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { StatusBar } from "expo-status-bar";
  import { useFonts } from "expo-font";
  import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  } from "@expo-google-fonts/inter";
  import {
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
  } from "@expo-google-fonts/fraunces";
  import { View } from "react-native";
  import { useEffect } from "react";
  import { useAuthStore } from "@/lib/auth";
  import * as Linking from "expo-linking";
  import * as FileSystem from "expo-file-system";
  import { usePendingPdfStore } from "@/stores/pendingPdfStore";
  import { PdfConfirmSheet } from "@/components/PdfConfirmSheet";

  const queryClient = new QueryClient();

  export default function RootLayout() {
    const loadSession = useAuthStore((s) => s.loadSession);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [fontsLoaded] = useFonts({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Fraunces_400Regular,
      Fraunces_400Regular_Italic,
      Fraunces_600SemiBold,
      Fraunces_600SemiBold_Italic,
    });

    useEffect(() => {
      loadSession();
    }, []);

    useEffect(() => {
      const handleIncomingUri = async (uri: string | null) => {
        if (!uri?.startsWith("content://")) return;
        try {
          const dest = FileSystem.cacheDirectory + "pending-invoice.pdf";
          await FileSystem.copyAsync({ from: uri, to: dest });
          usePendingPdfStore.getState().setPending(dest);
        } catch (err) {
          console.warn("[PDF intent] failed to copy file:", err);
        }
      };

      Linking.getInitialURL().then(handleIncomingUri);
      const sub = Linking.addEventListener("url", ({ url }) => handleIncomingUri(url));
      return () => sub.remove();
    }, []);

    if (!fontsLoaded) {
      return <View style={{ flex: 1, backgroundColor: "#F3EADB" }} />;
    }

    return (
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
        {isAuthenticated && <PdfConfirmSheet />}
      </QueryClientProvider>
    );
  }
  ```

- [ ] **Step 2: Run full test suite**

  ```bash
  cd apps/mobile && pnpm test
  ```

  Expected: all tests pass (store + component).

- [ ] **Step 3: Typecheck**

  ```bash
  cd apps/mobile && pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/mobile/app/_layout.tsx
  git commit -m "feat: wire PDF intent Linking handler and PdfConfirmSheet into root layout"
  ```

---

## Task 5: Build and manual test

- [ ] **Step 1: Build debug APK**

  ```bash
  cd apps/mobile && pnpm android
  ```

  Or build a release APK if testing on a physical device without a dev server:

  ```bash
  cd apps/mobile/android && ./gradlew assembleRelease
  ```

  APK output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

- [ ] **Step 2: Sideload on device**

  ```bash
  adb install apps/mobile/android/app/build/outputs/apk/release/app-release.apk
  ```

- [ ] **Step 3: Manual test checklist**

  Run each scenario and verify the described outcome:

  | # | Scenario | Expected |
  |---|----------|----------|
  | 1 | Signed in → download Zepto PDF in Chrome → share → select ghar-kharcha | Bottom sheet appears with filename; tap Add Invoice → spinner → navigates to Orders tab |
  | 2 | Force-stop app → signed in → open PDF → tap app (cold start) | Same as #1 — `getInitialURL` path |
  | 3 | Sign out → download Zepto PDF → select ghar-kharcha → sign in | Sign-in screen appears; after login, bottom sheet appears automatically |
  | 4 | Share same PDF a second time | "Already added" state with Dismiss only |
  | 5 | Enable airplane mode → share PDF → tap Add Invoice | "Couldn't parse invoice" error state with Retry button; tapping Retry returns to idle |
  | 6 | Share a non-PDF file (e.g. image) | App opens normally, no bottom sheet |
