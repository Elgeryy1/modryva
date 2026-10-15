import type {
  AyudanteAdminLogRepository,
  EventoAdminLog,
  EventoAdminLogParaStaff,
} from "@superbot/data";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";
import type { MensajeDeHistorial } from "../userbot-port.js";

// ---------------------------------------------------------------------------
// Lectura de payload -- la cola guarda JSON (`Json` en Prisma), asi que todo
// lo que llega a un manejador es `unknown` y hay que validarlo a mano antes
// de tocarlo. Mismo patron que `bloques/identidad.ts` y `bloques/censo.ts`.
// ---------------------------------------------------------------------------

const comoRegistro = (payload: unknown): Record<string, unknown> => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("payload invalido: se esperaba un objeto");
  }
  return payload as Record<string, unknown>;
};

const comoBigInt = (valor: unknown, campo: string): bigint => {
  if (typeof valor === "number" && Number.isInteger(valor)) {
    return BigInt(valor);
  }
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return BigInt(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

const comoEntero = (valor: unknown, campo: string): number => {
  if (typeof valor === "number" && Number.isInteger(valor)) return valor;
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return Number(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

const comoFecha = (valor: unknown, campo: string): Date => {
  const texto = comoTexto(valor, campo);
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`payload invalido: "${campo}" no es una fecha ISO valida`);
  }
  return fecha;
};

// ---------------------------------------------------------------------------
// 1. moderacion.sincronizar_admin_log
// ---------------------------------------------------------------------------

export interface RepositoriosDeModeracion {
  readonly adminLog: AyudanteAdminLogRepository;
}

export interface ResultadoSincronizarAdminLog {
  readonly nuevos: number;
}

/**
 * `moderacion.sincronizar_admin_log`: pide al userbot el tramo del registro
 * de administracion nativo (`channels.getAdminLog`, algo que la Bot API no
 * da) desde una fecha, y lo ingiere. `ingerir` es idempotente por
 * `telegramEventId` -- repetir el mismo tramo no duplica filas -- asi que
 * este manejador puede reintentarse sin cuidado especial.
 */
const sincronizarAdminLog = (
  repos: RepositoriosDeModeracion,
): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoBigInt(datos.chatId, "chatId");
    const desde = comoFecha(datos.desde, "desde");

    const eventosCrudos = await contexto.userbot.listarEventosAdminLog({
      chatId,
      desde,
    });
    const eventos: EventoAdminLog[] = eventosCrudos.map((evento) => ({
      telegramEventId: evento.telegramEventId,
      accion: evento.accion,
      actorTelegramId: evento.actorTelegramId,
      objetivoTelegramId: evento.objetivoTelegramId,
      detalle: evento.detalle,
      ocurrioEn: evento.ocurrioEn,
    }));

    const { nuevos } = await repos.adminLog.ingerir({
      tenantId,
      chatId: chatId.toString(),
      eventos,
    });

    contexto.logger.info(
      { tenantId, chatId, nuevos },
      "moderacion: admin log sincronizado",
    );

    const resultado: ResultadoSincronizarAdminLog = { nuevos };
    return resultado;
  };
};

// ---------------------------------------------------------------------------
// 2. vistaStaff -- pura, SIN actor. `EventoAdminLogParaStaff` ya no lleva el
// campo `actorTelegramId` en su tipo, asi que la frontera de privacidad la
// impone TypeScript, no solo la disciplina de quien escriba esta funcion.
// ---------------------------------------------------------------------------

export interface ResumenDeAccion {
  readonly accion: string;
  readonly total: number;
  readonly ultimaVezEn: Date;
}

export interface VistaStaffDeAdminLog {
  readonly total: number;
  /** De mas frecuente a menos -- lo primero que quiere ver un moderador. */
  readonly porAccion: readonly ResumenDeAccion[];
}

/**
 * Agrupa por `accion` y cuenta, sin decir nunca quien lo hizo -- eso es
 * exactamente lo que separa esta vista de `vistaParaPropietario`. Sirve al
 * staff un resumen ("3 expulsiones, 1 cambio de titulo") en vez de un listado
 * fila a fila que de todos modos no puede atribuir a nadie.
 */
export const vistaStaff = (
  eventos: readonly EventoAdminLogParaStaff[],
): VistaStaffDeAdminLog => {
  const porAccion = new Map<string, { total: number; ultimaVezEn: Date }>();
  for (const evento of eventos) {
    const previo = porAccion.get(evento.accion);
    const ultimaVezEn =
      previo && previo.ultimaVezEn > evento.ocurrioEn
        ? previo.ultimaVezEn
        : evento.ocurrioEn;
    porAccion.set(evento.accion, {
      total: (previo?.total ?? 0) + 1,
      ultimaVezEn,
    });
  }

  return {
    total: eventos.length,
    porAccion: [...porAccion.entries()]
      .map(([accion, datos]) => ({ accion, ...datos }))
      .sort((a, b) => b.total - a.total),
  };
};

