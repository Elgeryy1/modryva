import type { Logger } from "@nestjs/common";
import { type RuntimeEnv, TELEGRAM_ALLOWED_UPDATES } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import type { BotUpdateService } from "./bot-update.service.js";
import {
  botMetrics,
  observarProcesoDeUpdate,
  observarRetrasoDeEntrega,
} from "./metrics.js";
import { readAppUrl } from "./runtime-url.js";

// Single source of truth shared with managed-bot webhook registration
// (@superbot/shared). The synthetic `managed_bot` update the poller used to list
// is dropped: Telegram never emits it, so listing it was a no-op.
const ALLOWED_UPDATES = TELEGRAM_ALLOWED_UPDATES;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * El menú que ve **todo el mundo**.
 *
 * Antes esto era una sola lista de 194 entradas, y estaba al reves: llevaba
 * 189 calculadoras de staff —`/proporcionalidad`, `/medidor_hype`,
 * `/nivel_conocimiento`— y **ni uno** de los comandos que la gente usa a
 * diario. Ni `/saldo`, ni `/ruleta`, ni `/top`, ni los nueve de moderacion.
 * De los ~59 comandos de uso real solo habia 5 en el menu.
 *
 * Ademas Telegram corta en 100 **por ámbito**, asi que 94 de aquellas 194 no
 * llegaban nunca — se perdian por orden de array, sin que nada avisara.
 *
 * Los comandos que salieron del menu **siguen funcionando**: esto es lo que
 * se ofrece al escribir `/`, no lo que el bot acepta.
 */
export const COMANDOS_DE_TODOS = [
  { command: "start", description: "Empezar y ver qué puede hacer el bot" },
  { command: "help", description: "Ayuda según dónde estés" },
  { command: "menu", description: "Menú principal" },
  { command: "estado", description: "Estado del grupo e incidencias" },
  { command: "verificar", description: "Verificar tu entrada al grupo" },
  {
    command: "report",
    description: "Avisar al staff de un mensaje (responde a él)",
  },
  { command: "saldo", description: "Tu saldo y lo que tienes protegido" },
  { command: "daily", description: "Recompensa diaria" },
  { command: "checkin", description: "Pasar lista del día" },
  { command: "bono", description: "Reclamar tu bono" },
  { command: "top", description: "Ranking de saldo del grupo" },
  { command: "ranking", description: "Rankings del grupo" },
  { command: "donar", description: "Donar monedas a alguien" },
  { command: "robar", description: "Intentar robar monedas a alguien" },
  { command: "comprar", description: "Comprar algo de la tienda" },
  { command: "tienda", description: "Ver la tienda del grupo" },
  { command: "inventario", description: "Ver lo que tienes" },
  { command: "guardar", description: "Guardar monedas a salvo de robos" },
  { command: "sacar", description: "Sacar monedas de la caja fuerte" },
  { command: "casino", description: "Entrar al casino del grupo" },
  { command: "mascota", description: "Ver tu bicho" },
  { command: "alimentar", description: "Dar de comer a tu bicho" },
  {
    command: "jugar",
    description: "Jugar con tu bicho: gratis, una vez al día",
  },
  { command: "nombrar", description: "Ponerle nombre a tu bicho" },
  { command: "corral", description: "Los bichos del grupo" },
  { command: "huevo", description: "Conseguir tu primer bicho" },
  { command: "ruleta", description: "Jugar a la ruleta" },
  { command: "tragaperras", description: "Tirar de la tragaperras" },
  { command: "duelo", description: "Retar a alguien a un duelo de fichas" },
  { command: "regalar", description: "Regalar fichas a alguien" },
  { command: "comprarfichas", description: "Cambiar monedas por fichas" },
  { command: "venderfichas", description: "Cambiar fichas por monedas" },
  { command: "trivia", description: "Preguntas de trivial" },
  { command: "wordle", description: "Wordle del grupo" },
  { command: "ahorcado", description: "Jugar al ahorcado" },
  { command: "impostor", description: "Partida de El Impostor" },
  { command: "conecta4", description: "Jugar al conecta 4" },
  { command: "memoria", description: "Juego de memoria" },
  { command: "pole", description: "Pedir la pole del día" },
  { command: "racha", description: "Tu racha de días seguidos" },
  { command: "gracias", description: "Dar las gracias (responde a alguien)" },
  {
    command: "confianza",
    description: "Tu nivel de confianza y qué desbloquea",
  },
  { command: "mision", description: "Misión cooperativa del grupo" },
  {
    command: "intereses",
    description: "Tus etiquetas de interés y con quién coincides",
  },
  { command: "novatos", description: "Ranking de novatos y veteranos" },
  { command: "salonfama", description: "Salón de la fama del grupo" },
] as const;

