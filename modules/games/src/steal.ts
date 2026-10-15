/**
 * El robo entre miembros del grupo.
 *
 * Puro y determinista: el azar entra ya sorteado por parametro (`roll`, en
 * [0,1)), igual que el reloj (`nowMs`). Asi el desenlace se puede probar exacto
 * —"con 0.34 y un 35% de probabilidad, entra"— sin congelar nada ni repetir
 * tiradas hasta que salga lo que interesa.
 *
 * La forma del modulo es deliberada: NO toca saldos. Devuelve que habria que
 * mover y quien llama lo aplica con las operaciones atomicas del repositorio.
 * Mezclar decision y efecto aqui obligaria a este fichero a saber de
 * transacciones, y a los tests a montar una base de datos.
 */

export interface StealSettings {
  /** Apagado hasta que un admin lo enciende. */
  readonly enabled: boolean;
  /** Probabilidad de partida, en porcentaje. */
  readonly baseChancePct: number;
  /** Techo de probabilidad. Sin el, el veterano roba siempre. */
  readonly maxChancePct: number;
  /** Cuanto sube la probabilidad por robo con exito acumulado. */
  readonly chancePerLevelPct: number;
  /** Porcentaje del saldo de la victima que se lleva un golpe. */
  readonly lootPct: number;
  /** Tope absoluto del botin. */
  readonly lootMax: number;
  /** Porcentaje del saldo del ladron que se pierde al fallar. */
  readonly finePct: number;
  /** Tope absoluto de la multa. */
  readonly fineMax: number;
  /** Espera entre robos del mismo ladron. */
  readonly cooldownSeconds: number;
  /** Tiempo que la victima queda a salvo despues de que le roben. */
  readonly victimShieldSeconds: number;
  /** Por debajo de este saldo no se puede robar a alguien. */
  readonly minVictimBalance: number;
  /**
   * Espera entre robos DURANTE la purga. 0 = barra libre.
   *
   * Existe porque la barra libre total resulto ser demasiado: en la primera
   * purga real se movieron casi 11.000 monedas en cinco minutos, y el chat se
   * lleno de mensajes de robo. Una espera corta baja el volumen sin quitarle la
   * gracia — sigue siendo mucho mas rapido que el cooldown normal.
   */
  readonly purgeCooldownSeconds: number;
}

export const defaultStealSettings: StealSettings = {
  enabled: false,
  baseChancePct: 35,
  // Bajado de 75 a 60 despues de la primera purga real: con 75, el empujon del
  // evento lo dejaba en 95 y se veian rachas de 91%, 93%, 95%. Robar dejaba de
  // ser una apuesta para ser un tramite. Con 60 se queda en 80 durante la
  // purga, que sigue siendo generoso.
  maxChancePct: 60,
  chancePerLevelPct: 2,
  lootPct: 20,
  lootMax: 500,
  finePct: 10,
  fineMax: 250,
  cooldownSeconds: 1800,
  victimShieldSeconds: 3600,
  // Nadie es objetivo por 3 monedas: cebarse con quien no tiene nada es la
  // forma mas rapida de que alguien deje de jugar.
  minVictimBalance: 50,
  purgeCooldownSeconds: 10,
};

/** Clave en el almacen de ajustes por chat. */
export const STEAL_SETTINGS_KEY = "group_steal";

const pctOr = (value: unknown, fallback: number): number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100
    ? Math.round(value)
    : fallback;

const intOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;

/**
 * Lee los ajustes guardados con red de seguridad: lo que falte o venga corrupto
 * cae al valor por defecto. Aqui importa mas que en otros sitios, porque un
 * porcentaje fuera de rango no da un error visible: da una economia en la que
 * robar sale siempre bien y nadie entiende por que.
 */
