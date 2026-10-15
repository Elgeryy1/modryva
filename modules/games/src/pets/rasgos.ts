/**
 * Los rasgos: la capa que hace que dos bichos de la misma especie no sean el
 * mismo bicho.
 *
 * Cada mascota nace con uno o dos, y **todos son pequeños a proposito**. Esa es
 * la propiedad que los hace baratos: seis especies por doce rasgos son setenta y
 * dos combinaciones, y ninguna obliga a rehacer el balance, porque un rasgo
 * mueve como mucho un diez por ciento o cambia una regla de una linea.
 *
 * Tienen ademas una funcion que no se ve a primera vista: **impiden que un
 * duplicado sea una decepcion**. Con un catalogo grande, sacar la segunda abeja
 * va a pasar; si la segunda abeja fuera identica a la primera, el huevo habria
 * salido vacio. Con rasgos, es otra abeja.
 *
 * Y dos de ellos —`dormilon` y `frugal`— existen para quien entra poco al
 * grupo, que es la misma preocupacion que resuelve la ardilla por otro camino.
 * Un diseño que solo premia la visita diaria le dice a media plantilla que esto
 * no es para ellos.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

/** Identificador de rasgo. Sin tildes: viaja a la base de datos. */
export type RasgoId =
  | "madrugador"
  | "nocturno"
  | "gloton"
  | "frugal"
  | "dormilon"
  | "nervioso"
  | "fiel"
  | "terco"
  | "viajero"
  | "peleon"
  | "timido"
  | "sociable";

/**
 * Los efectos de un rasgo, ya en numeros.
 *
 * Es un registro de modificadores y no una union discriminada como
 * `EfectoDeEspecie` porque un rasgo puede tocar varias cosas a la vez y todas
 * son del mismo tipo: multiplicadores sobre valores que ya existen. Los que no
 * toca se quedan en su neutro, que esta escrito abajo.
 */
export interface EfectoDeRasgo {
  /** Multiplica el rendimiento diario. */
  readonly rendimiento: number;
  /** Multiplica lo que baja el hambre con el tiempo. Menos es mejor. */
  readonly hambre: number;
  /** Multiplica cuanto sube y baja el animo. */
  readonly animo: number;
  /** Multiplica lo que come de una racion. */
  readonly apetito: number;
  /** Multiplica la fuerza en la arena. */
  readonly arena: number;
  /** Si se puede dejar en la guarderia. */
  readonly sePresta: boolean;
}

/**
 * El rasgo que no hace nada: la referencia contra la que se leen los demas.
 *
 * Existe escrito para que cada rasgo declare SOLO lo que cambia, y para que
 * añadir un campo a `EfectoDeRasgo` no obligue a tocar los doce.
 */
export const RASGO_NEUTRO: EfectoDeRasgo = {
  rendimiento: 1,
  hambre: 1,
  animo: 1,
  apetito: 1,
  arena: 1,
  sePresta: true,
};

export interface Rasgo {
  readonly id: RasgoId;
  /** Como se llama para quien juega. Con tildes: es copy. */
  readonly nombre: string;
  /** Que hace, en pocas palabras. Se lee en la ficha. */
  readonly descripcion: string;
  readonly efecto: EfectoDeRasgo;
}

/** Atajo para declarar un rasgo cambiando solo lo suyo. */
const conEfecto = (cambios: Partial<EfectoDeRasgo>): EfectoDeRasgo => ({
  ...RASGO_NEUTRO,
  ...cambios,
});

