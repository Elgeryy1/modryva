/**
 * Bienvenida personalizada por riesgo y procedencia del nuevo miembro. Logica
 * pura: recibe un contexto plano y devuelve el texto que vera el usuario en el
 * chat. Sin I/O, sin estado, sin aleatoriedad; el mismo contexto produce
 * siempre el mismo texto. El riesgo alto anade un recordatorio de reglas en
 * tono amable para no ahuyentar a quien acaba de llegar.
 */

/** Nivel de riesgo estimado del miembro que entra al grupo. */
export type WelcomeRisk = "bajo" | "medio" | "alto";

/**
 * Contexto plano para elegir la bienvenida. `source` es opcional (procedencia
 * del miembro, p. ej. un enlace de invitacion o una campana) y se omite cuando
 * no se conoce.
 */
export interface WelcomeContext {
  readonly isNew: boolean;
  readonly risk: WelcomeRisk;
  readonly source?: string;
}

/**
 * Saludo base para miembros nuevos, indexado por nivel de riesgo. No incluye el
 * recordatorio de reglas: este se anade aparte para el riesgo alto.
 */
export const WELCOME_VARIANTS: Record<WelcomeRisk, string> = {
  bajo: "¡Bienvenido/a al grupo! Nos alegra tenerte aquí, ponte cómodo/a y participa cuando quieras.",
  medio:
    "¡Hola y bienvenido/a! Échale un vistazo al grupo y pregúntanos lo que necesites.",
  alto: "¡Bienvenido/a! Nos alegra que te unas a la comunidad.",
};

/**
 * Saludo base para miembros que regresan, indexado por nivel de riesgo. Se usa
 * cuando `isNew` es false.
 */
export const WELCOME_RETURNING_VARIANTS: Record<WelcomeRisk, string> = {
  bajo: "¡Qué bueno verte de nuevo! Bienvenido/a otra vez.",
  medio: "¡Has vuelto! Nos alegra tenerte de vuelta por aquí.",
  alto: "¡Has vuelto! Nos alegra verte otra vez.",
};

/** Recordatorio de reglas en tono suave, para miembros de riesgo alto. */
export const WELCOME_RULES_REMINDER =
  "Como recordatorio amable, échale un ojo a las reglas del grupo para que la convivencia sea genial.";

/**
 * Construye la nota de procedencia a partir de `source`. Devuelve cadena vacia
 * cuando no hay procedencia (undefined o solo espacios). Pura y determinista.
 */
export const welcomeSourceNote = (source: string | undefined): string => {
  const trimmed = (source ?? "").trim();
  if (trimmed.length === 0) {
    return "";
  }
  return `Vemos que llegas desde ${trimmed}, ¡esperamos que te sientas como en casa!`;
};

/**
 * Elige la variante de bienvenida segun el contexto. Combina el saludo base
 * (nuevo o de regreso segun `isNew`, y por nivel de riesgo), una nota opcional
 * de procedencia y, para riesgo alto, el recordatorio de reglas suave. Une las
 * partes no vacias con un espacio. Pura y determinista.
 */
export const chooseWelcomeVariant = (ctx: WelcomeContext): string => {
  const base = ctx.isNew
    ? WELCOME_VARIANTS[ctx.risk]
    : WELCOME_RETURNING_VARIANTS[ctx.risk];

  const parts: string[] = [base];

  const note = welcomeSourceNote(ctx.source);
  if (note.length > 0) {
    parts.push(note);
  }

  if (ctx.risk === "alto") {
    parts.push(WELCOME_RULES_REMINDER);
  }

  return parts.join(" ");
};