export const parseStealSettings = (value: unknown): StealSettings => {
  if (typeof value !== "object" || value === null) {
    return defaultStealSettings;
  }
  const raw = value as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    baseChancePct: pctOr(raw.baseChancePct, defaultStealSettings.baseChancePct),
    maxChancePct: pctOr(raw.maxChancePct, defaultStealSettings.maxChancePct),
    chancePerLevelPct: pctOr(
      raw.chancePerLevelPct,
      defaultStealSettings.chancePerLevelPct,
    ),
    lootPct: pctOr(raw.lootPct, defaultStealSettings.lootPct),
    lootMax: intOr(raw.lootMax, defaultStealSettings.lootMax),
    finePct: pctOr(raw.finePct, defaultStealSettings.finePct),
    fineMax: intOr(raw.fineMax, defaultStealSettings.fineMax),
    cooldownSeconds: intOr(
      raw.cooldownSeconds,
      defaultStealSettings.cooldownSeconds,
    ),
    victimShieldSeconds: intOr(
      raw.victimShieldSeconds,
      defaultStealSettings.victimShieldSeconds,
    ),
    minVictimBalance: intOr(
      raw.minVictimBalance,
      defaultStealSettings.minVictimBalance,
    ),
    purgeCooldownSeconds: intOr(
      raw.purgeCooldownSeconds,
      defaultStealSettings.purgeCooldownSeconds,
    ),
  };
};

/**
 * Lo que un objeto comprado le cambia a un robo.
 *
 * Numeros y banderas, nunca ids de objetos: el motor no sabe que existe una
 * tienda ni tiene por que. Quien llama traduce "lleva navaja" a "suma 25" (eso
 * lo hace `stealEffectsOf` en el catalogo) y aqui solo se aplican. Asi un
 * objeto nuevo no toca este fichero, que es el que decide todos los robos.
 *
 * Todos opcionales: sin ninguno, el robo se comporta exactamente como antes de
 * que la tienda existiera.
 */
export interface StealModifiers {
  /** Puntos porcentuales que suma quien ataca. */
  readonly attackerBonusPct?: number;
  /** Puntos porcentuales que resta la victima. */
  readonly victimGuardPct?: number;
  /** Se salta el escudo de la victima. */
  readonly ignoreVictimShield?: boolean;
  /** Se salta la espera entre robos. */
  readonly ignoreCooldown?: boolean;
  /**
   * Multiplica la espera entre robos. Menor que 1 la acorta.
   *
   * Existe para el zorro, cuyo efecto declarado es "recorta la espera" en
   * tanto por uno — media espera, no ninguna. `ignoreCooldown` es todo o nada
   * y lo tiene el evento de la purga; con solo ese campo, la unica forma de
   * darle algo al zorro habria sido regalarle la barra libre.
   */
  readonly cooldownMultiplier?: number;
  /** Fallar no cuesta multa. */
  readonly skipFine?: boolean;
  /** Multiplica el botin y su tope. Nunca el saldo expuesto de la victima. */
  readonly lootMultiplier?: number;
  /** Multiplica la multa de quien falla. */
  readonly fineMultiplier?: number;
  /**
   * La victima es intocable DURANTE LA PURGA.
   *
   * Dentro del evento gana a todo: es lo unico que lo para, y por eso el objeto
   * que lo concede es el mas caro de su familia. Fuera del evento no hace nada,
   * a proposito — ver el orden de comprobaciones en `resolveSteal`.
   */
  readonly victimImmune?: boolean;
}

/**
 * Techo absoluto una vez metidos los objetos.
 *
 * `maxChancePct` es el techo de la PROGRESION y la purga ya lo salta por
 * diseño; sin un tope de verdad, purga (80) mas navaja (25) daria 105, o sea
 * robar garantizado. Comprar una ventaja tiene que seguir siendo una apuesta:
 * si el objeto caro convierte el robo en un tramite, deja de haber juego y solo
 * queda quien tiene saldo para comprarlo.
 */
export const MAX_TOTAL_CHANCE_PCT = 90;

/** Por que no se puede robar ahora mismo. */
export type StealRefusal =
  | "disabled"
  | "self"
  | "cooldown"
  | "shielded"
  /** Lleva algo comprado que la hace intocable. Distinto de `shielded`, que es
   * el respiro automatico tras un robo: aqui hay alguien que ha pagado. */
  | "immune"
  /**
   * La victima tiene saldo sin fondo. No es un escudo que se agota ni algo
   * comprado: es que su saldo no se mueve, asi que ahi nunca hay nada que
   * llevarse.
   */
  | "victim-unlimited"
  | "victim-too-poor"
  | "thief-broke";

