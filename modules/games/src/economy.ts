/**
 * Motor de economia virtual sana (engine #8). Puntos de juego SIN valor
 * monetario real: caducan sin actividad (caducidad exponencial), se redistribuye
 * de las "ballenas" hacia la media (whale tax), se respeta un cupo diario de
 * ganancia y se reinicia por temporada conservando un porcentaje. Todo es logica
 * pura y determinista: recibe timestamps (nowMs) e inputs planos por parametro y
 * devuelve valores; sin I/O, sin Date.now(), sin Math.random().
 */

/**
 * Cartera de un jugador. `balance` es el saldo actual de puntos virtuales;
 * `lastEarnedMs` es el timestamp epoch (ms) de la ultima ganancia, usado para
 * calcular la caducidad. Nunca representa dinero real.
 */
export interface Wallet {
  readonly balance: number;
  readonly lastEarnedMs: number;
}

/**
 * Resultado de intentar ganar puntos respetando el cupo diario. `wallet` es la
 * cartera actualizada y `granted` los puntos realmente concedidos (0 si el cupo
 * ya estaba agotado o el importe pedido no era positivo).
 */
export interface EarnPointsResult {
  readonly wallet: Wallet;
  readonly granted: number;
}

/** Vida media por defecto (ms) para la caducidad exponencial: 30 dias. */
export const ECONOMY_DEFAULT_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

/** Percentil por defecto que define quien es "ballena" en la whale tax (top 10%). */
export const ECONOMY_DEFAULT_WHALE_TOP_PCT = 0.1;

/**
 * Redondea a un entero no negativo. Los puntos virtuales son unidades enteras;
 * un saldo nunca puede ser negativo.
 */
const clampToPoints = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value);
};

/**
 * Aplica caducidad exponencial al saldo segun el tiempo inactivo. Cada
 * `halfLifeMs` transcurridos desde `lastEarnedMs` el saldo se reduce a la mitad:
 * `balance * 2^(-dt / halfLifeMs)`. No avanza `lastEarnedMs` (la caducidad no
 * cuenta como actividad). Es idempotente respecto al reloj: llamarla dos veces
 * con el mismo `nowMs` da el mismo resultado. Si `nowMs <= lastEarnedMs`, si el
 * saldo ya es 0 o si `halfLifeMs` no es positivo, devuelve la cartera intacta.
 * Pura y determinista.
 */
export const applyDecay = (
  w: Wallet,
  nowMs: number,
  halfLifeMs: number,
): Wallet => {
  const elapsed = nowMs - w.lastEarnedMs;
  if (w.balance <= 0 || elapsed <= 0 || halfLifeMs <= 0) {
    return w;
  }
  const decayed = w.balance * 2 ** (-elapsed / halfLifeMs);
  return { balance: clampToPoints(decayed), lastEarnedMs: w.lastEarnedMs };
};

/**
 * Recorta a las ballenas hacia la media (redistribucion suave anti-acaparamiento).
 * Los saldos del `topPct` superior (por defecto el 10%) que ademas superan la media
 * se acercan a ella quedando a medio camino entre su saldo y la media:
 * `(saldo + media)/2`. Los saldos en o por debajo de la media NO se recortan. La
 * media se calcula sobre las carteras con puntos (saldo > 0): las vacias (o saneadas
 * desde negativos/no-finitos a 0) no participan y no arrastran la media hacia abajo
 * gravando saldos legitimos. El resto de saldos no cambia. Preserva el orden del
 * array de entrada y devuelve enteros no negativos. Con un array vacio devuelve `[]`.
 * `topPct` se sanea al rango (0, 1]; valores fuera de rango caen al valor por
 * defecto. Pura y determinista (no depende del reloj).
 */
export const applyWhaleTax = (
  balances: readonly number[],
  topPct: number = ECONOMY_DEFAULT_WHALE_TOP_PCT,
): number[] => {
  if (balances.length === 0) {
    return [];
  }

  const pct =
    Number.isFinite(topPct) && topPct > 0 && topPct <= 1
      ? topPct
      : ECONOMY_DEFAULT_WHALE_TOP_PCT;

  const sanitized = balances.map(clampToPoints);
  // La media se calcula solo sobre las carteras con puntos (>0). Las carteras
  // vacias (incluidas las saneadas desde negativos/no-finitos) no cuentan como
  // participantes: si arrastrasen la media hacia abajo, saldos legitimos iguales
  // pasarian a "superar la media" y se gravarian sin motivo.
  const funded = sanitized.filter((b) => b > 0);
  const mean =
    funded.length > 0
      ? funded.reduce((sum, b) => sum + b, 0) / funded.length
      : 0;

  // Umbral: el saldo del jugador en el limite del top `pct`. Se calcula sobre una
  // copia ordenada descendente para no alterar el orden original.
  const sortedDesc = [...sanitized].sort((a, b) => b - a);
  const whaleCount = Math.max(1, Math.ceil(sanitized.length * pct));
  const threshold = sortedDesc[whaleCount - 1] ?? sortedDesc[0] ?? 0;

  return sanitized.map((balance) =>
    balance > mean && balance >= threshold
      ? clampToPoints((balance + mean) / 2)
      : balance,
  );
};

/**
 * Concede puntos respetando el cupo diario. `amount` es lo que se quiere otorgar,
 * `earnedToday` lo ya ganado hoy y `dailyCap` el maximo diario. Solo se concede
 * `min(amount, dailyCap - earnedToday)`; si el cupo ya esta agotado (o `amount`
 * no es positivo) se conceden 0 puntos. Cuando concede algo, suma al saldo y
 * avanza `lastEarnedMs` a `nowMs`; si concede 0, la cartera queda intacta
 * (incluido `lastEarnedMs`). `dailyCap <= 0` significa sin ganancia. Pura y
 * determinista.
 */
export const earnPoints = (
  w: Wallet,
  amount: number,
  nowMs: number,
  dailyCap: number,
  earnedToday: number,
): EarnPointsResult => {
  const want = clampToPoints(amount);
  const cap = clampToPoints(dailyCap);
  const already = clampToPoints(earnedToday);
  const remaining = Math.max(0, cap - already);
  const granted = Math.min(want, remaining);

  if (granted <= 0) {
    return { wallet: w, granted: 0 };
  }

  return {
    wallet: { balance: w.balance + granted, lastEarnedMs: nowMs },
    granted,
  };
};

/**
 * Reinicio de temporada: conserva solo `keepPct` del saldo (p.ej. 0.2 = 20%) y
 * descarta el resto, preservando `lastEarnedMs` (el reinicio no cuenta como
 * actividad). `keepPct` se sanea al rango [0, 1]: <=0 vacia el saldo, >=1 lo
 * conserva integro; valores no finitos se tratan como 0. El resultado es un
 * entero no negativo. Pura y determinista (no depende del reloj).
 */
export const seasonReset = (w: Wallet, keepPct: number): Wallet => {
  const pct = Number.isFinite(keepPct) ? Math.min(1, Math.max(0, keepPct)) : 0;
  return {
    balance: clampToPoints(w.balance * pct),
    lastEarnedMs: w.lastEarnedMs,
  };
};
