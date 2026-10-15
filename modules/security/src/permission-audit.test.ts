import { describe, expect, it } from "vitest";
import {
  type AdminPerms,
  adminActedRecently,
  adminHasDangerousPermission,
  adminModerates,
  buildAdminOversightReport,
  buildPermissionAuditReport,
  findExcessPermissions,
  isModerationAction,
  PERM_AUDIT_REASONS,
} from "./permission-audit.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const admin = (overrides: Partial<AdminPerms> = {}): AdminPerms => {
  const { lastActionMs, ...rest } = overrides;
  return {
    userId: "u1",
    canBan: false,
    canDelete: false,
    canPin: false,
    canPromote: false,
    ...rest,
    ...(lastActionMs !== undefined ? { lastActionMs } : {}),
  };
};

const NOW = 10 * DAY;
const STALE = 7 * DAY;

describe("adminModerates", () => {
  it("is true when the admin can ban", () => {
    expect(adminModerates(admin({ canBan: true }))).toBe(true);
  });

  it("is true when the admin can delete", () => {
    expect(adminModerates(admin({ canDelete: true }))).toBe(true);
  });

  it("is false with only pin or promote", () => {
    expect(adminModerates(admin({ canPin: true, canPromote: true }))).toBe(
      false,
    );
  });
});

describe("adminHasDangerousPermission", () => {
  it("flags ban, delete and promote as dangerous", () => {
    expect(adminHasDangerousPermission(admin({ canBan: true }))).toBe(true);
    expect(adminHasDangerousPermission(admin({ canDelete: true }))).toBe(true);
    expect(adminHasDangerousPermission(admin({ canPromote: true }))).toBe(true);
  });

  it("does not treat pin alone as dangerous", () => {
    expect(adminHasDangerousPermission(admin({ canPin: true }))).toBe(false);
  });

  it("is false for an admin with no powers", () => {
    expect(adminHasDangerousPermission(admin())).toBe(false);
  });
});

describe("adminActedRecently", () => {
  it("is true when the last action is within the window", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW - HOUR }), NOW, STALE),
    ).toBe(true);
  });

  it("is true exactly at the window edge", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW - STALE }), NOW, STALE),
    ).toBe(true);
  });

  it("is false just past the window edge", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW - STALE - 1 }), NOW, STALE),
    ).toBe(false);
  });

  it("is false when the admin never acted", () => {
    expect(adminActedRecently(admin(), NOW, STALE)).toBe(false);
  });

  it("treats a future action timestamp as recent", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW + HOUR }), NOW, STALE),
    ).toBe(true);
  });

  it("treats action-now as recent with a zero window", () => {
    expect(adminActedRecently(admin({ lastActionMs: NOW }), NOW, 0)).toBe(true);
  });
});