export interface StealInput {
  readonly settings: StealSettings;
  readonly nowMs: number;
  /** Saldo actual del ladron. */
  readonly thiefBalance: number;
  /** Saldo actual de la victima. */
  readonly victimBalance: number;
  /**
   * Parte del saldo de la victima que esta en su caja fuerte y no se puede
   * tocar. Cuenta dentro de `victimBalance`, asi que lo robable es la
   * diferencia.
   */
  readonly victimProtected?: number;
  /**
   * Fichas de la victima que SI se pueden robar.
   *
   * Es `sellableChips`: el excedente sobre lo comprado con Telegram Stars. Lo
   * pagado con dinero real **no entra aqui y no puede entrar nunca** — ver la
   * cabecera de `CHIP_REASONS` en `packages/data`. Robar eso no seria un
   * cambio de juego, seria quitarle a alguien algo que pago.
   *
   * Existe porque meter todas las monedas en fichas se habia convertido en la
   * forma de esquivar `/robar`: la caja fuerte tiene tope y limite, y el
   * casino no tenia ninguno.
   *
   * Sin este campo el comportamiento es exactamente el de antes.
   */
  readonly victimSellableChips?: number;
  /** Robos con exito que acumula el ladron, para la progresion. */
  readonly successfulSteals: number;
  /** Cuando robo por ultima vez, o undefined si nunca. */
  readonly lastStealMs: number | undefined;
  /** Cuando robaron por ultima vez a la victima, o undefined. */
  readonly victimLastRobbedMs: number | undefined;
  /**
   * Si la victima tiene saldo sin fondo (`unlimited` en su cartera).
   *
   * Sin este campo el comportamiento es exactamente el de antes.
   */
  readonly victimUnlimited?: boolean;
  /** Si el ladron y la victima son la misma persona. */
  readonly samePerson: boolean;
  /** Tirada ya sorteada, en [0,1). */
  readonly roll: number;
  /** Si la purga esta abierta: sin esperas, sin escudos y mas probabilidad. */
  readonly purge: boolean;
  /** Lo que aportan los objetos de las dos partes, ya traducido a numeros. */
  readonly modifiers?: StealModifiers;
}

export interface StealOutcome {
  /** Si el intento llego a resolverse (con exito o sin el). */
  readonly attempted: boolean;
  /** Motivo por el que ni se intento. */
  readonly refusal?: StealRefusal;
  /** Segundos que faltan, cuando el motivo es una espera. */
  readonly retryAfterSeconds?: number;
  /** Si salio bien. */
  readonly success: boolean;
  /** Botin si salio bien, multa si no. Siempre >= 0. */
  readonly amount: number;
  /** La probabilidad que se aplico, para poder contarla en el mensaje. */
  readonly chancePct: number;
  /**
   * Cuanto de `amount` sale de las FICHAS de la victima.
   *
   * Se cobra primero de las monedas y solo despues de las fichas, asi que con
   * una victima que tenga monedas sueltas esto es 0 y todo se comporta como
   * siempre. Quien llame tiene que mover las dos cosas: `amount - fromChips`
   * en monedas y `fromChips` en fichas.
   */
  readonly amountFromChips: number;
}

/** Durante la purga la probabilidad sube de golpe: es lo que la hace un evento
 * y no "media hora con menos cooldown". */
const PURGE_BONUS_PCT = 20;

const clampPct = (value: number): number => Math.min(100, Math.max(0, value));

const enteroNoNegativo = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/**
 * La probabilidad efectiva de un ladron, ya con su progresion, el techo, la
 * purga y lo que lleven encima los dos.
 *
 * El techo se aplica ANTES del empujon de la purga a proposito: si no, el techo
 * dejaria de significar nada justo el dia en que mas gente esta robando. Los
 * objetos entran despues, por lo mismo, y por eso hace falta el tope duro del
 * final: es lo unico que impide que comprar sea ganar.
 */
