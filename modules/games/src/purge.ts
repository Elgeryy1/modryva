/**
 * La purga: cinco minutos en los que robar no tiene esperas, los escudos no
 * valen y la probabilidad sube.
 *
 * La gracia es que cae a una hora distinta cada dia dentro de una ventana. Una
 * hora fija se convierte en una alarma: la gente aparece un minuto antes, roba
 * y se va, y el resto del dia nadie juega. Sorteada, hay que estar.
 *
 * Puro y determinista: el reloj y el azar entran por parametro. El sorteo se
 * hace UNA vez y se guarda; recalcularlo en cada tick movería la hora cada
 * minuto y la purga no llegaria nunca.
 */

import { describirBotin } from "./steal.js";

export interface PurgeSettings {
  /** Apagada hasta que un admin la enciende. */
  readonly enabled: boolean;
  /** Cuanto dura, en minutos. */
  readonly durationMinutes: number;
  /** Hora UTC a partir de la cual puede caer (0-23). */
  readonly windowStartHour: number;
  /** Hora UTC hasta la que puede caer (1-24), exclusiva. */
  readonly windowEndHour: number;
}

export const defaultPurgeSettings: PurgeSettings = {
  enabled: false,
  durationMinutes: 5,
  // Por la noche, que es cuando hay gente. En UTC: el bot no sabe la zona del
  // grupo, y un ajuste que miente sobre la hora es peor que uno que la declara.
  windowStartHour: 19,
  windowEndHour: 23,
};

/** Lo que el worker va guardando. Separado de los ajustes a proposito: esto lo
 * escribe el bot y aquellos los edita un admin; en la misma clave, guardar
 * desde la Mini App borraria la purga programada. */
export interface PurgeState {
  /** Cuando toca la proxima, ya sorteada. */
  readonly scheduledForMs?: number;
  /** Cuando se abrio la que esta en marcha, si hay alguna. */
  readonly openedAtMs?: number;
  /**
   * El mensaje del marcador en vivo, el que se va editando con cada golpe.
   *
   * Sin esto, cada robo mandaba su propio mensaje y una purga de cinco minutos
   * dejaba el chat inservible. Guardarlo aqui es lo que permite que el bot sepa
   * QUE mensaje editar cuando alguien roba.
   */
  readonly boardMessageId?: number;
}

export const PURGE_SETTINGS_KEY = "group_purge";
export const PURGE_STATE_KEY = "group_purge_state";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const intInRange = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max
    ? value
    : fallback;

/**
 * Cuanto puede durar la purga en una ventana dada: la MITAD de su ancho.
 *
 * La mitad no es un numero elegido a ojo. La purga arranca en un punto sorteado
 * de `[desde, hasta - duracion]`, asi que el trozo que cae dentro de la purga
 * PASE LO QUE PASE es `[hasta - duracion, desde + duracion)`, y ese trozo solo
 * esta vacio mientras la duracion no pase de la mitad del ancho. En cuanto lo
 * pasa hay un instante que esta dentro de la purga todos los dias: aparecer a
 * esa hora la pilla siempre, que es exactamente la alarma que este fichero
 * existe para evitar.
 *
 * Y pasado el ancho entero es peor todavia: `ultimoInicio` colapsa a `desde`,
 * el sorteo se queda sin rango —la purga cae al segundo exacto cada dia— y
 * `isPurgeOpen` la mantiene abierta hasta despues del cierre declarado, con los
 * escudos de victima apagados en un horario que el admin nunca autorizo.
 *
 * La ventana mas estrecha que se acepta es de una hora, asi que el tope nunca
 * baja de 30 minutos: siempre queda algo que sortear.
 */
export const maxPurgeDurationMinutes = (
  windowStartHour: number,
  windowEndHour: number,
): number => Math.floor(((windowEndHour - windowStartHour) * 60) / 2);

