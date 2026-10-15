import {
  type GuardianSettingsState,
  InMemoryGuardianRepository,
  type VerificationSessionRecord,
} from "@superbot/data";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type GuardianVerifyDeps,
  GuardianVerifyService,
} from "./guardian-verify.service.js";

// beginAttempt only ever touches deps.repo, so the rest of the service's
// collaborators (storage, AI providers, Telegram) are deliberately absent —
// reaching for any of them here would be a bug worth failing on.
const serviceWith = (repo: InMemoryGuardianRepository) =>
  new GuardianVerifyService({ repo } as unknown as GuardianVerifyDeps);

const settingsWith = (maxAttempts: number) =>
  ({ maxAttempts }) as unknown as GuardianSettingsState;

const newSession = async (
  repo: InMemoryGuardianRepository,
): Promise<VerificationSessionRecord> => {
  const session = await repo.createSession({
    tenantId: "t1",
    chatId: "c1",
    telegramChatId: -100n,
    telegramUserId: 42n,
    mode: "manual",
    challengeDefinition: { steps: [] },
    challengeNonce: `nonce-${Math.random()}`,
    sessionTokenHash: `hash-${Math.random()}`,
    expiresAt: new Date(Date.now() + 600_000),
    idempotencyKey: `idem-${Math.random()}`,
  });
  if (!session) {
    throw new Error("fixture: session was not created");
  }
  return session;
};

describe("GuardianVerifyService.beginAttempt — double taps", () => {
  let repo: InMemoryGuardianRepository;

  beforeEach(() => {
    repo = new InMemoryGuardianRepository();
    vi.useRealTimers();
  });

  // The bug this pins: on 26 Jul someone tapped "start" twice three seconds
  // apart, then eight times in seven seconds while the API was slow, and spent
  // their attempts on one capture. Version locking never caught it — the second
  // tap re-read the session it had just updated and incremented legitimately.
  it("hands back the open attempt instead of spending a second one", async () => {
    const service = serviceWith(repo);
    const settings = settingsWith(3);
    const session = await newSession(repo);

    const first = await service.beginAttempt(session, settings);
    expect(first).toEqual({ attemptId: expect.any(String) });

    const reloaded = await repo.findSessionById(session.id);
    expect(reloaded?.attemptCount).toBe(1);

    const second = await service.beginAttempt(
      reloaded as VerificationSessionRecord,
      settings,
    );

    expect(second).toEqual(first);
    const afterSecond = await repo.findSessionById(session.id);
    expect(afterSecond?.attemptCount).toBe(1);
  });

  // The other half: reuse must not become a free retry. Once a capture is
  // submitted the attempt is finished, so the next start has to open a new one
  // and charge for it.
  it("opens and charges a new attempt once the previous one finished", async () => {
    const service = serviceWith(repo);
    const settings = settingsWith(3);
    const session = await newSession(repo);

    const first = await service.beginAttempt(session, settings);
    if (!("attemptId" in first)) {
      throw new Error("fixture: first attempt did not start");
    }
    await repo.finishAttempt(first.attemptId, { analysisStatus: "failed" });

    const reloaded = await repo.findSessionById(session.id);
    const second = await service.beginAttempt(
      reloaded as VerificationSessionRecord,
      settings,
    );

    expect(second).not.toEqual(first);
    const afterSecond = await repo.findSessionById(session.id);
    expect(afterSecond?.attemptCount).toBe(2);
  });

  // An attempt left open by an early rejection (an oversized upload returns
  // before the attempt is finished) must not be reusable forever, or the cap
  // on attempts quietly stops holding.
  it("stops reusing an attempt that has been open too long", async () => {
    const service = serviceWith(repo);
    const settings = settingsWith(3);
    const session = await newSession(repo);

    const first = await service.beginAttempt(session, settings);
    if (!("attemptId" in first)) {
      throw new Error("fixture: first attempt did not start");
    }

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 60_000));

    const reloaded = await repo.findSessionById(session.id);
    const second = await service.beginAttempt(
      reloaded as VerificationSessionRecord,
      settings,
    );

    expect(second).not.toEqual(first);
    const afterSecond = await repo.findSessionById(session.id);
    expect(afterSecond?.attemptCount).toBe(2);
  });

  it("still refuses to start once every attempt is spent", async () => {
    const service = serviceWith(repo);
    const settings = settingsWith(1);
    const session = await newSession(repo);

    const first = await service.beginAttempt(session, settings);
    if (!("attemptId" in first)) {
      throw new Error("fixture: first attempt did not start");
    }
    await repo.finishAttempt(first.attemptId, { analysisStatus: "failed" });

    const reloaded = await repo.findSessionById(session.id);
    await expect(
      service.beginAttempt(reloaded as VerificationSessionRecord, settings),
    ).resolves.toEqual({ error: "no-attempts-left" });
  });
});
