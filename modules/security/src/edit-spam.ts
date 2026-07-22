/**
 * Detector de spam por edicion: un mensaje que llego limpio y luego se edita
 * para colar un link o una mencion (o para inflar el texto) es un patron
 * clasico de spammers que evaden el filtro de entrada. Aqui solo hay logica
 * pura de comparacion entre el estado previo y el posterior del mensaje; la
 * accion (borrar, avisar, sancionar) vive en el servicio.
 */

/** Foto del mensaje en un instante: senales planas ya extraidas por el caller. */
export interface EditSpamSnapshot {
  readonly hasUrl: boolean;
  readonly hasMention: boolean;
  readonly text: string;
}

/**
 * Motivo por el que una edicion se considera sospechosa. `added-url` y
 * `added-mention` mandan sobre `text-growth` cuando coinciden.
 */
export type EditSpamReason = "added-url" | "added-mention" | "text-growth";

/** Veredicto de la deteccion. `reason` solo aparece si `suspicious` es true. */
export type EditSpamVerdict =
  | { readonly suspicious: false }
  | { readonly suspicious: true; readonly reason: EditSpamReason };

/**
 * Umbral de crecimiento: el texto editado debe ser al menos EDIT_SPAM_GROWTH_FACTOR
 * veces mas largo que el original para disparar `text-growth`.
 */
export const EDIT_SPAM_GROWTH_FACTOR = 3;

/**
 * Longitud minima (en caracteres visibles) que debe tener el texto editado para
 * que el crecimiento cuente. Evita falsos positivos al pasar de "hi" a "holaa".
 */
export const EDIT_SPAM_MIN_GROWTH_LENGTH = 40;

/** Cuenta code points (no unidades UTF-16) para medir la longitud real. */
const codePointLength = (text: string): number => {
  let count = 0;
  for (const _ of text) {
    count += 1;
  }
  return count;
};

/**
 * Decide si la edicion de un mensaje es sospechosa comparando el antes y el
 * despues. Es sospechosa cuando tras editar aparece una url que no estaba,
 * aparece una mencion que no estaba, o el texto crece de forma desproporcionada
 * (>= EDIT_SPAM_GROWTH_FACTOR veces y por encima de EDIT_SPAM_MIN_GROWTH_LENGTH).
 * Prioridad: url > mencion > crecimiento. Pura y determinista.
 */
export const detectEditSpam = (
  before: EditSpamSnapshot,
  after: EditSpamSnapshot,
): EditSpamVerdict => {
  if (after.hasUrl && !before.hasUrl) {
    return { suspicious: true, reason: "added-url" };
  }

  if (after.hasMention && !before.hasMention) {
    return { suspicious: true, reason: "added-mention" };
  }

  const beforeLen = codePointLength(before.text);
  const afterLen = codePointLength(after.text);

  if (
    afterLen >= EDIT_SPAM_MIN_GROWTH_LENGTH &&
    afterLen >= beforeLen * EDIT_SPAM_GROWTH_FACTOR &&
    afterLen > beforeLen
  ) {
    return { suspicious: true, reason: "text-growth" };
  }

  return { suspicious: false };
};
