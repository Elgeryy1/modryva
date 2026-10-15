/**
 * A quien el bot no toca NUNCA, decida lo que decida.
 *
 * Es distinto de la inmunidad que ya existe en `PROTECTED_TARGET_STATUSES`, y
 * la diferencia es el motivo de que esto exista: aquella cuelga del cargo
 * —`administrator` o `creator` en ESE grupo— y se cae en cuanto la persona no
 * lo es. Esta cuelga del id, asi que vale sin cargo, en cualquier grupo y en
 * los caminos automaticos, que son justo los tres huecos que dejaba la otra:
 *
 * - el `applyWarn` de la blocklist no pasa por la guarda de objetivo protegido,
 *   que solo esta en el camino del comando escrito a mano;
 * - Guardian reta a todo el que manda solicitud, sin lista de nadie;
 * - el barrido de presentacion salta a los admins mirando `getChatMember`, o
 *   sea que tambien depende del cargo.
 *
 * ## Por entorno, y nunca desde la base de datos
 *
 * La lista se lee de `SUPERBOT_INTOCABLES_TELEGRAM_IDS` y **no** hay forma de
 * tocarla desde la Mini App ni desde un comando. No es comodidad: el repo ya
 * separa `puedeModerar` de `puedeConfigurar` para que un admin nombrado por el
 * bot no pueda apagar al guardia que le vigila, y una lista de intocables
 * editable en caliente seria esa misma escalada por la puerta de al lado —
 * quien entrara al panel podria volverse inmune y luego hacer lo que quisiera.
 * Para cambiarla hay que entrar al servidor y reiniciar, que es el coste que
 * hace que la decision la tome una persona y quede en el despliegue.
 *
 * Y el precio, que hay que saberlo: a partir de aqui el bot no registra
 * sanciones de estas personas por ninguna via. No es que las oculte — es que
 * no llegan a existir.
 *
 * Puro: sin reloj, sin entrada/salida.
 */

import { ACTION_LABEL, type ModerationAction } from "./moderation-command.js";

/**
 * Si a `userId` no lo puede sancionar el bot.
 *
 * `undefined` responde `false` a proposito: un update sin autor no se parece a
 * nadie de la lista, y tratarlo como intocable convertiria cualquier hueco en
 * los datos en un agujero de moderacion.
 */
export const esIntocable = (
  userId: bigint | undefined,
  intocables: readonly bigint[],
): boolean =>
  userId !== undefined && intocables.some((suyo) => suyo === userId);

/**
 * Lo que se le contesta a quien intenta sancionar a un intocable.
 *
 * Se dice, no se calla. Un `/ban` que responde "hecho" sin banear es la mentira
 * que este repo persigue en todas partes —el mismo fallo que el "Aprobado" de
 * Guardian sobre una solicitud caducada—, y un silencio se lee como que el bot
 * esta roto. Conjuga con el mismo `ACTION_LABEL` que la negativa por
 * administrador, para que las dos suenen igual.
 */
export const textoIntocable = (
  accion: ModerationAction,
  objetivo: string,
): string =>
  `No puedo ${ACTION_LABEL[accion]} ${objetivo}: está en la lista de cuentas que no toco. ` +
  `Esa lista se cambia en el servidor, no desde aquí.`;
