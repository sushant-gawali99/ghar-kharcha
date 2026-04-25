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
