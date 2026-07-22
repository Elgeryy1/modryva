import { expect, test } from "@playwright/test";
import { createTestSession, wireGuardianTestAuth } from "./fixtures.js";

/**
 * Covers the session-validity boundary — every one of these exercises the
 * REAL guardian-session.guard.ts + GuardianVerifyController + verify/page.tsx
 * code, only the initial auth proof is faked (see fixtures.ts).
 */

test("a valid, fresh session reaches the consent screen", async ({
  page,
  request,
}) => {
  const session = await createTestSession(request);
  await wireGuardianTestAuth(page, session.telegramUserId);

  await page.goto(`/guardian/verify?session=${session.sessionToken}`);

  await expect(page.getByText("Verificación de entrada")).toBeVisible();
  await expect(page.getByText("Entendido, continuar")).toBeVisible();
});

test("a missing session token shows the missing-session banner", async ({
  page,
}) => {
  await page.goto("/guardian/verify");
  await expect(page.getByText(/Falta el enlace de sesión/i)).toBeVisible();
});

test("an unknown/garbage session token surfaces a real session-not-found error", async ({
  page,
}) => {
  // No wireGuardianTestAuth needed for this one — the bogus token 404s
  // before user identity is even checked.
  await page.goto("/guardian/verify?session=this-token-does-not-exist");
  await expect(page.getByText(/no es válido|no es valido/i)).toBeVisible();
});

test("authenticating as a different Telegram user than the session owner is rejected", async ({
  page,
  request,
}) => {
  const session = await createTestSession(request);
  // Deliberately wire auth for a DIFFERENT user id than the session's real
  // owner — exercises GuardianSessionGuard's userMatches check for real.
  const impostorId = `${session.telegramUserId}9`;
  await wireGuardianTestAuth(page, impostorId);

  await page.goto(`/guardian/verify?session=${session.sessionToken}`);

  // Not one of the friendly ERROR_LABELS entries, so the page renders the
  // raw server error code — still proves the mismatch was rejected, not
  // silently accepted.
  await expect(page.getByText(/session-user-mismatch/i)).toBeVisible();
});
