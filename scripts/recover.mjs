#!/usr/bin/env node
// Recuperación de UN comando tras reiniciar el stack (el quick tunnel rota su
// URL). Hace TODO: levanta stack+tunel, captura la URL nueva, reescribe .env,
// reinicia los servicios (el bot re-pone su menu button) y actualiza BotFather.
//
// Uso:  node scripts/recover.mjs
// BotFather auto: define BOTFATHER_SCRIPT con la ruta a botfather-set-url.mjs
// (necesita la sesion de la cuenta DUEÑA). Si no, imprime el paso manual.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV = path.join(ROOT, ".env");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
const capture = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
};

console.log("→ 1/4  Levantando stack + tunel…");
run("docker", ["compose", "--profile", "tunnel", "up", "-d"]);

console.log("→ 2/4  Esperando la URL publica del tunel…");
let url;
for (let i = 0; i < 15; i += 1) {
  await wait(2000);
  const logs = capture("docker", [
    "compose",
    "--profile",
    "tunnel",
    "logs",
    "cloudflared",
  ]);
  const match = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    url = match[0];
    break;
  }
}
if (!url) {
  console.error(
    "❌ No pude leer la URL del tunel. Espera unos segundos y reintenta.",
  );
  process.exit(1);
}
console.log(`   URL: ${url}`);

console.log("→ 3/4  Actualizando .env + reiniciando servicios…");
let env = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
env = /^TELEGRAM_APP_URL=.*$/m.test(env)
  ? env.replace(/^TELEGRAM_APP_URL=.*$/m, `TELEGRAM_APP_URL=${url}`)
  : `${env}${env.endsWith("\n") || !env ? "" : "\n"}TELEGRAM_APP_URL=${url}\n`;
writeFileSync(ENV, env);
run("docker", ["compose", "up", "-d", "bot", "api", "worker", "web"]);

console.log("→ 4/4  BotFather…");
// Por defecto no hay script de BotFather; define BOTFATHER_SCRIPT o hazlo a mano.
// Si se limpia, define BOTFATHER_SCRIPT o haz el /editapp a mano.
const DEFAULT_BF =
  "";
const bf = process.env.BOTFATHER_SCRIPT || DEFAULT_BF;
if (bf && existsSync(bf)) {
  try {
    run("node", [bf, url]);
    console.log("\n✅ Recuperado del todo. La Mini App vuelve a estar viva.");
  } catch {
    console.error(
      `\n⚠️ El auto-sync de BotFather fallo. Hazlo a mano:\n   /editapp @ModryvaBot → Edit Web App URL → ${url}`,
    );
  }
} else {
  console.log(
    `ℹ️ Paso manual de BotFather (o define BOTFATHER_SCRIPT):\n   /editapp @ModryvaBot → Edit Web App URL → ${url}`,
  );
}