export const stealChancePct = (
  settings: StealSettings,
  successfulSteals: number,
  purge: boolean,
  modifiers?: StealModifiers,
): number => {
  const progresion =
    enteroNoNegativo(successfulSteals) * settings.chancePerLevelPct;
  const conTecho = Math.min(
    settings.maxChancePct,
    settings.baseChancePct + progresion,
  );
  const conPurga = purge ? conTecho + PURGE_BONUS_PCT : conTecho;
  const empuje = Math.max(0, modifiers?.attackerBonusPct ?? 0);
  // El tope duro limita lo que EMPUJAN los objetos, no lo que ya habia. Un
  // grupo que configure el 100 y lo suba con la purga sigue en 100: bajarselo
  // seria decidir por el admin desde aqui. Lo que no puede pasar es que la
  // ventaja comprada sea la que te suba ahi.
  const conAtaque =
    empuje > 0
      ? Math.max(conPurga, Math.min(conPurga + empuje, MAX_TOTAL_CHANCE_PCT))
      : conPurga;
  return clampPct(conAtaque - Math.max(0, modifiers?.victimGuardPct ?? 0));
};

/** Segundos que faltan para que expire una espera, o 0 si ya paso. */
const faltan = (
  desdeMs: number | undefined,
  nowMs: number,
  duracionSegundos: number,
): number => {
  if (desdeMs === undefined || duracionSegundos <= 0) {
    return 0;
  }
  const finMs = desdeMs + duracionSegundos * 1000;
  return finMs <= nowMs ? 0 : Math.ceil((finMs - nowMs) / 1000);
};

const rechazo = (
  refusal: StealRefusal,
  retryAfterSeconds?: number,
): StealOutcome => ({
  attempted: false,
  refusal,
  success: false,
  amount: 0,
  amountFromChips: 0,
  chancePct: 0,
  ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
});

/**
 * Decide un intento de robo.
 *
 * El orden de las comprobaciones es el orden en que hay que explicarselas a
 * quien lo intenta: primero lo que nunca va a poder hacer (esta apagado, es el
 * mismo), luego lo que depende del tiempo, y por ultimo lo que depende de los
 * saldos. Al reves, alguien sin saldo veria "espera 20 minutos" y volveria a
 * los 20 minutos para que le dijeran que no tiene dinero.
 */