/**
 * El menú de un admin dentro de un grupo.
 *
 * **Incluye tambien los comunes**, y no es redundancia: Telegram resuelve el
 * ámbito mas especifico, asi que un admin ve ESTA lista y no la general. Si
 * no estuvieran, un admin perderia del menu `/saldo` y `/ruleta`, que usa
 * como cualquier otro.
 */
export const COMANDOS_DE_ADMIN = [
  { command: "start", description: "Empezar y ver qué puede hacer el bot" },
  { command: "help", description: "Ayuda según dónde estés" },
  { command: "menu", description: "Menú principal" },
  { command: "estado", description: "Estado del grupo e incidencias" },
  { command: "verificar", description: "Verificar tu entrada al grupo" },
  {
    command: "report",
    description: "Avisar al staff de un mensaje (responde a él)",
  },
  { command: "saldo", description: "Tu saldo y lo que tienes protegido" },
  { command: "daily", description: "Recompensa diaria" },
  { command: "checkin", description: "Pasar lista del día" },
  { command: "bono", description: "Reclamar tu bono" },
  { command: "top", description: "Ranking de saldo del grupo" },
  { command: "ranking", description: "Rankings del grupo" },
  { command: "donar", description: "Donar monedas a alguien" },
  { command: "robar", description: "Intentar robar monedas a alguien" },
  { command: "comprar", description: "Comprar algo de la tienda" },
  { command: "tienda", description: "Ver la tienda del grupo" },
  { command: "inventario", description: "Ver lo que tienes" },
  { command: "guardar", description: "Guardar monedas a salvo de robos" },
  { command: "sacar", description: "Sacar monedas de la caja fuerte" },
  { command: "casino", description: "Entrar al casino del grupo" },
  { command: "mascota", description: "Ver tu bicho" },
  { command: "alimentar", description: "Dar de comer a tu bicho" },
  {
    command: "jugar",
    description: "Jugar con tu bicho: gratis, una vez al día",
  },
  { command: "nombrar", description: "Ponerle nombre a tu bicho" },
  { command: "corral", description: "Los bichos del grupo" },
  { command: "huevo", description: "Conseguir tu primer bicho" },
  { command: "ruleta", description: "Jugar a la ruleta" },
  { command: "tragaperras", description: "Tirar de la tragaperras" },
  { command: "duelo", description: "Retar a alguien a un duelo de fichas" },
  { command: "regalar", description: "Regalar fichas a alguien" },
  { command: "comprarfichas", description: "Cambiar monedas por fichas" },
  { command: "venderfichas", description: "Cambiar fichas por monedas" },
  { command: "trivia", description: "Preguntas de trivial" },
  { command: "wordle", description: "Wordle del grupo" },
  { command: "ahorcado", description: "Jugar al ahorcado" },
  { command: "impostor", description: "Partida de El Impostor" },
  { command: "conecta4", description: "Jugar al conecta 4" },
  { command: "memoria", description: "Juego de memoria" },
  { command: "pole", description: "Pedir la pole del día" },
  { command: "racha", description: "Tu racha de días seguidos" },
  { command: "gracias", description: "Dar las gracias (responde a alguien)" },
  {
    command: "confianza",
    description: "Tu nivel de confianza y qué desbloquea",
  },
  { command: "mision", description: "Misión cooperativa del grupo" },
  {
    command: "intereses",
    description: "Tus etiquetas de interés y con quién coincides",
  },
  { command: "novatos", description: "Ranking de novatos y veteranos" },
  { command: "salonfama", description: "Salón de la fama del grupo" },
  { command: "settings", description: "Ajustes del grupo" },
  {
    command: "modo",
    description: "Ver los ajustes de un modo de configuración",
  },
  {
    command: "receta",
    description: "Exportar o importar la configuración del grupo",
  },
  { command: "warn", description: "Avisar a alguien (responde a su mensaje)" },
  { command: "warnings", description: "Ver los avisos de alguien" },
  { command: "mute", description: "Silenciar a alguien" },
  { command: "unmute", description: "Quitar el silencio" },
  { command: "ban", description: "Banear a alguien" },
  { command: "unban", description: "Quitar el baneo" },
  { command: "kick", description: "Expulsar dejando volver" },
  { command: "purge", description: "Borrar mensajes en bloque" },
  { command: "antiflood", description: "Límite de mensajes por ventana" },
  { command: "antiraid", description: "Protección contra entradas masivas" },
  { command: "captcha", description: "Captcha de entrada" },
  { command: "lock", description: "Bloquear un tipo de contenido" },
  { command: "unlock", description: "Desbloquear un tipo de contenido" },
  { command: "blocklist", description: "Lista negra de palabras del grupo" },
  { command: "bienvenida", description: "Mensaje de bienvenida" },
  { command: "guardian", description: "Verificación de entrada: resumen" },
  { command: "guardian_status", description: "Estado de Guardian en el grupo" },
  { command: "guardian_on", description: "Encender Guardian" },
  { command: "guardian_off", description: "Apagar Guardian" },
  { command: "guardian_mode", description: "Modo de Guardian" },
  { command: "admin", description: "Nombrar o quitar admins del bot" },
  {
    command: "ajustarsaldo",
    description: "Subir o bajar el saldo de alguien (solo owner)",
  },
  {
    command: "setmonedas",
    description: "Fijar el saldo de alguien en una cifra exacta (solo owner)",
  },
  {
    command: "ilimitado",
    description: "Saldo sin fondo: encender, apagar o listar (solo owner)",
  },
  { command: "staff", description: "Gestionar el equipo de staff" },
  { command: "turno", description: "Turnos de guardia del staff" },
  { command: "tablero_casos", description: "Tablero de casos de soporte" },
  { command: "buscar_regla", description: "Buscar en las reglas del grupo" },
  { command: "alias", description: "Alias de comandos del grupo" },
  { command: "glosario", description: "Diccionario interno del grupo" },
  { command: "voz", description: "Tono del bot en el grupo" },
  { command: "joinfed", description: "Vincular el grupo a una federación" },
  { command: "leavefed", description: "Desvincular el grupo" },
  { command: "chatfed", description: "Ver a qué federación pertenece" },
  { command: "fedinfo", description: "Información de la federación" },
  { command: "fban", description: "Banear en toda la federación" },
  { command: "unfban", description: "Quitar un baneo de federación" },
  { command: "fedadmins", description: "Admins de la federación" },
] as const;

