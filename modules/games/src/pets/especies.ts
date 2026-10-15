/**
 * El catalogo de especies.
 *
 * **Regla que sostiene el fichero entero: las especies son DATOS, no código.**
 * Cada una es una entrada de este registro con su efecto declarado, igual que
 * `GAME_CATALOG` y `SHOP_BY_ID`. En cuanto una especie necesite su propia rama
 * en un `if` de otro fichero, el catalogo deja de poder crecer — y el plan pide
 * que crezca por tandas hasta veinticinco mas cinco legendarias.
 *
 * Por eso `EfectoDeEspecie` es una union discriminada: quien calcula el
 * rendimiento hace `switch` sobre la CLASE de efecto, que son pocas y estables,
 * no sobre la especie, que son muchas y crecen.
 *
 * Aqui viven hoy las **seis comunes**, una por familia, que es con lo que
 * arranca la fase 1. Las demas entran despues, y cada tanda es una entrada mas
 * y sus tests. Una especie declarada cuyo efecto no sepa calcular nadie seria
 * una especie que se saca de un huevo y no hace nada: por eso no se declaran
 * antes de que su clase de efecto exista.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import type { FamiliaId } from "./familias.js";

/**
 * Como de dificil es que salga.
 *
 * Las tres primeras son la escala del huevo. Las otras dos **no salen de ningun
 * huevo**, y por eso son categorias aparte y no escalones mas altos: meterlas
 * en la misma escala haria pensar que basta con abrir huevos suficientes.
 *
 * - `legendaria` se consigue por un hito del grupo.
 * - `staff` es de una persona concreta del equipo, y **no la puede tener nadie
 *   mas**. Ni siquiera otro del staff: cada una tiene un solo dueño.
 * - `exclusiva` es del propietario del bot. Separada de `staff` a proposito:
 *   `staff` cuelga de un puesto y el dia que alguien lo deja se le puede
 *   retirar; esta no cuelga de nada, no se reparte y no crece. Mezclarlas
 *   haria que "las mascotas del equipo" incluyera una que no lo es.
 */
export type Rareza =
  | "comun"
  | "pocoComun"
  | "raro"
  | "legendaria"
  | "staff"
  | "exclusiva";

/**
 * Las rarezas que NO salen de ningun huevo.
 *
 * Escrito como lista y no como comparaciones sueltas porque hay tres sitios que
 * lo preguntan —la eclosion, el corral y los tests— y la tercera vez que se
 * escribe `!== "legendaria"` a mano es la vez que alguien olvida añadir la
 * siguiente.
 */
export const RAREZAS_FUERA_DEL_HUEVO: readonly Rareza[] = [
  "legendaria",
  "staff",
  "exclusiva",
];

/** Si una especie puede salir de un huevo. */
export const saleDeHuevo = (rareza: Rareza): boolean =>
  !RAREZAS_FUERA_DEL_HUEVO.includes(rareza);

/** Identificador de especie. Sin tildes: viaja a la base de datos y a la URL. */
export type EspecieId =
  // Bolsa
  | "abeja"
  | "ardilla"
  | "hormiga"
  | "cerdito"
  // Sombra
  | "zorro"
  | "mapache"
  | "murcielago"
  | "serpiente"
  // Muro
  | "tortuga"
  | "caracol"
  | "erizo"
  | "castor"
  // Pluma
  | "buho"
  | "elefante"
  | "loro"
  | "pulpo"
  // Lazo
  | "perro"
  | "gato"
  | "paloma"
  | "oveja"
  | "pollito"
  // Azar
  | "rana"
  | "pato"
  | "camaleon"
  | "gatonegro"
  // Legendarias y staff: no salen de ningun huevo. Ver RAREZAS_FUERA_DEL_HUEVO.
  | "dragon"
  | "lobo"
  | "aguila"
  | "ballena"
  | "cisne"
  // Del staff: una por persona, y nadie mas puede tenerlas.
  | "caballo"
  | "pezglobo"
  | "liron"
  | "ciervo"
  | "leon"
  | "elefanteninja"
  | "ocelote"
  | "tiburon"
  | "noxel";

/**
 * Lo que hace una especie, declarado.
 *
 * Cada clase es un contrato con quien la interpreta. Añadir una especie que
 * reutiliza una clase existente es gratis; añadir una clase nueva obliga a
 * tocar el interprete, y es justo la señal que se quiere: significa que la
 * especie hace algo que el motor no sabia hacer.
 */
