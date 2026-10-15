/**
 * La enfermedad grave: la unica forma en que una mascota puede morir.
 *
 * **No la decide el azar.** No hay tirada, no hay probabilidad diaria y no hay
 * lista de candidatas. La declara el propietario a mano, sobre una mascota
 * concreta, con un motivo escrito. Es deliberado: una enfermedad aleatoria que
 * puede costarte el bicho convierte la feature en una loteria con castigo, y lo
 * que la sostiene es justo lo contrario — que lo que le pase a tu mascota
 * dependa de lo que tu hagas.
 *
 * **Y no rompe la propiedad de que a hambre cero se duerme y no se muere.** Lo
 * que dice esa propiedad es que **el abandono no mata**: nadie pierde su bicho
 * por irse una semana. Aqui no mata el descuido, ni el reloj, ni una tirada:
 * mata una decision de una persona, con motivo, con factura, con plazo y con
 * tres avisos por delante. Son dos mecanismos distintos y el primero sigue
 * entero.
 *
 * La factura no es una cantidad suelta sino un **suelo**: la operacion deja la
 * cartera en `resto` exactamente. Se hizo asi porque el encargo era "que se
 * quede con 2500", y una resta congelada envejece mal — basta con que se gaste
 * ciento cincuenta monedas en una racion para que la cifra pactada ya no cuadre
 * con lo que tiene, y entonces no podria pagar aunque quisiera. Con un suelo,
 * eso no puede pasar.
 *
 * Pero el suelo solo, sin nada mas, seria un agujero: bastaria con vaciar la
 * cartera —regalarsela a un amigo, y que te la devuelva— para operar por cuatro
 * monedas. Por eso ademas se congela `coste`, que es la factura que se anuncio,
 * y al pagar se exige haber traido casi todo aquello. El `MARGEN` es lo que
 * separa "me he gastado la comida del bicho" de "he escondido el dinero".
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O. El tiempo entra por
 * parametro, como en el resto de `pets/`: la mitad de estos tests son "le
 * quedan treinta horas" contra "se le paso el plazo ayer", y eso no se prueba
 * tocando el reloj del proceso.
 */

/**
 * Cuanto se le perdona sobre la factura pactada.
 *
 * Existe para que cuidar al bicho durante el plazo no te impida salvarlo. En
 * setenta y dos horas caben seis raciones, que a precio de partida son 900
 * monedas: quien le da de comer mientras reune el dinero llegaria por debajo de
 * lo pactado y se quedaria sin operar por haberlo cuidado, que es exactamente
 * al reves de lo que esta feature quiere premiar.
 *
 * Cinco mil es holgado para eso y ridiculo para lo otro: nadie esconde una
 * fortuna en un margen de cinco mil monedas.
 */
export const MARGEN_DE_LA_FACTURA = 5_000;

/** Los numeros de la ficha clinica, tal y como se guardan. */
export interface Dolencia {
  /** Cuando se declaro. */
  readonly desde: Date;
  /** El motivo escrito por quien la declaro. */
  readonly motivo: string;
  /** La factura anunciada: lo que habia menos el resto. */
  readonly coste: number;
  /** Con cuanto se queda despues de pagar. */
  readonly resto: number;
  /** Cuando se acaba el plazo. */
  readonly vence: Date;
}

/** Lo que hace falta saber de una mascota para hablar de su salud. */
export interface FichaClinica {
  readonly enfermaDesde: Date | null;
  readonly curaCoste: number | null;
  readonly curaResto: number | null;
  readonly curaVence: Date | null;
  readonly curaAvisos: number;
  readonly fallecidaEn: Date | null;
}

/**
 * En que punto esta.
 *
 * `vencida` y `muerta` son distintas a proposito: entre que se acaba el plazo y
 * que pasa el barrido hay hasta quince minutos, y durante ese rato la mascota
 * ya no se puede salvar pero todavia no ha muerto. Confundirlas dejaria pagar
 * una operacion fuera de plazo, que es la peor forma de que esto falle: cobras
 * cientos de millones por un bicho que se iba a morir igual.
 */
export type EstadoDeSalud = "sana" | "enferma" | "vencida" | "muerta";

export const estadoDeSalud = (
  ficha: FichaClinica,
  ahora: Date,
): EstadoDeSalud => {
  if (ficha.fallecidaEn !== null) {
    return "muerta";
  }
  if (ficha.enfermaDesde === null) {
    return "sana";
  }
  if (
    ficha.curaVence !== null &&
    ficha.curaVence.getTime() <= ahora.getTime()
  ) {
    return "vencida";
  }
  return "enferma";
};

