/**
 * Ponerle nombre al bicho.
 *
 * El campo `nombre` existia desde el primer dia y se LEE en tres sitios —la
 * ficha, el corral y la Mini App— pero **no lo escribia nadie**. Treinta y seis
 * mascotas en produccion y ninguna con nombre: todas se llamaban "Perro" o
 * "Gato", que es el nombre de su especie.
 *
 * Importa mas de lo que parece. Bautizar una cosa es lo que la convierte en
 * tuya, y en un tamagotchi es la mecanica de apego entera. Lo demas —el hambre,
 * el animo, la renta— son numeros; el nombre es lo unico que no lo es.
 *
 * ## Que se valida y por que
 *
 * El nombre entra en mensajes con formato HTML y en el corral de todo el grupo,
 * asi que hay tres cosas que no puede hacer:
 *
 * - **Romper el formato.** `<` y `&` los interpreta Telegram; sin filtrarlos,
 *   un nombre con un `<b>` deja el resto del mensaje en negrita o directamente
 *   rechazado por la Bot API.
 * - **Ocupar la pantalla.** El corral pone una mascota por linea; un nombre de
 *   doscientos caracteres deja el resto ilegible para los demas.
 * - **Suplantar.** Un nombre que empieza por `@` se lee como una mencion.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

/** Lo largo que puede ser. Cabe en una linea del corral y sobra. */
export const LARGO_MAXIMO_DE_NOMBRE = 24;

/** Lo corto. Uno es poco para un nombre y mucho para un despiste. */
export const LARGO_MINIMO_DE_NOMBRE = 2;

export type FalloAlNombrar =
  | "vacio"
  | "corto"
  | "largo"
  | "caracteres"
  | "mencion";

export type NombreValidado =
  | { readonly ok: true; readonly nombre: string }
  | { readonly ok: false; readonly motivo: FalloAlNombrar };

/**
 * Los caracteres que no pueden viajar dentro de un mensaje con formato.
 *
 * Se rechaza en vez de escapar a proposito: escapar dejaria a alguien con un
 * bicho llamado `&lt;b&gt;` sin entender por que. Decir que no se puede es mas
 * corto de explicar y no sorprende luego.
 */
const PROHIBIDOS = /[<>&"']/u;

/**
 * Valida y normaliza el nombre que alguien propone.
 *
 * Recorta los espacios de los extremos y colapsa los de dentro: "  Don   Pepe "
 * y "Don Pepe" son el mismo nombre, y guardar el primero haria que el corral
 * pareciera desalineado sin que nadie supiera por que.
 */
export const validarNombre = (bruto: string): NombreValidado => {
  const limpio = bruto.trim().replace(/\s+/gu, " ");
  if (limpio.length === 0) {
    return { ok: false, motivo: "vacio" };
  }
  if (limpio.startsWith("@")) {
    return { ok: false, motivo: "mencion" };
  }
  if (PROHIBIDOS.test(limpio)) {
    return { ok: false, motivo: "caracteres" };
  }
  // Se cuenta por puntos de codigo y no por unidades UTF-16: un nombre de seis
  // emojis son doce `.length` y sigue siendo corto en pantalla.
  const largo = [...limpio].length;
  if (largo < LARGO_MINIMO_DE_NOMBRE) {
    return { ok: false, motivo: "corto" };
  }
  if (largo > LARGO_MAXIMO_DE_NOMBRE) {
    return { ok: false, motivo: "largo" };
  }
  return { ok: true, nombre: limpio };
};

/** Lo que se le dice a quien propuso un nombre que no vale. */
export const textoDeFalloAlNombrar = (motivo: FalloAlNombrar): string => {
  switch (motivo) {
    case "vacio":
      return "Dime cómo quieres llamarlo: <code>/nombrar Pelusa</code>";
    case "corto":
      return `Al menos ${LARGO_MINIMO_DE_NOMBRE} letras.`;
    case "largo":
      return `Como mucho ${LARGO_MAXIMO_DE_NOMBRE} caracteres, que si no no cabe en el corral.`;
    case "mencion":
      return "El nombre no puede empezar por @: parecería que mencionas a alguien.";
    case "caracteres":
      return 'Sin < > & " ni comillas: rompen el formato del mensaje.';
  }
};
