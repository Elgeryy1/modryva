import { normalizeLang, SUPPORTED_LANGS } from "@superbot/module-community";
import { describe, expect, it } from "vitest";
import {
  COPY_KEYS,
  copy,
  FALLBACK_LOCALE,
  normalizeLocale,
  SOCIAL_LOCALES,
  variantCount,
} from "./copy.js";

/**
 * El catálogo social acepta idioma aunque hoy solo sirva español.
 *
 * Lo que se protege: que añadir `en` sea rellenar entradas y no reescribir
 * llamadas, y que una clave sin traducir NUNCA devuelva la clave cruda ni una
 * cadena vacía en un grupo real.
 *
 * Y una comprobación de paridad con el i18n que ya existe: si
 * `modules/community` cambiara su regla de normalización, este test se entera
 * en vez de que las dos se separen en silencio.
 */

describe("normalizeLocale", () => {
  it("sigue la misma regla que el i18n existente para lo desconocido", () => {
    for (const value of ["klingon", "", "xx-YY", "  "]) {
      expect(normalizeLocale(value)).toBe(normalizeLang(value));
    }
    expect(normalizeLocale(undefined)).toBe(normalizeLang(undefined));
  });

  it("acepta las variantes regionales que manda Telegram", () => {
    // `language_code` llega como "es", "es-ES", "es-419"…
    expect(normalizeLocale("es-ES")).toBe("es");
    expect(normalizeLocale("ES")).toBe("es");
    expect(normalizeLocale("es-419")).toBe("es");
  });

  it("cae al español ante cualquier cosa", () => {
    expect(normalizeLocale("de")).toBe(FALLBACK_LOCALE);
    expect(FALLBACK_LOCALE).toBe("es");
  });

  it("el catálogo social es un subconjunto de los idiomas del proyecto", () => {
    // Servir un idioma que el resto del bot no conoce daría respuestas mixtas.
    for (const locale of SOCIAL_LOCALES) {
      expect(SUPPORTED_LANGS as readonly string[]).toContain(locale);
    }
  });
});

describe("copy con idioma", () => {
  it("devuelve español pidiendo cualquier idioma", () => {
    const es = copy("pole.first", { user: "Ana", latency: "1 s" }, 0, "es");
    expect(copy("pole.first", { user: "Ana", latency: "1 s" }, 0, "en")).toBe(
      es,
    );
    expect(
      copy("pole.first", { user: "Ana", latency: "1 s" }, 0, "klingon"),
    ).toBe(es);
  });

  it("nunca devuelve la clave cruda ni vacío, en ningún idioma", () => {
    for (const locale of ["es", "en", "zz", undefined]) {
      for (const key of COPY_KEYS) {
        for (let pick = 0; pick < variantCount(key); pick += 1) {
          const rendered = copy(
            key,
            { user: "x", latency: "1 s" },
            pick,
            locale,
          );
          expect(rendered.length).toBeGreaterThan(0);
          expect(rendered).not.toBe(key);
        }
      }
    }
  });

  it("no cambia el comportamiento de quien no pasa idioma", () => {
    // Toda llamada existente omite el parámetro; debe seguir dando lo mismo.
    expect(copy("pole.window-gone")).toBe(
      copy("pole.window-gone", {}, 0, "es"),
    );
  });
});
