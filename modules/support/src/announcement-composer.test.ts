import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_MAX_LENGTH,
  ANNOUNCEMENT_MIN_LENGTH,
  analyzeAnnouncement,
  buildAnnouncementPreview,
  collectAnnouncementSignals,
  detectAnnouncementTone,
  detectSensitiveTopics,
} from "./announcement-composer.js";

describe("analyzeAnnouncement", () => {
  it("marks a normal announcement as lengthOk without issues", () => {
    const result = analyzeAnnouncement(
      "Hola equipo, gracias por vuestro trabajo esta semana.",
    );
    expect(result.lengthOk).toBe(true);
    expect(result.clarityIssues).toEqual([]);
  });

  it("flags text shorter than the minimum", () => {
    const result = analyzeAnnouncement("hey");
    expect(result.lengthOk).toBe(false);
    expect(result.clarityIssues).toContain("demasiado corto");
  });

  it("flags text longer than the maximum", () => {
    const long = "a".repeat(ANNOUNCEMENT_MAX_LENGTH + 1);
    const result = analyzeAnnouncement(long);
    expect(result.lengthOk).toBe(false);
    expect(result.clarityIssues).toContain("demasiado largo");
  });

  it("accepts text exactly at the boundaries", () => {
    const min = "x".repeat(ANNOUNCEMENT_MIN_LENGTH);
    const max = "x".repeat(ANNOUNCEMENT_MAX_LENGTH);
    expect(analyzeAnnouncement(min).lengthOk).toBe(true);
    expect(analyzeAnnouncement(max).lengthOk).toBe(true);
  });

  it("flags a long block without punctuation as confuso", () => {
    const wall = "palabra ".repeat(30).trim();
    const result = analyzeAnnouncement(wall);
    expect(result.clarityIssues.some((i) => i.startsWith("confuso"))).toBe(
      true,
    );
  });

  it("does not flag confuso when punctuation is present", () => {
    const text = `${"palabra ".repeat(30).trim()}.`;
    const result = analyzeAnnouncement(text);
    expect(result.clarityIssues.some((i) => i.startsWith("confuso"))).toBe(
      false,
    );
  });

  it("flags too many exclamation marks as aggressive", () => {
    const result = analyzeAnnouncement(
      "Compren ahora!!! oferta del dia amigos",
    );
    expect(
      result.clarityIssues.some((i) =>
        i.includes("demasiados signos de exclamacion"),
      ),
    ).toBe(true);
  });

  it("flags mostly-uppercase text as aggressive", () => {
    const result = analyzeAnnouncement("ATENCION TODOS DEBEN LEER ESTO YA");
    expect(
      result.clarityIssues.some((i) => i.includes("demasiadas mayusculas")),
    ).toBe(true);
  });

  it("flags hostile language and quotes the matched word", () => {
    const result = analyzeAnnouncement(
      "Dejen de comportarse como idiotas por favor senores",
    );
    expect(result.clarityIssues.some((i) => i.includes("idiota"))).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const text = "URGENTE!!! pago pendiente del gobierno para todos ustedes";
    expect(analyzeAnnouncement(text)).toEqual(analyzeAnnouncement(text));
  });
});

describe("detectAnnouncementTone", () => {
  it("defaults to serio without signals", () => {
    expect(detectAnnouncementTone("Reunion el lunes en la sala grande")).toBe(
      "serio",
    );
  });

  it("detects urgente", () => {
    expect(
      detectAnnouncementTone("Atencion urgente, respondan de inmediato"),
    ).toBe("urgente");
  });

  it("detects hype", () => {
    expect(
      detectAnnouncementTone("Sorteo gratis con premio increible, gana ya"),
    ).toBe("hype");
  });

  it("detects tecnico", () => {
    expect(
      detectAnnouncementTone("Nueva version del backend con deploy y parche"),
    ).toBe("tecnico");
  });

  it("detects cercano", () => {
    expect(
      detectAnnouncementTone("Hola chicos, gracias equipo, un abrazo enorme"),
    ).toBe("cercano");
  });

  it("prioritizes urgente over cercano on a tie of one each", () => {
    expect(detectAnnouncementTone("Hola urgente")).toBe("urgente");
  });

  it("ignores accents when matching keywords", () => {
    expect(detectAnnouncementTone("Atención inmediata")).toBe("urgente");
  });
});

