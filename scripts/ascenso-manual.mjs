/**
 * Sube a alguien al rango mas alto a mano, haciendo TODO lo que hace el ascenso
 * automatico y en el mismo orden.
 *
 * No es un UPDATE suelto a proposito. Un rango "leyenda" lleva tres cosas
 * atadas: la fila, el titulo visible en Telegram y el apunte en el libro de
 * admins nombrados por el bot. Si se escribe solo la fila, la persona sale como
 * Leyenda en /rango y no tiene titulo; si se pone el titulo sin el apunte, queda
 * un administrador que el bot NO puede degradar nunca — que es exactamente el
 * estado que ese libro existe para evitar.
 *
 * Sin `--apply` no escribe nada: enseña lo que haria y sale.
 *
 * Uso, desde el NAS:
 *   docker compose run --rm -T --no-deps \
 *     -v $PROJ/scripts/ascenso-manual.mjs:/app/scripts/ascenso-manual.mjs:ro \
 *     api node scripts/ascenso-manual.mjs <telegramChatId> <telegramUserId> [--apply]
 */

import { PrismaClient } from "@prisma/client";

const [, , rawChat, rawUser, ...flags] = process.argv;
const APLICAR = flags.includes("--apply");

if (!rawChat || !rawUser) {
  console.error(
    "uso: ascenso-manual.mjs <telegramChatId> <telegramUserId> [--apply]",
  );
  process.exit(2);
}

const telegramChatId = BigInt(rawChat);
const telegramUserId = BigInt(rawUser);

// El tope de Telegram son 50 admins por grupo, y un titulo visible ES un admin.
// Se deja colchon para no gastar las ultimas plazas en insignias y quedarse sin
// sitio para nombrar a un moderador de verdad.
const RANGO = {
  key: "leyenda",
  label: "👑 Leyenda",
  blurb: "Eres parte esencial de la comunidad.",
};
const CAP_ADMINS = 50;
const RESERVA = 10;

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("falta TELEGRAM_BOT_TOKEN en el entorno");
  process.exit(2);
}

const tg = async (metodo, cuerpo) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return r.json();
};

const escapar = (s) =>
  s.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

const prisma = new PrismaClient();