/**
 * La lista historica, que se conserva porque hay código y tests que la miran.
 * Es la de todo el mundo.
 */
export const BOT_COMMANDS = COMANDOS_DE_TODOS;

interface TelegramGetUpdatesResponse {
  readonly ok: boolean;
  readonly result?: Array<{ update_id: number } & Record<string, unknown>>;
}

/**
 * Cuántos updates se traen por vuelta.
 *
 * Sin `limit`, Telegram manda hasta 100 y el bucle de abajo los procesa TODOS
 * antes de volver a pedir. Eso convierte el ciclo en minutos, y durante esos
 * minutos no se recoge nada nuevo: en producción se veían ráfagas de ~50
 * updates en un minuto y luego uno suelto en el siguiente. Un lote corto vuelve
 * antes a `getUpdates`, que es lo único que mantiene fresco lo que caduca.
 */
const UPDATES_POR_VUELTA = 25;

/**
 * Cuantas veces se reintenta un update que falla antes de descartarlo.
 *
 * Existe para que un update envenenado no congele el offset y con el la cola
 * entera. Tres vueltas cubren de sobra un fallo transitorio de red o de
 * Postgres; lo que falla tres veces seguidas no es transitorio.
 */
const MAX_INTENTOS_POR_UPDATE = 3;

