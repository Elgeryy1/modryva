/**
 * Comprobación previa a la prueba en Telegram de staging.
 *
 * Hace TODO lo que se puede hacer con un token de bot y sin que nadie escriba:
 * identidad del bot, permisos reales en el grupo, si el grupo tiene temas, y
 * si la pole automática puede funcionar. Lo demás —escribir `/pole`, ver quién
 * gana, comprobar el cooldown— necesita a una persona, y la lista está en
 * `docs/social-core/TELEGRAM_STAGING_CHECKLIST.md`.
 *
 * Uso:
 *   SOCIAL_STAGING_BOT_TOKEN=... SOCIAL_STAGING_CHAT_ID=-100... \
 *     node scripts/social-staging/preflight.mjs
 *
 * Se NIEGA a funcionar con el bot de producción. La comprobación no es
 * cosmética: el id numérico del token se compara con el de `.env`, así que
 * pegar el token equivocado aborta en vez de escribir en grupos reales.
 */

import { readFileSync } from "node:fs";

const TOKEN = process.env.SOCIAL_STAGING_BOT_TOKEN;
const CHAT_ID = process.env.SOCIAL_STAGING_CHAT_ID;

const fail = (message) => {
  console.error(`\n✗ ${message}`);
  process.exit(2);
};

if (!TOKEN || !CHAT_ID) {
  fail(
    "Faltan SOCIAL_STAGING_BOT_TOKEN y/o SOCIAL_STAGING_CHAT_ID.\n" +
      "  Crea un bot de PRUEBAS en BotFather y un grupo privado para él.\n" +
      "  Nunca uses el token de producción: este script lo rechaza.",
  );
}

/** El id numérico que precede a los dos puntos identifica al bot. */
const botIdOf = (token) => String(token).split(":")[0] ?? "";

// Guardia de producción. Se lee `.env` solo para COMPARAR; no se imprime nada.
try {
  const env = readFileSync(".env", "utf8");
  const prod = /^TELEGRAM_BOT_TOKEN=(.+)$/mu.exec(env)?.[1]?.trim();
  if (prod && botIdOf(prod) === botIdOf(TOKEN)) {
    fail(
      "Ese es el bot de PRODUCCIÓN. Este script no lo toca.\n" +
        "  Usa un bot de pruebas creado para esto.",
    );
  }
} catch {
  // Sin .env no hay nada que comparar; seguimos.
}

const call = async (method, payload = {}) => {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body = await response.json().catch(() => ({}));
  // Nunca se imprime la URL: lleva el token dentro.
  return { ok: response.ok && body.ok === true, result: body.result, body };
};

const mark = (state) => (state === "yes" ? "✅" : state === "no" ? "⚠️ " : "❔");

const main = async () => {
  console.log("Comprobación previa — Telegram de staging\n");

  const me = await call("getMe");
  if (!me.ok) {
    fail(`getMe ha fallado: ${me.body?.description ?? "sin descripción"}`);
  }
  const botId = me.result.id;
  console.log(`Bot: @${me.result.username} (id ${botId})`);
  console.log(
    `can_join_groups=${me.result.can_join_groups} ` +
      `can_read_all_group_messages=${me.result.can_read_all_group_messages}`,
  );

  const chat = await call("getChat", { chat_id: CHAT_ID });
  if (!chat.ok) {
    fail(
      `No puedo leer el grupo ${CHAT_ID}: ` +
        `${chat.body?.description ?? "sin descripción"}.\n` +
        "  ¿Está el bot dentro del grupo?",
    );
  }
  const isForum = chat.result.is_forum === true;
  console.log(
    `Grupo: "${chat.result.title}" (${chat.result.type})` +
      `${isForum ? " — CON TEMAS" : " — sin temas"}`,
  );

  const member = await call("getChatMember", {
    chat_id: CHAT_ID,
    user_id: botId,
  });
  const status = member.ok ? member.result.status : undefined;
  const isAdmin = status === "administrator" || status === "creator";
  const tri = (value) =>
    value === undefined ? "unknown" : value ? "yes" : "no";

  console.log("\nPermisos del bot:");
  console.log(
    `${mark(isAdmin ? "yes" : status ? "no" : "unknown")} administrador (status=${status ?? "?"})`,
  );
  console.log(
    `${mark(tri(member.result?.can_delete_messages))} borrar mensajes`,
  );
  console.log(
    `${mark(tri(member.result?.can_restrict_members))} restringir miembros` +
      `${member.result?.can_restrict_members ? "" : "  → la ruleta con silencio NO podrá aplicarse"}`,
  );

  // La privacidad no se puede consultar: se infiere. Un bot administrador
  // recibe todos los mensajes independientemente del modo privacidad.
  const autoPoleViable =
    isAdmin || me.result.can_read_all_group_messages === true;
  console.log(
    `${mark(autoPoleViable ? "yes" : "unknown")} pole automática viable` +
      `${autoPoleViable ? "" : "  → hazlo admin o desactiva la privacidad en BotFather"}`,
  );

  console.log(
    "\nLo que este script NO puede comprobar (necesita una persona):",
  );
  for (const item of [
    "escribir /pole y ver quién gana",
    "que una segunda persona reciba la subpole",
    "el cooldown de la ruleta entre dos tiradas",
    "el reparto por temas (thread principal vs secundario)",
    "el comportamiento con un nombre que lleva * _ [ o < >",
    "la reentrega del mismo update",
  ]) {
    console.log(`  · ${item}`);
  }
  console.log(
    "\nLista completa y hoja de registro:" +
      "\n  docs/social-core/TELEGRAM_STAGING_CHECKLIST.md",
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