/** Cuanto le queda, en milisegundos. Cero si ya se le paso o no esta enferma. */
export const msHastaElPlazo = (ficha: FichaClinica, ahora: Date): number => {
  if (ficha.curaVence === null || estadoDeSalud(ficha, ahora) !== "enferma") {
    return 0;
  }
  return Math.max(0, ficha.curaVence.getTime() - ahora.getTime());
};

/** Por que no se puede declarar la enfermedad. */
export type FalloAlDiagnosticar =
  | "sinMascota"
  | "yaEnferma"
  | "yaMuerta"
  | "dormida"
  | "sinSaldo"
  | "sinMotivo";

export type Diagnostico =
  | { readonly ok: true; readonly dolencia: Dolencia }
  | { readonly ok: false; readonly motivo: FalloAlDiagnosticar };

export interface PeticionDeDiagnostico {
  readonly ficha: FichaClinica;
  /** El hambre de ahora, ya envejecida por quien tiene el reloj. */
  readonly hambre: number;
  /** El saldo de su dueño en este momento. De aqui sale la factura. */
  readonly saldo: number;
  /** Con cuanto se queda despues de operar. */
  readonly resto: number;
  readonly horasDePlazo: number;
  readonly motivo: string;
  readonly ahora: Date;
}

/**
 * Declara la enfermedad, o dice por que no.
 *
 * Las tres negativas que no son evidentes:
 *
 * - **`yaEnferma`**: reenfermar reiniciaria el plazo por accidente, y es el
 *   fallo mas facil de cometer — escribes el mando dos veces porque no viste la
 *   primera respuesta, y le regalas tres dias mas.
 * - **`dormida`**: a hambre cero lleva dias sin dueño. La factura no la va a
 *   leer nadie y el plazo vence solo. Eso no es una decision, es un accidente
 *   con pasos extra; antes hay que despertarla.
 * - **`sinSaldo`**: sin dinero por encima del resto no hay factura que valga.
 *   Una operacion de cero monedas no es una operacion, y la alternativa
 *   —matarla porque no tiene nada— es castigar la pobreza, que no es lo que
 *   esto hace.
 */
export const diagnosticar = (peticion: PeticionDeDiagnostico): Diagnostico => {
  const { ficha, hambre, saldo, resto, horasDePlazo, motivo, ahora } = peticion;

  const salud = estadoDeSalud(ficha, ahora);
  if (salud === "muerta") {
    return { ok: false, motivo: "yaMuerta" };
  }
  if (salud !== "sana") {
    return { ok: false, motivo: "yaEnferma" };
  }
  if (hambre <= 0) {
    return { ok: false, motivo: "dormida" };
  }
  const limpio = motivo.trim();
  if (!limpio) {
    return { ok: false, motivo: "sinMotivo" };
  }

  const sueloValido = Number.isInteger(resto) && resto >= 0 ? resto : 0;
  const coste = Math.floor(saldo) - sueloValido;
  if (coste <= 0) {
    return { ok: false, motivo: "sinSaldo" };
  }

  const horas =
    Number.isFinite(horasDePlazo) && horasDePlazo > 0 ? horasDePlazo : 72;

  return {
    ok: true,
    dolencia: {
      desde: ahora,
      motivo: limpio,
      coste,
      resto: sueloValido,
      vence: new Date(ahora.getTime() + horas * 3_600_000),
    },
  };
};

/** Por que no se puede operar. */
export type FalloAlOperar =
  | "sinMascota"
  | "sanaYa"
  | "yaMuerta"
  | "fueraDePlazo"
  | "noLlega";

export type DecisionDeOperar =
  | {
      readonly ok: true;
      /** Lo que hay que cobrar ahora mismo. */
      readonly aPagar: number;
      /** Con cuanto se queda. Es el suelo pactado. */
      readonly resto: number;
    }
  | {
      readonly ok: false;
      readonly motivo: FalloAlOperar;
      /** La factura pactada, para poder decirla en la negativa. */
      readonly coste: number;
      readonly saldo: number;
    };

