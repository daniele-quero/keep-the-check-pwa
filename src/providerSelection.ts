// Temporary, client-side AI provider selection with a 1-hour TTL.
// Only the providerId is stored (never a key). Backed by sessionStorage so the
// selection is naturally cleared when the user leaves the web app; it also
// expires after SELECTION_TTL_MS even within the same session.

import { getCatalogEntry } from "./providerCatalog";

export const SELECTION_TTL_MS = 3_600_000; // 1 hour
const STORAGE_KEY = "aiProviderSelection";

interface StoredSelection {
  providerId: string;
  expiresAt: number;
}

function getStore(): Storage | undefined {
  return typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
}

export function getSelectedProvider(): string | null {
  const store = getStore();
  if (!store) return null;
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return null;

  let parsed: StoredSelection;
  try {
    parsed = JSON.parse(raw) as StoredSelection;
  } catch {
    store.removeItem(STORAGE_KEY);
    return null;
  }

  if (
    !parsed ||
    typeof parsed.providerId !== "string" ||
    typeof parsed.expiresAt !== "number" ||
    !getCatalogEntry(parsed.providerId)
  ) {
    store.removeItem(STORAGE_KEY);
    return null;
  }

  if (Date.now() >= parsed.expiresAt) {
    store.removeItem(STORAGE_KEY);
    return null;
  }

  return parsed.providerId;
}

export function setSelectedProvider(id: string): void {
  const store = getStore();
  if (!store) return;
  if (!getCatalogEntry(id)) return;
  const payload: StoredSelection = {
    providerId: id,
    expiresAt: Date.now() + SELECTION_TTL_MS,
  };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage full or unavailable */
  }
}

export function clearSelection(): void {
  const store = getStore();
  store?.removeItem(STORAGE_KEY);
}
