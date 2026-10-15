import type {
  AyudanteInvitacionRepository,
  EnlaceSincronizado,
} from "@superbot/data";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

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

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

/** A diferencia de `comoBigInt`, admite fraccion: la tarifa por uso no tiene por que ser un numero entero de monedas. */
const comoNumero = (valor: unknown, campo: string): number => {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim().length > 0) {
    const convertido = Number(valor);
    if (Number.isFinite(convertido)) return convertido;
  }
  throw new Error(`payload invalido: "${campo}" no es un numero valido`);
};

// ---------------------------------------------------------------------------
// 1. comunidad.sincronizar_invitaciones
// ---------------------------------------------------------------------------

export interface RepositoriosDeComunidad {
  readonly invitaciones: AyudanteInvitacionRepository;
}

export interface ResultadoSincronizarInvitaciones {
  readonly total: number;
}

/**
 * `comunidad.sincronizar_invitaciones`: pide al userbot los enlaces de
 * invitacion reales del grupo (`messages.getExportedChatInvites`, algo que un
 * bot no puede hacer sobre enlaces que no creo el mismo) y los deja tal cual
 * en el repositorio, que sobrescribe `usosTotal` en vez de sumarlo -- ver el
 * comentario de `AyudanteInvitacionRepository.sincronizar`.
 */
const sincronizarInvitaciones = (
  repos: RepositoriosDeComunidad,
): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoBigInt(datos.chatId, "chatId");

    const enlaces = await contexto.userbot.listarEnlacesInvitacion(chatId);
    const sincronizados: EnlaceSincronizado[] = enlaces.map((enlace) => ({
      enlaceId: enlace.enlaceId,
      creadorTelegramId: enlace.creadorTelegramId,
      usosTotal: enlace.usosTotal,
    }));

    await repos.invitaciones.sincronizar({
      tenantId,
      chatId: chatId.toString(),
      enlaces: sincronizados,
    });

    contexto.logger.info(
      { tenantId, chatId, total: sincronizados.length },
      "comunidad: invitaciones sincronizadas",
    );

    const resultado: ResultadoSincronizarInvitaciones = {
      total: sincronizados.length,
    };
    return resultado;
  };
};

// ---------------------------------------------------------------------------
// 2. calcularComision -- pura
// ---------------------------------------------------------------------------

/**
 * Comision de un reclutador: usos **sin liquidar** por tarifa, en la misma
 * moneda que el resto de la economia -- sin fraccion (`Math.floor`) y nunca
 * negativa (`Math.max(0, ...)`), la misma convencion que `rendimiento.ts` en
 * mascotas.
 *
 * El parametro es lo PENDIENTE, nunca `usosTotal`. Calcularlo sobre el
 * acumulado de por vida hacia que cada ejecucion del ranking volviera a pagar
 * todo lo ya pagado: un enlace con 40 usos y tarifa 10 devolvia 400 hoy y 420
 * mañana en vez de 20. Quien paga tiene que llamar despues a
 * `comunidad.liquidar_comision`, que es lo que mueve `usosLiquidados`.
 */
export const calcularComision = (
  usosPendientes: number,
  tarifaPorUso: number,
): number => Math.max(0, Math.floor(usosPendientes * tarifaPorUso));

// ---------------------------------------------------------------------------
// 3. comunidad.ranking_reclutadores
// ---------------------------------------------------------------------------

export interface EntradaRankingConComision {
  readonly creadorTelegramId: bigint;
  /** De por vida. Es lo que se enseña en el ranking. */
  readonly usosTotal: number;
  /** Sin liquidar. Es lo que se paga. */
  readonly usosPendientes: number;
  readonly comision: number;
}

/**
 * `comunidad.ranking_reclutadores`: envuelve
 * `AyudanteInvitacionRepository.rankingDeReclutadores` y le añade la
 * comision de cada fila. La tarifa la trae el payload -- no vive en el
 * repositorio -- porque puede variar por grupo o por campaña sin que eso
 * signifique reescribir el historial de usos ya sincronizado.
 */
const rankingReclutadores = (
  repos: RepositoriosDeComunidad,
): ManejadorDeSolicitud => {
  return async (payload) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoBigInt(datos.chatId, "chatId");
    const tarifaPorUso = comoNumero(datos.tarifaPorUso, "tarifaPorUso");

    const ranking = await repos.invitaciones.rankingDeReclutadores({
      tenantId,
      chatId: chatId.toString(),
    });

    const resultado: readonly EntradaRankingConComision[] = ranking.map(
      (entrada) => ({
        creadorTelegramId: entrada.creadorTelegramId,
        usosTotal: entrada.usosTotal,
        usosPendientes: entrada.usosPendientes,
        comision: calcularComision(entrada.usosPendientes, tarifaPorUso),
      }),
    );
    return resultado;
  };
};

// ---------------------------------------------------------------------------
// 4. comunidad.liquidar_comision
// ---------------------------------------------------------------------------

export interface ResultadoLiquidarComision {
  readonly usosLiquidados: number;
  readonly comision: number;
}

/**
 * `comunidad.liquidar_comision`: cierra la comision de UN reclutador, marcando
 * sus usos pendientes como liquidados y devolviendo lo que le toca cobrar.
 *
 * Separado del ranking a proposito. El ranking se consulta a menudo -- lo mira
 * cualquiera, se enseña en el grupo -- y no puede tener efecto; liquidar
 * cambia estado y se hace una vez. Mezclarlos era exactamente lo que hacia que
 * mirar el ranking dos veces pagara dos veces.
 *
 * Devuelve `usosLiquidados: 0` cuando no habia nada pendiente, y entonces la
 * comision es 0: repetir la llamada no paga otra vez.
 */
const liquidarComision = (
  repos: RepositoriosDeComunidad,
): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoBigInt(datos.chatId, "chatId");
    const creadorTelegramId = comoBigInt(
      datos.creadorTelegramId,
      "creadorTelegramId",
    );
    const tarifaPorUso = comoNumero(datos.tarifaPorUso, "tarifaPorUso");

    const { usosLiquidadosAhora } = await repos.invitaciones.liquidarPendientes(
      {
        tenantId,
        chatId: chatId.toString(),
        creadorTelegramId,
      },
    );

    const comision = calcularComision(usosLiquidadosAhora, tarifaPorUso);

    contexto.logger.info(
      {
        tenantId,
        chatId: chatId.toString(),
        creadorTelegramId: creadorTelegramId.toString(),
        usosLiquidados: usosLiquidadosAhora,
        comision,
      },
      "comunidad: comision liquidada",
    );

    const resultado: ResultadoLiquidarComision = {
      usosLiquidados: usosLiquidadosAhora,
      comision,
    };
    return resultado;
  };
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const manejadoresDeComunidad = (
  repos: RepositoriosDeComunidad,
): CatalogoDeManejadores => ({
  "comunidad.sincronizar_invitaciones": sincronizarInvitaciones(repos),
  "comunidad.ranking_reclutadores": rankingReclutadores(repos),
  "comunidad.liquidar_comision": liquidarComision(repos),
});