export const resolveSteal = (input: StealInput): StealOutcome => {
  const { settings, nowMs } = input;
  if (!settings.enabled) {
    return rechazo("disabled");
  }
  if (input.samePerson) {
    return rechazo("self");
  }

  // A una cartera con saldo sin fondo no se le puede robar, y no es un favor:
  // es que el golpe ACUÑABA moneda. Su saldo esta congelado, asi que la victima
  // no perdia nada y al ladron se le pagaba el botin igual — dinero nuevo de la
  // nada en cada robo con exito.
  //
  // Va por delante de la purga, del escudo y de la espera a proposito. Los
  // otros rechazos son respiros que se agotan o cosas que alguien ha comprado;
  // este no se puede levantar ni el dia del evento, porque no protege un saldo:
  // dice que ahi no hay saldo que proteger.
  if (input.victimUnlimited === true) {
    return rechazo("victim-unlimited");
  }

  // El comodin SOLO vale dentro de la purga, que es lo que promete el
  // escaparate ("intocable durante la proxima purga"). Comprobarlo sin mirar
  // `purge` lo convertia en una trampa: quien llama consume el objeto al ver
  // este rechazo, asi que bastaba un /robar cualquier martes para que la
  // victima perdiera 5.000 monedas evitando un golpe de 500 como mucho, y
  // encima el dia de la purga ya no le quedaba nada con que pararla.
  //
  // Dentro de la purga si va delante de las esperas y del escudo: ahi es donde
  // tiene que ganar a todo, porque es lo unico que para el evento.
  if (input.purge && input.modifiers?.victimImmune) {
    return rechazo("immune");
  }

  // En purga la espera se acorta, no desaparece. La barra libre total dejaba
  // robar tan rapido como se pudiera escribir, y eso llenaba el chat y movia
  // una fortuna en cinco minutos. Con 0 el comportamiento es el de antes.
  const esperaBase = input.purge
    ? settings.purgeCooldownSeconds
    : settings.cooldownSeconds;
  // El recorte se aplica sobre la espera que TOQUE, purga incluida. Acortar
  // solo la normal dejaria al zorro sin su ventaja justo el dia del evento,
  // que es cuando mas se roba.
  //
  // Se acota a [0,1]: un multiplicador mayor que uno seria una espera mas
  // larga, y ninguna especie declara eso. Un valor corrupto no puede
  // convertir una ventaja en un castigo.
  const recorte = input.modifiers?.cooldownMultiplier;
  const factorDeEspera =
    recorte !== undefined && Number.isFinite(recorte)
      ? Math.min(1, Math.max(0, recorte))
      : 1;
  const esperaAplicable = Math.ceil(esperaBase * factorDeEspera);
  const espera = input.modifiers?.ignoreCooldown
    ? 0
    : faltan(input.lastStealMs, nowMs, esperaAplicable);
  if (espera > 0) {
    return rechazo("cooldown", espera);
  }

  // El escudo de la victima si se ignora entero durante la purga: si no, media
  // hora despues del primer golpe ya no quedaria nadie a quien robar y el
  // evento se apagaria solo.
  if (!input.purge && !input.modifiers?.ignoreVictimShield) {
    const escudo = faltan(
      input.victimLastRobbedMs,
      nowMs,
      settings.victimShieldSeconds,
    );
    if (escudo > 0) {
      return rechazo("shielded", escudo);
    }
  }

  // Lo que de verdad esta expuesto: el saldo menos su caja fuerte. Todas las
  // comprobaciones de aqui abajo usan ESTE numero y no el saldo, o alguien con
  // 6.000 intocables y 10 sueltos seguiria pareciendo un objetivo jugoso.
  const expuesto = Math.max(
    0,
    input.victimBalance - Math.max(0, input.victimProtected ?? 0),
  );
  // Las fichas que se pueden cambiar por monedas cuentan como saldo a efectos
  // de robo, y por el mismo motivo por el que se pueden cambiar: son valor del
  // juego, no dinero real. Meterlo todo en fichas era la forma de esquivar
  // `/robar` — la caja fuerte tiene tope y el casino no tenia ninguno.
  const fichasRobables = Math.max(0, input.victimSellableChips ?? 0);
  const bote = expuesto + fichasRobables;
  if (bote < settings.minVictimBalance) {
    return rechazo("victim-too-poor");
  }

  // La multa hay que poder pagarla. Sin esto, quien esta a cero roba gratis:
  // gana a veces y cuando falla no pierde nada, que es exactamente el incentivo
  // contrario al que busca el castigo.
  //
  // Quien lleva guante SI puede robar sin poder pagarla, y no es un descuido:
  // eso es exactamente lo que ha comprado, y lo ha pagado antes de intentarlo.
  // La diferencia con robar gratis es que el guante se gasta.
  const sinMulta = input.modifiers?.skipFine === true;
  // Un grupo puede dejar `finePct` o `fineMax` a 0 desde la Mini App, y eso es
  // "no he puesto multa", no "el ladron esta seco". Son dos ceros distintos y
  // confundirlos apagaba `/robar` para TODO el grupo con el mensaje mas injusto
  // posible: a quien lo intentara con la cartera llena se le decia que no tenia
  // ni para pagar la multa. Mismo criterio que los precios de la tienda
  // (`parsePrecios` en `shop.ts`): en un campo numerico editado a mano, el 0
  // casi siempre significa "no he puesto nada".
  //
  // No hace falta un rechazo nuevo para distinguirlo porque no hay nada que
  // rechazar: sin multa configurada el robo se intenta igual y fallar sale
  // gratis, que es justo lo que el admin pidio. `thief-broke` se queda para lo
  // que nombra — el ladron no tiene saldo con el que responder.
  const grupoSinMulta = settings.finePct <= 0 || settings.fineMax <= 0;
  // El espejo multiplica la multa DESPUES del tope del grupo: si multiplicara
  // antes, el tope se la comeria entera y el objeto no haria nada. El guante
  // gana al espejo, y es la lectura correcta — quien pago por no arriesgar, no
  // arriesga.
  //
  // El total se topa ademas al saldo del ladron, y eso NO es cosmetico: sin
  // ese tope, doblar la multa podia dejarla por encima de lo que el ladron
  // tiene, el cobro fallaba entero y la victima se quedaba sin nada. El objeto
  // que la protege la habria dejado peor que no tenerlo.
  const multa =
    sinMulta || grupoSinMulta
      ? 0
      : Math.min(
          input.thiefBalance,
          Math.min(
            settings.fineMax,
            Math.floor((input.thiefBalance * settings.finePct) / 100),
          ) * Math.max(1, input.modifiers?.fineMultiplier ?? 1),
        );
  if (!sinMulta && !grupoSinMulta && multa <= 0) {
    return rechazo("thief-broke");
  }

  const chancePct = stealChancePct(
    settings,
    input.successfulSteals,
    input.purge,
    input.modifiers,
  );
  const success = input.roll * 100 < chancePct;

  if (!success) {
    return {
      attempted: true,
      success: false,
      amount: multa,
      // La multa la paga el ladron de SU saldo. Las fichas no entran: es un
      // castigo, no un segundo robo.
      amountFromChips: 0,
      chancePct,
    };
  }

  // El botin sale del saldo EXPUESTO, y ademas se topa a el: sin ese segundo
  // tope, un porcentaje alto sobre un saldo grande podria llevarse mas de lo
  // que estaba fuera de la caja fuerte y vaciarla por la puerta de atras.
  //
  // El saco multiplica el botin Y su tope, no solo el tope. Subiendo solo el
  // tope no haria nada salvo contra victimas ricas —es el porcentaje el que
  // manda mientras el saldo sea normal—, y un objeto que unas veces sirve y
  // otras no sin que se pueda saber de antemano es un objeto que no se vuelve
  // a comprar.
  //
  // El techo del saldo expuesto no se multiplica nunca: un objeto de 350 no
  // puede vaciar de un golpe todo lo que alguien tenia fuera de la caja fuerte.
  const multiplicador = Math.max(1, input.modifiers?.lootMultiplier ?? 1);
  const botin = Math.min(
    bote,
    settings.lootMax * multiplicador,
    Math.floor((bote * settings.lootPct) / 100) * multiplicador,
  );
  const cobrado = Math.max(1, botin);
  // Monedas primero, fichas para lo que falte. Con una victima que tenga
  // monedas sueltas esto deja `amountFromChips` en 0 y no cambia nada.
  const deFichas = Math.max(0, Math.min(fichasRobables, cobrado - expuesto));
  return {
    attempted: true,
    success: true,
    amountFromChips: deFichas,
    // Un botin de 0 por redondeo convertiria un robo con exito en un mensaje
    // absurdo ("te he robado 0"). Con el suelo de saldo esto casi no pasa, pero
    // basta con que un admin baje `minVictimBalance` para que empiece a pasar.
    amount: cobrado,
    chancePct,
  };
};