/**
 * Cuantos comandos acepta Telegram en el menu `/` por ámbito.
 *
 * Es un limite de Telegram, no una decision nuestra. Importa saberlo porque
 * `BOT_COMMANDS` tiene bastantes mas: los que se pasan de este corte siguen
 * funcionando al teclearlos, pero NO salen en el autocompletado. Anadir uno
 * por delante empuja a otro fuera del menu sin que falle nada, y por eso
 * `apps/bot/src/menu-comandos.test.ts` congela cuales entran.
 */
export const TOPE_MENU_TELEGRAM = 100;

/**
 * Cuantos chats se procesan a la vez dentro de un lote.
 *
 * Es el tope de concurrencia, o sea el backpressure. Cada update paga varios
 * viajes a Postgres antes de tocar un handler, asi que sin tope un lote de 25
 * chats distintos abriria 25 cadenas de consultas simultaneas y el remedio
 * seria peor que la enfermedad.
 *
 * Cuatro es deliberadamente conservador: multiplica por cuatro el rendimiento
 * frente al proceso en serie de antes sin acercarse a los limites del pool de
 * Postgres ni a los de la Bot API. Se puede subir con
 * `TELEGRAM_CARRILES_EN_PARALELO` si las metricas lo respaldan.
 */
const CARRILES_EN_PARALELO = Math.max(
  1,
  Number.parseInt(process.env.TELEGRAM_CARRILES_EN_PARALELO ?? "", 10) || 4,
);

/** Un `chat_join_request` primero; todo lo demás después. */
const urgencia = (update: Record<string, unknown>): number =>
  update.chat_join_request === undefined ? 1 : 0;

/**
 * Reordena un lote poniendo delante lo que caduca.
 *
 * Los updates NO son igual de perecederos. Un `chat_join_request` trae un
 * `query_id` que Telegram invalida en segundos —es lo único con lo que se le
 * puede abrir la Mini App a esa persona—, mientras que un mensaje aguanta lo
 * que haga falta. Atenderlos por orden de llegada, con el lote entero por
 * delante, mataba justo al único que tenía prisa.
 *
 * Visto en producción el 2026-08-10: el retraso de entrega creció de 15 s a
 * 245 s en seis minutos y TODAS las solicitudes de unión llegaban con el
 * `query_id` muerto (`query is too old and response timeout expired`). La
 * persona veía el mensaje de Telegram "el bot administrador no puede procesar
 * la solicitud de unión ahora" y se quedaba fuera, sin Mini App y sin DM.
 *
 * `sort` es estable en Node, así que dentro de cada grupo se respeta el orden
 * de llegada: los mensajes de un chat siguen procesándose en orden, que es de
 * lo que dependen la moderación y los contadores.
 */
export const ordenarPorUrgencia = <
  T extends { update_id: number } & Record<string, unknown>,
>(
  lote: readonly T[],
): T[] => [...lote].sort((a, b) => urgencia(a) - urgencia(b));

/**
 * Long-polling fallback for local/dev (and any deployment without a public
 * webhook URL). Pulls updates via getUpdates and feeds each one through the exact
 * same {@link BotUpdateService.processWebhook} pipeline used by the webhook, so
 * idempotency, auditing and persistence behave identically.
 */
