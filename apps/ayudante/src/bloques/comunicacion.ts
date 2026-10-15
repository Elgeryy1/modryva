import type {
  AyudanteAvisoPrivadoRepository,
  EstadoAvisoPrivado,
} from "@superbot/data";
import { enviarAvisoPrivado } from "../avisos.js";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";
import type { SegmentoDeMensaje } from "../userbot-port.js";

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

// ---------------------------------------------------------------------------
// 1. comunicacion.mencion_real
// ---------------------------------------------------------------------------

export type ResultadoMencionReal =
  | {
      readonly ok: true;
      readonly accessHash: string;
      readonly textoAlrededor: string;
    }
  | { readonly ok: false; readonly motivo: string };

/**
 * `comunicacion.mencion_real`: resuelve a alguien para poder mencionarlo de
 * verdad aunque no tenga `@username` -- la peticion mas pedida de todo
 * `docs/PLAN-AYUDANTE.md`. Sin `accessHash` no hay mencion posible ni para
 * el userbot, asi que no es un fallo del manejador: es un resultado valido
 * que quien encolo la solicitud tiene que saber manejar (typicamente
 * cayendo a mencionar solo por nombre, sin enlace a la cuenta).
 */
const mencionReal: ManejadorDeSolicitud = async (payload, contexto) => {
  const datos = comoRegistro(payload);
  const chatId = comoBigInt(datos.chatId, "chatId");
  const userTelegramId = comoBigInt(datos.userTelegramId, "userTelegramId");
  const textoAlrededor = comoTexto(datos.textoAlrededor, "textoAlrededor");

  const resuelto = await contexto.userbot.resolverParaMencion({
    chatId,
    userTelegramId,
  });

  if (resuelto === null) {
    const resultado: ResultadoMencionReal = {
      ok: false,
      motivo: "sin acceso a esa persona",
    };
    return resultado;
  }

  const resultado: ResultadoMencionReal = {
    ok: true,
    accessHash: resuelto.accessHash,
    textoAlrededor,
  };
  return resultado;
};

// ---------------------------------------------------------------------------
// comunicacion.publicar_con_menciones -- la razon de ser del Ayudante
// ---------------------------------------------------------------------------

/**
 * El marcador que deja quien compone el mensaje: `{{MENCION:123456}}`.
 *
 * Se eligio un marcador y no un enlace ya montado porque el que compone
 * (`bloques/mascotas.ts`, el worker...) no puede saber ni el nombre actual de
 * la persona ni su `access_hash`. Deja la marca y sigue; resolverla es trabajo
 * del ayudante, que es el unico que puede.
 */
const MARCADOR = /\{\{MENCION:(-?\d+)\}\}/gu;

/**
 * Parte un texto con marcadores en trozos de texto y menciones.
 *
 * Pura: aqui se decide DONDE va cada mencion, y eso se prueba sin red. Montar
 * las entidades con sus offsets necesita a Telegram y vive en el adaptador.
 *
 * Un marcador con un id que no es un numero no se toca: se queda como texto,
 * porque romper el mensaje entero por una marca mal escrita es peor que
 * enseñarla.
 */
export const partirPorMenciones = (
  texto: string,
): readonly SegmentoDeMensaje[] => {
  const segmentos: SegmentoDeMensaje[] = [];
  let ultimo = 0;

  MARCADOR.lastIndex = 0;
  let encontrado = MARCADOR.exec(texto);
  while (encontrado !== null) {
    if (encontrado.index > ultimo) {
      segmentos.push({
        tipo: "texto",
        valor: texto.slice(ultimo, encontrado.index),
      });
    }
    segmentos.push({
      tipo: "mencion",
      userTelegramId: BigInt(encontrado[1] ?? "0"),
    });
    ultimo = encontrado.index + encontrado[0].length;
    encontrado = MARCADOR.exec(texto);
  }

  if (ultimo < texto.length) {
    segmentos.push({ tipo: "texto", valor: texto.slice(ultimo) });
  }
  return segmentos;
};

/**
 * Quita las etiquetas HTML del texto.
 *
 * Un mensaje con menciones reales va con las entidades puestas a mano, y ahi
 * `parse_mode` no interviene: si el texto trae `<b>`, Telegram lo enseña tal
 * cual. Casi todo el copy del bot esta escrito en HTML porque asi es como lo
 * manda la Bot API, asi que quien reutilice ese copy aqui lo traeria con
 * etiquetas sin darse cuenta.
 *
 * Se quitan en vez de rechazar el mensaje: perder la negrita es mucho menos
 * malo que no avisar, y el enlace de la mencion —que es a lo que se viene— se
 * conserva entero. Las entidades de `<b>` se podran calcular el dia que haga
 * falta; hoy no compensa un parser por una negrita.
 */
export const sinHtml = (texto: string): string =>
  texto
    .replace(/<\/?(?:b|strong|i|em|u|s|code|pre|a)(?:\s[^>]*)?>/giu, "")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");

export interface ResultadoPublicarConMenciones {
  readonly ok: boolean;
  readonly mencionesResueltas: number;
  readonly mencionesPedidas: number;
}

/**
 * `comunicacion.publicar_con_menciones`: publica en el grupo enlazando de
 * verdad a quien no tiene `@alias`.
 *
 * Sin texto no se publica nada: un mensaje vacio en el grupo es peor que no
 * mandarlo.
 */
