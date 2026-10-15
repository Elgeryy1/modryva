import { siONo } from "@superbot/shared";

import { buildFirstStepsChecklist } from "../../onboarding-checklist.js";

/** `/checklist_bienvenida`: qué le falta a quien acaba de entrar. */
export const calculadoraDeChecklistDeBienvenida = (
  args: readonly string[],
): string => {
  const leyoLasReglas = siONo(args[0]);
  const sePresento = siONo(args[1]);
  const eligioIntereses = siONo(args[2]);
  if (
    leyoLasReglas === undefined ||
    sePresento === undefined ||
    eligioIntereses === undefined
  ) {
    return "Uso: /checklist_bienvenida <reglas si|no> <presentado si|no> <intereses si|no>";
  }

  const v = buildFirstStepsChecklist({
    readRules: leyoLasReglas,
    introduced: sePresento,
    pickedInterests: eligioIntereses,
  });
  const lineas = v.items.map(
    (item) => `${item.done ? "✅" : "❌"} ${item.label}`,
  );

  return `${v.complete ? "✅ Completo" : "⏳ Incompleto"}\n${lineas.join("\n")}`;
};