/**
 * Lee los ajustes con red de seguridad.
 *
 * Una ventana que no avanza (fin <= inicio) cae ENTERA a los valores por
 * defecto, no solo el campo malo: arreglar solo uno de los dos daria una
 * ventana que el admin no ha pedido y en la que la purga caeria a horas
 * absurdas. Cruzar medianoche no esta soportado y por eso se rechaza aqui, en
 * vez de dejar que el sorteo produzca un instante en el pasado.
 *
 * La duracion no se valida sola: no basta con que este entre 1 y 120 minutos,
 * tiene que caber en SU ventana, que puede ser de una sola hora. Esta es la
 * unica puerta —ni `PurgeSettings` ni `defaultPurgeSettings` salen por el
 * `index.ts` del modulo, asi que nadie de fuera construye unos ajustes a
 * mano—, y por eso el resto del fichero puede fiarse de la pareja.
 */
export const parsePurgeSettings = (value: unknown): PurgeSettings => {
  if (typeof value !== "object" || value === null) {
    return defaultPurgeSettings;
  }
  const raw = value as Record<string, unknown>;
  const inicio = intInRange(
    raw.windowStartHour,
    0,
    23,
    defaultPurgeSettings.windowStartHour,
  );
  const fin = intInRange(
    raw.windowEndHour,
    1,
    24,
    defaultPurgeSettings.windowEndHour,
  );
  const ventanaValida = fin > inicio;
  const inicioAplicado = ventanaValida
    ? inicio
    : defaultPurgeSettings.windowStartHour;
  const finAplicado = ventanaValida ? fin : defaultPurgeSettings.windowEndHour;
  const duracionPedida = intInRange(
    raw.durationMinutes,
    1,
    120,
    defaultPurgeSettings.durationMinutes,
  );
  return {
    enabled: raw.enabled === true,
    // La duracion se RECORTA, no tumba la config entera como hace la ventana.
    // Son casos distintos: una ventana al reves no dice nada de lo que el admin
    // queria, mientras que "120 minutos" en una ventana de una hora si lo dice
    // —que dure lo maximo— y recortar lo respeta. Ademas nadie se queda a
    // ciegas: la Mini App pinta lo que devuelve esta funcion, asi que ve el
    // numero aplicado de verdad en vez de uno que miente.
    durationMinutes: Math.min(
      duracionPedida,
      maxPurgeDurationMinutes(inicioAplicado, finAplicado),
    ),
    windowStartHour: inicioAplicado,
    windowEndHour: finAplicado,
  };
};

/** Lee el estado guardado, ignorando lo que no sea un numero util. */
export const parsePurgeState = (value: unknown): PurgeState => {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
  const scheduledForMs = num(raw.scheduledForMs);
  const openedAtMs = num(raw.openedAtMs);
  const boardMessageId = num(raw.boardMessageId);
  return {
    ...(scheduledForMs !== undefined ? { scheduledForMs } : {}),
    ...(openedAtMs !== undefined ? { openedAtMs } : {}),
    ...(boardMessageId !== undefined ? { boardMessageId } : {}),
  };
};

/**
 * Sortea cuando cae la proxima purga.
 *
 * Siempre devuelve un instante FUTURO: si la ventana de hoy ya paso (o el
 * sorteo cae antes de ahora), se va a la de mañana. Devolver una hora pasada
 * haria que el siguiente tick la abriera al instante, y la purga dejaria de ser
 * una sorpresa para ser un bucle.
 *
 * El ultimo inicio posible deja hueco para que quepa entera dentro de la
 * ventana: una purga de 5 minutos que empieza 2 minutos antes del cierre seria
 * una purga de 2 minutos.
 *
 * Cuenta con que la duracion cabe holgada en la ventana, que es lo que
 * garantiza `parsePurgeSettings` igual que garantiza `fin > inicio`. Si no
 * fuera asi, `ultimoInicio` colapsaria a `desde` y esto devolveria la misma
 * hora clavada todos los dias, que es lo contrario de para lo que existe.
 */