export type EfectoDeEspecie =
  /**
   * Renta diaria estable. `factor` multiplica la base del nivel: 1 es la
   * referencia, 1.3 es un tercio mas.
   */
  | { readonly clase: "renta"; readonly factor: number }
  /**
   * Renta diaria que se juega a una tirada entre `minimo` y `maximo` veces la
   * base. La esperanza matematica se queda por debajo de una `renta` estable
   * con el mismo techo: se paga la emocion con rendimiento medio.
   */
  | {
      readonly clase: "rentaAlAzar";
      readonly minimo: number;
      readonly maximo: number;
    }
  /**
   * Mejora el robo: recorta la espera y engorda el botin, los dos en tanto por
   * uno sobre lo que saldria sin mascota.
   */
  | {
      readonly clase: "roboMejorado";
      readonly esperaMenos: number;
      readonly botinMas: number;
    }
  /** Probabilidad (0..1) de que un robo contra su dueño no llegue a cobrarse. */
  | { readonly clase: "bloqueaRobo"; readonly probabilidad: number }
  /**
   * Energia extra al dia y puntos de mas en los juegos de ingenio. Dos numeros
   * y no dos especies porque van siempre juntos: es el mismo rasgo, "se le da
   * bien pensar".
   */
  | {
      readonly clase: "ingenio";
      readonly energiaExtra: number;
      readonly puntosExtra: number;
    }
  /** Gana animo cuando a su dueño le dan las gracias. */
  | { readonly clase: "animoPorGratitud"; readonly animoPorGracias: number }
  /**
   * No rinde a diario: acumula y suelta un pico cada `cadaDias`.
   *
   * Es la mascota de quien entra poco. Un diseño que solo premia la visita
   * diaria le dice a media plantilla del grupo que esto no es para ellos.
   */
  | {
      readonly clase: "rentaAcumulada";
      readonly cadaDias: number;
      readonly factor: number;
    }
  /** Rinde poco sola y mas cuanta mas compañia tenga en el grupo. */
  | {
      readonly clase: "rentaColectiva";
      readonly base: number;
      readonly porCompanera: number;
      readonly tope: number;
    }
  /** Rinde el doble en su franja horaria y menos fuera de ella. */
  | {
      readonly clase: "rentaPorHorario";
      readonly deNoche: boolean;
      readonly enSuFranja: number;
      readonly fuera: number;
    }
  /**
   * Renta fija que NO depende del animo.
   *
   * La mascota para quien no quiere una mascota: rinde menos que las demas y a
   * cambio da igual como este de animo. Su factor se aplica entero.
   */
  | { readonly clase: "rentaIndiferente"; readonly factor: number }
  /** Rinde mas cuanto mas limpia esta la semana del grupo. */
  | {
      readonly clase: "rentaPorBuenClima";
      readonly base: number;
      readonly porDiaLimpio: number;
      readonly tope: number;
    }
  /** Sube el tope de la caja fuerte de su dueño. */
  | { readonly clase: "topeDeCaja"; readonly extra: number }
  /** Roba objetos del inventario en vez de monedas. */
  | { readonly clase: "robaObjetos"; readonly probabilidad: number }
  /** Un robo fallido no gasta el objeto que se uso. */
  | { readonly clase: "ahorraObjeto"; readonly probabilidad: number }
  /** Lo robado vuelve solo, poco a poco. */
  | { readonly clase: "recuperaRobado"; readonly porDia: number }
  /** Quien falla al robarle, pierde algo. */
  | { readonly clase: "contraataca"; readonly castigo: number }
  /** Protege tambien a una persona que su dueño elija. */
  | { readonly clase: "protegeAOtro"; readonly probabilidad: number }
  /** Bonus en los juegos de memoria y palabras. */
  | { readonly clase: "memoria"; readonly puntosExtra: number }
  /** Una segunda oportunidad al dia en la trivia. */
  | { readonly clase: "segundaOportunidad"; readonly vecesAlDia: number }
  /** Recorta los cooldowns de todos los juegos. */
  | { readonly clase: "menosEspera"; readonly recorte: number }
  /** Bonus mientras su clan este activo. */
  | { readonly clase: "bonusDeClan"; readonly factor: number }
  /** Bonus por cada recien llegado que se queda. */
  | { readonly clase: "bonusPorNovato"; readonly porNovato: number }
  /** Bonus en el casino del grupo. */
  | { readonly clase: "bonusDeCasino"; readonly factor: number }
  /** Copia cada dia el bono del bicho que tenga al lado en el corral. */
  | { readonly clase: "copiaVecino" }
  /** Quien le rete en la arena empieza con penalizacion. */
  | { readonly clase: "penalizaRetador"; readonly castigo: number }
  /**
   * Un poco de todo. Solo las legendarias.
   *
   * Clase propia y no una lista de efectos sueltos: una legendaria tiene que
   * ser mejor de forma reconocible, no la suma de cuatro numeros que nadie
   * puede comparar de cabeza.
   */
  | { readonly clase: "legendaria"; readonly factor: number };

