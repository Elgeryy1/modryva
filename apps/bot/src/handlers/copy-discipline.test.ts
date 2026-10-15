import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guardia contra las frases sueltas.
 *
 * El informe pide catálogo centralizado (§11.2), pero «acordarse de usarlo» no
 * es una garantía: basta una prisa para que vuelva a aparecer un
 * `return { text: "..." }` en el handler, y a partir de ahí ese texto no se
 * puede traducir, ni variar, ni revisar de tono.
 *
 * Este test LEE el fichero del handler y falla si encuentra una cadena que
 * parezca legible por una persona. Es tosco a propósito: un analizador de AST
 * sería más elegante y mucho más fácil de esquivar sin darse cuenta.
 */

const HANDLER = join(dirname(fileURLToPath(import.meta.url)), "social.ts");

/**
 * Cadenas que sí pueden estar en el handler.
 *
 * Ninguna llega a un usuario: son claves del catálogo, nombres de ajustes,
 * identificadores de comando y motivos internos. El motivo de sanción es el
 * único caso discutible — acaba en el registro de moderación, no en el chat, y
 * el registro se lee en el idioma del proyecto.
 */
const ALLOWED = new Set([
  "Ruleta rusa (juego del grupo)",
  "social_media_recent",
]);

/**
 * ¿Parece una frase para una persona?
 *
 * Heurística deliberadamente amplia: acentos o eñe, un emoji, o tres palabras
 * separadas por espacios. Prefiere el falso positivo (que obliga a mirar) al
 * falso negativo (que deja pasar la frase).
 */
const looksHumanFacing = (value: string): boolean => {
  if (value.length < 8) {
    return false;
  }
  if (/[áéíóúñÁÉÍÓÚÑ¡¿]/u.test(value)) {
    return true;
  }
  if (/\p{Extended_Pictographic}/u.test(value)) {
    return true;
  }
  return value.trim().split(/\s+/u).length >= 3;
};

/** Extrae los literales de cadena, saltándose comentarios e imports. */
const stringLiteralsOf = (source: string): string[] => {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");
  const literals: string[] = [];
  const pattern = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/gu;
  let match = pattern.exec(withoutComments);
  while (match !== null) {
    literals.push(match[1] ?? match[2] ?? "");
    match = pattern.exec(withoutComments);
  }
  return literals;
};

describe("disciplina de copy en los handlers sociales", () => {
  const source = readFileSync(HANDLER, "utf8");

  it("no hay ninguna frase suelta fuera del catálogo", () => {
    const offenders = stringLiteralsOf(source)
      .filter(looksHumanFacing)
      .filter((value) => !ALLOWED.has(value));

    expect(
      offenders,
      `Estas cadenas parecen texto para una persona y no vienen del catálogo.\n` +
        `Muévelas a modules/social/src/copy.ts y llámalas con copy("clave").\n` +
        `Si de verdad no las lee nadie, añádelas a ALLOWED con el motivo.\n` +
        offenders.map((value) => `  - ${value}`).join("\n"),
    ).toEqual([]);
  });

  it("la heurística caza de verdad una frase", () => {
    // Sin esto, el test de arriba pasaría aunque `looksHumanFacing` fuese
    // `() => false`.
    expect(looksHumanFacing("🥇 Pole para Ana")).toBe(true);
    expect(looksHumanFacing("Se acabaron los puestos")).toBe(true);
    expect(looksHumanFacing("configuración")).toBe(true);
    // Y no confunde identificadores con frases.
    expect(looksHumanFacing("pole")).toBe(false);
    expect(looksHumanFacing("AUTO_FIRST_MESSAGE")).toBe(false);
    expect(looksHumanFacing("social_pole_claims_total")).toBe(false);
  });

  it("el extractor ignora lo que hay dentro de los comentarios", () => {
    const sample = [
      '// "Esto es una frase en un comentario y no cuenta"',
      '/* "Y esta también" */',
      'const x = "una frase de verdad aquí";',
    ].join("\n");
    expect(stringLiteralsOf(sample)).toEqual(["una frase de verdad aquí"]);
  });

  it("el handler sigue llamando al catálogo, no lo ha esquivado entero", () => {
    // Un handler sin ninguna frase Y sin ninguna llamada a copy() estaría
    // "limpio" y roto a la vez.
    expect(source.match(/\bcopy\(/gu)?.length ?? 0).toBeGreaterThan(20);
  });
});
