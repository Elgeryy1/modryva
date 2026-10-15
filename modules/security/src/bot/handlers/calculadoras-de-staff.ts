import { enteroDelArgumento, siONo } from "@superbot/shared";

import { rulesForOwnerAbsent } from "../../owner-absent.js";
import { requiresPeerReview } from "../../peer-admin-review.js";
import { computeStaffConfidence } from "../../staff-confidence.js";

/**
 * Las calculadoras de staff de `/utility_plus` que viven en seguridad.
 *
 * Las otras dos de la familia (`/burnout_staff` y `/escalar_owner`) están en
 * `modules/support`, porque sus detectores viven allí. Juntarlas aquí habría
 * creado un import de módulo a módulo, que hoy es cero y el test de
 * arquitectura no deja subir.
 */

/** `/confianza_staff`: cuanto se sostiene el criterio de quien modera. */
export const calculadoraDeConfianzaDeStaff = (
  args: readonly string[],
): string => {
  const confirmadas = enteroDelArgumento(args[0]);
  const revertidas = enteroDelArgumento(args[1]);
  if (confirmadas === null || revertidas === null) {
    return "Uso: /confianza_staff <confirmadas> <revertidas>";
  }

  const v = computeStaffConfidence({
    confirmed: confirmadas,
    reverted: revertidas,
  });

  return `🎖️ ${v.band} (${v.score}/100)`;
};

/** `/revision_entre_pares`: si un admin sancionando a otro necesita revision. */
export const calculadoraDeRevisionEntrePares = (
  args: readonly string[],
): string => {
  const autorEsAdmin = siONo(args[0]);
  const objetivoEsAdmin = siONo(args[1]);
  if (autorEsAdmin === undefined || objetivoEsAdmin === undefined) {
    return "Uso: /revision_entre_pares <autor_admin si|no> <objetivo_admin si|no>";
  }

  return requiresPeerReview({
    actorIsAdmin: autorEsAdmin,
    targetIsAdmin: objetivoEsAdmin,
  }).reason;
};

/** `/owner_ausente`: que reglas cambian cuando el owner no esta. */
export const calculadoraDeOwnerAusente = (args: readonly string[]): string => {
  const ausente = siONo(args[0]);
  if (ausente === undefined) {
    return "Uso: /owner_ausente <si|no>";
  }

  return rulesForOwnerAbsent(ausente).note;
};