export const RASGOS: Record<RasgoId, Rasgo> = {
  // Los dos de horario son el mismo rasgo mirado desde los dos lados. El
  // interprete decide que franja es cual; aqui solo se declara la ventaja, que
  // es la misma para los dos.
  madrugador: {
    id: "madrugador",
    nombre: "Madrugador",
    descripcion: "Rinde más por la mañana.",
    efecto: conEfecto({ rendimiento: 1.1 }),
  },
  nocturno: {
    id: "nocturno",
    nombre: "Nocturno",
    descripcion: "Rinde más de noche.",
    efecto: conEfecto({ rendimiento: 1.1 }),
  },
  gloton: {
    id: "gloton",
    nombre: "Glotón",
    descripcion: "Come más, pero también rinde más.",
    efecto: conEfecto({ rendimiento: 1.1, apetito: 1.25 }),
  },
  frugal: {
    id: "frugal",
    nombre: "Frugal",
    descripcion: "Come poco y rinde poco. Sale barato.",
    efecto: conEfecto({ rendimiento: 0.9, apetito: 0.75 }),
  },
  dormilon: {
    id: "dormilon",
    nombre: "Dormilón",
    descripcion: "El hambre le baja despacio. Aguanta bien que no estés.",
    efecto: conEfecto({ hambre: 0.7 }),
  },
  nervioso: {
    id: "nervioso",
    nombre: "Nervioso",
    descripcion: "El ánimo le sube y le baja el doble de rápido.",
    efecto: conEfecto({ animo: 2 }),
  },
  fiel: {
    id: "fiel",
    nombre: "Fiel",
    descripcion: "Cuanto más tiempo lleva contigo, más rinde.",
    // El neutro es el correcto: la ventaja del fiel la calcula quien sabe
    // cuanto tiempo lleva, que no es este fichero. Declararla aqui como un
    // numero fijo seria mentir.
    efecto: conEfecto({}),
  },
  terco: {
    id: "terco",
    nombre: "Terco",
    descripcion: "No se deja cuidar por nadie más.",
    efecto: conEfecto({ sePresta: false }),
  },
  viajero: {
    id: "viajero",
    nombre: "Viajero",
    descripcion: "Vuelve de las expediciones con más cosas.",
    efecto: conEfecto({}),
  },
  peleon: {
    id: "peleon",
    nombre: "Peleón",
    descripcion: "Mejor en la arena, peor en casa.",
    efecto: conEfecto({ rendimiento: 0.9, arena: 1.2 }),
  },
  timido: {
    id: "timido",
    nombre: "Tímido",
    descripcion: "Peor en la arena, mejor en casa.",
    efecto: conEfecto({ rendimiento: 1.1, arena: 0.8 }),
  },
  sociable: {
    id: "sociable",
    nombre: "Sociable",
    descripcion: "Rinde más si tiene con quién jugar en el grupo.",
    efecto: conEfecto({}),
  },
};

export const RASGOS_EN_ORDEN: readonly RasgoId[] = [
  "madrugador",
  "nocturno",
  "gloton",
  "frugal",
  "dormilon",
  "nervioso",
  "fiel",
  "terco",
  "viajero",
  "peleon",
  "timido",
  "sociable",
];

/** Si un texto cualquiera es un id de rasgo conocido. */
export const esRasgoId = (valor: string): valor is RasgoId =>
  Object.hasOwn(RASGOS, valor);

/**
 * Los rasgos que no pueden convivir en el mismo bicho.
 *
 * Un bicho madrugador y nocturno a la vez rinde mas a todas horas, que es
 * justo lo que ningun rasgo debe hacer. Y gloton y frugal se contradicen en la
 * frase misma. Se guardan como pares y no como "grupos excluyentes" porque hoy
 * son dos casos y una estructura mas general seria mas dificil de leer que el
 * problema que resuelve.
 */
export const PARES_INCOMPATIBLES: readonly (readonly [RasgoId, RasgoId])[] = [
  ["madrugador", "nocturno"],
  ["gloton", "frugal"],
  ["peleon", "timido"],
];

/** Si dos rasgos pueden estar en la misma mascota. */
export const sonCompatibles = (uno: RasgoId, otro: RasgoId): boolean => {
  if (uno === otro) {
    return false;
  }
  return !PARES_INCOMPATIBLES.some(
    ([a, b]) => (a === uno && b === otro) || (a === otro && b === uno),
  );
};

/**
 * Junta los efectos de los rasgos de un bicho en uno solo.
 *
 * Los multiplicadores se multiplican entre si y `sePresta` es un `y` logico:
 * basta un rasgo que lo impida para que no se pueda prestar. Con la lista vacia
 * devuelve el neutro, que es lo que hace que el resto del motor no tenga que
 * preguntar nunca si el bicho tiene rasgos.
 */
export const combinarRasgos = (rasgos: readonly RasgoId[]): EfectoDeRasgo =>
  rasgos.reduce<EfectoDeRasgo>((acumulado, id) => {
    const efecto = RASGOS[id]?.efecto;
    if (!efecto) {
      return acumulado;
    }
    return {
      rendimiento: acumulado.rendimiento * efecto.rendimiento,
      hambre: acumulado.hambre * efecto.hambre,
      animo: acumulado.animo * efecto.animo,
      apetito: acumulado.apetito * efecto.apetito,
      arena: acumulado.arena * efecto.arena,
      sePresta: acumulado.sePresta && efecto.sePresta,
    };
  }, RASGO_NEUTRO);