/**
 * El offset que se confirmara a Telegram tras procesar un lote.
 *
 * La regla es una sola y es la que impide perder updates: **el offset nunca
 * pasa por encima de un update que fallo y todavia tiene reintentos**. Si hay
 * alguno asi, se retrocede hasta el menor de ellos, y Telegram reenvia ese y
 * todo lo posterior. Los que si terminaron vuelven a llegar, pero
 * `claimUpdate` los ve con `processedAt` y los descarta como duplicados sin
 * repetir ningun efecto.
 *
 * Sin fallos, avanza hasta el final del lote, que es lo de siempre.
 *
 * Funcion pura y exportada para poder probarla: el bucle de `startPolling` no
 * termina nunca y no se deja testear entero.
 */
export const calcularSiguienteOffset = (
  offsetActual: number,
  updateIdsDelLote: readonly number[],
  fallidosReintentables: readonly number[],
): number => {
  if (fallidosReintentables.length > 0) {
    return Math.min(...fallidosReintentables);
  }
  return updateIdsDelLote.reduce(
    (mayor, updateId) => Math.max(mayor, updateId + 1),
    offsetActual,
  );
};

/**
 * A que chat pertenece un update crudo de Telegram.
 *
 * Es la clave que decide que updates pueden adelantarse entre si y cuales no.
 * Lo que no se pueda atribuir a un chat cae en un unico carril compartido
 * (`sin-chat`), que es la opción conservadora: se procesa en serie, como hasta
 * ahora, en vez de suponer que no tiene dependencias.
 */
export const chatDeUpdate = (update: Record<string, unknown>): string => {
  const conChat = (valor: unknown): string | undefined => {
    const chat = (valor as { chat?: { id?: unknown } } | undefined)?.chat?.id;
    return typeof chat === "number" || typeof chat === "string"
      ? String(chat)
      : undefined;
  };

  const directo =
    conChat(update.message) ??
    conChat(update.edited_message) ??
    conChat(update.channel_post) ??
    conChat(update.edited_channel_post) ??
    conChat(update.chat_join_request) ??
    conChat(update.chat_member) ??
    conChat(update.my_chat_member) ??
    conChat(update.message_reaction) ??
    conChat(update.message_reaction_count);
  if (directo !== undefined) return directo;

  const desdeCallback = conChat(
    (update.callback_query as { message?: unknown } | undefined)?.message,
  );
  return desdeCallback ?? "sin-chat";
};

/**
 * La fecha que Telegram le puso al update, en segundos unix.
 *
 * Existe porque `update.date` **no existe**. El objeto `Update` de la Bot API
 * lleva `update_id` y un payload, y la fecha vive DENTRO del payload
 * (`message.date`, `chat_join_request.date`...). El poller leia `update.date`
 * con una guarda de `typeof === "number"` que por tanto no se cumplia jamas,
 * asi que `superbot_bot_update_delay_seconds` —la metrica con la que se iba a
 * diagnosticar lo de Guardian— nunca registro una sola muestra. El sintoma
 * exacto: 10.207 updates procesados, 10.207 muestras en el histograma de
 * proceso y CERO en el de retraso, los dos anotados en lineas consecutivas.
 *
 * `undefined` cuando el update no trae fecha por ningun lado (callback_query,
 * inline_query, poll_answer...). Eso NO se anota como cero: un cero inventado
 * bajaria la media y taparia justo el retraso que se busca.
 *
 * Para un mensaje editado manda `edit_date`: `date` es la del original, que
 * puede ser de hace semanas, y meterla aqui produciria retrasos absurdos.
 */
export const fechaDeUpdate = (
  update: Record<string, unknown>,
): number | undefined => {
  const conFecha = (valor: unknown): number | undefined => {
    const payload = valor as
      | { date?: unknown; edit_date?: unknown }
      | undefined;
    const fecha = payload?.edit_date ?? payload?.date;
    return typeof fecha === "number" && Number.isFinite(fecha)
      ? fecha
      : undefined;
  };

  const directo =
    conFecha(update.message) ??
    conFecha(update.edited_message) ??
    conFecha(update.channel_post) ??
    conFecha(update.edited_channel_post) ??
    conFecha(update.business_message) ??
    conFecha(update.edited_business_message) ??
    conFecha(update.chat_join_request) ??
    conFecha(update.chat_member) ??
    conFecha(update.my_chat_member) ??
    conFecha(update.message_reaction) ??
    conFecha(update.message_reaction_count);
  if (directo !== undefined) return directo;

  // El callback_query no se fecha a si mismo; lo unico datado es el mensaje
  // sobre el que se pulso, que puede ser MUY viejo (un menu de ayer). Se deja
  // fuera a proposito: mediria la edad del botón, no el retraso de la entrega.
  return undefined;
};

