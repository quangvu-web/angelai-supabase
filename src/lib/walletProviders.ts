/**
 * Multi-Wallet Provider Layer — EIP-6963 first, EIP-1193 legacy fallback.
 *
 * Architecture:
 *   EIP-6963 announceProvider  ─┐
 *   legacy window.ethereum      ├─> normalized DetectedWallet[] ─> active EIP-1193 provider
 *   window.<brand> namespaces  ─┘
 *
 * Business logic must never branch on wallet brand — only on the EIP-1193 provider.
 */

export interface DetectedWallet {
  id: string;
  name: string;
  icon: string; // emoji or data-uri (EIP-6963 icons are data-uris)
  provider: any;
  rdns?: string;
  source: "eip6963" | "legacy";
}

/** EIP-6963 provider info record */
interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: any;
}

const STORAGE_KEY = "selected_wallet_rdns";
const LEGACY_STORAGE_KEY = "selected_wallet_id";

/** Canonical wallet catalog. `rdns` are the identifiers wallets announce via EIP-6963. */
export const WALLET_CATALOG = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    desc: "Ví phổ biến nhất",
    rdns: ["io.metamask", "io.metamask.mobile", "io.metamask.flask"],
    download: "https://metamask.io/download/",
    deepLink: (url: string) => `https://metamask.app.link/dapp/${url}`,
  },
  {
    id: "bitget",
    name: "Bitget Wallet",
    icon: "🟦",
    desc: "Ví đa chuỗi (trước là BitKeep)",
    rdns: ["com.bitget.web3", "com.bitkeep", "com.bitget.wallet"],
    download: "https://web3.bitget.com/en/wallet-download",
    deepLink: (url: string) =>
      `https://bkcode.vip?action=dapp&url=${encodeURIComponent(`https://${url}`)}`,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    desc: "Ví di động an toàn",
    rdns: ["com.trustwallet.app", "com.trustwallet"],
    download: "https://trustwallet.com/download",
    deepLink: (url: string) =>
      `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(`https://${url}`)}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    desc: "Ví của Coinbase",
    rdns: ["com.coinbase.wallet", "com.coinbase"],
    download: "https://www.coinbase.com/wallet/downloads",
    deepLink: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(`https://${url}`)}`,
  },
  {
    id: "okx",
    name: "OKX Wallet",
    icon: "⭕",
    desc: "Ví đa chuỗi",
    rdns: ["com.okex.wallet", "com.okx.wallet"],
    download: "https://www.okx.com/download",
    deepLink: (url: string) =>
      `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(`https://${url}`)}`,
  },
  {
    id: "rabby",
    name: "Rabby Wallet",
    icon: "🐰",
    desc: "Ví desktop cho DeFi",
    rdns: ["io.rabby"],
    download: "https://rabby.io/",
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    desc: "Hỗ trợ EVM",
    rdns: ["app.phantom"],
    download: "https://phantom.app/download",
    deepLink: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(`https://${url}`)}`,
  },
] as const;

export type WalletCatalogEntry = (typeof WALLET_CATALOG)[number];

// ─────────────────────────────────────────────────────────────
// EIP-6963 discovery
// ─────────────────────────────────────────────────────────────

const discovered = new Map<string, Eip6963ProviderDetail>(); // key: rdns
let listenerAttached = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      /* subscriber errors must never break discovery */
    }
  });
}

/** Idempotent: safe to call many times, attaches the announce listener only once. */
export function initWalletDiscovery() {
  if (typeof window === "undefined" || listenerAttached) return;
  listenerAttached = true;

  window.addEventListener("eip6963:announceProvider", ((event: CustomEvent) => {
    const detail = event.detail as Eip6963ProviderDetail;
    if (!detail?.info?.rdns || !detail.provider) return;
    const existing = discovered.get(detail.info.rdns);
    if (existing?.provider === detail.provider) return;
    discovered.set(detail.info.rdns, detail);
    notify();
  }) as EventListener);

  requestProviders();
}

