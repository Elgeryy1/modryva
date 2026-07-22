import { expect, test } from "@playwright/test";
import { createTestSession, wireGuardianTestAuth } from "./fixtures.js";

/**
 * Camera permission + the real on-device challenge pipeline. Chromium's
 * fake video device (see playwright.config.ts) feeds a synthetic test
 * pattern by default — MediaPipe's real FaceLandmarker won't recognize it
 * as a face, so these specs exercise the REAL detection pipeline (WASM
 * load, ChallengeGate, capture, submit) end-to-end through its FAILURE
 * path, which is honest and doesn't need a real face fixture. Scenarios
 * that need a successful detection (correct video, auto-approve) are in
 * fixtures-needed.spec.ts, skipped with a clear reason.
 */

const advanceThroughConsentAndPermission = async (
  page: import("@playwright/test").Page,
) => {
  await page.getByText("Entendido, continuar").click();
  await expect(page.getByText("Activar la cámara")).toBeVisible();
  await page.getByText("Activar cámara").click();
};

test("granting camera permission reaches the challenge guide screen with a live preview", async ({
  page,
  request,
}) => {
  const session = await createTestSession(request);
  await wireGuardianTestAuth(page, session.telegramUserId);
  await page.goto(`/guardian/verify?session=${session.sessionToken}`);

  await advanceThroughConsentAndPermission(page);

  await expect(page.getByText("Tu reto")).toBeVisible();
  await expect(page.locator("video.guardian-camera-preview")).toBeVisible();
  await expect(page.getByText("Comenzar")).toBeVisible();
});

test("denying camera permission shows the real camera-access error, never a fake pass-through", async ({
  page,
  context,
  request,
}) => {
  // Override the page-level permission grant from playwright.config.ts —
  // this test specifically wants getUserMedia() to reject.
  await context.clearPermissions();
  const session = await createTestSession(request);
  await wireGuardianTestAuth(page, session.telegramUserId);

  // Force getUserMedia to reject regardless of the fake-device flags, so
  // this test is deterministic even if a future Chromium version changes
  // fake-device permission defaults.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });

  await page.goto(`/guardian/verify?session=${session.sessionToken}`);
  await page.getByText("Entendido, continuar").click();
  await page.getByText("Activar cámara").click();

  await expect(page.getByText(/No pude acceder a tu cámara/i)).toBeVisible();
});

test("a challenge that never sees the requested gesture times out into a real retry, never a fabricated pass", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const session = await createTestSession(request, {
    challengeDifficulty: "basic", // single step keeps this test's own timeout budget sane
  });
  await wireGuardianTestAuth(page, session.telegramUserId);
  await page.goto(`/guardian/verify?session=${session.sessionToken}`);

  await advanceThroughConsentAndPermission(page);
  await page.getByText("Comenzar").click();

  // Real MediaPipe inference now runs against the synthetic fake camera
  // feed in-browser; since it never matches the requested action, the
  // ChallengeGate's own step timeout (~6s, see modules/guardian/src/
  // challenge.ts's STEP_TIME_LIMIT_MS) fires for real, the client submits
  // whatever partial stepResults it has, and the REAL server rejects an
  // incomplete challenge via verifyChallengeSubmission — never an
  // auto-approve.
  await expect(page.getByText(/Repite la verificación/i)).toBeVisible({
    timeout: 20_000,
  });
});

test("exhausting every attempt without ever completing the challenge lands in manual review, never auto-approved", async ({
  page,
  request,
}) => {
  test.setTimeout(30_000);
  // A single attempt: the very first (inevitably incomplete, since the fake
  // camera never produces a matching gesture) submission immediately
  // exhausts attemptsRemaining, so the REAL decision engine's
  // declineOrReview path resolves this to manual_review right away
  // (allowAutomaticDecline defaults to false) instead of another retry.
  const session = await createTestSession(request, { maxAttempts: 1 });
  await wireGuardianTestAuth(page, session.telegramUserId);
  await page.goto(`/guardian/verify?session=${session.sessionToken}`);

  await advanceThroughConsentAndPermission(page);
  await page.getByText("Comenzar").click();

  await expect(page.getByText(/En revisión/i)).toBeVisible({
    timeout: 20_000,
  });
});
