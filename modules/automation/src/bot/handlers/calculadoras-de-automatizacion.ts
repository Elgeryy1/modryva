import { decimalDelArgumento } from "@superbot/shared";

import { checkRuleCooldown } from "../../rule-cooldown.js";

/**
 * Las calculadoras puras de `/utility_plus` que consumen `modules/automation`.
 *
 * De momento una. Los otros ocho casos de automatización del switch **no
 * caben aquí todavía**: leen y escriben ajustes del chat, así que sacarlos no
 * es una mudanza sino una extracción profunda con su puerto de datos, y eso va
 * en su propio cambio.
 */

/** `/cooldown_regla`: si una regla automática ya puede volver a dispararse. */
export const calculadoraDeCooldownDeRegla = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const segundos = decimalDelArgumento(args[0]);
  if (segundos === null) {
    return "Uso: /cooldown_regla <segundos_desde_ultimo_disparo>";
  }

  const v = checkRuleCooldown(ahoraMs - segundos * 1000, ahoraMs);

  return v.allowed
    ? "🟢 Puede dispararse de nuevo."
    : `🔴 Cooldown activo, faltan ${Math.round(v.remainingMs / 1000)}s.`;
};
