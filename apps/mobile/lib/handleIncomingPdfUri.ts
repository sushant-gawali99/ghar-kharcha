import * as FileSystem from "expo-file-system";
import { usePendingPdfStore } from "@/stores/pendingPdfStore";

export async function handleIncomingPdfUri(uri: string | null): Promise<void> {
  if (!uri?.startsWith("content://")) return;
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      console.warn("[PDF intent] cacheDirectory unavailable");
      return;
    }
    // TODO: fixed filename overwrites on rapid re-share; use a timestamp/uuid suffix before prod
    const dest = cacheDir + "pending-invoice.pdf";
    await FileSystem.copyAsync({ from: uri, to: dest });
    usePendingPdfStore.getState().setPending(dest);
  } catch (err) {
    console.warn("[PDF intent] failed to copy file:", err);
  }
}
