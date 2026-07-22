/**
 * Lenguaje de plantillas unificado al estilo Rose/DaisyX para notas, filtros y
 * welcomes: botones inline en texto plano `[Texto](buttonurl://url)`, variables
 * `{clave}` y variantes aleatorias separadas por lineas `%%%`. Todo es puro y
 * determinista: las variantes se eligen por `seed`, nunca con `Math.random()`.
 */

/** Un boton inline: texto visible y url de destino. */
export interface TemplateButton {
  readonly text: string;
  readonly url: string;
}

/** Resultado de separar el texto de sus filas de botones. */
export interface ParsedTemplate {
  readonly text: string;
  readonly buttons: readonly (readonly TemplateButton[])[];
}

const buttonPattern = /\[([^\]]+)\]\(([^)]+)\)/gu;
const buttonUrlPrefix = "buttonurl://";
const sameSuffix = ":same";

/**
 * Extrae botones con sintaxis Rose `[Texto](buttonurl://https://ejemplo.com)`.
 * El sufijo `:same` en la url coloca el boton en la MISMA fila que el anterior.
 * Acepta la url con o sin el prefijo `buttonurl://`. Los botones se quitan del
 * texto devuelto (con `trim` final). Si no hay botones, `buttons` es `[]` y
 * `text` es `raw` recortado. El resto del markdown queda intacto.
 */
export const parseButtons = (raw: string): ParsedTemplate => {
  const rows: TemplateButton[][] = [];
  let hadButton = false;

  const text = raw
    .replace(buttonPattern, (match, label: string, target: string) => {
      let rest = target.trim();

      if (rest.startsWith(buttonUrlPrefix)) {
        rest = rest.slice(buttonUrlPrefix.length);
      }

      const sameRow = rest.endsWith(sameSuffix);

      if (sameRow) {
        rest = rest.slice(0, rest.length - sameSuffix.length);
      }

      const url = rest.trim();

      if (url.length === 0) {
        return match;
      }

      hadButton = true;
      const button: TemplateButton = { text: label.trim(), url };
      const lastRow = rows[rows.length - 1];

      if (sameRow && lastRow) {
        lastRow.push(button);
      } else {
        rows.push([button]);
      }

      return "";
    })
    .trim();

  return { text, buttons: hadButton ? rows : [] };
};

/**
 * Mezcla determinista de una cadena en un entero de 32 bits sin signo. Combina
 * el `seed` recibido con cada caracter (variante de djb2) para repartir bien.
 */
const hashString = (value: string, seed: number): number => {
  let hash = (seed >>> 0) ^ 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash ^ value.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
};

/**
 * Variantes separadas por una linea que sea exactamente `%%%`: elige UNA de
 * forma determinista a partir del `seed` (hash inline sobre el contenido) y
 * recorta sus espacios. Si no hay separador devuelve `raw` sin tocar.
 */
export const pickVariant = (raw: string, seed: number): string => {
  const variants = raw.split(/\r?\n%%%\r?\n/u);

  if (variants.length <= 1) {
    return raw;
  }

  const index = hashString(raw, seed) % variants.length;

  return (variants[index] ?? raw).trim();
};

const fillingPattern = /\{([a-z_]+)\}/gu;

/**
 * Sustituye `{clave}` por su valor. Las claves desconocidas se reemplazan por
 * cadena vacia para no filtrar tokens crudos. Solo se aceptan claves `[a-z_]`.
 */
export const renderFillings = (
  template: string,
  vars: Readonly<Record<string, string>>,
): string =>
  template.replace(fillingPattern, (_match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key] ?? "") : "",
  );

/**
 * Pipeline completo `pickVariant` -> `renderFillings` -> `parseButtons`.
 * Devuelve el `text` renderizado sin las lineas de botones y, SOLO si hay
 * botones, un `replyMarkup` `{ inline_keyboard: filas }`. Cuando no hay botones,
 * `replyMarkup` se omite mediante spread condicional.
 */
export const buildTemplateReply = (
  raw: string,
  vars: Readonly<Record<string, string>>,
  seed: number,
): { text: string; replyMarkup?: Record<string, unknown> } => {
  const chosen = pickVariant(raw, seed);
  const rendered = renderFillings(chosen, vars);
  const parsed = parseButtons(rendered);

  const inlineKeyboard = parsed.buttons.map((row) =>
    row.map((button) => ({ text: button.text, url: button.url })),
  );

  const replyMarkup: Record<string, unknown> = {
    inline_keyboard: inlineKeyboard,
  };

  return {
    text: parsed.text,
    ...(parsed.buttons.length > 0 ? { replyMarkup } : {}),
  };
};
