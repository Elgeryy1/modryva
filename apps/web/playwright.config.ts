import { defineConfig, devices } from "@playwright/test";

/**
 * Guardian Verification E2E config. Requires the real stack running
 * (postgres+redis+api+web at minimum — see docker-compose.yml) with
 * GUARDIAN_TEST_MODE=1 and NODE_ENV!=="production" on the API, since every
 * spec here authenticates through the dev-only session bootstrap
 * (guardian-dev.controller.ts) instead of a real Telegram bot/token.
 *
 * Chromium launches with fake camera flags so getUserMedia() succeeds
 * without an OS permission prompt or a real webcam — by default it feeds a
 * synthetic scrolling test pattern, not a real face, so scenarios that need
 * genuine face/gesture recognition to succeed are marked test.skip with a
 * fixture requirement noted inline (see e2e/guardian/README.md).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.GUARDIAN_E2E_WEB_BASE_URL ?? "http://localhost:3003",
    trace: "retain-on-failure",
    permissions: ["camera"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            // Set GUARDIAN_E2E_FAKE_VIDEO_PATH (a .y4m/.mjpeg file) to feed a
            // real recorded clip instead of the synthetic default pattern —
            // required for any scenario that needs real face/gesture
            // detection to succeed. See e2e/guardian/README.md.
            ...(process.env.GUARDIAN_E2E_FAKE_VIDEO_PATH
              ? [
                  `--use-file-for-fake-video-capture=${process.env.GUARDIAN_E2E_FAKE_VIDEO_PATH}`,
                ]
              : []),
          ],
        },
      },
    },
  ],
});
