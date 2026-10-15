import { existsSync, readFileSync } from "node:fs";

const STATE_FILE = "/state/app_url";

/**
 * The live public Mini App URL. The `urlsync` sidecar writes the current tunnel
 * URL to a shared Docker volume; the bot reads it here so a tunnel rotation is
 * picked up WITHOUT a restart. Falls back to the configured env value when the
 * file is absent (local dev / no tunnel).
 */
export const readAppUrl = (fallback: string): string => {
  // A stable named tunnel pins the URL via env — skip the rotating state file
  // (which may still hold a dead quick-tunnel URL from a previous run).
  if (
    process.env.TELEGRAM_APP_URL_PINNED === "1" &&
    fallback.startsWith("https://")
  ) {
    return fallback;
  }
  try {
    if (existsSync(STATE_FILE)) {
      const url = readFileSync(STATE_FILE, "utf8").trim();
      if (url.startsWith("https://")) {
        return url;
      }
    }
  } catch {
    // fall through to the configured fallback
  }
  return fallback;
};
