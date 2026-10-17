import type { NavigateFunction } from "@/lib/router-compat";

/**
 * Smart back navigation that works inside Telegram in-app browser.
 * If there's no history (fresh webview), fall back to a safe route.
 */
export function smartBack(navigate: NavigateFunction, fallback: string = "/") {
  try {
    const len = typeof window !== "undefined" ? window.history.length : 0;
    if (len > 1) {
      navigate(-1);
      return;
    }
  } catch {
    /* noop */
  }
  navigate(fallback);
}
