/**
 * Reconocimiento de helpers por utilidad, no por cantidad. Un usuario que
 * responde una vez y recibe gracias es mas util que otro que escribe mucho sin
 * ayudar a nadie. La utilidad pondera las respuestas y, con mas peso, las
 * gracias recibidas (senal de que la respuesta sirvio). Logica pura y
 * determinista: recibe actividad plana y devuelve un ranking ordenado.
 */

/**
 * Actividad agregada de un usuario en la comunidad. Los contadores no negativos
 * los calcula el llamador; este modulo solo los combina.
 */
export interface HelperActivity {
  readonly userId: string;
  readonly answers: number;
  readonly thanksReceived: number;
  readonly questionsAsked: number;
}

/** Entrada del ranking: usuario y su puntuacion de utilidad calculada. */
export interface HelperRanking {
  readonly userId: string;
  readonly helpfulness: number;
}

/** Peso de cada respuesta dada al calcular la utilidad. */
export const HELPER_ANSWER_WEIGHT = 1;

/**
 * Peso de cada gracias recibida. Superior al de una respuesta porque una
 * gracias confirma que la ayuda fue util (calidad sobre cantidad).
 */
export const HELPER_THANKS_WEIGHT = 3;

/**
 * Calcula la utilidad de un usuario: respuestas + gracias ponderadas. Los
 * contadores negativos se tratan como cero para no premiar datos corruptos.
 * `questionsAsked` no suma utilidad (preguntar no es ayudar) pero forma parte
 * del perfil de actividad. Puro y determinista.
 */
export const computeHelperHelpfulness = (activity: HelperActivity): number => {
  const answers = activity.answers > 0 ? activity.answers : 0;
  const thanks = activity.thanksReceived > 0 ? activity.thanksReceived : 0;
  return answers * HELPER_ANSWER_WEIGHT + thanks * HELPER_THANKS_WEIGHT;
};

/**
 * Ordena a los helpers por utilidad descendente. El orden es estable: ante
 * empate de utilidad se conserva el orden de aparicion en `activity`. No muta
 * la entrada. Puro y determinista.
 */
export const rankHelpers = (
  activity: readonly HelperActivity[],
): readonly HelperRanking[] => {
  const indexed = activity.map((entry, index) => ({
    index,
    ranking: {
      userId: entry.userId,
      helpfulness: computeHelperHelpfulness(entry),
    } satisfies HelperRanking,
  }));

  indexed.sort((a, b) => {
    if (b.ranking.helpfulness !== a.ranking.helpfulness) {
      return b.ranking.helpfulness - a.ranking.helpfulness;
    }
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.ranking);
};