/** Una especie del catalogo. */
export interface Especie {
  readonly id: EspecieId;
  /** Como se llama para quien juega. Con tildes: es copy. */
  readonly nombre: string;
  /** El emoji. Es el retrato en el chat, donde no se puede pintar un SVG. */
  readonly glifo: string;
  readonly familia: FamiliaId;
  readonly rareza: Rareza;
  /** Una frase. Se lee en la ficha y en el momento de eclosionar. */
  readonly descripcion: string;
  readonly efecto: EfectoDeEspecie;
}

export const ESPECIES: Record<EspecieId, Especie> = {
  abeja: {
    id: "abeja",
    nombre: "Abeja",
    glifo: "🐝",
    familia: "bolsa",
    rareza: "comun",
    descripcion: "Trabaja todos los días y no se queja. La renta más alta.",
    efecto: { clase: "renta", factor: 1.3 },
  },
  zorro: {
    id: "zorro",
    nombre: "Zorro",
    glifo: "🦊",
    familia: "sombra",
    rareza: "comun",
    descripcion: "Sabe cuándo salir. Esperas menos para robar y te llevas más.",
    // Una cuarta parte menos de espera y un quinto mas de botin. Deliberadamente
    // modesto: el robo ya tiene sus propios objetos en la tienda y una mascota
    // que lo doblara los dejaria sin sentido.
    efecto: { clase: "roboMejorado", esperaMenos: 0.25, botinMas: 0.2 },
  },
  tortuga: {
    id: "tortuga",
    nombre: "Tortuga",
    glifo: "🐢",
    familia: "muro",
    rareza: "comun",
    descripcion: "No corre. No hace falta: a veces el robo rebota y ya está.",
    // Una de cada cinco. Por encima de eso el escudo de la tienda —que se paga
    // y se gasta— seria peor que un bicho que no cuesta nada mantener.
    efecto: { clase: "bloqueaRobo", probabilidad: 0.2 },
  },
  buho: {
    id: "buho",
    nombre: "Búho",
    glifo: "🦉",
    familia: "pluma",
    rareza: "comun",
    descripcion: "Se pasa la noche leyendo. Se le nota en la trivia.",
    efecto: { clase: "ingenio", energiaExtra: 2, puntosExtra: 1 },
  },
  perro: {
    id: "perro",
    nombre: "Perro",
    glifo: "🐕",
    familia: "lazo",
    rareza: "comun",
    descripcion: "Se pone contento cuando alguien te da las gracias.",
    efecto: { clase: "animoPorGratitud", animoPorGracias: 5 },
  },
  rana: {
    id: "rana",
    nombre: "Rana",
    glifo: "🐸",
    familia: "azar",
    rareza: "comun",
    descripcion: "Unos días trae el triple. Otros vuelve con las manos vacías.",
    // Esperanza 1.05 contra el 1.3 fijo de la abeja: la rana rinde menos de
    // media y a cambio a veces te alegra el dia. Si su esperanza igualara a la
    // abeja, la abeja no tendria ninguna razon de existir.
    efecto: { clase: "rentaAlAzar", minimo: 0, maximo: 2.1 },
  },

  // --- Bolsa ---
  ardilla: {
    id: "ardilla",
    nombre: "Ardilla",
    glifo: "🐿️",
    familia: "bolsa",
    rareza: "pocoComun",
    descripcion: "Guarda lo de cada día y te lo suelta todo junto.",
    // Cinco dias a 1.5 rinden mas que cinco a 1.3, y esa diferencia es lo que
    // se paga por no poder cobrar cuando te apetece.
    efecto: { clase: "rentaAcumulada", cadaDias: 5, factor: 1.5 },
  },
  hormiga: {
    id: "hormiga",
    nombre: "Hormiga",
    glifo: "🐜",
    familia: "bolsa",
    rareza: "pocoComun",
    descripcion: "Sola no es gran cosa. En grupo, otra historia.",
    efecto: {
      clase: "rentaColectiva",
      base: 0.6,
      porCompanera: 0.08,
      tope: 1.6,
    },
  },
  cerdito: {
    id: "cerdito",
    nombre: "Cerdito",
    glifo: "🐖",
    familia: "bolsa",
    rareza: "raro",
    descripcion: "No rinde nada. Lo que hace es que te quepa más a salvo.",
    efecto: { clase: "topeDeCaja", extra: 5000 },
  },

  // --- Sombra ---
  mapache: {
    id: "mapache",
    nombre: "Mapache",
    glifo: "🦝",
    familia: "sombra",
    rareza: "pocoComun",
    descripcion: "No le interesan las monedas. Le interesa lo que guardas.",
    efecto: { clase: "robaObjetos", probabilidad: 0.25 },
  },
  murcielago: {
    id: "murcielago",
    nombre: "Murciélago",
    glifo: "🦇",
    familia: "sombra",
    rareza: "pocoComun",
    descripcion: "De día no sirve para nada. De noche, el que más.",
    efecto: {
      clase: "rentaPorHorario",
      deNoche: true,
      enSuFranja: 1.9,
      fuera: 0.5,
    },
  },
  serpiente: {
    id: "serpiente",
    nombre: "Serpiente",
    glifo: "🐍",
    familia: "sombra",
    rareza: "raro",
    descripcion: "Si el golpe sale mal, al menos no pierdes la navaja.",
    efecto: { clase: "ahorraObjeto", probabilidad: 0.5 },
  },

  // --- Muro ---
  caracol: {
    id: "caracol",
    nombre: "Caracol",
    glifo: "🐌",
    familia: "muro",
    rareza: "comun",
    descripcion: "No bloquea nada. Lo que te quitan vuelve solo, sin prisa.",
    efecto: { clase: "recuperaRobado", porDia: 0.2 },
  },
  erizo: {
    id: "erizo",
    nombre: "Erizo",
    glifo: "🦔",
    familia: "muro",
    rareza: "pocoComun",
    descripcion: "Quien mete la mano y falla, se pincha.",
    efecto: { clase: "contraataca", castigo: 0.15 },
  },
  castor: {
    id: "castor",
    nombre: "Castor",
    glifo: "🦫",
    familia: "muro",
    rareza: "raro",
    descripcion: "Levanta el muro para ti y para quien tú digas.",
    efecto: { clase: "protegeAOtro", probabilidad: 0.18 },
  },

  // --- Pluma ---
  elefante: {
    id: "elefante",
    nombre: "Elefante",
    glifo: "🐘",
    familia: "pluma",
    rareza: "pocoComun",
    descripcion: "No olvida una carta ni una palabra.",
    efecto: { clase: "memoria", puntosExtra: 2 },
  },
  loro: {
    id: "loro",
    nombre: "Loro",
    glifo: "🦜",
    familia: "pluma",
    rareza: "pocoComun",
    descripcion: "Te sopla la respuesta una vez al día.",
    efecto: { clase: "segundaOportunidad", vecesAlDia: 1 },
  },
  pulpo: {
    id: "pulpo",
    nombre: "Pulpo",
    glifo: "🐙",
    familia: "pluma",
    rareza: "raro",
    descripcion: "Ocho brazos, ocho cosas a la vez. Esperas menos en todo.",
    efecto: { clase: "menosEspera", recorte: 0.3 },
  },

  // --- Lazo ---
  gato: {
    id: "gato",
    nombre: "Gato",
    glifo: "🐈",
    familia: "lazo",
    rareza: "comun",
    descripcion: "Ni te necesita ni te lo va a agradecer. Rinde igual.",
    // La mascota para quien no quiere una mascota: rinde por debajo de la
    // abeja y a cambio da lo mismo como este de animo.
    efecto: { clase: "rentaIndiferente", factor: 1 },
  },
  paloma: {
    id: "paloma",
    nombre: "Paloma",
    glifo: "🕊️",
    familia: "lazo",
    rareza: "pocoComun",
    descripcion: "Rinde más cuanto mejor se porte el grupo.",
    efecto: {
      clase: "rentaPorBuenClima",
      base: 0.8,
      porDiaLimpio: 0.12,
      tope: 1.7,
    },
  },
  oveja: {
    id: "oveja",
    nombre: "Oveja",
    glifo: "🐑",
    familia: "lazo",
    rareza: "pocoComun",
    descripcion: "Sola se aburre. Con su clan, no para.",
    efecto: { clase: "bonusDeClan", factor: 1.35 },
  },
  pollito: {
    id: "pollito",
    nombre: "Pollito",
    glifo: "🐣",
    familia: "lazo",
    rareza: "raro",
    descripcion: "Cada uno que llega y se queda, le alegra el día.",
    efecto: { clase: "bonusPorNovato", porNovato: 0.1 },
  },

  // --- Azar ---
  pato: {
    id: "pato",
    nombre: "Pato",
    glifo: "🦆",
    familia: "azar",
    rareza: "pocoComun",
    descripcion: "Tiene una suerte descarada en el casino.",
    efecto: { clase: "bonusDeCasino", factor: 1.15 },
  },
  camaleon: {
    id: "camaleon",
    nombre: "Camaleón",
    glifo: "🦎",
    familia: "azar",
    rareza: "raro",
    descripcion: "Cada día copia al que tiene al lado en el corral.",
    efecto: { clase: "copiaVecino" },
  },
  gatonegro: {
    id: "gatonegro",
    nombre: "Gato negro",
    glifo: "🐈‍⬛",
    familia: "azar",
    rareza: "raro",
    descripcion: "Quien lo reta, empieza con mal pie.",
    efecto: { clase: "penalizaRetador", castigo: 0.2 },
  },

  // --- Legendarias ---
  //
  // No salen de ningun huevo: se consiguen por un hito del grupo. Su factor es
  // alto pero **el tope diario sigue mandando**, asi que una legendaria no
  // rompe la economia: la acerca al techo antes, y ahi se para.
  dragon: {
    id: "dragon",
    nombre: "Dragón",
    glifo: "🐉",
    familia: "azar",
    rareza: "legendaria",
    descripcion: "Estuviste cuando cayó el jefe. Se nota desde lejos.",
    efecto: { clase: "legendaria", factor: 1.8 },
  },
  lobo: {
    id: "lobo",
    nombre: "Lobo",
    glifo: "🐺",
    familia: "lazo",
    rareza: "legendaria",
    descripcion: "Tu clan ganó la temporada. Esto es lo que quedó.",
    efecto: { clase: "legendaria", factor: 1.7 },
  },
  aguila: {
    id: "aguila",
    nombre: "Águila",
    glifo: "🦅",
    familia: "pluma",
    rareza: "legendaria",
    descripcion: "Tres semanas en lo más alto del corral.",
    efecto: { clase: "legendaria", factor: 1.7 },
  },
  ballena: {
    id: "ballena",
    nombre: "Ballena",
    glifo: "🐋",
    familia: "bolsa",
    rareza: "legendaria",
    descripcion: "Nadie ha quemado tantas monedas como tú en este grupo.",
    // Premia GASTAR, no tener. El bicho mas raro se lo lleva quien mas ha
    // drenado la economia, que es el comportamiento que esta feature existe
    // para provocar. Un legendario por saldo acumulado premiaria lo contrario.
    efecto: { clase: "legendaria", factor: 1.9 },
  },
  cisne: {
    id: "cisne",
    nombre: "Cisne",
    glifo: "🦢",
    familia: "muro",
    rareza: "legendaria",
    descripcion: "Cien días seguidos sin fallar ni uno.",
    efecto: { clase: "legendaria", factor: 1.75 },
  },

  // --- Del staff ---
  //
  // Una por persona del equipo, y **nadie mas puede tenerlas**: ni siquiera
  // otro del staff. No salen de ningun huevo, no se compran y no se crian; se
  // asignan a mano a quien las pidio.
  //
  // Sus efectos reutilizan clases que ya existen a proposito. Una clase nueva
  // por cada una habria significado cinco ramas mas en el interprete para
  // cinco bichos que no puede tener casi nadie, y el tope diario les manda
  // igual que a las demas: son un reconocimiento, no una ventaja que rompa el
  // grupo.
  caballo: {
    id: "caballo",
    nombre: "Caballo",
    glifo: "🐴",
    familia: "bolsa",
    rareza: "staff",
    descripcion: "Tira del carro sin que nadie se lo pida.",
    efecto: { clase: "renta", factor: 1.75 },
  },
  pezglobo: {
    id: "pezglobo",
    nombre: "Pez globo",
    glifo: "🐡",
    familia: "muro",
    rareza: "staff",
    descripcion: "Se hincha y no hay quien le meta mano.",
    efecto: { clase: "bloqueaRobo", probabilidad: 0.45 },
  },
  liron: {
    id: "liron",
    nombre: "Lirón de tormenta",
    glifo: "⚡",
    familia: "pluma",
    rareza: "staff",
    descripcion: "Pequeño, amarillo y cargado de electricidad.",
    efecto: { clase: "ingenio", energiaExtra: 5, puntosExtra: 3 },
  },
  ciervo: {
    id: "ciervo",
    nombre: "Ciervo",
    glifo: "🦌",
    familia: "lazo",
    rareza: "staff",
    descripcion: "Sin cuernos, y así es más mono.",
    efecto: { clase: "animoPorGratitud", animoPorGracias: 12 },
  },
  /**
   * El ocelote del staff, con un ojo verde y otro azul.
   *
   * La heterocromia no es solo el dibujo: es su mecanica. Dos ojos que no ven
   * igual dan dos resultados distintos, y por eso su renta es al azar y no un
   * factor fijo como la del leon.
   *
   * El minimo no baja de 1.2 a proposito. La rana, que es comun, puede quedarse
   * en cero y eso ahi es la gracia; una mascota de staff que algun dia no diera
   * nada seria un castigo por tenerla. La media sale 1.8, que es exactamente el
   * factor del leon: mismo poder, distinto caracter.
   */
  ocelote: {
    id: "ocelote",
    nombre: "Ocelote",
    glifo: "🐆",
    familia: "azar",
    rareza: "staff",
    descripcion: "Un ojo verde y otro azul. Nunca miran lo mismo.",
    efecto: { clase: "rentaAlAzar", minimo: 1.2, maximo: 2.4 },
  },
  /**
   * Noxel, la del propietario del bot. Rareza `exclusiva`, y es la unica.
   *
   * No sale de ningun huevo, no esta en la tienda y no la reparte ningun
   * comando: lo que la blinda no es una comprobacion suelta sino la rareza, que
   * esta en `RAREZAS_FUERA_DEL_HUEVO`. Ahi la eclosion no la ve siquiera —
   * `especiesPorRareza` devuelve lista vacia— asi que no hay parametro que
   * manipular para que salga: no hay camino que llegue.
   *
   * Va en la familia Sombra por lo que es, no por lo que hace: un bicho de
   * humo con cuernos y runas doradas no encaja en Bolsa ni en Pluma.
   */
  noxel: {
    id: "noxel",
    nombre: "Noxel",
    glifo: "🌑",
    familia: "sombra",
    rareza: "exclusiva",
    descripcion: "Estaba aquí antes que el grupo. No come, acompaña.",
    // El factor mas alto del catalogo, y aun asi acotado: el tope diario de
    // 600 corta igual, asi que lo que cambia es lo pronto que se llega a el y
    // no cuanto se acuña. Sin ese tope esto seria una impresora.
    efecto: { clase: "legendaria", factor: 2 },
  },
  leon: {
    id: "leon",
    nombre: "León",
    glifo: "🦁",
    familia: "lazo",
    rareza: "staff",
    descripcion: "No necesita rugir para que se note quién manda.",
    efecto: { clase: "legendaria", factor: 1.8 },
  },
  /**
   * El elefante del staff, que NO es el `elefante` del catalogo.
   *
   * Ese ya existe como poco comun de Pluma y lo puede sacar cualquiera de un
   * huevo, asi que no valia como mascota unica: la gracia de una de staff es
   * que nadie mas pueda tenerla. Este es otro bicho, con su acabado y su
   * nombre, y por eso el id tambien es otro — reutilizar `elefante` habria
   * cambiado la mascota a quien ya la tuviera.
   */
  elefanteninja: {
    id: "elefanteninja",
    nombre: "Elefante Ninja",
    glifo: "🥷",
    // En Sombra y no en Pluma como el otro elefante: un ninja pertenece al
    // sigilo, y el contraste —dos toneladas que no hacen ruido— es la gracia.
    familia: "sombra",
    rareza: "staff",
    descripcion: "Pesa dos toneladas y no le oyes llegar.",
    efecto: { clase: "roboMejorado", esperaMenos: 0.4, botinMas: 0.3 },
  },
  /**
   * El tiburon del staff.
   *
   * Misma clase que el elefante ninja y caracter opuesto: el ninja golpea a
   * menudo y se lleva poco cada vez; el tiburon espera casi lo mismo que sin
   * mascota y cuando muerde se lleva la mitad mas. Lo que rinden a lo largo del
   * dia queda un poco por debajo del ninja (1,25 golpes por 1,5 de botin contra
   * 1,67 por 1,3), a proposito: un bocado grande se nota mas en el chat que
   * muchos pequeños, y esa visibilidad ya es parte de lo que se lleva.
   *
   * En Sombra por lo que hace, igual que el ninja. `contraataca` encajaba con
   * "quien se mete en su agua sale mordido", pero solo actua cuando alguien
   * falla al robarle, que en la practica es casi nunca: una mascota de staff
   * cuyo efecto no se ve no es un reconocimiento.
   */
  tiburon: {
    id: "tiburon",
    nombre: "Tiburón",
    glifo: "🦈",
    familia: "sombra",
    rareza: "staff",
    descripcion: "No muerde a menudo, pero cada bocado cuenta.",
    efecto: { clase: "roboMejorado", esperaMenos: 0.2, botinMas: 0.5 },
  },
};

