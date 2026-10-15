/**
 * Carrera entre DOS PROCESOS del sistema operativo por la misma pole.
 *
 * Es lo que el doble en memoria no puede demostrar. Aquel prueba que el modelo
 * de conflicto es correcto en un runtime de un solo hilo; esto prueba que dos
 * procesos que no se conocen, con conexiones distintas al mismo Postgres,
 * llegan al mismo resultado.
 *
 * Uso:
 *   TEST_DATABASE_URL=postgresql://... node scripts/social-two-workers/run.mjs
 *
 * Sale con código 0 solo si TODOS los criterios se cumplen.
 */

import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

const DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta TEST_DATABASE_URL. Ver docs/social-core/OPERATIONS.md.");
  process.exit(2);
}

const TENANT = "tenant-two-workers";
const CHAT_ROW = "chat-two-workers";
const CHAT = -1009999n;

/** Cuánto margen se da a los dos procesos para arrancar antes de la barrera. */
const BARRIER_MS = 3000;

const client = new PrismaClient({ datasourceUrl: DATABASE_URL });

const runWorker = (label, startAt, userId) =>
  new Promise((resolveWorker) => {
    const child = spawn(
      process.execPath,
      [
        join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
        "--tsconfig",
        join(ROOT, "tsconfig.base.json"),
        join(HERE, "worker.ts"),
        label,
        String(startAt),
        String(userId),
      ],
      {
        cwd: ROOT,
        env: { ...process.env, TEST_DATABASE_URL: DATABASE_URL },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    child.on("close", (code) => {
      const line = out.trim().split("\n").filter(Boolean).pop();
      let parsed = null;
      try {
        parsed = line ? JSON.parse(line) : null;
      } catch {
        parsed = null;
      }
      resolveWorker({
        label,
        code,
        parsed,
        stderr: err.trim(),
        raw: out.trim(),
      });
    });
  });

const seed = async () => {
  // Un tenant y un chat de verdad: ChatSetting tiene FK a los dos, así que sin
  // ellos el worker no podría leer los ajustes como los lee el bot.
  await client.tenant.upsert({
    where: { slug: "telegram-two-workers" },
    create: { id: TENANT, name: "two-workers", slug: "telegram-two-workers" },
    update: {},
  });
  await client.chat.upsert({
    where: {
      tenantId_telegramChatId: { tenantId: TENANT, telegramChatId: CHAT },
    },
    create: {
      id: CHAT_ROW,
      tenantId: TENANT,
      telegramChatId: CHAT,
      type: "supergroup",
    },
    update: {},
  });
  await client.chatSetting.upsert({
    where: {
      tenantId_chatId_key: {
        tenantId: TENANT,
        chatId: CHAT_ROW,
        key: "social",
      },
    },
    create: {
      tenantId: TENANT,
      chatId: CHAT_ROW,
      key: "social",
      // Un solo puesto: así "un ganador" es inequívoco.
      value: { pole: { enabled: true, positions: 1 } },
    },
    update: { value: { pole: { enabled: true, positions: 1 } } },
  });
};

const wipeRun = async () => {
  await client.poleWindow.deleteMany({ where: { tenantId: TENANT } });
  await client.auditLog.deleteMany({ where: { tenantId: TENANT } });
};

const check = (name, pass, detail) => {
  console.log(
    `${pass ? "PASA" : "FALLA"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
  return pass;
};

const main = async () => {
  await seed();
  await wipeRun();

  const startAt = Date.now() + BARRIER_MS;
  console.log(`Barrera en ${new Date(startAt).toISOString()} (dos procesos)\n`);

  const [a, b] = await Promise.all([
    runWorker("worker-A", startAt, 100001),
    runWorker("worker-B", startAt, 100002),
  ]);

  const workers = [a, b];
  for (const w of workers) {
    console.log(
      `${w.label}: exit=${w.code} ${JSON.stringify(w.parsed)}${w.stderr ? `\n  stderr: ${w.stderr}` : ""}`,
    );
  }
  console.log("");

  const skew = Math.abs((a.parsed?.firedAt ?? 0) - (b.parsed?.firedAt ?? 0));
  console.log(`Desfase real entre los dos disparos: ${skew} ms\n`);

  const claims = await client.poleClaim.findMany({
    where: { window: { tenantId: TENANT } },
  });
  const audits = await client.auditLog.findMany({
    where: { tenantId: TENANT, action: "social.pole.claimed" },
  });
  const windows = await client.poleWindow.findMany({
    where: { tenantId: TENANT },
  });

  const announcements = workers.filter((w) => w.parsed?.wonPole === true);

  let ok = true;
  ok =
    check("una sola ventana", windows.length === 1, `${windows.length}`) && ok;
  ok =
    check(
      "un solo ganador persistido",
      claims.length === 1,
      `${claims.length} reclamaciones`,
    ) && ok;
  ok =
    check(
      "un solo anuncio de ganador",
      announcements.length === 1,
      `${announcements.length}`,
    ) && ok;
  ok =
    check(
      "el perdedor termina limpio (exit 0)",
      workers.every((w) => w.code === 0),
    ) && ok;
  ok =
    check(
      "ningún error no gestionado",
      workers.every((w) => w.parsed?.ok === true),
      workers.map((w) => w.parsed?.error ?? "-").join(" / "),
    ) && ok;
  ok =
    check(
      "el perdedor responde algo, no calla",
      workers.every(
        (w) => typeof w.parsed?.text === "string" && w.parsed.text.length > 0,
      ),
    ) && ok;
  ok =
    check(
      "una sola fila de auditoría",
      audits.length === 1,
      `${audits.length}`,
    ) && ok;
  ok =
    check(
      "sin stderr",
      workers.every((w) => w.stderr === ""),
      workers
        .map((w) => w.stderr)
        .filter(Boolean)
        .join(" | ") || "-",
    ) && ok;

  // Reentrega posterior: el mismo update, ya con la ventana ocupada.
  const replay = await runWorker("replay", Date.now() + 200, 100001);
  console.log(`\nreplay: ${JSON.stringify(replay.parsed)}`);
  const claimsAfter = await client.poleClaim.count({
    where: { window: { tenantId: TENANT } },
  });
  const auditsAfter = await client.auditLog.count({
    where: { tenantId: TENANT, action: "social.pole.claimed" },
  });
  ok =
    check(
      "la reentrega no crea una segunda reclamación",
      claimsAfter === 1,
      `${claimsAfter}`,
    ) && ok;
  ok =
    check(
      "la reentrega no duplica auditoría",
      auditsAfter === 1,
      `${auditsAfter}`,
    ) && ok;
  ok =
    check(
      "la reentrega responde sin reventar",
      replay.code === 0 && replay.parsed?.ok === true,
    ) && ok;

  await wipeRun();
  await client.$disconnect();

  console.log(
    `\n${ok ? "TODOS LOS CRITERIOS PASAN" : "HAY CRITERIOS QUE FALLAN"}`,
  );
  process.exit(ok ? 0 : 1);
};

main().catch(async (error) => {
  console.error(error);
  await client.$disconnect();
  process.exit(1);
});
