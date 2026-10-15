# Guardian Verification — Playwright E2E

## Running these tests

Requires the real stack (at least `postgres`, `redis`, `api`, `web`) running
locally, with the API started with:

```
GUARDIAN_TEST_MODE=1
NODE_ENV!=production   (e.g. "development" or "test")
GUARDIAN_SESSION_SECRET=<any generated value — see scripts/generate-guardian-secrets.mjs>
```

`GUARDIAN_TEST_MODE` gates a dev-only session bootstrap endpoint
(`apps/api/src/guardian/guardian-dev.controller.ts`) and an initData bypass
in `GuardianSessionGuard` — both independently re-check `NODE_ENV` and 404/401
the instant either condition doesn't hold. **Never set `GUARDIAN_TEST_MODE=1`
in a production deployment** — `scripts/guardian-doctor.mjs` fails hard if it
detects that combination.

```bash
cd apps/web
GUARDIAN_E2E_API_BASE_URL=http://localhost:3001 \
GUARDIAN_E2E_WEB_BASE_URL=http://localhost:3003 \
npx playwright test
```

**Not yet executed in this repo's dev sandbox**: these specs were written and
type-checked, but this sandbox has no Postgres/Redis/running API — they have
NOT been run against a live stack. Run them for real before relying on them;
see the final Guardian Verification report for exactly what's verified vs.
what still needs that first live run.

## What's real here vs. what needs a fixture

Chromium's fake camera device (`--use-fake-device-for-media-stream`) feeds a
synthetic scrolling test pattern by default — MediaPipe's real
FaceLandmarker/GestureRecognizer will not recognize it as a human face. Every
spec in this directory that's ACTIVE exercises the real detection pipeline,
real challenge gate, real API, and real decision engine end-to-end, but only
through paths that don't require a *successful* face/gesture match:
session validity, camera permission, and the honest failure/retry/manual-
review paths a fake feed naturally produces.

The scenarios below need a real recorded face video fed via
`--use-file-for-fake-video-capture=<path.y4m>` (set
`GUARDIAN_E2E_FAKE_VIDEO_PATH` in playwright.config.ts) — this repo does not
include one (no way to source/record a real face clip from this sandbox), so
they're written as `test.skip` with the exact fixture requirement noted:

- **Correct video / gesture performed as asked** → completes the full
  challenge for real and reaches either `manual_review` (MANUAL/ASSISTED
  mode) or, with the visual analyzer configured and reachable, potentially
  `auto_approve` in AUTO/STRICT mode.
- **Wrong gesture** → the fixture performs a DIFFERENT recognized gesture
  than requested; the step should never advance, eventually timing out.
- **Wrong order** → a fixture that performs the challenge's steps out of
  sequence; the server's `verifyChallengeSubmission` should reject via
  `wrong-order`.
- **Static/frozen video** → a real fixture that holds still (as opposed to
  today's synthetic pattern, which the analyzer never even recognizes as a
  face at all) should be flagged by the server analyzer's
  `staticVideoSuspected`.
- **Reused media across two different sessions** → submit the exact same
  fixture bytes for two different test sessions; the second should be
  flagged via `integrityViolation: "media-hash-reused-by-other-user"`.
- **Auto-approve with the real analyzer configured and reachable** →
  requires both a passing fixture AND `AI_SERVICE_URL` pointed at a running
  `services/guardian-vision-analyzer` instance.

Add these as real (non-skipped) tests once a fixture video is available —
the `fixtures.ts` helpers and dev-session bootstrap already support every
parameter (`mode`, `challengeDifficulty`, `maxAttempts`) these scenarios need.