describe("findExcessPermissions", () => {
  it("returns empty for no admins", () => {
    expect(findExcessPermissions([], NOW, STALE)).toEqual([]);
  });

  it("flags a promoter that does not moderate", () => {
    const result = findExcessPermissions(
      [admin({ userId: "p", canPromote: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "p", reason: PERM_AUDIT_REASONS.promoteWithoutModeration },
    ]);
  });

  it("does not flag a promoter that also moderates recently", () => {
    const result = findExcessPermissions(
      [
        admin({
          userId: "p",
          canPromote: true,
          canBan: true,
          lastActionMs: NOW - HOUR,
        }),
      ],
      NOW,
      STALE,
    );
    expect(result).toEqual([]);
  });

  it("flags a moderating promoter that has gone stale", () => {
    const result = findExcessPermissions(
      [
        admin({
          userId: "p",
          canPromote: true,
          canBan: true,
          lastActionMs: NOW - STALE - DAY,
        }),
      ],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "p", reason: PERM_AUDIT_REASONS.staleDangerous },
    ]);
  });

  it("flags dangerous powers that were never used", () => {
    const result = findExcessPermissions(
      [admin({ userId: "b", canBan: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "b", reason: PERM_AUDIT_REASONS.staleDangerous },
    ]);
  });

  it("does not flag dangerous powers used recently", () => {
    const result = findExcessPermissions(
      [admin({ userId: "b", canDelete: true, lastActionMs: NOW - MINUTE })],
      NOW,
      STALE,
    );
    expect(result).toEqual([]);
  });

  it("never flags an admin with only harmless pin power", () => {
    const result = findExcessPermissions(
      [admin({ userId: "pin", canPin: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([]);
  });

  it("emits at most one finding per admin, preferring the promote reason", () => {
    const result = findExcessPermissions(
      [admin({ userId: "x", canPromote: true, canPin: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "x", reason: PERM_AUDIT_REASONS.promoteWithoutModeration },
    ]);
  });

  it("preserves input order across mixed findings", () => {
    const result = findExcessPermissions(
      [
        admin({ userId: "clean", canBan: true, lastActionMs: NOW - HOUR }),
        admin({ userId: "promoter", canPromote: true }),
        admin({ userId: "stale", canDelete: true }),
        admin({ userId: "harmless", canPin: true }),
      ],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      {
        userId: "promoter",
        reason: PERM_AUDIT_REASONS.promoteWithoutModeration,
      },
      { userId: "stale", reason: PERM_AUDIT_REASONS.staleDangerous },
    ]);
  });

  it("is deterministic for identical inputs", () => {
    const admins = [
      admin({ userId: "a", canPromote: true }),
      admin({ userId: "b", canBan: true }),
    ];
    expect(findExcessPermissions(admins, NOW, STALE)).toEqual(
      findExcessPermissions(admins, NOW, STALE),
    );
  });

  it("does not mutate the input array", () => {
    const admins: readonly AdminPerms[] = [
      admin({ userId: "a", canPromote: true }),
    ];
    findExcessPermissions(admins, NOW, STALE);
    expect(admins.length).toBe(1);
  });
});

/**
 * Que cuenta como "haber moderado". Es la definicion de la que cuelga todo el
 * informe: si se cuela aqui algo que no es moderacion, el informe absuelve a
 * quien no deberia y deja de servir para nada.
 */
describe("isModerationAction", () => {
  it("cuenta las acciones que de verdad son moderar", () => {
    for (const accion of [
      "moderation.ban.created",
      "moderation.mute.created",
      "moderation.warn.created",
      "moderation.kick.applied",
      "moderation.unban.applied",
      "admin.del",
      "appointed_admin.granted",
      "introduction.staff_kept",
      "introduction.forgiven",
    ]) {
      expect(isModerationAction(accion)).toBe(true);
    }
  });

  it("HABLAR no es moderar", () => {
    // `telegram.update.received` es la accion mas frecuente de la tabla con
    // diferencia. Colarla daria por activo a cualquier admin que escriba, que
    // es justo lo contrario de lo que el informe pregunta.
    for (const accion of [
      "telegram.update.received",
      "file.recorded",
      "ai.mention.completion",
      "guardian.consent.accepted",
      "quote.generated",
      "bot.spoke",
      "inline.answered",
    ]) {
      expect(isModerationAction(accion)).toBe(false);
    }
  });

  it("configurar el bot tampoco es moderar", () => {
    // Tocar ajustes en la Mini App demuestra que la cuenta esta viva, no que
    // use sus poderes peligrosos.
    expect(isModerationAction("miniapp.guardian.configured")).toBe(false);
    expect(isModerationAction("miniapp.games.configured")).toBe(false);
  });

  it("no se deja enganar por un prefijo parecido", () => {
    expect(isModerationAction("moderationXban")).toBe(false);
    expect(isModerationAction("")).toBe(false);
  });
});

describe("buildPermissionAuditReport — el informe que se lee", () => {
  const nombres = new Map([["7", "@ana"]]);

  it("dice cuantos ha revisado, no solo cuantos ha senalado", () => {
    // "0 hallazgos" sin denominador es indistinguible de "no he mirado nada".
    const texto = buildPermissionAuditReport([], 5, nombres, 90);
    expect(texto).toContain("5");
    expect(texto).toContain("90");
  });

  it("distingue 'todo bien' de 'no he podido mirar'", () => {
    const sinDatos = buildPermissionAuditReport([], 0, nombres, 90);
    expect(sinDatos).toContain("No he podido leer");
    expect(sinDatos).not.toContain("✅");
  });

  it("nombra a quien puede y usa el id de quien no", () => {
    const texto = buildPermissionAuditReport(
      [
        { userId: "7", reason: PERM_AUDIT_REASONS.staleDangerous },
        { userId: "99", reason: PERM_AUDIT_REASONS.promoteWithoutModeration },
      ],
      2,
      nombres,
      90,
    );
    expect(texto).toContain("@ana");
    expect(texto).toContain("99");
  });

  it("deja claro que no ha tocado nada", () => {
    // Igual que el aviso de suplantacion: quien lee un informe de un bot de
    // moderacion asume que el bot ya ha actuado.
    const texto = buildPermissionAuditReport(
      [{ userId: "7", reason: PERM_AUDIT_REASONS.staleDangerous }],
      1,
      nombres,
      90,
    );
    expect(texto).toContain("No se ha tocado ningún permiso");
  });

  it("explica que hablar no cuenta como moderar", () => {
    // Sin esto, quien lea "sin actividad reciente" sobre un admin que escribe
    // a diario asumira que el informe esta roto.
    const texto = buildPermissionAuditReport(
      [{ userId: "7", reason: PERM_AUDIT_REASONS.staleDangerous }],
      1,
      nombres,
      90,
    );
    expect(texto).toContain("Hablar no cuenta");
  });
});

describe("buildAdminOversightReport — las tres preguntas juntas", () => {
  const nombres = new Map([
    ["7", "@ana"],
    ["8", "@bea"],
    ["9", "@cris"],
  ]);
  const base = {
    revisados: 3,
    excess: [],
    externos: [],
    antiguos: [],
    nombres,
    diasSinUsar: 90,
  } as const;

  it("distingue 'nada que mirar' de 'no he podido mirar'", () => {
    expect(buildAdminOversightReport({ ...base })).toContain("nada que mirar");
    expect(buildAdminOversightReport({ ...base, revisados: 0 })).toContain(
      "No he podido leer",
    );
  });

  it("omite los bloques vacios pero mantiene el recuento", () => {
    const texto = buildAdminOversightReport({
      ...base,
      externos: ["8"],
    });
    expect(texto).toContain("3 revisados");
    expect(texto).toContain("@bea");
    expect(texto).not.toContain("Poderes peligrosos sin usar");
    expect(texto).not.toContain("Nombramientos muy antiguos");
  });

  it("dice que a los externos NO puede degradarlos", () => {
    // Es la mitad util del hallazgo: saber que hay un admin ajeno sin saber
    // que el bot no puede quitarlo lleva a esperar que lo arregle solo.
    const texto = buildAdminOversightReport({ ...base, externos: ["8"] });
    expect(texto).toContain("NO los puedo degradar");
  });

  it("junta los tres bloques cuando hay de todo", () => {
    const texto = buildAdminOversightReport({
      ...base,
      excess: [{ userId: "7", reason: PERM_AUDIT_REASONS.staleDangerous }],
      externos: ["8"],
      antiguos: [{ userId: "9", dias: 400 }],
    });
    expect(texto).toContain("@ana");
    expect(texto).toContain("@bea");
    expect(texto).toContain("@cris");
    expect(texto).toContain("400");
    expect(texto).toContain("No se ha tocado ningún permiso");
  });
});