/**
 * Reparte el lote en carriles independientes, uno por chat.
 *
 * El bucle procesaba el lote entero **en serie**: el update N+1 no empezaba
 * hasta que terminaba el N, y cada uno paga varios viajes a Postgres antes de
 * tocar un handler. Con un grupo activo, la cola se acumulaba y las
 * solicitudes de union llegaban con el `query_id` ya muerto.
 *
 * Pero paralelizar el lote entero seria un error: el comentario de
 * `ordenarPorUrgencia` ya avisa de que **los mensajes de un chat se procesan en
 * orden, y de eso dependen la moderacion y los contadores**. Dos mensajes del
 * mismo chat compitiendo se pisarian los contadores de flood y podrian aplicar
 * sanciones sobre estado obsoleto.
 *
 * Solucion: carriles. Dentro de un carril, orden estricto de llegada (con las
 * solicitudes de union delante, como antes). Entre carriles, paralelo. Chats
 * distintos no comparten nada que pueda competir.
 */
export const repartirEnCarriles = <
  T extends { update_id: number } & Record<string, unknown>,
>(
  lote: readonly T[],
): T[][] => {
  const carriles = new Map<string, T[]>();
  for (const update of ordenarPorUrgencia(lote)) {
    const clave = chatDeUpdate(update);
    const carril = carriles.get(clave);
    if (carril) {
      carril.push(update);
    } else {
      carriles.set(clave, [update]);
    }
  }
  return [...carriles.values()];
};

/**
 * Ejecuta tareas con un tope de concurrencia.
 *
 * El tope es el backpressure: sin el, un lote de 25 chats distintos abriria 25
 * cadenas de consultas simultaneas contra Postgres y contra la Bot API, y el
 * remedio seria peor que la enfermedad. Las tareas que no caben esperan turno.
 *
 * No propaga: cada tarea se ocupa de su propio error. Aqui una excepcion que
 * escapara cancelaria el lote entero.
 */
export const ejecutarConLimite = async (
  tareas: readonly (() => Promise<void>)[],
  limite: number,
): Promise<void> => {
  let siguiente = 0;
  const obrero = async (): Promise<void> => {
    for (;;) {
      const indice = siguiente;
      siguiente += 1;
      const tarea = tareas[indice];
      if (tarea === undefined) return;
      await tarea();
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limite, tareas.length)) }, () =>
      obrero(),
    ),
  );
};

/**
 * Que hacer con un update que acaba de fallar, segun los intentos que ya lleva.
 *
 * `"reintentar"` congela el offset para que Telegram lo reenvie. `"descartar"`
 * lo deja marchar a proposito: sin ese tope, un update envenenado —un payload
 * que revienta el normalizador, por ejemplo— congelaria la cola para todo el
 * grupo indefinidamente.
 */
export const decidirTrasFallo = (
  intentosConsumidos: number,
): "reintentar" | "descartar" =>
  intentosConsumidos < MAX_INTENTOS_POR_UPDATE ? "reintentar" : "descartar";

