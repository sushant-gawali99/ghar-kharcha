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
                {/* Cancel button — disabled during parsing */}
                <Pressable disabled style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, alignItems: 'center', opacity: 0.4 }}>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Cancel</Text>
                </Pressable>
                {/* Add Invoice button — disabled during parsing */}
                <Pressable disabled style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, alignItems: 'center', opacity: 0.4 }}>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 }}>Add Invoice</Text>
                </Pressable>
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
                <Pressable onPress={() => { setState('idle'); setErrorMessage(''); }} style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: T.ink, alignItems: 'center' }}>
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
