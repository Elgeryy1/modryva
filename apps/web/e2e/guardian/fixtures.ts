import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Test-only helpers for Guardian Verification E2E specs. Every one of these
 * exists ONLY on the test side (Playwright config/fixtures) — no production
 * source file (apps/web/lib, apps/web/app) is modified to make any of this
 * work. Auth works by:
 *
 * 1. Minting a real session via the dev-only bootstrap endpoint
 *    (apps/api/src/guardian/guardian-dev.controller.ts), which itself is a
 *    404 unless the API has GUARDIAN_TEST_MODE=1 and isn't production.
 * 2. Injecting a fake (unsigned, meaningless) `window.Telegram.WebApp`
 *    object so the real frontend code's "no initData => don't even try the
 *    network call" guard (apps/web/lib/api.ts's guardianFetch) is satisfied
 *    enough to attempt the request at all.
 * 3. Rewriting the actual outgoing request at the network layer (Playwright
 *    route interception) to add the two headers GuardianSessionGuard's dev
 *    bypass requires — the bogus initData string never has to be valid
 *    because the server never inspects it once the bypass headers are
 *    present.
 */

const API_BASE =
  process.env.GUARDIAN_E2E_API_BASE_URL ?? "http://localhost:3001";

export interface TestSessionOptions {
  readonly mode?: "manual" | "assisted" | "auto" | "strict";
  readonly challengeDifficulty?: "basic" | "normal" | "strict";
  readonly telegramUserId?: string;
  readonly maxAttempts?: number;
}

export interface TestSession {
  readonly sessionToken: string;
  readonly telegramUserId: string;
}

let counter = 0;

export const createTestSession = async (
  request: APIRequestContext,
  options: TestSessionOptions = {},
): Promise<TestSession> => {
  counter += 1;
  const unique = `${Date.now()}-${counter}`;
  const telegramUserId = options.telegramUserId ?? `9${counter}00000001`;

  const response = await request.post(`${API_BASE}/v1/guardian/dev/sessions`, {
    data: {
      chatId: `e2e-chat-${unique}`,
      tenantId: `e2e-tenant-${unique}`,
      telegramChatId: `-100${1000000 + counter}`,
      telegramUserId,
      mode: options.mode ?? "manual",
      challengeDifficulty: options.challengeDifficulty ?? "basic",
      ...(options.maxAttempts !== undefined
        ? { maxAttempts: options.maxAttempts }
        : {}),
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Guardian dev session creation failed (${response.status()}): ${await response.text()}. ` +
        "Is the API running with GUARDIAN_TEST_MODE=1 and NODE_ENV!=production?",
    );
  }

  const body = (await response.json()) as {
    sessionToken: string;
    telegramUserId: string;
  };
  return {
    sessionToken: body.sessionToken,
    telegramUserId: body.telegramUserId,
  };
};

/** Wires fake-but-sufficient Telegram auth onto `page` for the given user.
 * Call BEFORE navigating to a /guardian/verify URL. */
export const wireGuardianTestAuth = async (
  page: Page,
  telegramUserId: string,
): Promise<void> => {
  await page.addInitScript(() => {
    // biome-ignore lint/suspicious/noExplicitAny: test-only global shape, not the real TelegramWebApp type
    (window as any).Telegram = {
      WebApp: {
        initData: "e2e-placeholder-not-a-real-signature",
        ready: () => {},
        HapticFeedback: {
          impactOccurred: () => {},
          notificationOccurred: () => {},
          selectionChanged: () => {},
        },
      },
    };
  });

  await page.route("**/v1/guardian/**", async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-guardian-test-bypass": "1",
        "x-guardian-test-user": telegramUserId,
      },
    });
  });
};
