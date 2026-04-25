import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PdfConfirmSheet } from './PdfConfirmSheet';
import { usePendingPdfStore } from '@/stores/pendingPdfStore';
import { authFetch } from '@/lib/auth-fetch';
import { router } from 'expo-router';

jest.mock('@/stores/pendingPdfStore');
jest.mock('@/lib/auth-fetch');
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;

type StoreShape = {
  pendingUri: string | null;
  clearPending: () => void;
  setPending: jest.Mock;
};

let currentStore: StoreShape;

function makeStore(overrides: Partial<StoreShape> = {}): StoreShape {
  return {
    pendingUri: 'file:///cache/pending-invoice.pdf',
    clearPending: jest.fn(),
    setPending: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  currentStore = makeStore();
  jest.mocked(usePendingPdfStore).mockImplementation((selector: any) => selector(currentStore));
});

it('renders nothing when pendingUri is null', () => {
  currentStore = makeStore({ pendingUri: null });
  const { queryByText } = render(<PdfConfirmSheet />);
  expect(queryByText('Add Invoice')).toBeNull();
});

it('shows idle state with filename and action buttons when pendingUri is set', () => {
  const { getByText } = render(<PdfConfirmSheet />);
  expect(getByText('pending-invoice.pdf')).toBeTruthy();
  expect(getByText('Add Invoice')).toBeTruthy();
  expect(getByText('Cancel')).toBeTruthy();
});

it('Cancel calls clearPending', () => {
  const clearPending = jest.fn();
  currentStore = makeStore({ clearPending });
  const { getByText } = render(<PdfConfirmSheet />);
  fireEvent.press(getByText('Cancel'));
  expect(clearPending).toHaveBeenCalledTimes(1);
});

it('Add Invoice shows parsing state then navigates to orders on success', async () => {
  const clearPending = jest.fn();
  currentStore = makeStore({ clearPending });
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
  mockAuthFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'duplicate', invoiceNo: 'INV-001' }),
  } as Response);

  const { getByText } = render(<PdfConfirmSheet />);
  fireEvent.press(getByText('Add Invoice'));

  await waitFor(() => expect(getByText('Already added')).toBeTruthy());
});

it('shows error state when fetch throws', async () => {
  mockAuthFetch.mockRejectedValue(new Error('Network error'));

  const { getByText } = render(<PdfConfirmSheet />);
  fireEvent.press(getByText('Add Invoice'));

  await waitFor(() => expect(getByText("Couldn't parse invoice")).toBeTruthy());
  expect(getByText('Retry')).toBeTruthy();
});

it('shows error state when server returns non-ok status', async () => {
  mockAuthFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'File too large' }),
  } as Response);

  const { getByText } = render(<PdfConfirmSheet />);
  fireEvent.press(getByText('Add Invoice'));

  await waitFor(() => expect(getByText("Couldn't parse invoice")).toBeTruthy());
  expect(getByText('File too large')).toBeTruthy();
});

it('Retry returns to idle state', async () => {
  mockAuthFetch.mockRejectedValue(new Error('Network error'));

  const { getByText } = render(<PdfConfirmSheet />);
  fireEvent.press(getByText('Add Invoice'));
  await waitFor(() => expect(getByText('Retry')).toBeTruthy());

  fireEvent.press(getByText('Retry'));
  expect(getByText('Add Invoice')).toBeTruthy();
});
