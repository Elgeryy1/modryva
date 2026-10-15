/**
 * Los tres parseadores de argumentos de comando.
 *
 * Viven aqui y no en un modulo porque los usan varios, y un modulo no puede
 * importar a otro. Son genericos: no saben de sanciones ni de apelaciones, solo
 * de convertir lo que alguien escribio detras de una barra.
 *
 * El patron que sustituyen estaba escrito **decenas de veces** dentro del
 * `switch` de 124 casos de `/utility_plus`:
 *
 * ```
 * const n = Number.parseInt(args[0] ?? "", 10);
 * if (Number.isNaN(n)) return { text: "Uso: ..." };
 * ```
 *
 * Devolver `null` en vez de `NaN` es lo que cambia: `NaN` se propaga en
 * silencio si a alguien se le olvida el `isNaN`, y `null` no compila si no lo
 * miras.
 */

/** Un entero de la linea de comandos, o `null` si no lo es. */
export const enteroDelArgumento = (
  crudo: string | undefined,
): number | null => {
  if (crudo === undefined) return null;
  const n = Number.parseInt(crudo, 10);
  return Number.isNaN(n) ? null : n;
};

/** Un decimal de la linea de comandos, o `null` si no lo es. */
export const decimalDelArgumento = (
  crudo: string | undefined,
): number | null => {
  if (crudo === undefined) return null;
  const n = Number.parseFloat(crudo);
  return Number.isNaN(n) ? null : n;
};

/**
 * Un `si`/`no` de la linea de comandos, o `undefined` si no es ni una cosa ni
 * la otra.
 *
 * `undefined` y no `false`: quien no contesta no esta diciendo que no. Casi
 * todos los comandos que lo usan enseñan el uso cuando falta, y confundir las
 * dos cosas convertiria "se me olvido el argumento" en una respuesta valida.
 */
export const siONo = (crudo: string | undefined): boolean | undefined => {
  const normalizado = (crudo ?? "").toLowerCase();
  if (normalizado === "si") return true;
  if (normalizado === "no") return false;
  return undefined;
};

/**
 * Los tres primeros argumentos como enteros, o `null` si falta alguno o alguno
 * no lo es.
 *
 * Sustituye a `args.map((v) => Number.parseInt(v, 10))` seguido de comprobar
 * `undefined` **y** `NaN` por separado, que estaba escrito 13 veces. Las dos
 * comprobaciones hacian falta porque `args.map` sobre una lista corta deja
 * huecos `undefined`, y olvidarse de una deja pasar basura.
 *
 * Devuelve una **tupla** y no un array: asi quien llama desestructura sin
 * castear, que era la otra mitad del problema.
 */
export const tresEnteros = (
  args: readonly string[],
): readonly [number, number, number] | null => {
  const a = enteroDelArgumento(args[0]);
  const b = enteroDelArgumento(args[1]);
  const c = enteroDelArgumento(args[2]);
  return a === null || b === null || c === null ? null : [a, b, c];
};

/**
 * Parsea un argumento `"k1=v1,k2=v2"` a un registro numerico.
 *
 * Vivia como estatico privado en el nucleo y lo usaban dos casos del switch de
 * `/utility_plus`. Descarta los pares sin clave y los que no dan un numero, en
 * vez de meter un `NaN` en el registro: quien compara metricas prefiere que
 * falte una a que salga "NaN" en el informe.
 */
export const paresClaveValor = (
  valor: string | undefined,
): Record<string, number> => {
  const salida: Record<string, number> = {};
  for (const par of (valor ?? "").split(",")) {
    const [clave, crudo] = par.split("=");
    const numero = Number.parseFloat(crudo ?? "");
    if (clave?.trim() && !Number.isNaN(numero)) {
      salida[clave.trim()] = numero;
    }
  }
  return salida;
};

/**
 * Los cuatro primeros argumentos como enteros, o `null` si alguno no lo es.
 *
 * Devuelve tupla y no array por lo mismo que `tresEnteros`: con un array, quien
 * llama tiene que castear para desestructurar, y ese casteo era justo lo que
 * habia que quitar.
 */
export const cuatroEnteros = (
  args: readonly string[],
): readonly [number, number, number, number] | null => {
  const a = enteroDelArgumento(args[0]);
  const b = enteroDelArgumento(args[1]);
  const c = enteroDelArgumento(args[2]);
  const d = enteroDelArgumento(args[3]);
  return a === null || b === null || c === null || d === null
    ? null
    : [a, b, c, d];
};

/**
 * `true` si la cadena es una de las claves de la tabla, estrechando el tipo.
 *
 * La tabla se declara como `Record<Union, true>`, asi que **TypeScript exige
 * todas las claves de la union y rechaza las que sobren**. Es lo que separa
 * esto de un `new Set([...])` escrito a mano: el `Set` es una copia de la union
 * que se queda vieja en silencio, y despues hace falta un `as` para convencer
 * al compilador de algo que nadie ha comprobado.
 *
 * Usa `Object.hasOwn` y no `in` a proposito: con `in`, `"toString"` y
 * `"constructor"` pasarian la guarda por venir del prototipo.
 */
export const perteneceA = <T extends string>(
  tabla: Record<T, true>,
  valor: string | undefined,
): valor is T => valor !== undefined && Object.hasOwn(tabla, valor);

/** Las claves de una tabla separadas por `|`, para el mensaje de uso. */
export const opcionesDe = (tabla: Record<string, true>): string =>
  Object.keys(tabla).join("|");