try {
  const chat = await prisma.chat.findFirst({ where: { telegramChatId } });
  if (!chat) {
    console.error(`no conozco el chat ${telegramChatId}`);
    process.exit(1);
  }

  const perfil = await prisma.reputationProfile.findFirst({
    where: { chatId: chat.id, telegramUserId },
  });

  // Que este DENTRO del grupo. Ascender a quien se fue publica un anuncio sobre
  // alguien que no esta, y el titulo ni se aplica.
  const miembro = await tg("getChatMember", {
    chat_id: telegramChatId.toString(),
    user_id: telegramUserId.toString(),
  });
  const estado = miembro?.result?.status;
  const usuario = miembro?.result?.user ?? {};
  const nombre =
    usuario.first_name ??
    (usuario.username ? `@${usuario.username}` : String(telegramUserId));

  const admins = await tg("getChatAdministrators", {
    chat_id: telegramChatId.toString(),
  });
  const numAdmins = Array.isArray(admins?.result) ? admins.result.length : null;
  const ficha = (admins?.result ?? []).find(
    (a) => String(a?.user?.id) === String(telegramUserId),
  );
  const yaEsAdmin = Boolean(ficha);
  const huecos =
    numAdmins === null ? null : Math.max(0, CAP_ADMINS - RESERVA - numAdmins);

  /**
   * Quien YA es administrador no pasa por promoteChatMember, y esto no es un
   * detalle: en la API de Telegram, promover con todos los permisos a false ES
   * la forma de degradar. Aplicarselo a un moderador de verdad le quitaria el
   * poder de banear y borrar para ponerle una insignia.
   *
   * `can_be_edited` decide si el bot puede siquiera cambiarle el titulo:
   * Telegram solo deja tocar a los administradores que ascendio el propio bot.
   */
  const editable = ficha?.can_be_edited === true;
  const puedeLlevarTitulo = !yaEsAdmin || editable;

  console.log(
    JSON.stringify(
      {
        modo: APLICAR ? "APLICAR" : "SIMULACRO",
        grupo: { titulo: chat.title, chatInterno: chat.id },
        persona: {
          id: String(telegramUserId),
          nombre,
          username: usuario.username ?? null,
          estado,
        },
        rangoActual: perfil?.rank ?? null,
        rangoNuevo: RANGO.key,
        xp: perfil?.xp ?? null,
        puntos: perfil?.points ?? null,
        admins: {
          total: numAdmins,
          yaEsAdmin,
          editablePorElBot: editable,
          huecosParaInsignias: huecos,
        },
        tituloVisible: puedeLlevarTitulo
          ? yaEsAdmin
            ? "se le cambia el titulo, sin tocarle los permisos"
            : "se le pone la insignia"
          : "IMPOSIBLE: ya es admin y no lo ascendio el bot (can_be_edited=false)",
      },
      null,
      2,
    ),
  );

  if (!estado || estado === "left" || estado === "kicked") {
    console.error(
      `la persona no esta en el grupo (estado: ${estado ?? "desconocido"}) — no se hace nada`,
    );
    process.exit(1);
  }
  if (!yaEsAdmin && huecos !== null && huecos <= 0) {
    console.error(
      "no queda cupo de administradores: el titulo visible no se puede dar",
    );
    process.exit(1);
  }
  if (!APLICAR) {
    console.log("\nSIMULACRO: no se ha escrito nada. Repetir con --apply.");
    process.exit(0);
  }

  // 1) La fila.
  const guardado = await prisma.reputationProfile.upsert({
    where: { chatId_telegramUserId: { chatId: chat.id, telegramUserId } },
    update: { rank: RANGO.key },
    create: {
      tenantId: chat.tenantId,
      chatId: chat.id,
      telegramUserId,
      rank: RANGO.key,
    },
  });
  console.log(`rango guardado: ${guardado.rank}`);

  // 2) El titulo, SOLO si Telegram deja.
  //
  // A quien ya es administrador NO se le toca promoteChatMember: con todos los
  // permisos a false, esa llamada degrada. Se le cambia el titulo y nada mas.
  let conTitulo = false;
  let notaTitulo = "no aplicado";

  if (!puedeLlevarTitulo) {
    notaTitulo =
      "no se puede: ya es administrador y no lo ascendio este bot, asi que Telegram no deja cambiarle el titulo";
    console.log(`titulo: ${notaTitulo}`);
  } else {
    if (!yaEsAdmin) {
      // Insignia, no poder: todos los permisos explicitos a false. Solo vale
      // para quien NO era admin — aqui eso significa "de miembro a insignia".
      const ascendido = await tg("promoteChatMember", {
        chat_id: telegramChatId.toString(),
        user_id: telegramUserId.toString(),
        can_manage_chat: false,
        can_delete_messages: false,
        can_restrict_members: false,
        can_promote_members: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
      });
      console.log(`promoteChatMember: ${JSON.stringify(ascendido)}`);
      if (!ascendido?.ok) {
        notaTitulo = `Telegram rechazo la insignia: ${ascendido?.description ?? "?"}`;
      }
    }

    const puesto = await tg("setChatAdministratorCustomTitle", {
      chat_id: telegramChatId.toString(),
      user_id: telegramUserId.toString(),
      custom_title: RANGO.label,
    });
    conTitulo = Boolean(puesto?.ok);
    notaTitulo = conTitulo
      ? "puesto"
      : `rechazado: ${puesto?.description ?? "?"}`;
    console.log(`setChatAdministratorCustomTitle: ${JSON.stringify(puesto)}`);

    // 3) El apunte, solo cuando la insignia la puso este bot. Si ya era admin
    // por su cuenta, apuntarlo como "nombrado por el bot" seria mentira: el bot
    // no puede degradarle, y el libro existe justo para responder a eso.
    if (conTitulo && !yaEsAdmin) {
      try {
        await prisma.botGrantedAdmin.upsert({
          where: {
            tenantId_chatId_telegramUserId: {
              tenantId: chat.tenantId,
              chatId: chat.id,
              telegramUserId,
            },
          },
          update: {
            status: "active",
            revokedAt: null,
            revokedReason: null,
            customTitle: RANGO.label,
            telegramChatId,
          },
          create: {
            tenantId: chat.tenantId,
            chatId: chat.id,
            telegramChatId,
            telegramUserId,
            username: usuario.username ?? null,
            displayName: usuario.first_name ?? null,
            customTitle: RANGO.label,
            grantedByTelegramId: 0n,
          },
        });
        console.log(
          "apuntado en bot_granted_admins (el bot puede retirarselo)",
        );
      } catch (e) {
        console.error(
          `FALLO el apunte (${e?.message}) — se deja constancia, NO se degrada a nadie a ciegas`,
        );
        notaTitulo = "puesto, pero sin apunte: revisar a mano";
      }
    }
  }

  // 4) El anuncio, con el mismo texto que usan los ascensos automaticos.
  const mencion = `<a href="tg://user?id=${telegramUserId}">${escapar(nombre)}</a>`;
  const anuncio = await tg("sendMessage", {
    chat_id: telegramChatId.toString(),
    text: `${RANGO.label} ${mencion} sube a <b>${RANGO.label}</b> — ${RANGO.blurb}`,
    parse_mode: "HTML",
  });
  console.log(
    `anuncio: ${anuncio?.ok ? `publicado (msg ${anuncio.result.message_id})` : JSON.stringify(anuncio)}`,
  );

  // 5) El rastro.
  await prisma.auditLog.create({
    data: {
      tenantId: chat.tenantId,
      actorType: "system",
      action: "rank.granted_manually",
      resourceType: "reputation_profile",
      resourceId: String(telegramUserId),
      payload: {
        rank: RANGO.key,
        rangoAnterior: perfil?.rank ?? null,
        titulo: conTitulo,
        notaTitulo,
        anuncio: Boolean(anuncio?.ok),
        motivo: "peticion del owner",
      },
    },
  });
  console.log("auditado como rank.granted_manually");
} finally {
  await prisma.$disconnect();
}
