import { initErrorTracking } from "@superbot/shared";

/**
 * Next's boot hook — runs once per server process, before any request.
 *
 * SERVER-SIDE ONLY, and the NEXT_RUNTIME guard is what keeps it that way: this
 * is the only file in the web app that imports a VALUE from @superbot/shared,
 * and that barrel re-exports pino and zod. See next.config.ts on why every
 * other import from it must stay `import type`.
 *
 * No browser reporting either. It would need a DSN embedded in the page and a
 * tracker reachable from the public internet; GlitchTip runs on the NAS and is
 * not. Shipping one anyway would only produce events that never arrive, from a
 * page advertising the address of an internal service.
 */
export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  // process.env directly, NOT getRuntimeEnv(). That validates the whole runtime
  // contract, including rules about services this one is not — the web is not
  // given GUARDIAN_MEDIA_ENCRYPTION_KEY on purpose, because it never touches
  // captured media, and validating for it here took the Mini App down with
  // "Invalid environment" the moment this hook first ran. An instrumentation
  // hook needs three strings; making it a gate on everyone else's config gives
  // a reporting feature the power to refuse a boot.
  await initErrorTracking({
    dsn: process.env.SENTRY_DSN,
    service: "web",
    release: process.env.APP_BUILD_SHA ?? "unknown",
    environment: process.env.NODE_ENV ?? "production",
  });
};
