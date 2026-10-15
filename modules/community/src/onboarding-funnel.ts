/**
 * Embudo de onboarding de la comunidad: mide cuantos recien llegados avanzan
 * por cada etapa (se unen -> se verifican -> hablan por primera vez -> vuelven
 * un segundo dia). Logica pura: recibe conteos planos y devuelve ratios seguros
 * ante cero y un resumen de texto en espanol-neutro. Sin I/O ni estado.
 */

/**
 * Conteos absolutos de cada etapa del embudo. Cada etapa es un subconjunto de
 * la anterior en la practica, pero este modulo no lo asume ni lo exige: los
 * ratios se calculan siempre contra su etapa previa y se recortan a 0..1.
 */
export interface FunnelCounts {
  /** Personas que entraron al grupo en el periodo. */
  readonly joined: number;
  /** De las que entraron, cuantas superaron la verificacion/captcha. */
  readonly verified: number;
  /** De las verificadas, cuantas enviaron su primer mensaje. */
  readonly spoke: number;
  /** De las que hablaron, cuantas volvieron a participar otro dia. */
  readonly returned: number;
}

/**
 * Resultado del analisis del embudo: tres ratios en 0..1 y un texto listo para
 * mostrar. `verifyRate` = verified/joined, `speakRate` = spoke/verified,
 * `returnRate` = returned/spoke.
 */
export interface OnboardingFunnelResult {
  readonly verifyRate: number;
  readonly speakRate: number;
  readonly returnRate: number;
  readonly text: string;
}

/**
 * Divide de forma segura recortando el resultado a 0..1. Devuelve 0 cuando el
 * denominador no es positivo, cuando algun operando no es finito o cuando el
 * numerador no es positivo. Nunca lanza ni devuelve NaN/Infinity.
 */
const safeRate = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 0;
  }
  if (denominator <= 0 || numerator <= 0) {
    return 0;
  }
  const rate = numerator / denominator;
  return rate > 1 ? 1 : rate;
};

/** Formatea un ratio 0..1 como porcentaje entero sin decimales, p.ej. "72%". */
const asPercent = (rate: number): string => `${Math.round(rate * 100)}%`;

/**
 * Calcula el embudo de onboarding a partir de conteos planos. Puro y
 * determinista: mismas entradas producen exactamente la misma salida. Todos los
 * ratios estan garantizados en 0..1 aunque las etapas vengan vacias, negativas
 * o incoherentes (p.ej. verified > joined queda recortado a 1).
 */
export const computeOnboardingFunnel = (
  counts: FunnelCounts,
): OnboardingFunnelResult => {
  const verifyRate = safeRate(counts.verified, counts.joined);
  const speakRate = safeRate(counts.spoke, counts.verified);
  const returnRate = safeRate(counts.returned, counts.spoke);

  const text = [
    "Embudo de onboarding",
    `Entradas: ${Math.max(0, Math.trunc(counts.joined))}`,
    `Verificados: ${asPercent(verifyRate)}`,
    `Hablaron: ${asPercent(speakRate)}`,
    `Volvieron: ${asPercent(returnRate)}`,
  ].join("\n");

  return { verifyRate, speakRate, returnRate, text };
};