/** Re-broadcast the request so late-injected wallets announce themselves. */
export function requestProviders() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/** Subscribe to discovery updates. Returns an unsubscribe function. */
export function subscribeWallets(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─────────────────────────────────────────────────────────────
// Legacy EIP-1193 detection (fallback only)
// ─────────────────────────────────────────────────────────────

function legacyBrandOf(p: any): WalletCatalogEntry | null {
  if (!p) return null;
  if (p.isBitKeep || p.isBitEthereum || p.isBitgetWallet) return byId("bitget");
  if (p.isOKExWallet || p.isOkxWallet) return byId("okx");
  if (p.isRabby) return byId("rabby");
  if (p.isPhantom) return byId("phantom");
  if (p.isCoinbaseWallet || p.isCoinbaseBrowser) return byId("coinbase");
  if (p.isTrust || p.isTrustWallet) return byId("trust");
  if (p.isMetaMask) return byId("metamask");
  return null;
}

function byId(id: string): WalletCatalogEntry | null {
  return (WALLET_CATALOG.find((w) => w.id === id) as WalletCatalogEntry) ?? null;
}

function catalogByRdns(rdns: string): WalletCatalogEntry | null {
  const lower = rdns.toLowerCase();
  return (
    (WALLET_CATALOG.find((w) => (w.rdns as readonly string[]).some((r) => r === lower)) as
      | WalletCatalogEntry
      | undefined) ?? null
  );
}

function legacyCandidates(): any[] {
  const win = window as any;
  const out: any[] = [];
  const push = (p: any) => {
    if (p && !out.includes(p)) out.push(p);
  };

  // Brand-specific namespaces
  push(win.bitkeep?.ethereum);
  push(win.bitgetWallet);
  push(win.okxwallet);
  push(win.trustwallet?.ethereum);
  push(win.coinbaseWalletExtension);
  push(win.rabby);
  push(win.phantom?.ethereum);

  // EIP-5749 multi-provider array
  if (Array.isArray(win.ethereum?.providers)) win.ethereum.providers.forEach(push);
  push(win.ethereum);

  return out;
}

/**
 * Returns the deduplicated list of usable wallets.
 * EIP-6963 entries win; legacy entries are only added for brands not already announced.
 */
export function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];
  initWalletDiscovery();

  const wallets: DetectedWallet[] = [];
  const seenIds = new Set<string>();
  const seenProviders = new Set<any>();

  // 1. EIP-6963 (authoritative)
  for (const detail of discovered.values()) {
    const entry = catalogByRdns(detail.info.rdns);
    const id = entry?.id ?? detail.info.rdns;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    seenProviders.add(detail.provider);
    wallets.push({
      id,
      name: entry?.name ?? detail.info.name,
      icon: detail.info.icon || entry?.icon || "🌐",
      provider: detail.provider,
      rdns: detail.info.rdns,
      source: "eip6963",
    });
  }

  // 2. Legacy fallback for brands that did not announce
  for (const p of legacyCandidates()) {
    if (seenProviders.has(p)) continue;
    const entry = legacyBrandOf(p);
    const id = entry?.id ?? "injected";
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    seenProviders.add(p);
    wallets.push({
      id,
      name: entry?.name ?? "Browser Wallet",
      icon: entry?.icon ?? "🌐",
      provider: p,
      rdns: entry?.rdns?.[0],
      source: "legacy",
    });
  }

  return wallets;
}

export function hasAnyWallet(): boolean {
  if (typeof window === "undefined") return false;
  return detectWallets().length > 0;
}

// ─────────────────────────────────────────────────────────────
// Active provider
// ─────────────────────────────────────────────────────────────

let _activeProvider: any = null;
let _activeWalletId: string | null = null;

export function setActiveProvider(provider: any, wallet?: DetectedWallet) {
  _activeProvider = provider ?? null;
  _activeWalletId = wallet?.id ?? null;
  try {
    if (wallet?.rdns) localStorage.setItem(STORAGE_KEY, wallet.rdns);
    else if (wallet?.id) localStorage.setItem(STORAGE_KEY, wallet.id);
    if (wallet?.name) localStorage.setItem(LEGACY_STORAGE_KEY, wallet.name);
  } catch {
    /* storage may be blocked */
  }
}

export function clearActiveProvider() {
  _activeProvider = null;
  _activeWalletId = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function getActiveWalletId(): string | null {
  return _activeWalletId;
}

/**
 * Resolves the EIP-1193 provider to use.
 * Priority: explicit selection > persisted rdns/id > single detected wallet > window.ethereum.
 * Never assumes window.ethereum is MetaMask.
 */
export function getActiveProvider(): any {
  if (_activeProvider) return _activeProvider;
  if (typeof window === "undefined") return null;

  const wallets = detectWallets();
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* noop */
  }

  if (saved) {
    const match =
      wallets.find((w) => w.rdns === saved) ?? wallets.find((w) => w.id === saved);
    if (match) {
      _activeProvider = match.provider;
      _activeWalletId = match.id;
      return _activeProvider;
    }
  }

  if (wallets.length === 1) {
    _activeProvider = wallets[0].provider;
    _activeWalletId = wallets[0].id;
    return _activeProvider;
  }

  // Ambiguous (multiple wallets, no selection): fall back to the injected default.
  return (window as any).ethereum ?? null;
}

/** Mobile deep link that opens angel.fun.rich inside the wallet's in-app browser. */
export function getWalletDeepLink(id: string): string | null {
  const entry = byId(id) as any;
  if (!entry?.deepLink) return null;
  const url = window.location.href.replace(/^https?:\/\//, "");
  return entry.deepLink(url);
}

export function getWalletDownloadUrl(id: string): string | null {
  return (byId(id) as any)?.download ?? null;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// WalletConnect: not configured. Requires WALLETCONNECT_PROJECT_ID.
export const WALLETCONNECT_CONFIGURED = false;
