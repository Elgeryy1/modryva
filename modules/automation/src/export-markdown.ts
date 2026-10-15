/**
 * Exporta casos de moderacion y reglas a Markdown. Logica pura y
 * determinista: no lee reloj ni entorno; el instante de cada caso llega como
 * `ms` (epoch en milisegundos) y se formatea con `new Date(ms).toISOString()`.
 * Pensado para volcar auditorias reproducibles a un mensaje o fichero.
 */

/**
 * Un caso exportable. `ms` es el epoch (milisegundos) en que ocurrio la
 * accion; el modulo lo formatea como ISO-8601 UTC de forma determinista.
 */
export interface ExportCase {
  readonly id: string;
  readonly user: string;
  readonly action: string;
  readonly reason: string;
  readonly ms: number;
}

/** Cabeceras de la tabla, en orden de columna. */
export const EXPORT_CASE_HEADERS: readonly string[] = [
  "id",
  "user",
  "action",
  "reason",
  "when",
];

/**
 * Escapa el contenido de una celda de tabla Markdown: los pipes se escapan
 * como `\|` para no romper columnas y los saltos de linea se colapsan a un
 * espacio para mantener la fila en una sola linea.
 */
export const exportEscapeCell = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ");

/**
 * Formatea un epoch en milisegundos como ISO-8601 UTC. Determinista: no usa
 * el reloj del sistema. Un `ms` no finito produce la cadena vacia.
 */
export const exportFormatTimestamp = (ms: number): string => {
  if (!Number.isFinite(ms)) {
    return "";
  }
  return new Date(ms).toISOString();
};

const row = (cells: readonly string[]): string =>
  `| ${cells.map(exportEscapeCell).join(" | ")} |`;

/**
 * Renderiza los casos como una tabla Markdown con cabecera y separador. Con
 * un array vacio devuelve solo la cabecera y el separador (tabla sin filas).
 * Escapa pipes y saltos de linea en cada celda. Pura y determinista.
 */
export const casesToMarkdown = (cases: readonly ExportCase[]): string => {
  const header = row(EXPORT_CASE_HEADERS);
  const separator = `| ${EXPORT_CASE_HEADERS.map(() => "---").join(" | ")} |`;
  const body = cases.map((c) =>
    row([c.id, c.user, c.action, c.reason, exportFormatTimestamp(c.ms)]),
  );
  return [header, separator, ...body].join("\n");
};

/**
 * Renderiza las reglas como una lista numerada Markdown (`1. ...`). Con un
 * array vacio devuelve la cadena vacia. Escapa saltos de linea dentro de cada
 * regla para no romper la numeracion. Pura y determinista.
 */
export const rulesToMarkdown = (rules: readonly string[]): string =>
  rules
    .map((rule, index) => `${index + 1}. ${rule.replace(/[\r\n]+/g, " ")}`)
    .join("\n");
