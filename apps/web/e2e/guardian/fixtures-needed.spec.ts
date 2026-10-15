import { test } from "@playwright/test";

/**
 * Scenarios that need a REAL recorded face/gesture video fed via Chromium's
 * --use-file-for-fake-video-capture flag (GUARDIAN_E2E_FAKE_VIDEO_PATH — see
 * playwright.config.ts and README.md). None exist in this repo — recording
 * one wasn't possible from this sandbox (no camera, and guessing/fetching a
 * random face video from the internet wasn't appropriate). Kept as
 * `test.skip` (not deleted, not faked passing) so they show up in Playwright's
 * test list as explicitly pending work, per the project's rule that a
 * skipped/unverified test must never be reported as passing.
 */

test.skip("performing the exact requested gesture completes the challenge for real", () => {
  // Needs: a fixture where a real person performs the session's actual
  // generated challenge steps, correctly, within their time limits.
});

test.skip("performing a different (but still recognized) gesture never advances the step", () => {
  // Needs: a fixture performing e.g. "victory" when "thumbs_up" was asked.
});

test.skip("performing the correct gestures out of order is rejected server-side", () => {
  // Needs: a fixture where the steps are done in the wrong sequence —
  // exercises verifyChallengeSubmission's "wrong-order" path for real.
});

test.skip("a genuinely static (held-still) real face video is flagged by the server analyzer", () => {
  // Needs: a fixture with a real, recognized face that holds still —
  // today's synthetic Chromium test pattern isn't recognized as a face at
  // all, so it can't exercise `staticVideoSuspected` specifically.
});

test.skip("submitting the identical media for a second session is flagged as reused", () => {
  // Needs: the same fixture bytes posted for two different test sessions
  // — exercises the media-hash-reused-by-other-user integrity violation.
});

test.skip("AUTO mode with a real, reachable visual analyzer can genuinely auto-approve", () => {
  // Needs: a passing fixture AND AI_SERVICE_URL pointed at a running
  // services/guardian-vision-analyzer instance.
});
