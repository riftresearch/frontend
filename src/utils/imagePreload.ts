// Lightweight image preloader with in-memory cache to avoid repeated flashes.

const loaded = new Set<string>();
const inflight = new Map<string, Promise<void>>();

export function preloadImage(url: string): Promise<void> {
  if (!url) return Promise.resolve();
  // Only run in browser
  if (typeof window === "undefined") return Promise.resolve();

  if (loaded.has(url)) return Promise.resolve();
  const existing = inflight.get(url);
  if (existing) return existing;

  const p = new Promise<void>(async (resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.onload = () => {
      loaded.add(url);
      inflight.delete(url);
      resolve();
    };
    img.onerror = () => {
      // Don't block on errors; consider it resolved to avoid retry storms.
      inflight.delete(url);
      resolve();
    };
    img.src = url;
    await img.decode().catch(() => undefined);
  });

  inflight.set(url, p);
  return p;
}

export function preloadImages(urls: Array<string | null | undefined>): Promise<void[]> {
  const list = Array.from(new Set(urls.filter(Boolean) as string[]));
  return Promise.all(list.map(preloadImage));
}

export function isImagePreloaded(url?: string | null): boolean {
  if (!url) return false;
  return loaded.has(url);
}
