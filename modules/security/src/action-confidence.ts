/**
 * Accion de moderacion sugerida con un nivel de confianza. Es logica pura:
 * recibe senales planas de un caso (warnings activos, severidad, historial de
 * reverts/confirms de decisiones pasadas) y devuelve una accion escalonada
 * (aviso -> mute -> ban), un porcentaje de confianza y variantes mas suave /
 * mas dura para ofrecer al moderador. Sin I/O, sin red, sin Date.now().
 */

/** Severidad declarada del caso, de menor a mayor. */
export type CaseSeverity = "leve" | "media" | "grave";

/** Accion de moderacion, ordenada de mas suave a mas dura. */
export type ModerationActionKind = "aviso" | "mute" | "ban";

/**
 * Senales planas de un caso concreto. `activeWarnings` son los avisos vigentes
 * del usuario; `severity` es la gravedad de la infraccion; `historyReverts` y
 * `historyConfirms` cuentan cuantas decisiones parecidas fueron revertidas o
 * confirmadas por humanos (calibran la confianza).
 */
export interface CaseSignalCtx {
  readonly activeWarnings: number;
  readonly severity: CaseSeverity;
  readonly historyReverts: number;
  readonly historyConfirms: number;
}

/** Sugerencia final: accion, confianza y alternativas adyacentes. */
export interface ModerationSuggestion {
  readonly action: ModerationActionKind;
  readonly confidencePct: number;
  readonly rationale: string;
  readonly softer: ModerationActionKind;
  readonly harder: ModerationActionKind;
}

/** Escalera de acciones, de mas suave (indice 0) a mas dura (indice 2). */
const ACTION_LADDER: readonly ModerationActionKind[] = ["aviso", "mute", "ban"];

/** Puntos base de severidad que empujan hacia acciones mas duras. */
const SEVERITY_SCORE: Readonly<Record<CaseSeverity, number>> = {
  leve: 0,
  media: 1,
  grave: 2,
};

/** Confianza base (%) antes de penalizar por reverts. */
export const CONFIDENCE_BASE_PCT = 60;

/** Cada revert historico resta este % de confianza. */
export const CONFIDENCE_REVERT_PENALTY_PCT = 12;

/** Cada confirm historico suma este % de confianza. */
export const CONFIDENCE_CONFIRM_BONUS_PCT = 8;

/** Suelo y techo de confianza para no salir de un rango honesto. */
export const CONFIDENCE_MIN_PCT = 5;
export const CONFIDENCE_MAX_PCT = 95;

/** Limita un numero al rango [min, max]. */
const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * Indice de accion (0..2) segun severidad + warnings. La severidad marca el
 * piso; cada dos warnings vigentes sube un peldano. `activeWarnings` negativo o
 * no entero se trata como 0 warnings efectivos. Pura y determinista.
 */
export const escalateActionIndex = (ctx: CaseSignalCtx): number => {
  const warnings = Math.max(0, Math.floor(ctx.activeWarnings));
  const fromWarnings = Math.floor(warnings / 2);
  const raw = SEVERITY_SCORE[ctx.severity] + fromWarnings;
  return clamp(raw, 0, ACTION_LADDER.length - 1);
};

/**
 * Confianza (%) de la sugerencia: parte de una base y se ajusta con el
 * historial. Muchos reverts la bajan (decisiones parecidas fallaron), los
 * confirms la suben. El resultado se acota a [CONFIDENCE_MIN_PCT,
 * CONFIDENCE_MAX_PCT] y se redondea. Conteos negativos se ignoran (cuentan 0).
 * Pura y determinista.
 */
export const computeActionConfidencePct = (ctx: CaseSignalCtx): number => {
  const reverts = Math.max(0, Math.floor(ctx.historyReverts));
  const confirms = Math.max(0, Math.floor(ctx.historyConfirms));
  const raw =
    CONFIDENCE_BASE_PCT -
    reverts * CONFIDENCE_REVERT_PENALTY_PCT +
    confirms * CONFIDENCE_CONFIRM_BONUS_PCT;
  return clamp(Math.round(raw), CONFIDENCE_MIN_PCT, CONFIDENCE_MAX_PCT);
};

/** Etiqueta legible de una severidad, para el rationale. */
const SEVERITY_LABEL: Readonly<Record<CaseSeverity, string>> = {
  leve: "leve",
  media: "media",
  grave: "grave",
};

/**
 * Sugiere una accion de moderacion escalonada con su confianza. La accion sale
 * de severidad + warnings; `softer`/`harder` son los peldanos adyacentes de la
 * escalera (saturan en los extremos, p.ej. si ya es "ban", `harder` sigue
 * siendo "ban"). El rationale resume las senales en espanol-neutro. Pura y
 * determinista: mismos ctx -> misma sugerencia.
 */
export const suggestModerationAction = (
  ctx: CaseSignalCtx,
): ModerationSuggestion => {
  const index = escalateActionIndex(ctx);
  const action = ACTION_LADDER[index] as ModerationActionKind;
  const softer = ACTION_LADDER[
    clamp(index - 1, 0, ACTION_LADDER.length - 1)
  ] as ModerationActionKind;
  const harder = ACTION_LADDER[
    clamp(index + 1, 0, ACTION_LADDER.length - 1)
  ] as ModerationActionKind;
  const confidencePct = computeActionConfidencePct(ctx);

  const warnings = Math.max(0, Math.floor(ctx.activeWarnings));
  const reverts = Math.max(0, Math.floor(ctx.historyReverts));
  const rationale =
    `Severidad ${SEVERITY_LABEL[ctx.severity]} con ${warnings} aviso(s) ` +
    `vigente(s): se sugiere ${action} (${confidencePct}% de confianza` +
    (reverts > 0 ? `, baja por ${reverts} revert(s) historico(s)` : "") +
    `).`;

  return { action, confidencePct, rationale, softer, harder };
};