/**
 * El orden en que se enseñan: por familia, siguiendo `FAMILIAS_EN_ORDEN`.
 *
 * Escrito a mano por el mismo motivo que el de las familias, y porque el orden
 * del corral es lo primero que ve alguien que no conoce el catalogo.
 */
export const ESPECIES_EN_ORDEN: readonly EspecieId[] = [
  // Bolsa
  "abeja",
  "ardilla",
  "hormiga",
  "cerdito",
  // Sombra
  "zorro",
  "mapache",
  "murcielago",
  "serpiente",
  // Muro
  "tortuga",
  "caracol",
  "erizo",
  "castor",
  // Pluma
  "buho",
  "elefante",
  "loro",
  "pulpo",
  // Lazo
  "perro",
  "gato",
  "paloma",
  "oveja",
  "pollito",
  // Azar
  "rana",
  "pato",
  "camaleon",
  "gatonegro",
  // Legendarias
  "dragon",
  "lobo",
  "aguila",
  "ballena",
  "cisne",
  // Del staff
  "caballo",
  "pezglobo",
  "liron",
  "ciervo",
  "leon",
  "elefanteninja",
  "ocelote",
  "tiburon",
  "noxel",
];

/** Si un texto cualquiera es un id de especie conocido. */
export const esEspecieId = (valor: string): valor is EspecieId =>
  Object.hasOwn(ESPECIES, valor);

/** Las especies de una familia, en el orden del catalogo. */
export const especiesDeFamilia = (familia: FamiliaId): readonly Especie[] =>
  ESPECIES_EN_ORDEN.map((id) => ESPECIES[id]).filter(
    (especie) => especie.familia === familia,
  );

/**
 * Las que puede sacar un huevo, por rareza.
 *
 * Las legendarias nunca salen de aqui: se consiguen por hito. La funcion las
 * excluye por construccion —filtra por la rareza pedida— y hay un test que
 * comprueba que ninguna consulta puede devolverlas.
 */
export const especiesPorRareza = (rareza: Rareza): readonly Especie[] => {
  // Las de fuera del huevo no se sirven NUNCA por esta via, ni pidiendolas por
  // su propia rareza: quien llama es la eclosion, y una legendaria o una de
  // staff saliendo de un huevo es el fallo que esta funcion existe para hacer
  // imposible.
  if (!saleDeHuevo(rareza)) {
    return [];
  }
  return ESPECIES_EN_ORDEN.map((id) => ESPECIES[id]).filter(
    (especie) => especie.rareza === rareza,
  );
};
