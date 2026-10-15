import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

/**
 * Bloque de vinculacion: como entra el Ayudante en un grupo.
 *
 * El reparto de trabajo es asimetrico a proposito, porque Telegram obliga:
 * **un bot no puede añadir a nadie a un grupo** -- la Bot API no tiene
 * `addChatMember`. Asi que Modryva crea un enlace de un solo uso y lo encola
 * aqui; el ayudante se une el mismo. Despues, el bot ve la entrada como un
 * update normal (`new_chat_member`), revoca el enlace y promueve si toca.
 *
 * Ese ultimo paso no lo hace este bloque, y es deliberado: el ayudante NO se
 * concede permisos a si mismo. Quien reparte poder es el bot, que tiene la
 * auditoria y el `PermisosPort`. Si algun dia hiciera falta un metodo aqui que
 * pida ser admin, es señal de que algo se ha torcido.
 */

// ---------------------------------------------------------------------------
// Lectura de payload -- mismo patron que el resto de bloques.
// ---------------------------------------------------------------------------

const comoRegistro = (payload: unknown): Record<string, unknown> => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("payload invalido: se esperaba un objeto");
  }
  return payload as Record<string, unknown>;
};

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

// ---------------------------------------------------------------------------
// El hash de un enlace de invitacion -- pura
// ---------------------------------------------------------------------------

/**
 * Saca el hash de un enlace de invitacion de Telegram.
 *
 * Hay dos formas vivas y las dos se ven a diario: la moderna `t.me/+HASH` y la
 * vieja `t.me/joinchat/HASH`, ademas de `telegram.me` como dominio alterno.
 * Devuelve `null` si no es ninguna de ellas -- y eso incluye un enlace publico
 * tipo `t.me/migrupo`, que NO es una invitacion y no sirve para entrar por
 * `ImportChatInvite`.
 */
export const extraerHashDeInvitacion = (enlace: string): string | null => {
  const limpio = enlace.trim();
  const patron =
    /^(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/(?:joinchat\/|\+)([A-Za-z0-9_-]+)\/?$/u;
  const encontrado = patron.exec(limpio);
  return encontrado?.[1] ?? null;
};

// ---------------------------------------------------------------------------
// vinculacion.unirse_a_grupo
// ---------------------------------------------------------------------------

export interface ResultadoUnirseAGrupo {
  readonly ok: boolean;
  readonly yaDentro: boolean;
  readonly motivo: string | null;
}

/**
 * `vinculacion.unirse_a_grupo`: entra en el grupo con el enlace que Modryva
 * acaba de crear.
 *
 * Valida el enlace ANTES de llamar al userbot. Un enlace mal formado es un
 * error de quien encola, no algo que reintentar contra Telegram: lanzar aqui
 * gasta un intento y para; mandarselo a MTProto gasta cuota de una cuenta que
 * se banea por hacer cosas raras.
 */
const unirseAGrupo: ManejadorDeSolicitud = async (payload, contexto) => {
  const datos = comoRegistro(payload);
  const enlace = comoTexto(datos.enlace, "enlace");

  if (extraerHashDeInvitacion(enlace) === null) {
    throw new Error(
      "el enlace no es una invitacion de Telegram (t.me/+... o t.me/joinchat/...)",
    );
  }

  const resultado = await contexto.userbot.unirseConEnlace({ enlace });

  contexto.logger.info(
    { ok: resultado.ok, yaDentro: resultado.yaDentro },
    "vinculacion: intento de union a un grupo",
  );

  const salida: ResultadoUnirseAGrupo = resultado;
  return salida;
};

const comoBigInt = (valor: unknown, campo: string): bigint => {
  if (typeof valor === "number" && Number.isInteger(valor))
    return BigInt(valor);
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) return BigInt(valor);
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

/**
 * `vinculacion.salir_del_grupo`: el ayudante se va por su cuenta.
 *
 * Es como se deshace la vinculacion. Lo hace el ayudante y no el bot echandolo
 * porque expulsar exige permisos de moderacion sobre el, y darselos al bot
 * para esto seria abrir una puerta mucho mas grande que la que se cierra.
 */
const salirDelGrupo: ManejadorDeSolicitud = async (payload, contexto) => {
  const datos = comoRegistro(payload);
  const chatId = comoBigInt(datos.chatId, "chatId");

  const resultado = await contexto.userbot.salirDelGrupo(chatId);
  contexto.logger.info(
    { chatId: chatId.toString(), ok: resultado.ok },
    "vinculacion: salida del grupo",
  );
  return resultado;
};

export const manejadoresDeVinculacion: CatalogoDeManejadores = {
  "vinculacion.unirse_a_grupo": unirseAGrupo,
  "vinculacion.salir_del_grupo": salirDelGrupo,
};
