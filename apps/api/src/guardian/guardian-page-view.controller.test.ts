import { InMemoryGuardianRepository } from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import { describe, expect, it } from "vitest";
import { GuardianPageViewController } from "./guardian-page-view.controller.js";

interface RecordedAudit {
  readonly action: string;
  readonly resourceId?: string;
  readonly tenantId: string;
}

const buildController = async () => {
  const repo = new InMemoryGuardianRepository();
  const audits: RecordedAudit[] = [];
  const controller = new GuardianPageViewController();
  // biome-ignore lint/suspicious/noExplicitAny: overriding private fields for testing has no public API
  (controller as any).guardian = repo;
  // biome-ignore lint/suspicious/noExplicitAny: same
  (controller as any).foundation = {
    recordAudit: async (input: RecordedAudit) => {
      audits.push(input);
    },
  };

  const token = "token-de-prueba";
  const session = await repo.createSession({
    tenantId: "tenant-1",
    chatId: "chat-1",
    telegramChatId: -100999n,
    telegramUserId: 42n,
    mode: "manual",
    challengeDefinition: { steps: [] },
    challengeNonce: "nonce",
    sessionTokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 600_000),
    idempotencyKey: "clave-1",
  });

  return { controller, audits, token, session };
};

describe("GuardianPageViewController", () => {
  it("records that the page was served for a real session", async () => {
    const { controller, audits, token, session } = await buildController();

    const result = await controller.record({ session: token });

    expect(result).toEqual({ ok: true });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("guardian.page.served");
    expect(audits[0]?.resourceId).toBe(session?.id);
    expect(audits[0]?.tenantId).toBe("tenant-1");
  });

  it.each([
    ["sin token", undefined],
    ["token vacio", ""],
    ["token inventado", "no-existe-esta-sesion"],
  ])("answers ok and records nothing: %s", async (_label, token) => {
    const { controller, audits } = await buildController();

    // Always ok, never a hint: an endpoint that said "no such session" would
    // let anyone probe which tokens are real.
    const result = await controller.record(
      token === undefined ? {} : { session: token },
    );

    expect(result).toEqual({ ok: true });
    expect(audits).toHaveLength(0);
  });

  it("stops recording once the same token floods it", async () => {
    const { controller, audits, token } = await buildController();

    for (let i = 0; i < 30; i += 1) {
      await controller.record({ session: token });
    }

    // The bucket holds 10; the rest are dropped silently.
    expect(audits.length).toBeLessThanOrEqual(11);
    expect(audits.length).toBeGreaterThan(0);
  });

  it("never fails the caller when the audit write blows up", async () => {
    const { controller, token } = await buildController();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing
    (controller as any).foundation = {
      recordAudit: async () => {
        throw new Error("la base de datos se cayo");
      },
    };

    // Telemetry must never be the reason somebody cannot verify.
    await expect(controller.record({ session: token })).resolves.toEqual({
      ok: true,
    });
  });
});
