import { decimalDelArgumento, enteroDelArgumento } from "@superbot/shared";

import { classifyActionSafety } from "../../action-safety.js";
import { assessProportionality } from "../../proportionality.js";
import { adjustSanction } from "../../sanction-adjust.js";
import { computeSanctionDurationMs } from "../../sanction-duration.js";
import { classifySeverityColor } from "../../severity-color.js";

/**
 * Las calculadoras de sanción de `/utility_plus`.
 *
 * Son cinco de los 124 casos de un `switch` de 2.101 lineas. Todas tienen la
 * misma forma —parsear los argumentos, rendirse con el uso si no encajan,
 * calcular y dar formato— y esa forma estaba escrita 124 veces.
 *
 * Ninguna toca la base ni Telegram: **114 de los 124 casos son puros**, y por
 * eso mover esto no es una extraccion profunda sino una mudanza. Lo unico que
 * entra de fuera es el reloj, y solo donde hace falta.
 */

/** `/rango_accion`: como de grave y de reversible es una accion. */
export const calculadoraDeRangoDeAccion = (args: readonly string[]): string => {
  const accion = args.join(" ").trim();
  if (!accion) {
    return "Uso: /rango_accion <acción> (ej. ban, mute, warn)";
  }

  const v = classifyActionSafety(accion);
  const emoji =
    v.level === "rojo" ? "🔴" : v.level === "amarillo" ? "🟡" : "🟢";

  return `${emoji} ${v.level} · ${v.reversible ? "reversible" : "irreversible"}`;
};

/**
 * `/sancion_duracion`: cuanto deberia durar una sanción.
 *
 * La hora entra por parametro. El nucleo la sacaba de `new Date().getHours()`,
 * que ademas es hora LOCAL del contenedor —y el contenedor va en UTC porque
 * no se le pone `TZ`—, asi que ni siquiera era la hora del grupo. Ver C-24.
 */
export const calculadoraDeDuracionDeSancion = (
  args: readonly string[],
  horaDelDia: number,
): string => {
  const gravedad = enteroDelArgumento(args[0]);
  const reincidencia = enteroDelArgumento(args[1]);
  if (gravedad === null || reincidencia === null) {
    return "Uso: /sancion_duracion <gravedad 1-5> <reincidencia 0+>";
  }

  return `⏱️ ${computeSanctionDurationMs({ gravity: gravedad, recidivism: reincidencia, hourOfDay: horaDelDia }).label}`;
};

/** Los cuatro escalones de sanción que se pueden ajustar. */
const ESCALONES = ["aviso", "silencio", "expulsion", "ban"] as const;
type Escalon = (typeof ESCALONES)[number];

const esEscalon = (v: string | undefined): v is Escalon =>
  v !== undefined && (ESCALONES as readonly string[]).includes(v);

const esDireccion = (v: string | undefined): v is "suavizar" | "endurecer" =>
  v === "suavizar" || v === "endurecer";

/**
 * `/sancion_ajustar`: subir o bajar un escalon.
 *
 * Las dos comprobaciones son guardas de tipo y no `Set.has` seguido de un
 * cast: el nucleo hacia `current as Sanction`, que compila igual pero deja de
 * protegerte el dia que alguien anada un escalon a la union y se olvide del
 * `Set`.
 */
export const calculadoraDeAjusteDeSancion = (
  args: readonly string[],
): string => {
  const [actual, direccion] = args;
  if (!esEscalon(actual) || !esDireccion(direccion)) {
    return "Uso: /sancion_ajustar <aviso|silencio|expulsion|ban> <suavizar|endurecer>";
  }

  return adjustSanction(actual, direccion).message;
};

/** `/proporcionalidad`: si la sanción encaja con lo que paso. */
export const calculadoraDeProporcionalidad = (
  args: readonly string[],
): string => {
  const nivel = enteroDelArgumento(args[0]);
  const gravedad = enteroDelArgumento(args[1]);
  const reincidencia = enteroDelArgumento(args[2]);
  if (nivel === null || gravedad === null || reincidencia === null) {
    return "Uso: /proporcionalidad <sanción 0-5> <gravedad 0-5> <reincidencia 0+>";
  }

  return `⚖️ ${assessProportionality({ sanctionLevel: nivel, gravity: gravedad, recidivism: reincidencia }).summary}`;
};

/** `/color_severidad`: el semaforo de una puntuacion. */
export const calculadoraDeColorDeSeveridad = (
  args: readonly string[],
): string => {
  const puntuacion = decimalDelArgumento(args[0]);
  if (puntuacion === null) {
    return "Uso: /color_severidad <score>";
  }

  const c = classifySeverityColor(puntuacion);
  return `${c.color}: ${c.action}`;
};