export const startPolling = async (
  updates: BotUpdateService,
  env: RuntimeEnv,
  logger: Logger,
): Promise<void> => {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("polling disabled: TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const base = `https://api.telegram.org/bot${token}`;
  // Se quita el webhook para que getUpdates este permitido, pero SIN tirar el
  // backlog.
  //
  // Antes esto llamaba a `deleteWebhook?drop_pending_updates=true`, y como
  // corre en cada arranque, cada despliegue se comia todo lo que Telegram tenia
  // pendiente: solicitudes de union incluidas. Nadie se enteraba, porque
  // desaparecian antes de existir para el bot.
  //
  // Tirar el backlog sigue siendo posible, pero ahora hay que pedirlo a
  // proposito con TELEGRAM_DROP_PENDING_UPDATES=true, que es una decision
  // administrativa consciente y no un efecto secundario de reiniciar.
  const tirarBacklog = process.env.TELEGRAM_DROP_PENDING_UPDATES === "true";
  try {
    await fetch(
      `${base}/deleteWebhook${tirarBacklog ? "?drop_pending_updates=true" : ""}`,
    );
    if (tirarBacklog) {
      logger.warn(
        "TELEGRAM_DROP_PENDING_UPDATES=true: se descarta el backlog pendiente de Telegram",
      );
    }
  } catch {
    // Non-fatal: getUpdates will report a 409 if a webhook is still set.
  }

  logger.log(`polling Telegram as @${env.TELEGRAM_BOT_USERNAME}`);

  // Point the bot's default menu button at the live Mini App URL, and re-set it
  // whenever the URL changes (the urlsync sidecar publishes the current tunnel
  // URL to /state/app_url). No restart needed — self-heals every poll tick.
  const menuGateway = new HttpTelegramGateway();
  let lastMenuUrl = "";
  const syncMenuButton = async (): Promise<void> => {
    const url = readAppUrl(env.TELEGRAM_APP_URL);
    if (!url.startsWith("https://") || url === lastMenuUrl) {
      return;
    }
    try {
      await menuGateway.setChatMenuButton({ url, text: "Panel", token });
      lastMenuUrl = url;
      logger.log(`menu button set -> ${url}`);
    } catch (error) {
      logger.warn({ error }, "failed to set chat menu button");
    }
  };
  await syncMenuButton();

  // El menu de `/`, al arrancar, sin depender de que alguien se acuerde de
  // hacer /setcommands en BotFather.
  //
  // **Dos ámbitos, y el orden importa.** Telegram resuelve el mas especifico:
  // un admin dentro de un grupo ve la lista de administradores y NO la
  // general. Por eso `COMANDOS_DE_ADMIN` incluye tambien los comunes.
  //
  // Se manda primero el general: si el segundo fallara, todo el mundo se
  // queda con un menu correcto en vez de con ninguno.
  //
  // El tope de 100 es POR AMBITO, y las dos listas caben de sobra. El
  // `slice` se queda como red por si alguien las hace crecer: pasarse no da
  // error, Telegram corta por su cuenta y los últimos desaparecen sin avisar.
  try {
    await menuGateway.setMyCommands({
      commands: COMANDOS_DE_TODOS.slice(0, TOPE_MENU_TELEGRAM),
      token,
    });
    await menuGateway.setMyCommands({
      commands: COMANDOS_DE_ADMIN.slice(0, TOPE_MENU_TELEGRAM),
      token,
      scope: { type: "all_chat_administrators" },
    });
  } catch (error) {
    logger.warn({ error }, "failed to set bot commands");
  }

  let offset = 0;
  /**
   * Intentos consumidos por cada update que ha fallado, para no reintentar un
   * update envenenado indefinidamente. Se limpia en cuanto uno termina bien.
   */
  const intentosPorUpdate = new Map<number, number>();

  for (;;) {
    try {
      const url =
        `${base}/getUpdates?timeout=25&offset=${offset}&limit=${UPDATES_POR_VUELTA}` +
        `&allowed_updates=${encodeURIComponent(JSON.stringify(ALLOWED_UPDATES))}`;
      const response = await fetch(url);
      const data = (await response.json()) as TelegramGetUpdatesResponse;

      await syncMenuButton();

      if (!data.ok || !data.result) {
        await sleep(2000);
        continue;
      }

      // El offset se calcula DESPUES de procesar el lote, no antes.
      //
      // Antes se adelantaba con el lote entero por delante. Consecuencia: si
      // `processWebhook` lanzaba, el catch lo registraba y seguia, pero el
      // offset ya cubria ese update, asi que Telegram no lo reenviaba nunca.
      // El update se perdia para siempre y en `update_inbox` quedaba una fila
      // reclamada y sin `processedAt` que nadie iba a reprocesar. Un fallo
      // transitorio de red o de Postgres bastaba para tirar una solicitud de
      // union a la basura sin que nadie lo supiera.
      //
      // Ahora el offset solo avanza hasta el primer update que fallo y que aun
      // tiene reintentos, de modo que Telegram lo reenvia junto con todo lo
      // posterior. Los que si terminaron vuelven a llegar, pero `claimUpdate`
      // los ve con `processedAt` y devuelve "already-processed": se
      // descartan sin repetir un solo efecto. Esa es exactamente la propiedad
      // de idempotencia en la que ya se apoyaba el diseno.
      const fallidosReintentables: number[] = [];

      const procesarUpdate = async (
        update: { update_id: number } & Record<string, unknown>,
      ): Promise<void> => {
        const recibidoEn = Date.now();
        // El retraso de entrega es la metrica de la incidencia de Guardian:
        // mide desde que Telegram fecha el update hasta que nos llega.
        //
        // La fecha se saca del PAYLOAD, no de `update.date`, que no existe en
        // la Bot API — ver `fechaDeUpdate`. Mientras se leyo de la raiz, la
        // guarda no se cumplio nunca y el histograma se quedo vacio.
        const fechado = fechaDeUpdate(update);
        if (fechado !== undefined) {
          observarRetrasoDeEntrega(recibidoEn / 1000 - fechado);
        }
        try {
          await updates.processWebhook(env.TELEGRAM_BOT_USERNAME, update);
          intentosPorUpdate.delete(update.update_id);
          observarProcesoDeUpdate((Date.now() - recibidoEn) / 1000);
          botMetrics.increment('superbot_bot_polled_update_total{result="ok"}');
        } catch (error) {
          const intento = (intentosPorUpdate.get(update.update_id) ?? 0) + 1;
          intentosPorUpdate.set(update.update_id, intento);

          if (decidirTrasFallo(intento) === "reintentar") {
            fallidosReintentables.push(update.update_id);
            botMetrics.increment(
              'superbot_bot_polled_update_total{result="retry"}',
            );
            logger.error(
              {
                updateId: update.update_id,
                intento,
                de: MAX_INTENTOS_POR_UPDATE,
                msEnProceso: Date.now() - recibidoEn,
                error,
              },
              "update fallido: no se confirma el offset, Telegram lo reenviara",
            );
          } else {
            // Tope de reintentos. Sin el, un update que falla siempre —un
            // payload que revienta el normalizador, por ejemplo— congelaria el
            // offset y el bot dejaria de avanzar para todo el mundo. Se
            // descarta a proposito y se deja constancia ruidosa.
            intentosPorUpdate.delete(update.update_id);
            botMetrics.increment(
              'superbot_bot_polled_update_total{result="descartado"}',
            );
            logger.error(
              { updateId: update.update_id, intentos: intento, error },
              "update DESCARTADO tras agotar los reintentos: se pierde a proposito para no bloquear la cola",
            );
          }
        }
      };

      // Un carril por chat: dentro, orden estricto; entre carriles, paralelo
      // con tope. Ver `repartirEnCarriles`.
      const carriles = repartirEnCarriles(data.result);
      await ejecutarConLimite(
        carriles.map((carril) => async () => {
          for (const update of carril) {
            await procesarUpdate(update);
          }
        }),
        CARRILES_EN_PARALELO,
      );

      offset = calcularSiguienteOffset(
        offset,
        data.result.map((update) => update.update_id),
        fallidosReintentables,
      );
    } catch {
      // Network blip or Telegram hiccup: back off briefly and retry.
      await sleep(2000);
    }
  }
};
