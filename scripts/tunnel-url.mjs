#!/usr/bin/env node
// Reads the cloudflared quick-tunnel logs, extracts the public https URL, and
// rewrites ONLY the `TELEGRAM_APP_URL=` line of the repo `.env` (the bot token
// lives in the same file, so we never touch anything else). Plain ESM, no deps,
// mirrors scripts/run.mjs (pnpm is not on PATH on the Windows host).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function readTunnelLogs() {
  try {
    return execFileSync(
      "docker",
      ["compose", "--profile", "tunnel", "logs", "cloudflared"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    // docker prints logs to stderr sometimes; use whatever we captured.
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

const logs = readTunnelLogs();
const match = logs.match(URL_RE);

if (!match) {
  console.error(
    "No encontre la URL del tunnel todavia.\n" +
      "Arranca cloudflared y espera ~5s:\n" +
      "  docker compose --profile tunnel up -d cloudflared\n" +
      "  Start-Sleep -Seconds 5\n" +
      "Luego vuelve a correr: node scripts/tunnel-url.mjs",
  );
  process.exit(1);
}

const url = match[0];
const line = `TELEGRAM_APP_URL=${url}`;

let contents = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
if (/^TELEGRAM_APP_URL=.*$/m.test(contents)) {
  contents = contents.replace(/^TELEGRAM_APP_URL=.*$/m, line);
} else {
  contents =
    contents.length && !contents.endsWith("\n")
      ? `${contents}\n${line}\n`
      : `${contents}${line}\n`;
}
writeFileSync(ENV_PATH, contents);

console.log(url);
console.error(
  "\n.env actualizado (solo la linea TELEGRAM_APP_URL=).\n" +
    "Siguiente:\n" +
    "  docker compose up -d bot api worker web\n" +
    "  BotFather: /myapps -> @ModryvaBot -> Edit Web App URL -> pega la URL de arriba\n" +
    "  (o corre el auto-sync del Bloque E)",
);
