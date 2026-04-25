import { handleIncomingPdfUri } from './handleIncomingPdfUri';
import * as FileSystem from 'expo-file-system';
import { usePendingPdfStore } from '@/stores/pendingPdfStore';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  copyAsync: jest.fn(),
}));

jest.mock('@/stores/pendingPdfStore', () => ({
  usePendingPdfStore: { getState: jest.fn() },
}));

const mockCopyAsync = FileSystem.copyAsync as jest.MockedFunction<typeof FileSystem.copyAsync>;
const mockGetState = usePendingPdfStore.getState as jest.MockedFunction<typeof usePendingPdfStore.getState>;
const mockSetPending = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockCopyAsync.mockResolvedValue(undefined);
  mockGetState.mockReturnValue({ setPending: mockSetPending, clearPending: jest.fn(), pendingUri: null });
});

it('ignores null uri', async () => {
  await handleIncomingPdfUri(null);
  expect(mockCopyAsync).not.toHaveBeenCalled();
});

it('ignores non-content:// uri', async () => {
  await handleIncomingPdfUri('gharkharcha://home');
  expect(mockCopyAsync).not.toHaveBeenCalled();
});

it('ignores file:// uri', async () => {
  await handleIncomingPdfUri('file:///downloads/invoice.pdf');
  expect(mockCopyAsync).not.toHaveBeenCalled();
});

it('copies content:// uri to cache and calls setPending', async () => {
  await handleIncomingPdfUri('content://com.android.providers.downloads/document/123');
  expect(mockCopyAsync).toHaveBeenCalledWith({
    from: 'content://com.android.providers.downloads/document/123',
    to: 'file:///cache/pending-invoice.pdf',
  });
  expect(mockSetPending).toHaveBeenCalledWith('file:///cache/pending-invoice.pdf');
});

it('does not call setPending if copyAsync throws', async () => {
  mockCopyAsync.mockRejectedValue(new Error('Permission denied'));
  await handleIncomingPdfUri('content://com.android.providers.downloads/document/123');
  expect(mockSetPending).not.toHaveBeenCalled();
});