/**
 * El botin escrito como lo que es: monedas y fichas por separado.
 *
 * Existe porque el mensaje decia el TOTAL con el nombre de la moneda del grupo,
 * y con una victima que tuviera el dinero en fichas eso era falso. Paso en
 * vivo: el ladron leyo "500 puntitoputitacoins" y la victima habia perdido 2
 * monedas. Las dos cosas eran ciertas —las otras 498 eran fichas— y ninguna de
 * las dos personas podia entender la otra.
 *
 * Con `deFichas` a 0 devuelve exactamente lo que devolvia antes, letra por
 * letra: la inmensa mayoria de los robos son solo de monedas y ese texto no
 * tenia nada malo.
 *
 * `formatMonedas` lo pone quien llama porque el nombre de la moneda es de cada
 * grupo. Las fichas no: son del casino y se llaman igual en todas partes.
 */
export const describirBotin = (input: {
  readonly total: number;
  readonly deFichas: number;
  readonly formatMonedas: (cantidad: number) => string;
}): string => {
  const fichas = Math.max(0, Math.min(input.deFichas, input.total));
  const monedas = input.total - fichas;
  if (fichas <= 0) {
    return input.formatMonedas(input.total);
  }
  if (monedas <= 0) {
    return `${fichas} fichas`;
  }
  return `${input.formatMonedas(monedas)} y ${fichas} fichas`;
};
