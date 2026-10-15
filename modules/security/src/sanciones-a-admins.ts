/**
 * Sancionar a un administrador sin quitarle el cargo por el camino.
 *
 * Hasta ahora un admin era simplemente insancionable: `PROTECTED_TARGET_STATUSES`
 * rechazaba cualquier `/ban`, `/mute` o `/kick` sobre el. No era pereza, era una
 * cicatriz — el 6 de agosto de 2026 tres `/mute` a admins nombrados por el bot
 * los degradaron en silencio, y el `/unmute` les quito la mordaza pero **no** el
 * cargo perdido. La negativa era la unica forma segura que habia.
 *
 * Lo que cambia: la negativa deja de ser para todos y pasa a depender de una
 * pregunta que antes no se hacia, `can_be_edited`.
 *
 * ## Por que hay dos clases de administrador
 *
 * Telegram solo deja a un bot tocar a los admins que **el mismo** nombro. Eso
 * parte a los administradores en dos grupos que no se parecen en nada:
 *
 * - **Propio** (`can_be_edited: true`): el bot puede restringirle. Al hacerlo
 *   Telegram le quita el cargo, asi que hay que guardarlo antes y devolverselo
 *   al levantar la mordaza. Es posible, pero solo si alguien se acuerda.
 * - **Ajeno** (`can_be_edited: false`): lo nombro una persona. Telegram va a
 *   rechazar la llamada, y tampoco deja degradarle primero. **Esto no se puede
 *   arreglar desde aqui**, ni se podra: es una regla de Telegram, no una
 *   limitacion de este bot. Lo unico honrado es decirlo.
 *
 * Y el creador del grupo no lo toca nadie nunca, ni siquiera otro creador.
 *
 * ## Lo que NO decide este fichero
 *
 * Los intocables de `SUPERBOT_INTOCABLES_TELEGRAM_IDS` se miran ANTES y ganan
 * siempre — ver `intocables.ts`. Aquella lista cuelga del id y esta del cargo,
 * y mezclarlas haria que perder el cargo te quitara la inmunidad, que es justo
 * lo que aquella existe para evitar.
 *
 * Puro: sin reloj, sin entrada/salida, sin Telegram.
 */

import { ACTION_LABEL, type ModerationAction } from "./moderation-command.js";

/**
 * Que es el objetivo para el bot, ya traducido de lo que contesta Telegram.
 *
 * `nadie` no quiere decir "don nadie": quiere decir que no tiene cargo, que es
 * el caso normal y el unico en el que no hay nada que proteger.
 */
export type CargoDelObjetivo =
  | "nadie"
  | "adminPropio"
  | "adminAjeno"
  | "creador";

/** Por que no se puede, cuando no se puede. */
export type MotivoDeNegativa = "creador" | "adminAjeno";

export type DecisionSobreAdmin =
  | { readonly permitir: true; readonly guardarCargo: boolean }
  | { readonly permitir: false; readonly motivo: MotivoDeNegativa };

/**
 * Las acciones que pasan por Telegram y por tanto arrancan el cargo.
 *
 * `warn` no esta porque no llama a Telegram: es un contador en nuestra base de
 * datos y no puede degradar a nadie. `unban` y `unmute` tampoco: son la marcha
 * atras, y son justo el momento en que el cargo se devuelve.
 */
export const ACCIONES_QUE_DEGRADAN: ReadonlySet<ModerationAction> = new Set([
  "ban",
  "mute",
  "kick",
]);

/**
 * Traduce lo que contesta `getChatMember` a las cuatro formas que importan.
 *
 * `canBeEdited` llega en tres estados y el `undefined` se trata como **ajeno**,
 * o sea como el caso que no se toca. Es deliberado: si Telegram no ha dicho que
 * podemos editarle, dar por hecho que si es exactamente como se degrada a
 * alguien sin querer, que es lo que este fichero existe para no repetir.
 */
export const cargoDelObjetivo = (
  status: string | undefined,
  canBeEdited: boolean | undefined,
): CargoDelObjetivo => {
  if (status === "creator") {
    return "creador";
  }
  if (status !== "administrator") {
    return "nadie";
  }
  return canBeEdited === true ? "adminPropio" : "adminAjeno";
};

/**
 * Si la accion sigue adelante, y si hay que guardar el cargo antes.
 *
 * `guardarCargo` solo sale a `true` cuando de verdad se va a perder algo: un
 * admin propio y una accion que degrada. Guardarlo de mas no seria grave, pero
 * escribiria un cargo viejo encima del bueno la proxima vez.
 */
export const decidirSobreAdmin = (
  accion: ModerationAction,
  cargo: CargoDelObjetivo,
): DecisionSobreAdmin => {
  if (cargo === "creador") {
    return { permitir: false, motivo: "creador" };
  }
  if (cargo === "nadie") {
    return { permitir: true, guardarCargo: false };
  }
  if (!ACCIONES_QUE_DEGRADAN.has(accion)) {
    // Avisar a un admin, o levantarle una mordaza, no le quita nada.
    return { permitir: true, guardarCargo: false };
  }
  if (cargo === "adminAjeno") {
    return { permitir: false, motivo: "adminAjeno" };
  }
  return { permitir: true, guardarCargo: true };
};

/**
 * Lo que se le contesta a quien pide algo que no se puede hacer.
 *
 * Dice el porque y, cuando la hay, la salida. Un "no puedo" a secas se lee como
 * que el bot esta roto, y este repo persigue esa mentira en todas partes.
 * Conjuga con el mismo `ACTION_LABEL` que las otras dos negativas para que las
 * tres suenen igual.
 */
export const textoAdminNoSancionable = (
  accion: ModerationAction,
  quien: string,
  motivo: MotivoDeNegativa,
): string =>
  motivo === "creador"
    ? `No puedo ${ACTION_LABEL[accion]} ${quien}: es quien creó el grupo.`
    : [
        `🛡️ No puedo ${ACTION_LABEL[accion]} ${quien}: le dio el cargo una persona, no yo.`,
        "",
        "Telegram solo me deja tocar a los administradores que nombré yo, así que esta llamada la rechazaría él, no yo.",
        "Quítale el cargo en los ajustes del grupo y vuelve a intentarlo.",
      ].join("\n");

/**
 * El aviso que acompaña a una mordaza sobre un admin propio.
 *
 * Se dice en el momento, y no al levantarla, porque el que sanciona tiene que
 * saber que el cargo esta en el aire ANTES de irse a dormir: si el bot se cae
 * con la mordaza puesta, devolverlo a mano es su problema y quiere enterarse
 * ahora, no dentro de tres dias.
 */
export const AVISO_DE_CARGO_GUARDADO =
  "ℹ️ Es administrador, así que le he guardado el cargo y se lo devolveré al levantarle la sanción.";

/** Lo que se dice cuando el cargo vuelve a su sitio. */
export const AVISO_DE_CARGO_DEVUELTO = "ℹ️ Le he devuelto el cargo.";

/**
 * Lo que se dice cuando el cargo NO se ha podido devolver.
 *
 * Existe porque el silencio aqui es el peor de los tres: la persona se queda
 * sin cargo y sin que nadie lo sepa, que es exactamente el fallo del 6 de
 * agosto repetido con mas pasos.
 */
export const AVISO_DE_CARGO_PERDIDO =
  "⚠️ No he podido devolverle el cargo. Habrá que dárselo a mano.";
