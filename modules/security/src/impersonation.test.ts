import { describe, expect, it } from "vitest";
import {
  adminIdentitiesFrom,
  buildImpersonationAlert,
  buildImpersonationSignals,
  detectImpersonation,
  IMPERSONATION_THRESHOLD,
  type ImpersonationIdentity,
  nameSimilarity,
  normalizeDisplayName,
} from "./impersonation.js";

const admins: readonly ImpersonationIdentity[] = [
  { name: "Ana Soporte", username: "ana_admin" },
  { name: "Carlos Modryva", username: "carlosm" },
];

describe("normalizeDisplayName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeDisplayName("MODRÝVA Ádmin")).toBe("modryva admin");
  });

  it("collapses common confusables", () => {
    expect(normalizeDisplayName("M0dryva")).toBe("modryva");
    expect(normalizeDisplayName("adm1n")).toBe("admln");
    expect(normalizeDisplayName("$oporte")).toBe("soporte");
    expect(normalizeDisplayName("modryva")).toBe("modryva");
  });

  it("collapses the rn -> m confusable", () => {
    expect(normalizeDisplayName("adrnin")).toBe("admin");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(normalizeDisplayName("  Ana   Soporte  ")).toBe("ana soporte");
  });

  it("is deterministic for the same input", () => {
    expect(normalizeDisplayName("Ténésé")).toBe(normalizeDisplayName("Ténésé"));
  });
});