export const scheduleNextPurge = (
  settings: PurgeSettings,
  nowMs: number,
  roll: number,
): number => {
  const tirada = Number.isFinite(roll)
    ? Math.min(0.999999, Math.max(0, roll))
    : 0;
  const duracionMs = settings.durationMinutes * 60 * 1000;

  const paraElDia = (inicioDelDiaMs: number): number => {
    const desde = inicioDelDiaMs + settings.windowStartHour * HOUR_MS;
    const hasta = inicioDelDiaMs + settings.windowEndHour * HOUR_MS;
    const ultimoInicio = Math.max(desde, hasta - duracionMs);
    return Math.floor(desde + tirada * (ultimoInicio - desde));
  };

  const hoy = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const candidato = paraElDia(hoy);
  return candidato > nowMs ? candidato : paraElDia(hoy + DAY_MS);
};

/**
 * Si hay una purga abierta ahora mismo.
 *
 * Se fia de `settings.durationMinutes` tal cual, y por eso depende de que
 * `parsePurgeSettings` lo haya recortado al ancho de su ventana: con una
 * duracion mas larga que la ventana, esto la daria por abierta despues del
 * cierre declarado. No es cosmetico —durante la purga los escudos de victima
 * estan apagados a proposito—, asi que serian minutos de robar a la misma
 * persona en bucle en un horario que el admin no autorizo.
 */
export const isPurgeOpen = (
  state: PurgeState,
  settings: PurgeSettings,
  nowMs: number,
): boolean => {
  if (state.openedAtMs === undefined) {
    return false;
  }
  // Apagarla en los ajustes CORTA la que este abierta.
  //
  // Antes esto solo miraba el reloj, asi que `enabled: false` no paraba una
  // purga en marcha: quien la apagaba porque se le estaba yendo de las manos
  // creia haberla parado y no la habia parado, y seguia media hora corriendo.
  // Es el peor sitio para que un interruptor mienta, porque justo ahi se usa
  // con prisa.
  //
  // `decidePurge` ya contaba con esto —su comentario dice que la comprobacion
  // de `enabled` va DESPUES de cerrar "para que apagarla a media purga no deje
  // una abierta para siempre"—, pero sin esta linea nunca llegaba a cerrar.
  // Ahora si: el worker la ve cerrada y la cierra de verdad.
  if (!settings.enabled) {
    return false;
  }
  return nowMs < state.openedAtMs + settings.durationMinutes * 60 * 1000;
};

/** Una jugada para el marcador, ya con nombres resueltos. */
export interface PurgePlay {
  readonly thief: string;
  readonly victim: string;
  /** Botin total. Incluye la parte que salio de las fichas. */
  readonly amount: number;
  /**
   * Cuanto de `amount` salio de las FICHAS de la victima.
   *
   * Sin esto la linea decia el total con el nombre de la moneda del grupo, y
   * con una victima que tuviera el dinero en fichas eso era falso. Ausente o 0
   * = todo monedas, que es el caso normal y se escribe igual que antes.
   */
  readonly fromChips?: number;
  /** false = le pillaron, y entonces `amount` es la multa que pago. */
  readonly success: boolean;
}

/** Cuantas jugadas se enseñan. Mas de cinco y el mensaje crece tanto que hay
 * que hacer scroll para ver el marcador, que es lo que de verdad interesa. */
const PLAYS_SHOWN = 5;

/**
 * El marcador en vivo: UN mensaje que se va editando, en vez de uno por robo.
 *
 * Puro para poder probar el texto sin mandar nada. `plays` llega de la mas
 * reciente a la mas antigua.
 *
 * `formatAmount` lo pone quien llama porque el nombre de la moneda es de cada
 * grupo, y este modulo no sabe de ajustes de moneda.
 */
