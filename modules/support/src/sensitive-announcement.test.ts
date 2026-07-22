import { describe, expect, it } from "vitest";
import {
  describeSensitiveWarning,
  detectSensitiveAnnouncement,
} from "./sensitive-announcement.js";

describe("detectSensitiveAnnouncement", () => {
  it("detects multiple topics in SensitiveTopic declaration order", () => {
    expect(
      detectSensitiveAnnouncement(
        "Anuncio importante: por la subida de precios y despidos, cerramos el local.",
      ),
    ).toEqual({ sensitive: true, topics: ["precios", "cierre", "despido"] });
  });

  it("flags politics and religion together", () => {
    expect(
      detectSensitiveAnnouncement("El gobierno y la iglesia opinan distinto"),
    ).toEqual({ sensitive: true, topics: ["politica", "religion"] });
  });

  it("deduplicates several hits within the same category", () => {
    expect(
      detectSensitiveAnnouncement("El gobierno anuncia elecciones anticipadas"),
    ).toEqual({ sensitive: true, topics: ["politica"] });
  });

  it("is accent- and case-insensitive and orders topics by category, not by text", () => {
    expect(
      detectSensitiveAnnouncement(
        "La RELIGIÓN y la políTICA son temas delicados",
      ),
    ).toEqual({ sensitive: true, topics: ["politica", "religion"] });
  });

  it("avoids false positives using word boundaries", () => {
    expect(
      detectSensitiveAnnouncement(
        "Compartimos los resultados de los estudios recientes de la comunidad",
      ),
    ).toEqual({ sensitive: false, topics: [] });
  });

  it("detects price-increase phrasing variants", () => {
    expect(
      detectSensitiveAnnouncement(
        "El servicio sera mas caro a partir de junio",
      ),
    ).toEqual({ sensitive: true, topics: ["precios"] });
  });

  it("detects drastic-change phrasing with accents", () => {
    expect(
      detectSensitiveAnnouncement("Vienen cambios drásticos en las reglas"),
    ).toEqual({ sensitive: true, topics: ["cambios"] });
  });

  it("returns not sensitive for clean text", () => {
    expect(
      detectSensitiveAnnouncement(
        "Hola equipo, nos vemos el viernes para tomar un cafe",
      ),
    ).toEqual({ sensitive: false, topics: [] });
  });

  it("handles undefined", () => {
    expect(detectSensitiveAnnouncement(undefined)).toEqual({
      sensitive: false,
      topics: [],
    });
  });

  it("handles empty string", () => {
    expect(detectSensitiveAnnouncement("")).toEqual({
      sensitive: false,
      topics: [],
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = "gobierno, subida de precios y despidos";
    const first = detectSensitiveAnnouncement(input);
    const second = detectSensitiveAnnouncement(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      sensitive: true,
      topics: ["politica", "precios", "despido"],
    });
  });
});

describe("describeSensitiveWarning", () => {
  it("builds a Spanish warning with accents and punctuation", () => {
    const result = detectSensitiveAnnouncement("El gobierno confirma despidos");
    expect(describeSensitiveWarning(result)).toBe(
      "⚠️ Este anuncio puede generar polémica: política, despidos. ¿Seguro que quieres publicarlo?",
    );
  });

  it("returns undefined when the announcement is not sensitive", () => {
    const result = detectSensitiveAnnouncement("Hola equipo, feliz jueves");
    expect(describeSensitiveWarning(result)).toBeUndefined();
  });
});
