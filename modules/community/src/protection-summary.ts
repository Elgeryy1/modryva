/**
 * Vista "que estoy protegiendo ahora": traduce el estado de defensas activas
 * de un grupo a un texto humano en espanol, con emojis, explicando cada
 * defensa encendida y avisando cuando el grupo esta completamente desprotegido.
 * Logica pura y determinista: recibe un estado plano por parametro y devuelve
 * texto/numeros; sin I/O, sin red, sin relojes.
 */

/**
 * Estado plano de las defensas de un grupo en un instante dado. Cada campo
 * booleano indica si esa proteccion esta activa; `lockedTypes` lista los tipos
 * de contenido bloqueados y `blocklistCount` el numero de patrones en la lista
 * negra de palabras.
 */
export interface ProtectionState {
  readonly antiflood: boolean;
  readonly captcha: boolean;
  readonly antiraid: boolean;
  readonly lockedTypes: readonly string[];
  readonly blocklistCount: number;
  readonly nightMode: boolean;
  readonly welcomeMute: boolean;
}

/**
 * Cuenta cuantas defensas estan realmente activas en el estado dado. Los
 * campos booleanos suman 1 cuando son true; `lockedTypes` cuenta como una
 * defensa si tiene al menos un tipo bloqueado, y `blocklistCount` como una si
 * es mayor que cero (valores negativos o cero no cuentan). Pura y determinista.
 */
export const countActiveDefenses = (state: ProtectionState): number => {
  let active = 0;
  if (state.antiflood) {
    active += 1;
  }
  if (state.captcha) {
    active += 1;
  }
  if (state.antiraid) {
    active += 1;
  }
  if (state.lockedTypes.length > 0) {
    active += 1;
  }
  if (state.blocklistCount > 0) {
    active += 1;
  }
  if (state.nightMode) {
    active += 1;
  }
  if (state.welcomeMute) {
    active += 1;
  }
  return active;
};

const PROTECTION_HEADER = "🛡️ Protecciones activas:";

const PROTECTION_NONE =
  "🛡️ Ninguna proteccion activa. Este grupo esta desprotegido; " +
  "activa al menos una defensa (antiflood, captcha o antiraid) para empezar.";

/**
 * Construye una linea humana por cada defensa encendida, en orden estable
 * (antiflood, captcha, antiraid, bloqueos de tipo, lista negra, modo noche,
 * silencio de bienvenida). Interna: `buildProtectionSummary` la usa. Pura.
 */
const buildProtectionLines = (state: ProtectionState): string[] => {
  const lines: string[] = [];

  if (state.antiflood) {
    lines.push("🌊 Antiflood: silencio a quien envia mensajes en rafaga.");
  }
  if (state.captcha) {
    lines.push(
      "🔐 Captcha: los nuevos deben verificarse antes de poder escribir.",
    );
  }
  if (state.antiraid) {
    lines.push("🚨 Antiraid: bloqueo entradas masivas de cuentas nuevas.");
  }
  if (state.lockedTypes.length > 0) {
    lines.push(`🔒 Bloqueo de contenido: ${state.lockedTypes.join(", ")}.`);
  }
  if (state.blocklistCount > 0) {
    const word = state.blocklistCount === 1 ? "palabra" : "palabras";
    lines.push(
      `🚫 Lista negra: borro mensajes con ${state.blocklistCount} ${word} prohibidas.`,
    );
  }
  if (state.nightMode) {
    lines.push("🌙 Modo noche: cierro el chat en el horario nocturno.");
  }
  if (state.welcomeMute) {
    lines.push(
      "🤫 Silencio de bienvenida: los recien llegados entran muteados.",
    );
  }

  return lines;
};

/**
 * Construye el texto completo de la vista "que estoy protegiendo ahora". Si no
 * hay ninguna defensa activa devuelve un aviso de desproteccion; en caso
 * contrario, una cabecera seguida de una linea con emoji por cada defensa
 * encendida. Pura y determinista: el mismo estado produce siempre el mismo
 * texto.
 */
export const buildProtectionSummary = (state: ProtectionState): string => {
  const lines = buildProtectionLines(state);

  if (lines.length === 0) {
    return PROTECTION_NONE;
  }

  return [PROTECTION_HEADER, ...lines].join("\n");
};