export const renderPurgeBoard = (input: {
  readonly remainingSeconds: number;
  readonly totalMoved: number;
  readonly plays: readonly PurgePlay[];
  readonly top: readonly { readonly name: string; readonly amount: number }[];
  readonly formatAmount: (amount: number) => string;
}): string => {
  const { formatAmount } = input;
  const botin = (jugada: PurgePlay): string =>
    describirBotin({
      total: jugada.amount,
      deFichas: jugada.fromChips ?? 0,
      formatMonedas: formatAmount,
    });
  const restante = Math.max(0, Math.floor(input.remainingSeconds));
  const mm = Math.floor(restante / 60);
  const ss = String(restante % 60).padStart(2, "0");

  const lineas = [
    restante > 0
      ? `😈 <b>LA PURGA</b> — quedan ${mm}:${ss}`
      : "🔒 <b>LA PURGA HA TERMINADO</b>",
    "",
    `💰 Se han movido <b>${formatAmount(input.totalMoved)}</b>`,
  ];

  if (input.plays.length > 0) {
    lineas.push("");
    for (const jugada of input.plays.slice(0, PLAYS_SHOWN)) {
      // Al fallar no hay desglose que hacer: la multa la paga el ladron de sus
      // monedas y las fichas no entran en el castigo.
      lineas.push(
        jugada.success
          ? `🥷 ${jugada.thief} le robó ${botin(jugada)} a ${jugada.victim}`
          : `🚨 ${jugada.thief} fue pillado: pagó ${formatAmount(jugada.amount)} a ${jugada.victim}`,
      );
    }
  }

  if (input.top.length > 0) {
    lineas.push(
      "",
      `🏆 ${input.top
        .map((fila) => `${fila.name} ${formatAmount(fila.amount)}`)
        .join(" · ")}`,
    );
  }

  if (restante > 0) {
    lineas.push("", "<i>Responde a alguien con /robar</i>");
  }

  return lineas.join("\n");
};

/** Lo que hay que hacer en este tick. */
export type PurgeAction =
  | { readonly kind: "none" }
  /** Sortear y guardar la proxima. */
  | { readonly kind: "schedule"; readonly scheduledForMs: number }
  /** Abrirla y anunciarlo. */
  | { readonly kind: "open" }
  /** Cerrarla, contar el resumen y programar la siguiente. */
  | { readonly kind: "close"; readonly scheduledForMs: number };

/**
 * Decide que toca hacer con la purga de un chat.
 *
 * El orden importa: cerrar va antes que abrir, porque un tick que llega tarde
 * podria cumplir las dos condiciones a la vez y lo correcto es terminar la que
 * estaba en marcha, no encadenar otra.
 */
export const decidePurge = (input: {
  readonly settings: PurgeSettings;
  readonly state: PurgeState;
  readonly nowMs: number;
  readonly roll: number;
}): PurgeAction => {
  const { settings, state, nowMs, roll } = input;

  if (state.openedAtMs !== undefined) {
    if (!isPurgeOpen(state, settings, nowMs)) {
      return {
        kind: "close",
        scheduledForMs: scheduleNextPurge(settings, nowMs, roll),
      };
    }
    return { kind: "none" };
  }

  // Apagada: no se programa nada. La comprobacion va DESPUES de cerrar para que
  // apagarla a media purga no deje una abierta para siempre.
  if (!settings.enabled) {
    return { kind: "none" };
  }

  if (state.scheduledForMs === undefined) {
    return {
      kind: "schedule",
      scheduledForMs: scheduleNextPurge(settings, nowMs, roll),
    };
  }

  if (nowMs >= state.scheduledForMs) {
    // Si el worker estuvo caido mas de lo que dura la purga, la hora ya paso
    // del todo y abrirla ahora seria abrirla a deshora. Se reprograma.
    const tardeMs = nowMs - state.scheduledForMs;
    if (tardeMs > settings.durationMinutes * 60 * 1000) {
      return {
        kind: "schedule",
        scheduledForMs: scheduleNextPurge(settings, nowMs, roll),
      };
    }
    return { kind: "open" };
  }

  return { kind: "none" };
};
