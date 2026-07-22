/**
 * Detector de preguntas repetidas tras un anuncio: si mucha gente pregunta lo
 * mismo, el anuncio no fue claro. Agrupa las preguntas por su forma normalizada
 * (sin acentos, sin puntuacion, sin mayusculas) y reporta los grupos por
 * tamano. Logica pura y determinista: sin I/O, sin red, sin reloj ni
 * aleatoriedad; solo recibe textos planos y umbrales.
 */

const DIACRITICS = /\p{Diacritic}/gu;
const NON_KEYWORD = /[^a-z0-9\s]/g;
const WHITESPACE = /\s+/g;

/** Umbral por defecto: cuantas repeticiones marcan un patron sospechoso. */
const DEFAULT_MIN_REPEATS = 3;

/**
 * Un grupo de preguntas que comparten la misma forma normalizada. `sample` es
 * el texto original (recortado) de la primera pregunta vista en el grupo y
 * `count` cuantas preguntas cayeron en el. Pura y determinista.
 */
export interface QuestionCluster {
  readonly sample: string;
  readonly count: number;
}

/**
 * Opciones de `detectRepeatedQuestions`. `minRepeats` es el tamano de grupo
 * (se aplica un minimo de 1; por defecto 3) a partir del cual las preguntas se
 * consideran un patron repetido. Pura y determinista.
 */
export interface DetectRepeatedQuestionsOptions {
  readonly minRepeats?: number;
}

/**
 * Resultado de analizar un lote de preguntas en busca de repeticion.
 * `repeated` es true cuando al menos un grupo alcanza `minRepeats`. `clusters`
 * lista cada grupo distinto de preguntas, ordenado por `count` descendente y,
 * en caso de empate, por orden de primera aparicion. Pura y determinista.
 */
export interface RepeatedQuestionsResult {
  readonly repeated: boolean;
  readonly clusters: readonly QuestionCluster[];
}

/**
 * Normaliza una pregunta: quita acentos y diacriticos, pasa a minusculas,
 * reemplaza puntuacion y simbolos por espacios y colapsa los espacios en uno
 * solo, recortando los extremos. Devuelve cadena vacia si no queda contenido
 * util. Pura y determinista.
 */
const normalizeQuestion = (raw: string): string =>
  raw
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(NON_KEYWORD, " ")
    .replace(WHITESPACE, " ")
    .trim();

/** Grupo mutable interno usado durante el conteo. */
interface MutableCluster {
  sample: string;
  count: number;
  order: number;
}

/**
 * Agrupa `questions` por forma normalizada y decide si hay un patron repetido.
 * Las preguntas vacias o solo con puntuacion/simbolos se ignoran. Los grupos se
 * ordenan por `count` descendente y, en empate, por orden de primera aparicion,
 * de modo que la salida es totalmente determinista. `minRepeats` se limita a un
 * minimo de 1 (por defecto 3). Pura y determinista.
 */
export const detectRepeatedQuestions = (
  questions: readonly string[],
  options?: DetectRepeatedQuestionsOptions,
): RepeatedQuestionsResult => {
  const requested = options?.minRepeats ?? DEFAULT_MIN_REPEATS;
  const minRepeats = requested < 1 ? 1 : requested;

  const groups = new Map<string, MutableCluster>();
  let order = 0;
  for (const question of questions) {
    const key = normalizeQuestion(question);
    if (key.length === 0) {
      continue;
    }
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { sample: question.trim(), count: 1, order });
      order += 1;
    } else {
      existing.count += 1;
    }
  }

  const clusters: QuestionCluster[] = [...groups.values()]
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.order - b.order;
    })
    .map((cluster) => ({ sample: cluster.sample, count: cluster.count }));

  const repeated = clusters.some((cluster) => cluster.count >= minRepeats);

  return { repeated, clusters };
};
