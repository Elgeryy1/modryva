/**
 * Deteccion de bucles entre reglas de automatizacion: cuando una regla dispara
 * a otra y esa cadena acaba volviendo sobre si misma (ciclo en el grafo
 * dirigido de reglas). Logica pura y determinista: recibe una lista plana de
 * aristas y no toca I/O, red, Prisma ni relojes.
 */

/** Arista dirigida `from -> to`: la regla `from` dispara a la regla `to`. */
export interface RuleEdge {
  readonly from: string;
  readonly to: string;
}

/** Comparador total y estable de identificadores de regla (orden de string). */
const compareId = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * Comparador element-a-element de ciclos: primero por identificador en cada
 * posicion y, a igualdad de prefijo, el ciclo mas corto va antes. Da un orden
 * de salida totalmente determinista.
 */
const compareCycle = (a: readonly string[], b: readonly string[]): number => {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    const av = a[i] ?? "";
    const bv = b[i] ?? "";
    const c = compareId(av, bv);
    if (c !== 0) {
      return c;
    }
  }
  return a.length - b.length;
};

/**
 * Detecta todos los ciclos elementales del grafo dirigido de reglas. Cada ciclo
 * se devuelve como la secuencia de nodos en el sentido de las aristas, empezando
 * por su nodo minimo (orden de string), sin repetir el nodo de cierre. Un
 * self-loop `a -> a` es un ciclo de longitud 1 `["a"]`. Las aristas duplicadas
 * se colapsan y el resultado no depende del orden de entrada. Puro y
 * determinista.
 */
export const detectRuleLoops = (
  edges: readonly RuleEdge[],
): readonly (readonly string[])[] => {
  const adjacency = new Map<string, Set<string>>();
  const nodeSet = new Set<string>();

  for (const edge of edges) {
    nodeSet.add(edge.from);
    nodeSet.add(edge.to);
    let targets = adjacency.get(edge.from);
    if (targets === undefined) {
      targets = new Set<string>();
      adjacency.set(edge.from, targets);
    }
    targets.add(edge.to);
  }

  const nodes = [...nodeSet].sort(compareId);

  const neighborsOf = (node: string): readonly string[] => {
    const targets = adjacency.get(node);
    return targets === undefined ? [] : [...targets].sort(compareId);
  };

  const cycles: string[][] = [];

  for (const start of nodes) {
    const path: string[] = [];
    const onPath = new Set<string>();

    const walk = (node: string): void => {
      path.push(node);
      onPath.add(node);
      for (const next of neighborsOf(node)) {
        // Mantener `start` como nodo minimo del ciclo: asi cada ciclo elemental
        // se descubre exactamente una vez, con su minimo en primera posicion.
        if (compareId(next, start) < 0) {
          continue;
        }
        if (next === start) {
          cycles.push([...path]);
        } else if (!onPath.has(next)) {
          walk(next);
        }
      }
      path.pop();
      onPath.delete(node);
    };

    walk(start);
  }

  cycles.sort(compareCycle);
  return cycles;
};

/**
 * True si el grafo de reglas contiene al menos un bucle. Puro y determinista.
 */
export const hasRuleLoop = (edges: readonly RuleEdge[]): boolean =>
  detectRuleLoops(edges).length > 0;

/**
 * Devuelve los identificadores de regla que participan en algun bucle, sin
 * duplicados y ordenados. Vacio si el grafo es aciclico. Puro y determinista.
 */
export const ruleLoopNodes = (
  edges: readonly RuleEdge[],
): readonly string[] => {
  const involved = new Set<string>();
  for (const cycle of detectRuleLoops(edges)) {
    for (const node of cycle) {
      involved.add(node);
    }
  }
  return [...involved].sort(compareId);
};
