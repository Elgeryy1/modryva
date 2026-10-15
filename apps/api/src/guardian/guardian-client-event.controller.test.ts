import { InMemoryGuardianRepository } from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import { describe, expect, it } from "vitest";
import { GuardianClientEventController } from "./guardian-client-event.controller.js";

interface RecordedAudit {
  readonly action: string;
  readonly resourceId?: string;
  readonly tenantId: string;
  readonly payload?: Record<string, unknown>;
}

const buildController = async () => {
  const repo = new InMemoryGuardianRepository();
  const audits: RecordedAudit[] = [];
  const controller = new GuardianClientEventController();
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

describe("GuardianClientEventController", () => {
  it("registra la miga con su evento y su detalle", async () => {
    const { controller, audits, token, session } = await buildController();

    const result = await controller.record({
      session: token,
      event: "foto1.capturada",
      detail: "nada que decir",
    });

    expect(result).toEqual({ ok: true });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("guardian.client.event");
    expect(audits[0]?.resourceId).toBe(session?.id);
    expect(audits[0]?.payload?.event).toBe("foto1.capturada");
    expect(audits[0]?.payload?.detail).toBe("nada que decir");
  });

  it.each([
    ["sin token", { event: "foto1.capturada" }],
    ["token vacio", { session: "", event: "foto1.capturada" }],
    ["token inventado", { session: "no-existe", event: "foto1.capturada" }],
    ["sin evento", { session: "token-de-prueba" }],
  ])("contesta ok y no registra nada: %s", async (_label, body) => {
    const { controller, audits } = await buildController();

    // Siempre ok y nunca una pista: un endpoint que dijera "esa sesion no
    // existe" dejaria probar que tokens son buenos.
    const result = await controller.record(body);

    expect(result).toEqual({ ok: true });
    expect(audits).toHaveLength(0);
  });

  it("recorta el detalle para que una traza entera no entre como volcado", async () => {
    const { controller, audits, token } = await buildController();

    await controller.record({
      session: token,
      event: "window.error",
      detail: "x".repeat(5000),
    });

    expect((audits[0]?.payload?.detail as string).length).toBe(300);
  });

  it("deja de registrar cuando el mismo token lo inunda", async () => {
    const { controller, audits, token } = await buildController();

    for (let i = 0; i < 60; i += 1) {
      await controller.record({ session: token, event: "spam" });
    }

    // El cubo son 30; el resto se tiran en silencio.
    expect(audits.length).toBeLessThanOrEqual(31);
    expect(audits.length).toBeGreaterThan(0);
  });

  it("nunca revienta a quien llama aunque falle la escritura", async () => {
    const { controller, token } = await buildController();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing
    (controller as any).foundation = {
      recordAudit: async () => {
        throw new Error("la base de datos se cayo");
      },
    };

    // La telemetria no puede ser el motivo de que alguien no pueda verificarse.
    await expect(
      controller.record({ session: token, event: "foto1.capturada" }),
    ).resolves.toEqual({ ok: true });
  });
});
