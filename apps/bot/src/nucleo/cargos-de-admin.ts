/**
 * Guardar y devolver el cargo de un administrador al que se sanciona.
 *
 * La decision —a quien se puede y a quien no— vive en
 * `modules/security/src/sanciones-a-admins.ts` y es pura. Aqui esta lo que un
 * modulo no puede tocar: preguntarle a Telegram, replicar los permisos y
 * decidir que se le cuenta a quien sanciono.
 *
 * Vive fuera de `bot-update.service.ts` a proposito. El nucleo esta en su tope
 * de lineas y este comportamiento es Telegram puro: dos llamadas a la Bot API y
 * la traduccion entre lo que devuelve una y lo que pide la otra.
 *
 * ## El orden importa, y no es negociable
 *
 * El cargo se lee ANTES de restringir y se guarda con la sancion. Si se leyera
 * despues, Telegram ya habria degradado a la persona y lo que se guardaria
 * seria el cargo vacio — o sea, el fallo del 6 de agosto de 2026 escrito a
 * mano y con mas pasos.
 */

import type { CargoGuardado } from "@superbot/data";
import {
  AVISO_DE_CARGO_DEVUELTO,
  AVISO_DE_CARGO_PERDIDO,
  cargoDelObjetivo,
  decidirSobreAdmin,
  type ModerationAction,
  textoAdminNoSancionable,
} from "@superbot/module-security";
import type { TelegramGateway } from "@superbot/telegram";

/** Lo poco del gateway que hace falta aqui, para poder doblarlo en un test. */
export type TelegramParaCargos = Pick<
  TelegramGateway,
  "getChatMember" | "promoteChatMember"
>;

export interface PeticionDeExamen {
  readonly telegram: TelegramParaCargos;
  readonly token: string | undefined;
  readonly chatId: bigint;
  readonly objetivo: bigint;
  readonly accion: ModerationAction;
  /** Como se le llama al objetivo en el mensaje. Lo resuelve el nucleo. */
  readonly quien: string;
}

/**
 * El resultado de mirar a quien se va a sancionar.
 *
 * `permitir: false` trae siempre su texto: una negativa muda se lee como que el
 * bot esta roto.
 */
export type Veredicto =
  | { readonly permitir: false; readonly texto: string }
  | { readonly permitir: true; readonly cargoGuardado?: CargoGuardado };

/**
 * Si la sancion puede seguir, y con que cargo hay que quedarse antes.
 *
 * Un fallo al preguntarle a Telegram **deja pasar**, que es la misma decision
 * que tomaba la guarda anterior y por el mismo motivo: tratar un error de red
 * como prueba de que alguien es admin convertiria cada corte en una moderacion
 * congelada, y eso pasaria en todos los casos. Lo que se pierde cuando falla es
 * el respaldo del cargo, no la sancion.
 */
export const examinarObjetivo = async ({
  telegram,
  token,
  chatId,
  objetivo,
  accion,
  quien,
}: PeticionDeExamen): Promise<Veredicto> => {
  const ficha = await telegram
    .getChatMember({ chatId, userId: objetivo, token })
    .catch(() => undefined);

  const cargo = cargoDelObjetivo(ficha?.status, ficha?.canBeEdited);
  const decision = decidirSobreAdmin(accion, cargo);

  if (!decision.permitir) {
    return {
      permitir: false,
      texto: textoAdminNoSancionable(accion, quien, decision.motivo),
    };
  }
  if (!decision.guardarCargo) {
    return { permitir: true };
  }

  // Aqui `cargo` es "adminPropio", asi que Telegram nos dio sus permisos. Si
  // llegaron vacios se guarda igual: `promoteChatMember` sin `rights` reparte
  // el juego historico de /promote, que es mejor que dejarle sin nada.
  return {
    permitir: true,
    cargoGuardado: {
      rights: ficha?.adminRights ?? {},
      ...(ficha?.customTitle ? { titulo: ficha.customTitle } : {}),
    },
  };
};

/**
 * El modo de la escalada de avisos, dicho en acciones de moderacion.
 *
 * `tban` y `tmute` son los mismos castigos con fecha de caducidad, y para saber
 * si degradan a un administrador la fecha da igual.
 */
export const accionDeEscalada = (
  mode: "ban" | "kick" | "mute" | "tban" | "tmute",
): ModerationAction => {
  if (mode === "kick") {
    return "kick";
  }
  return mode === "ban" || mode === "tban" ? "ban" : "mute";
};

/** Como fue el intento de devolver el cargo. */
export type ResultadoDeDevolucion = "nada" | "devuelto" | "perdido";

/**
 * Le devuelve a alguien el cargo que se le guardo, si se le guardo alguno.
 *
 * `nada` no es un fallo: es el caso normal, el de levantarle la mordaza a quien
 * nunca fue administrador.
 */
export const devolverCargo = async ({
  telegram,
  token,
  chatId,
  objetivo,
  cargo,
}: {
  readonly telegram: TelegramParaCargos;
  readonly token: string | undefined;
  readonly chatId: bigint;
  readonly objetivo: bigint;
  readonly cargo: CargoGuardado | null;
}): Promise<ResultadoDeDevolucion> => {
  if (!cargo) {
    return "nada";
  }
  const hecho = await telegram
    .promoteChatMember({
      chatId,
      userId: objetivo,
      customTitle: cargo.titulo,
      token,
      // Un objeto vacio haria que el gateway repartiera su juego por defecto,
      // que no es lo que esta persona tenia. Solo se pasan los permisos cuando
      // de verdad se guardo alguno.
      ...(Object.keys(cargo.rights).length > 0 ? { rights: cargo.rights } : {}),
    })
    .catch(() => undefined);

  return hecho?.ok ? "devuelto" : "perdido";
};

/**
 * La coletilla que se le añade al parte de una marcha atras.
 *
 * Vacia cuando no habia cargo que devolver, que es el caso normal. Lo que NUNCA
 * devuelve es cadena vacia habiendo fallado: quedarse sin cargo y sin aviso es
 * el 6 de agosto otra vez, solo que con mas pasos por medio.
 */
export const notaDeCargo = (resultado: ResultadoDeDevolucion): string =>
  resultado === "devuelto"
    ? `\n${AVISO_DE_CARGO_DEVUELTO}`
    : resultado === "perdido"
      ? `\n${AVISO_DE_CARGO_PERDIDO}`
      : "";
