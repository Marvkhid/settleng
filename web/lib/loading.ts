/**
 * One global loading signal for the whole app.
 *
 * Two things can own it:
 *  - Writes the user started (`beginLoading`/`endLoading`), wrapped around the single fetch helper.
 *  - Route changes (`startNavigation`/`finishNavigation`), driven by a link click and resolved by
 *    the pathname watcher.
 *
 * The state lives on `globalThis`, not in module scope: Next can place the same module in more than
 * one client chunk, and module-scoped state would then split into two unrelated counters (the
 * request would increment one while the overlay listened to the other). One key, one store.
 *
 * A delay keeps fast operations from flashing the overlay, and a minimum visible time stops it
 * flickering off the instant a request returns. Counting also guarantees that overlapping work can
 * never stack two overlays: the overlay renders once, from one boolean.
 */

type Listener = (active: boolean) => void;

const SHOW_DELAY_MS = 160;
const MIN_VISIBLE_MS = 320;
const NAV_SAFETY_MS = 10_000;
const STORE_KEY = "__settlengLoadingStore__";

interface LoadingStore {
  requests: number;
  navOwned: boolean;
  visible: boolean;
  shownAt: number;
  showTimer: ReturnType<typeof setTimeout> | null;
  hideTimer: ReturnType<typeof setTimeout> | null;
  navTimer: ReturnType<typeof setTimeout> | null;
  snapshot: boolean;
  listeners: Set<Listener>;
}

function createStore(): LoadingStore {
  return {
    requests: 0,
    navOwned: false,
    visible: false,
    shownAt: 0,
    showTimer: null,
    hideTimer: null,
    navTimer: null,
    snapshot: false,
    listeners: new Set<Listener>(),
  };
}

const store: LoadingStore = (() => {
  const host = globalThis as unknown as Record<string, LoadingStore | undefined>;
  const existing = host[STORE_KEY];
  if (existing) return existing;
  const created = createStore();
  host[STORE_KEY] = created;
  return created;
})();

export function subscribeLoading(listener: Listener): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function getLoadingSnapshot(): boolean {
  return store.snapshot;
}

/** Server render: never show the overlay, so hydration matches. */
export function getServerLoadingSnapshot(): boolean {
  return false;
}

function publish(next: boolean): void {
  if (store.snapshot === next) return;
  store.snapshot = next;
  for (const listener of store.listeners) listener(next);
}

/**
 * Which requests deserve the blocking overlay.
 *
 * Reads never do: dashboard loads, refreshes, polling, "me" checks and analytics all happen on
 * their own while the page stays usable. Writes do, because the person is waiting for their own
 * action to land. A caller can override either way with the explicit `loading` option.
 */
export function isBlockingRequest(method?: string): boolean {
  const verb = (method ?? "GET").toUpperCase();
  return verb !== "GET" && verb !== "HEAD" && verb !== "OPTIONS";
}

function scheduleShow(): void {
  if (store.visible || store.showTimer) return;
  store.showTimer = setTimeout(() => {
    store.showTimer = null;
    if (store.requests > 0 && !store.visible) {
      store.visible = true;
      store.shownAt = Date.now();
      publish(true);
    }
  }, SHOW_DELAY_MS);
}

function scheduleHide(): void {
  if (store.requests > 0) return;
  if (store.showTimer) {
    clearTimeout(store.showTimer);
    store.showTimer = null;
  }
  if (!store.visible) return;
  const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - store.shownAt));
  if (store.hideTimer) clearTimeout(store.hideTimer);
  store.hideTimer = setTimeout(() => {
    store.hideTimer = null;
    if (store.requests === 0) {
      store.visible = false;
      publish(false);
    }
  }, remaining);
}

export function beginLoading(): void {
  store.requests += 1;
  if (store.requests === 1) {
    if (store.hideTimer) {
      clearTimeout(store.hideTimer);
      store.hideTimer = null;
    }
    scheduleShow();
  }
}

export function endLoading(): void {
  store.requests = Math.max(0, store.requests - 1);
  scheduleHide();
}

/** Called when an internal link is clicked; resolved once the new pathname is rendered. */
export function startNavigation(): void {
  if (store.navOwned) return;
  store.navOwned = true;
  beginLoading();
  if (store.navTimer) clearTimeout(store.navTimer);
  store.navTimer = setTimeout(() => {
    store.navTimer = null;
    finishNavigation();
  }, NAV_SAFETY_MS);
}

export function finishNavigation(): void {
  if (store.navTimer) {
    clearTimeout(store.navTimer);
    store.navTimer = null;
  }
  if (!store.navOwned) return;
  store.navOwned = false;
  endLoading();
}

/** Test helper: returns the store to a clean state without touching the DOM. */
export function resetLoadingForTests(): void {
  store.requests = 0;
  store.navOwned = false;
  store.visible = false;
  store.shownAt = 0;
  if (store.showTimer) clearTimeout(store.showTimer);
  if (store.hideTimer) clearTimeout(store.hideTimer);
  if (store.navTimer) clearTimeout(store.navTimer);
  store.showTimer = null;
  store.hideTimer = null;
  store.navTimer = null;
  publish(false);
}