// ---------------------------------------------------------------------------
// 3. vistaParaPropietario -- misma agregacion, pero CON actor.
// ---------------------------------------------------------------------------

export interface ResumenDeActor {
  readonly actorTelegramId: bigint;
  readonly total: number;
}

export interface VistaPropietarioDeAdminLog {
  readonly total: number;
  /** Fila a fila, sin resumir: el propietario audita eventos concretos, no solo un agregado. */
  readonly eventos: readonly EventoAdminLog[];
  /** De mas activo a menos -- quien esta moderando de verdad y quien no ha tocado nada. */
  readonly porActor: readonly ResumenDeActor[];
}

/**
 * La UNICA funcion de este bloque autorizada a mostrar quien hizo que.
 * `docs/PLAN-AYUDANTE.md` lo deja explicito: el actor de una accion de
 * administracion es del propietario y de nadie mas. Si alguna vez hace falta
 * enseñarselo a otra persona, es una decision nueva y una funcion nueva, con
 * nombre que lo diga -- no ampliar esta.
 */
export const vistaParaPropietario = (
  eventos: readonly EventoAdminLog[],
): VistaPropietarioDeAdminLog => {
  const porActor = new Map<string, number>();
  for (const evento of eventos) {
    const clave = evento.actorTelegramId.toString();
    porActor.set(clave, (porActor.get(clave) ?? 0) + 1);
  }

  return {
    total: eventos.length,
    eventos,
    porActor: [...porActor.entries()]
      .map(([clave, total]) => ({ actorTelegramId: BigInt(clave), total }))
      .sort((a, b) => b.total - a.total),
  };
};

// ---------------------------------------------------------------------------
// 4. distinguirBorradoPorAdmin -- pura, heuristica por ventana de tiempo.
// ---------------------------------------------------------------------------

/**
 * Ventana de correlacion entre un mensaje y un evento del admin log. Dos
 * minutos porque el admin log llega con el reloj del servidor de Telegram, y
 * es el margen que ya usa el resto del repo para "esto paso casi a la vez"
 * (mismo orden de magnitud que el timeout corto de `packages/telegram`).
 */
const VENTANA_DE_BORRADO_MS = 2 * 60 * 1000;

/**
 * Ninguna `accion` cruda trae un `messageId` fiable con el que casar un
 * borrado a un mensaje concreto -- el admin log de Telegram audita acciones,
 * no mensajes -- asi que la señal es por texto: cualquier accion cuyo nombre
 * mencione borrar o eliminar.
 */
const esAccionDeBorrado = (accion: string): boolean => {
  const normalizada = accion.toLowerCase();
  return normalizada.includes("borr") || normalizada.includes("delet");
};

/**
 * Heuristica, no certeza: si hay un evento de borrado en el admin log dentro
 * de +/- 2 minutos de la fecha del mensaje, se asume que lo borro un admin y
 * no el propio autor (que no deja rastro en el admin log). Puede dar falso
 * positivo si hay otro borrado ajeno en la misma ventana en un grupo muy
 * activo, y falso negativo si el admin log tarda en propagarse. `eventos` se
 * espera ya filtrado al mismo chat por quien llama -- `EventoAdminLogParaStaff`
 * no lleva `chatId` porque `listarParaStaff` ya lo filtra en el repositorio.
 */
export const distinguirBorradoPorAdmin = (
  mensaje: MensajeDeHistorial,
  eventos: readonly EventoAdminLogParaStaff[],
): boolean =>
  eventos.some(
    (evento) =>
      esAccionDeBorrado(evento.accion) &&
      Math.abs(evento.ocurrioEn.getTime() - mensaje.fecha.getTime()) <=
        VENTANA_DE_BORRADO_MS,
  );

// ---------------------------------------------------------------------------
// 5. moderacion.listar_reacciones / moderacion.listar_vistos -- envuelven el
// puerto tal cual, sin transformar el resultado.
// ---------------------------------------------------------------------------

const listarReacciones: ManejadorDeSolicitud = async (payload, contexto) => {
  const datos = comoRegistro(payload);
  const chatId = comoBigInt(datos.chatId, "chatId");
  const messageId = comoEntero(datos.messageId, "messageId");

  return contexto.userbot.listarReacciones({ chatId, messageId });
};

const listarVistos: ManejadorDeSolicitud = async (payload, contexto) => {
  const datos = comoRegistro(payload);
  const chatId = comoBigInt(datos.chatId, "chatId");
  const messageId = comoEntero(datos.messageId, "messageId");

  return contexto.userbot.listarVistos({ chatId, messageId });
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const manejadoresDeModeracion = (
  repos: RepositoriosDeModeracion,
): CatalogoDeManejadores => ({
  "moderacion.sincronizar_admin_log": sincronizarAdminLog(repos),
  "moderacion.listar_reacciones": listarReacciones,
  "moderacion.listar_vistos": listarVistos,
});
