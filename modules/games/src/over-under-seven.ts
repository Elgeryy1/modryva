// Over/Under 7 — apuesta sobre la SUMA de dos dados nativos de Telegram (🎲🎲).
//
// Telegram devuelve dice.value en 1..6 para 🎲. Ese valor lo genera Telegram (no
// el bot), así que el resultado es provably-fair por construcción; aquí solo lo
// PRECIAMOS. Tratamos 🎲 como uniforme 1..6 (la distribución real es
// prácticamente uniforme para este emoji), por lo que la suma de dos dados sigue
// la distribución clásica 2..12.
//
// Distribución de la suma (36 combinaciones equiprobables):
//   bajo  = suma < 7  -> 15/36
//   siete = suma === 7 -> 6/36
//   alto  = suma > 7  -> 15/36
//
// Pago justo = 36/ways; aplicamos una ventaja de casa (house edge) del 4%:
//   multiplier = round2( (36/ways) * (1 - 0.04) )  si gana, 0 si pierde.
// Ventaja de casa positiva y clara en las tres apuestas.

const HOUSE_EDGE = 0.04;

/** Formas (de 36) en que gana cada apuesta. */
const WAYS: Readonly<Record<OverUnderPick, number>> = {
  bajo: 15,
  siete: 6,
  alto: 15,
};

export type OverUnderPick = "bajo" | "siete" | "alto";

export interface OverUnderDetail {
  readonly d1: number;
  readonly d2: number;
  readonly sum: number;
  readonly pick: OverUnderPick;
  readonly win: boolean;
}

export interface OverUnderResult {
  readonly multiplier: number;
  readonly detail: OverUnderDetail;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Un dado 🎲 válido es un entero 1..6 (tratado como uniforme). */
const isDieValue = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 6;

const didWin = (sum: number, pick: OverUnderPick): boolean => {
  if (pick === "bajo") {
    return sum < 7;
  }
  if (pick === "alto") {
    return sum > 7;
  }
  return sum === 7;
};

export const resolveOverUnder = (
  d1: number,
  d2: number,
  pick: OverUnderPick,
): OverUnderResult => {
  if (!isDieValue(d1) || !isDieValue(d2)) {
    throw new RangeError(
      `Valores de dado inválidos: d1=${d1}, d2=${d2} (esperado 1..6)`,
    );
  }
  const sum = d1 + d2;
  const win = didWin(sum, pick);
  const ways = WAYS[pick];
  const multiplier = win ? round2((36 / ways) * (1 - HOUSE_EDGE)) : 0;
  return {
    multiplier,
    detail: { d1, d2, sum, pick, win },
  };
};

const PICK_LABEL: Readonly<Record<OverUnderPick, string>> = {
  bajo: "Bajo (menos de 7)",
  siete: "Siete (exacto)",
  alto: "Alto (más de 7)",
};

export const describeOverUnder = (detail: OverUnderDetail): string => {
  const label = PICK_LABEL[detail.pick];
  const icon = detail.win ? "✅" : "❌";
  const outcome = detail.win
    ? `¡Ganas! ×${resolveOverUnder(detail.d1, detail.d2, detail.pick).multiplier}`
    : "Pierdes";
  return `🎲🎲 ${detail.d1}+${detail.d2}=${detail.sum} · ${label} ${icon} ${outcome}`;
};