/**
 * Decide si se puede operar y por cuanto.
 *
 * Lo que se cobra es **lo que sobre del suelo**, no la factura congelada. Las
 * dos coinciden si no se ha tocado nada, y cuando no coinciden manda el suelo:
 * el encargo era "que se quede con 2500", no "cobrale exactamente esta cifra".
 *
 * La factura congelada sigue haciendo falta, y hace de **minimo**: si lo que
 * trae se queda corto por mas del margen, es que ha escondido el dinero, y
 * entonces no hay operacion. Sin esa comprobacion bastaria con vaciar la
 * cartera un minuto para salvar al bicho por cuatro monedas.
 */
export const decidirOperacion = (peticion: {
  readonly ficha: FichaClinica;
  readonly saldo: number;
  readonly ahora: Date;
}): DecisionDeOperar => {
  const { ficha, saldo, ahora } = peticion;
  const coste = ficha.curaCoste ?? 0;
  const resto = ficha.curaResto ?? 0;

  const salud = estadoDeSalud(ficha, ahora);
  if (salud === "muerta") {
    return { ok: false, motivo: "yaMuerta", coste, saldo };
  }
  if (salud === "sana") {
    return { ok: false, motivo: "sanaYa", coste, saldo };
  }
  if (salud === "vencida") {
    return { ok: false, motivo: "fueraDePlazo", coste, saldo };
  }

  const aPagar = Math.floor(saldo) - resto;
  if (aPagar <= 0 || aPagar < coste - MARGEN_DE_LA_FACTURA) {
    return { ok: false, motivo: "noLlega", coste, saldo };
  }
  return { ok: true, aPagar, resto };
};

/**
 * Cuantos recordatorios deberian haber salido ya.
 *
 * Devuelve un NUMERO y no un booleano, y quien llama lo compara con
 * `curaAvisos`. Es lo que hace que el barrido no pueda mandar el mismo aviso
 * dos veces ni saltarse uno porque el worker estuvo caido media hora: el estado
 * es "cuantos van", no "toca ahora".
 *
 * Dos avisos y no cinco. Uno a mitad de plazo, cuando todavia da tiempo a
 * reaccionar, y otro al final, cuando ya es ahora o nunca. Mas seria acoso, y
 * el acoso a trescientas personas a la vez es la forma de incidente que ya
 * conocemos.
 */
export const HORAS_DE_AVISO: readonly number[] = [24, 6];

export const avisosQueTocan = (ficha: FichaClinica, ahora: Date): number => {
  if (ficha.curaVence === null || estadoDeSalud(ficha, ahora) !== "enferma") {
    return 0;
  }
  const horasQueQuedan =
    (ficha.curaVence.getTime() - ahora.getTime()) / 3_600_000;
  return HORAS_DE_AVISO.filter((umbral) => horasQueQuedan <= umbral).length;
};

/** Si al barrido le toca matarla ya. */
export const tocaFallecer = (ficha: FichaClinica, ahora: Date): boolean =>
  estadoDeSalud(ficha, ahora) === "vencida";

/**
 * Si todavia esta de duelo y no puede tener otra.
 *
 * El duelo es lo que hace que la muerte cueste algo. Sin el, quien pierde el
 * bicho se compra un huevo en diez segundos y no ha perdido nada: ha
 * reiniciado.
 *
 * Corto a proposito. Lo que de verdad se ha perdido es **ese** bicho —con su
 * nivel, su nombre y sus rasgos, y si era de las que no salen de ningun huevo,
 * para siempre—, y alargar la espera no aumenta esa perdida: solo aleja a
 * alguien del grupo justo cuando acaba de llevarse un disgusto.
 */
export const sigueDeDuelo = (
  ficha: FichaClinica,
  horasDeDuelo: number,
  ahora: Date,
): boolean => {
  if (ficha.fallecidaEn === null) {
    return false;
  }
  const horas =
    Number.isFinite(horasDeDuelo) && horasDeDuelo > 0 ? horasDeDuelo : 0;
  return ahora.getTime() - ficha.fallecidaEn.getTime() < horas * 3_600_000;
};

/** Lo que queda de duelo, en milisegundos. Cero si ya se puede tener otra. */
export const msDeDuelo = (
  ficha: FichaClinica,
  horasDeDuelo: number,
  ahora: Date,
): number => {
  if (!sigueDeDuelo(ficha, horasDeDuelo, ahora) || ficha.fallecidaEn === null) {
    return 0;
  }
  return Math.max(
    0,
    ficha.fallecidaEn.getTime() + horasDeDuelo * 3_600_000 - ahora.getTime(),
  );
};
