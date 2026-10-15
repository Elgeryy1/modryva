// Thin wrapper over the Telegram WebApp SDK (loaded in app/layout.tsx). No
// external dependency — just typed access to what the Mini App needs.

/** Telegram's bottom action button — the native, sticky primary CTA. */
export interface TgMainButton {
  setText: (text: string) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  setParams: (params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }) => void;
}

/** Native back arrow in the Telegram header. */
export interface TgBackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

/** Native haptic feedback — the small taps that make an app feel physical. */
export interface TgHaptic {
  impactOccurred: (
    style: "light" | "medium" | "heavy" | "rigid" | "soft",
  ) => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

export interface TelegramWebApp {
  readonly initData: string;
  readonly colorScheme?: "light" | "dark";
  readonly themeParams?: Record<string, string>;
  readonly platform?: string;
  readonly version?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  MainButton?: TgMainButton;
  BackButton?: TgBackButton;
  HapticFeedback?: TgHaptic;
  openInvoice?: (
    url: string,
    callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void,
  ) => void;
  openTelegramLink?: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const getWebApp = (): TelegramWebApp | undefined =>
  typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

export const getInitData = (): string => getWebApp()?.initData ?? "";

export const getMainButton = (): TgMainButton | undefined =>
  getWebApp()?.MainButton;

export const getBackButton = (): TgBackButton | undefined =>
  getWebApp()?.BackButton;

/**
 * Haptic helpers that no-op safely outside Telegram (SDK absent) so the UI can
 * fire them anywhere without guards. `selection` for taps/toggles, `impact` for
 * presses, `notify` for success/error outcomes.
 */
export const haptic = {
  impact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light") {
    getWebApp()?.HapticFeedback?.impactOccurred?.(style);
  },
  notify(type: "error" | "success" | "warning") {
    getWebApp()?.HapticFeedback?.notificationOccurred?.(type);
  },
  selection() {
    getWebApp()?.HapticFeedback?.selectionChanged?.();
  },
};

const urlParam = (name: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const value = new URLSearchParams(window.location.search).get(name);
  return value && value.length > 0 ? value : null;
};

// Reads a URL param but ALSO remembers it for the rest of the Mini App session.
// Client-side navigation (Next <Link> / router.replace) drops the query string,
// so a value only present on the first load (like ?tgbot=) would be lost on
// every later page. Persisting it keeps the bot identity attached to every API
// call regardless of which page we're on.
const stickyParam = (name: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const key = `superbot:${name}`;
  const fromUrl = new URLSearchParams(window.location.search).get(name);
  try {
    if (fromUrl && fromUrl.length > 0) {
      window.sessionStorage.setItem(key, fromUrl);
      return fromUrl;
    }
    const stored = window.sessionStorage.getItem(key);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return fromUrl && fromUrl.length > 0 ? fromUrl : null;
  }
};

export const getStartParam = (): string | null => {
  const fromUrl = urlParam("sp");
  if (fromUrl) {
    return fromUrl;
  }
  const initData = getInitData();
  const fromInit = initData
    ? new URLSearchParams(initData).get("start_param")
    : null;
  if (fromInit) {
    return fromInit;
  }
  // A managed child bot opens the Mini App via a `web_app` button whose URL
  // carries `?sp=<startParam>` — Telegram does NOT populate start_param for
  // web_app buttons, only for named-app `t.me/bot/app?startapp=` links (which
  // child bots can't register). Fall back to the URL so routing works the same.
  return null;
};

const cleanBotParam = (value: string | null): string | null => {
  const raw = (value ?? "").replace(/^@/u, "").toLowerCase();
  return /^[a-z0-9_]{4,64}$/u.test(raw) ? raw : null;
};

/**
 * The bot whose Mini App this is, from the `?tgbot=` param that a managed bot's
 * menu button / web_app button carries. Sent to the API as `X-Bot-Username` so
 * it verifies initData against that bot's token. Null → the primary bot.
 */
export const getBotUsername = (): string | null => {
  return cleanBotParam(stickyParam("tgbot"));
};

export const getActAsBotUsername = (): string | null => {
  return cleanBotParam(stickyParam("actas"));
};

/**
 * Opens a `t.me/...` link the native way inside Telegram (staying in the app),
 * falling back to a new browser tab when the SDK is absent (dev/preview).
 */
export const openTelegramLink = (url: string): void => {
  const webApp = getWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
  }
};

/** Opens Telegram's native Stars payment sheet for an invoice link. */
export const openInvoice = (
  url: string,
  callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void,
): void => {
  getWebApp()?.openInvoice?.(url, callback);
};

export const getColorScheme = (): "light" | "dark" =>
  getWebApp()?.colorScheme === "dark" ? "dark" : "light";

export const ready = (): void => {
  const webApp = getWebApp();
  webApp?.ready?.();
  webApp?.expand?.();
  // Paint Telegram's own header + background from the theme so the app is
  // seamless top to bottom (the SDK exposes the theme via --tg-theme-* CSS vars,
  // which globals.css consumes). Uses named theme colors, not fixed hex.
  webApp?.setBackgroundColor?.("bg_color");
  webApp?.setHeaderColor?.("secondary_bg_color");
};