describe("detectSensitiveTopics", () => {
  it("returns empty for neutral text", () => {
    expect(detectSensitiveTopics("Feliz cumpleanos a todos")).toEqual([]);
  });

  it("detects politica", () => {
    expect(
      detectSensitiveTopics("Hablemos del gobierno y las elecciones"),
    ).toEqual(["politica"]);
  });

  it("detects dinero", () => {
    expect(detectSensitiveTopics("El precio del bitcoin subio hoy")).toEqual([
      "dinero",
    ]);
  });

  it("detects salud", () => {
    expect(
      detectSensitiveTopics("La nueva vacuna y el tratamiento medico"),
    ).toEqual(["salud"]);
  });

  it("detects multiple topics in stable order", () => {
    expect(
      detectSensitiveTopics("El gobierno aprobo un pago para la salud publica"),
    ).toEqual(["politica", "dinero", "salud"]);
  });

  it("matches whole words only, not substrings", () => {
    // "voto" como palabra completa dispara; "Devoto" no (letra previa).
    expect(detectSensitiveTopics("El voto fue contado")).toEqual(["politica"]);
    expect(detectSensitiveTopics("Devoto de la musica")).toEqual([]);
  });
});

describe("collectAnnouncementSignals", () => {
  it("returns signals in a stable order with the three keys", () => {
    const signals = collectAnnouncementSignals("texto normal");
    expect(signals.map((s) => s.key)).toEqual([
      "shouting",
      "caps",
      "aggressive-words",
    ]);
  });

  it("marks shouting present when exclamations reach the threshold", () => {
    const signals = collectAnnouncementSignals("hola!!!");
    const shout = signals.find((s) => s.key === "shouting");
    expect(shout?.present).toBe(true);
  });

  it("keeps signals absent for calm text", () => {
    const signals = collectAnnouncementSignals("hola a todos, saludos");
    expect(signals.every((s) => !s.present)).toBe(true);
  });
});

describe("buildAnnouncementPreview", () => {
  it("summarizes target and pinned group counts", () => {
    const preview = buildAnnouncementPreview(
      "Hola equipo, gracias a todos por el esfuerzo",
      ["a", "b", "c"],
      ["a"],
    );
    expect(preview).toContain("enviar esto a 3 grupos y fijar en 1 grupo.");
  });

  it("defaults pinnedGroups to zero when omitted", () => {
    const preview = buildAnnouncementPreview("Reunion el lunes sin falta", [
      "solo",
    ]);
    expect(preview).toContain("enviar esto a 1 grupo y fijar en 0 grupos.");
  });

  it("includes the detected tone line", () => {
    const preview = buildAnnouncementPreview(
      "Sorteo gratis con premio increible amigos",
      ["g"],
    );
    expect(preview).toContain("Tono detectado: hype.");
  });

  it("lists clarity issues when present", () => {
    const preview = buildAnnouncementPreview("hey!!!", ["g"]);
    expect(preview).toContain("Avisos:");
  });

  it("lists sensitive topics when present", () => {
    const preview = buildAnnouncementPreview(
      "Nuevo pago disponible para todo el equipo de la comunidad",
      ["g"],
    );
    expect(preview).toContain("Temas sensibles: dinero.");
  });

  it("omits avisos and temas lines when clean", () => {
    const preview = buildAnnouncementPreview(
      "Hola equipo, nos vemos el lunes en la oficina",
      ["g", "h"],
    );
    expect(preview).not.toContain("Avisos:");
    expect(preview).not.toContain("Temas sensibles:");
  });

  it("is deterministic for identical inputs", () => {
    const a = buildAnnouncementPreview("Hola equipo, gracias", ["x"], ["x"]);
    const b = buildAnnouncementPreview("Hola equipo, gracias", ["x"], ["x"]);
    expect(a).toBe(b);
  });
});
