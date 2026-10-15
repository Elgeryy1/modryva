#!/usr/bin/env node
// Bloque E-2: un solo comando que re-sincroniza todo tras rotar el quick tunnel.
//   1) captura la URL del tunnel al .env (tunnel-url.mjs)
//   2) recrea bot/api/worker/web para que tomen la URL nueva (el bot re-pone su menu button)
//   3) intenta el auto-sync de BotFather (botfather-set-url.mjs) si esta disponible;
//      si no, imprime el paso manual.
//
// Uso:  node scripts/sync-url.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });

// 1) URL del tunnel -> .env
console.log("→ Capturando URL del tunnel…");
run("node", ["scripts/tunnel-url.mjs"]);

// 2) recrear servicios
console.log("\n→ Recreando servicios con la URL nueva…");
run("docker", ["compose", "up", "-d", "bot", "api", "worker", "web"]);

// 3) BotFather auto-sync (best-effort). El script + la sesion dueña viven en el
//    scratchpad de la sesion; si no estan, cae al paso manual.
const url =
  readFileSync(path.join(ROOT, ".env"), "utf8").match(
    /^TELEGRAM_APP_URL=(.*)$/m,
  )?.[1] ?? "";
const bfScript = process.env.BOTFATHER_SCRIPT; // ruta absoluta opcional al botfather-set-url.mjs
if (bfScript && existsSync(bfScript)) {
  console.log("\n→ Auto-sync de BotFather…");
  try {
    run("node", [bfScript, url]);
  } catch {
    console.error(
      `\n⚠️ El auto-sync de BotFather fallo. Hazlo a mano:\n  /myapps → @ModryvaBot → Edit Web App URL → ${url}`,
    );
  }
} else {
  console.log(
    `\n→ Paso manual de BotFather (define BOTFATHER_SCRIPT para automatizarlo):\n  /myapps → @ModryvaBot → Edit Web App URL → ${url}`,
  );
}

console.log(
  "\n✅ Listo. Comprueba: docker compose logs bot | Select-String 'menu button set'",
);
