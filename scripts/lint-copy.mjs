// Copy lint: fails if known-bad unaccented es-ES forms (or leaked internal
// codes) reappear in the bot's user-facing source. Run in CI to stop
// regressions — the codebase has historically shipped both spellings.
//
//   node scripts/lint-copy.mjs
//
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const files = [
  "apps/bot/src/core-handlers.ts",
  "apps/bot/src/bot-update.service.ts",
];

// Word-boundary forms that are always wrong in es-ES prose here.
const badWords = [
  "Moderacion",
  "Diversion",
  "diversion",
  "automatizacion",
  "reputacion",
  "Reputacion",
  "seccion",
  "Seccion",
  "federacion",
  "Federacion",
  "Publicacion",
  "publicacion",
  "verificacion",
  "Verificacion",
  "invitacion",
  "proteccion",
  "duracion",
  "sancion",
  "Sancion",
  "activacion",
  "inyeccion",
  "Opcion",
  "opcion",
  "estadisticas",
  "Estadisticas",
  "configuracion",
  "Configuracion",
  "modulo",
  "Modulo",
  "configuralo",
  "Aniadelo",
  "anademe",
  "Anademe",
  "boton",
  "codigo",
  "ultimos",
  "Ultimos",
];
const badPhrases = ["Aun no", "aun no"];
// Internal codes must never be interpolated into a user message.
const codeLeak = /\$\{(permission|decision)\.reason\}/;

let failures = 0;
for (const rel of files) {
  const lines = readFileSync(path.join(repoRoot, rel), "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const w of badWords) {
      if (new RegExp(`\\b${w}\\b`).test(line)) {
        console.error(`${rel}:${i + 1}  bad word "${w}"  ->  ${line.trim()}`);
        failures++;
      }
    }
    for (const p of badPhrases) {
      if (line.includes(p)) {
        console.error(`${rel}:${i + 1}  bad phrase "${p}"  ->  ${line.trim()}`);
        failures++;
      }
    }
    if (codeLeak.test(line)) {
      console.error(`${rel}:${i + 1}  leaks internal code  ->  ${line.trim()}`);
      failures++;
    }
  });
}

if (failures > 0) {
  console.error(`\ncopy lint: ${failures} issue(s) found.`);
  process.exit(1);
}
console.log("copy lint: clean ✓");