const publicarConMenciones: ManejadorDeSolicitud = async (
  payload,
  contexto,
) => {
  const datos = comoRegistro(payload);
  const chatId = comoBigInt(datos.chatId, "chatId");
  const texto = comoTexto(datos.texto, "texto");

  const segmentos = partirPorMenciones(sinHtml(texto));
  const pedidas = segmentos.filter((s) => s.tipo === "mencion").length;

  const salida = await contexto.userbot.publicarConMenciones({
    chatId,
    segmentos,
  });

  contexto.logger.info(
    {
      chatId: chatId.toString(),
      pedidas,
      resueltas: salida.mencionesResueltas,
    },
    "comunicacion: publicado con menciones",
  );

  const resultado: ResultadoPublicarConMenciones = {
    ok: salida.ok,
    mencionesResueltas: salida.mencionesResueltas,
    mencionesPedidas: pedidas,
  };
  return resultado;
};

// ---------------------------------------------------------------------------
// 2 y 3. comunicacion.aviso_privado
// ---------------------------------------------------------------------------

export interface RepositoriosDeComunicacion {
  readonly avisos: AyudanteAvisoPrivadoRepository;
}

export type ResultadoAvisoPrivado =
  | { readonly ok: true; readonly yaAvisado: true }
  | {
      readonly ok: true;
      readonly yaAvisado: false;
      readonly estado: EstadoAvisoPrivado;
    };

/**
 * `comunicacion.aviso_privado`: delega entero en `enviarAvisoPrivado`
 * (`../avisos.ts`), que es el unico camino por el que el Ayudante manda un
 * privado. Este bloque solo traduce el payload y da forma al resultado.
 */
const avisoPrivado = (
  repos: RepositoriosDeComunicacion,
): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const destinatarioTelegramId = comoBigInt(
      datos.destinatarioTelegramId,
      "destinatarioTelegramId",
    );
    const tipo = comoTexto(datos.tipo, "tipo");
    const texto = comoTexto(datos.texto, "texto");

    const salida = await enviarAvisoPrivado(repos.avisos, contexto.userbot, {
      tenantId,
      destinatarioTelegramId,
      tipo,
      texto,
    });

    if (salida.yaAvisado || salida.envio === null) {
      const resultado: ResultadoAvisoPrivado = { ok: true, yaAvisado: true };
      return resultado;
    }

    contexto.logger.info(
      {
        tenantId,
        destinatarioTelegramId: destinatarioTelegramId.toString(),
        tipo,
        estado: salida.envio.estado,
      },
      "comunicacion: aviso privado despachado",
    );

    const resultado: ResultadoAvisoPrivado = {
      ok: true,
      yaAvisado: false,
      estado: salida.envio.estado,
    };
    return resultado;
  };
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const manejadoresDeComunicacion = (
  repos: RepositoriosDeComunicacion,
): CatalogoDeManejadores => ({
  "comunicacion.mencion_real": mencionReal,
  "comunicacion.publicar_con_menciones": publicarConMenciones,
  "comunicacion.aviso_privado": avisoPrivado(repos),
});

// ---------------------------------------------------------------------------
// 4. Recordatorios de plazo -- puras, sin repositorio ni userbot. Deciden SI
// toca avisar; encolar el `comunicacion.aviso_privado` correspondiente (con
// su propio `tipo`, para que `yaSeAviso` no lo repita) es trabajo de quien
// las llame -- un barrido periodico que hoy no existe todavia.
// ---------------------------------------------------------------------------

const MS_POR_HORA = 1000 * 60 * 60;

/** Horas hasta `plazo`, nunca negativas -- un plazo ya cumplido no "falta" horas, ha pasado. */
const horasHasta = (plazo: Date, ahora: Date): number =>
  Math.max(0, (plazo.getTime() - ahora.getTime()) / MS_POR_HORA);

/**
 * A cuantas horas del plazo se manda el recordatorio de verificacion
 * pendiente. Una sola ventana: es el unico aviso de este tipo, a diferencia
 * de una sancion que expira, que avisa dos veces (ver mas abajo).
 */
const HORAS_ANTES_RECORDAR_VERIFICACION = 6;

/**
 * Pura: dado el plazo de verificacion y "ahora", dice si toca mandar el
 * recordatorio. `false` tanto antes de entrar en la ventana como despues de
 * que el plazo ya haya pasado -- pasado el plazo lo que toca ya no es
 * recordar, es la consecuencia de no haber verificado.
 */
export const programarRecordatorioVerificacion = (
  plazo: Date,
  ahora: Date,
): boolean =>
  ahora.getTime() < plazo.getTime() &&
  horasHasta(plazo, ahora) <= HORAS_ANTES_RECORDAR_VERIFICACION;

export interface AvisoSancionExpira {
  readonly debeAvisar: boolean;
  readonly horasRestantes: number;
}

/** A cuantas horas de que expire la sancion se manda el aviso. */
const HORAS_ANTES_AVISAR_SANCION_EXPIRA = 3;

/**
 * Pura: dado el plazo en que expira una sancion y "ahora", dice si toca
 * avisar y cuantas horas quedan -- para poder escribirlas en el mensaje
 * ("tu sancion termina en 2 horas"). Igual que arriba, pasado el plazo
 * `debeAvisar` es `false`: ya no esta "a punto de expirar", ha expirado.
 */
export const programarAvisoSancionExpira = (
  plazo: Date,
  ahora: Date,
): AvisoSancionExpira => {
  const horasRestantes = horasHasta(plazo, ahora);
  const debeAvisar =
    ahora.getTime() < plazo.getTime() &&
    horasRestantes <= HORAS_ANTES_AVISAR_SANCION_EXPIRA;
  return { debeAvisar, horasRestantes };
};
