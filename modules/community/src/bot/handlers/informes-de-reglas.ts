import { rankBrokenRules } from "../../broken-rules-ranking.js";
import {
  type BoardCase,
  boardCounts,
  type CasePriority,
  orderBoard,
} from "../../case-board.js";
import { tallyConflictTypes } from "../../conflict-types.js";
import { rankRevertedActions } from "../../reverted-actions-ranking.js";
import { summarizeRulesMobile } from "../../rules-mobile.js";
import { searchRules } from "../../rules-search.js";

/**
 * Los cuatro informes de staff sobre las reglas del grupo: dos que leen el
 * texto de las normas y dos que miran los casos de moderacion.
 *
 * En el nucleo eran cuatro casos de un `switch` de 25. Los de cada pareja
 * repetian su consulta y su troceado del texto palabra por palabra.
 */

/**
 * Las normas del grupo, una por linea y sin las vacias.
 *
 * El troceado estaba copiado en los dos casos que leen reglas. Es la misma
 * decisión —una linea es una norma, y las lineas en blanco no cuentan— y por
 * eso vive en un solo sitio.
 */
export const normasDelTexto = (
  // `null` y no solo `undefined`: la columna de la base es nullable, y
  // estrecharlo aqui obligaria a quien llama a castear.
  crudo: string | null | undefined,
): readonly string[] =>
  (crudo ?? "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

/** `/buscar_regla`: encontrar una norma por texto. */
export const informeDeBusquedaDeRegla = (
  normas: readonly string[],
  busqueda: string,
): string => {
  if (busqueda.length === 0) {
    return "Uso: /buscar_regla <texto>";
  }
  if (normas.length === 0) {
    return "Este grupo todavía no tiene reglas configuradas.";
  }

  const encontradas = searchRules(normas, busqueda);
  return encontradas.length > 0
    ? encontradas.map((m) => `${m.index + 1}. ${m.text}`).join("\n")
    : "Ninguna regla coincide con esa búsqueda.";
};

/** `/reglas_movil`: las normas en corto, para leerlas en el movil. */
export const informeDeReglasEnMovil = (normas: readonly string[]): string =>
  normas.length === 0
    ? "Este grupo todavía no tiene reglas configuradas."
    : summarizeRulesMobile(normas).short.join("\n");

/** Un caso de moderacion, con lo unico que estos dos informes miran. */
export interface CasoConMotivo {
  readonly motivo: string;
}

/** `/tipos_conflicto`: por que se sanciona en este grupo. */
export const informeDeTiposDeConflicto = (
  casos: readonly CasoConMotivo[],
): string => {
  const recuento = tallyConflictTypes(casos.map((c) => ({ type: c.motivo })));
  return recuento.length > 0
    ? recuento.map((t) => `${t.type}: ${t.count} (${t.percent}%)`).join("\n")
    : "Sin casos recientes con motivo registrado.";
};

/** `/reglas_rotas`: que normas se saltan mas. */
export const informeDeReglasRotas = (
  casos: readonly CasoConMotivo[],
): string => {
  const ranking = rankBrokenRules(
    casos.map((c) => ({ ruleId: c.motivo, ruleName: c.motivo })),
  );
  return ranking.length > 0
    ? ranking.map((r) => `${r.ruleName}: ${r.count}`).join("\n")
    : "Sin normas rotas registradas recientemente.";
};

/** Una sanción, con lo unico que el ranking de reversiones mira. */
export interface SancionRevertible {
  readonly tipo: string;
  readonly revertida: boolean;
}

/**
 * `/acciones_revertidas`: que tipo de sanción se deshace mas.
 *
 * Va con los informes de reglas y no con los de actividad porque mira lo mismo
 * que ellos —lo que el staff decidio— y no lo que escribio la gente.
 */
export const informeDeAccionesRevertidas = (
  sanciones: readonly SancionRevertible[],
): string => {
  const ranking = rankRevertedActions(
    sanciones.map((s) => ({ type: s.tipo, reverted: s.revertida })),
  );

  return ranking.length > 0
    ? ranking
        .map((r) => `${r.type}: ${r.reverted}/${r.total} (${r.rate})`)
        .join("\n")
    : "Sin acciones registradas recientemente.";
};

/** Un ticket, con lo que el tablero mira. */
export interface TicketDelTablero {
  readonly numero: string;
  readonly estado: string;
  readonly prioridad: string;
  readonly abiertoEnMs: number;
}

/**
 * La prioridad guardada, encajada en las tres que el tablero conoce.
 *
 * Sale de la base, donde cabe cualquier cosa: una prioridad de una version
 * vieja o una errata. Lo que no encaje va a `normal`, que es el lado prudente
 * — mandarlo a `high` llenaria la columna urgente de casos que no lo son, y a
 * `low` los escondería.
 */
const prioridadConocida = (prioridad: string): CasePriority =>
  prioridad === "low" || prioridad === "high" ? prioridad : "normal";

/** `/tablero_casos`: cuantos casos hay en cada columna y cual va primero. */
export const informeDeTableroDeCasos = (
  tickets: readonly TicketDelTablero[],
  ahoraMs: number,
): string => {
  if (tickets.length === 0) {
    return "Sin casos registrados todavía.";
  }

  const casos: BoardCase[] = tickets.map((t) => ({
    id: t.numero,
    status: t.estado,
    priority: prioridadConocida(t.prioridad),
    ageMs: ahoraMs - t.abiertoEnMs,
  }));

  const cuantos = boardCounts(casos);
  const tablero = orderBoard(casos);

  const lineas = Object.entries(cuantos).map(([columna, cuenta]) => {
    const primero = tablero[columna as keyof typeof tablero][0];
    return primero
      ? `${columna}: ${cuenta} (caso #${primero.id} primero)`
      : `${columna}: ${cuenta}`;
  });

  return `🗂️ Tablero de casos:\n${lineas.join("\n")}`;
};