describe("nameSimilarity", () => {
  it("returns 1 for identical normalized names", () => {
    expect(nameSimilarity("M0dryva", "MODRYVA")).toBe(1);
  });

  it("returns 1 for two empty strings", () => {
    expect(nameSimilarity("", "")).toBe(1);
  });

  it("returns 0 for a totally different pair of same length", () => {
    expect(nameSimilarity("abc", "xyz")).toBe(0);
  });

  it("gives a high score for near matches", () => {
    expect(nameSimilarity("Carlos Modryva", "Carlos M0dryva")).toBeGreaterThan(
      0.9,
    );
  });

  it("is symmetric", () => {
    expect(nameSimilarity("ana soporte", "ana suporte")).toBeCloseTo(
      nameSimilarity("ana suporte", "ana soporte"),
    );
  });

  it("stays within the 0..1 range", () => {
    const score = nameSimilarity("hola mundo", "x");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("detectImpersonation", () => {
  it("flags a near-identical display name as impersonation", () => {
    const verdict = detectImpersonation(
      { name: "Carlos M0dryva", username: "fake123" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.matchedAdminName).toBe("Carlos Modryva");
    expect(verdict.score).toBeGreaterThanOrEqual(IMPERSONATION_THRESHOLD);
  });

  it("does not flag a clearly different name without role words", () => {
    const verdict = detectImpersonation(
      { name: "Pedro Gamer", username: "pedrog" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(false);
    expect(verdict.matchedAdminName).toBe("Carlos Modryva");
  });

  it("never flags a real admin (matched by username, case-insensitive)", () => {
    const verdict = detectImpersonation(
      { name: "Carlos Modryva", username: "CARLOSM" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(false);
    expect(verdict.score).toBe(0);
  });

  it("handles the @ prefix on usernames when matching real admins", () => {
    const verdict = detectImpersonation(
      { name: "Carlos Modryva", username: "@carlosm" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(false);
  });

  it("flags a role keyword in the name even without name similarity", () => {
    const verdict = detectImpersonation(
      { name: "Official Support", username: "helper" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.reason).toContain("support");
  });

  it("flags a role keyword hidden in the username", () => {
    const verdict = detectImpersonation(
      { name: "Random Dude", username: "group_admin" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.reason).toContain("admin");
  });

  it("detects confusable role keywords like 'adrnin' (rn -> m)", () => {
    const verdict = detectImpersonation(
      { name: "adrnin", username: "sneaky" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.reason).toContain("admin");
  });

  it("respects a custom threshold via opts", () => {
    const candidate = { name: "Carlos Modryca", username: "x" };
    const strict = detectImpersonation(candidate, admins, { threshold: 0.99 });
    const loose = detectImpersonation(candidate, admins, { threshold: 0.6 });
    expect(strict.isImpersonation).toBe(false);
    expect(loose.isImpersonation).toBe(true);
  });

  it("works with an empty admin list and no role words", () => {
    const verdict = detectImpersonation({ name: "Nadie" }, []);
    expect(verdict.isImpersonation).toBe(false);
    expect(verdict.score).toBe(0);
    expect(verdict.matchedAdminName).toBeUndefined();
  });

  it("matches against an admin username too, not just the name", () => {
    const verdict = detectImpersonation(
      { name: "carlosm", username: "impostor" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.matchedAdminName).toBe("Carlos Modryva");
  });

  it("is deterministic for identical inputs", () => {
    const candidate = { name: "Ana Soparte", username: "z" };
    expect(detectImpersonation(candidate, admins)).toEqual(
      detectImpersonation(candidate, admins),
    );
  });
});

describe("buildImpersonationSignals", () => {
  it("reflects a positive verdict in its signals", () => {
    const verdict = detectImpersonation(
      { name: "Carlos M0dryva", username: "fake" },
      admins,
    );
    const signals = buildImpersonationSignals(verdict);
    const verdictSignal = signals.find((s) => s.key === "verdict");
    expect(verdictSignal?.present).toBe(true);
    expect(verdictSignal?.weight).toBe(1);
  });

  it("reflects a negative verdict in its signals", () => {
    const verdict = detectImpersonation(
      { name: "Pedro", username: "p" },
      admins,
    );
    const signals = buildImpersonationSignals(verdict);
    const verdictSignal = signals.find((s) => s.key === "verdict");
    expect(verdictSignal?.present).toBe(false);
    expect(verdictSignal?.weight).toBe(0);
  });
});

/**
 * Lo que se cablea al bot: contra QUIEN se compara, y que se le dice al STAFF.
 *
 * El detector ya estaba probado; esto es lo que se decidio al conectarlo, que
 * es donde un modulo puro se estropea al tocar el mundo real.
 */
describe("adminIdentitiesFrom — contra quien se compara", () => {
  it("descarta los bots administradores", () => {
    // Un bot admin suele llamarse "...Bot" y llevar palabras de rol encima.
    // Dejarlo en la lista convierte cada entrada normal en un falso positivo.
    const identidades = adminIdentitiesFrom([
      { firstName: "Gerard", username: "elgery", isBot: false },
      { firstName: "GroupHelp", username: "GroupHelpBot", isBot: true },
    ]);

    expect(identidades).toEqual([{ name: "Gerard", username: "elgery" }]);
  });

  it("descarta a quien no tiene ningun nombre legible", () => {
    // Comparar contra la cadena vacia da similitud 1 con cualquier cosa: un
    // solo admin sin nombre marcaria a TODO el que entre.
    expect(adminIdentitiesFrom([{ isBot: false }])).toEqual([]);
  });

  it("usa el alias cuando no hay nombre", () => {
    expect(adminIdentitiesFrom([{ username: "dylansito2" }])).toEqual([
      { name: "dylansito2", username: "dylansito2" },
    ]);
  });

  it("un admin sin la marca isBot cuenta como persona", () => {
    // Ausente no es lo mismo que true: descartar por defecto dejaria la lista
    // vacia y apagaria la deteccion entera en silencio.
    expect(adminIdentitiesFrom([{ firstName: "Ana" }])).toHaveLength(1);
  });
});

describe("buildImpersonationAlert — lo que lee el STAFF", () => {
  it("dice que NO se ha hecho nada", () => {
    // Quien lee "posible suplantacion" en un bot de moderacion asume que el bot
    // ya ha actuado, deja de mirar, y el suplantador sigue dentro.
    const verdict = detectImpersonation({ name: "Gerard" }, [
      { name: "Gerard", username: "elgery" },
    ]);
    const texto = buildImpersonationAlert("@falso", verdict);

    expect(texto).toContain("No se ha hecho nada");
    expect(texto).toContain("@falso");
    expect(texto).toContain("Gerard");
  });
});

/**
 * Palabras de rol: PALABRA, no trozo de palabra.
 *
 * El fallo que esto cierra: `includes("admin")` marcaba a cualquiera llamado
 * "Adminah". Un detector que señala a personas reales por su nombre deja de
 * mirarse a la tercera vez, y entonces no sirve el dia que acierta.
 */
describe("palabras de rol", () => {
  const sinAdmins = detectImpersonation({ name: "x" }, []);
  const marca = (name: string, username?: string) =>
    detectImpersonation(
      username === undefined ? { name } : { name, username },
      [{ name: "Zzzzzzzz", username: "zzzzzzzz" }],
    ).isImpersonation;

  it("no marca nombres reales que solo CONTIENEN la palabra", () => {
    for (const nombre of [
      "Adminah",
      "Adminson",
      "Modesta",
      "Modest",
      "Staffordshire",
      "Ownersen",
    ]) {
      expect(marca(nombre)).toBe(false);
    }
  });

  it("sigue marcando a quien se pone el cargo", () => {
    for (const nombre of [
      "Admin",
      "ADMIN",
      "Administrador",
      "Administradora",
      "Soporte",
      "Soporte Oficial",
      "staff",
      "Moderador",
      "- ADMIN -",
      "admin01",
      "soporte_oficial",
    ]) {
      expect(marca(nombre)).toBe(true);
    }
  });

  it("tambien mira el alias, no solo el nombre visible", () => {
    expect(marca("Juan", "soporte_modryva")).toBe(true);
    expect(marca("Juan", "juanito")).toBe(false);
  });

  it("el veredicto sigue nombrando la palabra que lo disparo", () => {
    const verdict = detectImpersonation({ name: "Soporte Oficial" }, [
      { name: "Zzzzzzzz" },
    ]);
    expect(verdict.reason).toContain("soporte");
  });

  it("sin admins que comparar, la palabra de rol basta", () => {
    expect(sinAdmins.isImpersonation).toBe(false);
    expect(detectImpersonation({ name: "Admin" }, []).isImpersonation).toBe(
      true,
    );
  });
});
