/**
 * Los comandos de mascotas, enteros: la decision, el texto y el orden.
 *
 * Extraccion **profunda** desde el minuto uno. En el nucleo quedan la firma, un
 * comentario y la llamada; aqui esta todo lo demas. Un handler escrito dentro
 * del nucleo hay que sacarlo despues; escrito ya fuera, no.
 *
 * Los cuatro comandos funcionan **sin abrir la Mini App**, y eso no es cautela
 * generica: que la gente no abriera la Mini App fue un problema real y abierto
 * durante semanas. Una feature que solo viva ahi dentro nace apostando a que
 * eso no vuelva a pasar.
 *
 * El retrato aqui es emoji mas barras de bloques, porque Telegram no pinta
 * SVG. La Mini App usa el suyo. Dos representaciones para dos medios.
 *
 * Puro salvo por el puerto: sin reloj propio, sin azar y sin I/O directo.
 */

import { ESPECIES, type EspecieId } from "../especies.js";
import { caraDe, MAXIMO } from "../estado.js";
import { NIVEL_DE_EVOLUCION, progresoDeNivel } from "../nivel.js";
import { textoDeFalloAlNombrar, validarNombre } from "../nombrar.js";
import { RASGOS } from "../rasgos.js";
import type {
  EntradaDeCorral,
  MascotaVista,
  NombreDeUsuario,
  ProgresoDeMascota,
  PuertoDeMascotas,
  SalidaDeJuego,
  SalidaDeOperacion,
  SalidaDeProteger,
  SaludDeMascota,
} from "./puertos.js";

/** Los nombres que atiende este handler. */
export const COMANDOS_DE_MASCOTAS = [
  "mascota",
  "bicho",
  "alimentar",
  "jugar",
  "nombrar",
  "proteger",
  "corral",
  "huevo",
  "operar",
] as const;

export type ComandoDeMascotas = (typeof COMANDOS_DE_MASCOTAS)[number];

export const esComandoDeMascotas = (
  nombre: string | undefined,
): nombre is ComandoDeMascotas =>
  nombre !== undefined &&
  (COMANDOS_DE_MASCOTAS as readonly string[]).includes(nombre);

/** La cara, en emoji. Es el resumen que de verdad lee la gente. */
const GESTOS: Record<ReturnType<typeof caraDe>, string> = {
  feliz: "😊",
  normal: "🙂",
  conHambre: "🍽️",
  triste: "😔",
  enfermo: "🤒",
  dormido: "😴",
};

/** Una barra de diez bloques. */
const barra = (valor: number): string => {
  const llenos = Math.max(0, Math.min(10, Math.round((valor / MAXIMO) * 10)));
  return "█".repeat(llenos) + "░".repeat(10 - llenos);
};

/** Como se llama el bicho: el mote que le pusieron, o su especie. */
const comoSeLlama = (mascota: MascotaVista): string =>
  mascota.nombre ?? ESPECIES[mascota.especie].nombre;

/**
 * Un numero de monedas con puntos de millar.
 *
 * Con facturas de nueve cifras esto no es cosmetica: `499997500` y `49999750`
 * se distinguen contando digitos de uno en uno, y quien tiene que decidir si
 * paga o pierde a su bicho no deberia tener que hacer eso.
 */
const conPuntos = (monedas: number): string =>
  Math.round(monedas)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Cuanto queda, en lenguaje de persona.
 *
 * Redondea hacia ABAJO y a la unidad grande. Decir "1 día" cuando quedan 47
 * horas se queda corto, y esa es la direccion correcta del error: quien crea
 * que tiene menos tiempo del que tiene se da prisa, y quien crea que tiene mas
 * llega tarde.
 */
const cuantoQueda = (ms: number): string => {
  if (ms <= 0) {
    return "nada";
  }
  const horas = Math.floor(ms / 3_600_000);
  if (horas < 1) {
    return `${Math.max(1, Math.floor(ms / 60_000))} min`;
  }
  if (horas < 48) {
    return `${horas} h`;
  }
  return `${Math.floor(horas / 24)} días`;
};

/**
 * El bloque clinico de la ficha, que va DELANTE de todo lo demas.
 *
 * Delante y no al final: una ficha que empieza por barras y niveles y menciona
 * de pasada que al bicho le quedan seis horas esta contando otra cosa. Lo
 * primero que hay que leer es lo que hay que hacer.
 */
const lineasDeSalud = (
  nombre: string,
  salud: SaludDeMascota,
): readonly string[] => {
  if (salud.estado === "muerta") {
    const duelo =
      salud.msDeDuelo > 0
        ? `Podrás tener otro bicho dentro de ${cuantoQueda(salud.msDeDuelo)}.`
        : "Ya puedes empezar otra vez: <code>/huevo</code>";
    return [
      `🪦 <b>${nombre} ha fallecido.</b>`,
      ...(salud.motivo ? [`<i>${salud.motivo}</i>`] : []),
      "",
      duelo,
    ];
  }
  if (salud.estado === "vencida") {
    return [
      `🩺 <b>${nombre} está grave y se ha acabado el plazo.</b>`,
      ...(salud.motivo ? [`<i>${salud.motivo}</i>`] : []),
      "",
      "Ya no se puede operar.",
    ];
  }
  return [
    `🩺 <b>${nombre} está grave.</b>`,
    ...(salud.motivo ? [`<i>${salud.motivo}</i>`] : []),
    "",
    `La operación cuesta <b>${conPuntos(salud.coste)}</b> monedas.`,
    `Te quedan <b>${cuantoQueda(salud.msQueQuedan)}</b> para pagarla.`,
    "",
    "Se paga con <code>/operar</code>. Si no se paga, no lo cuenta.",
  ];
};

/**
 * La ficha de una mascota.
 *
 * `dueño` es null cuando es la tuya: enseñar "Tu bicho" cuando es tuyo y el
 * nombre de la persona cuando es de otro evita la frase rara de hablarte de ti
 * en tercera persona.
 */
export const fichaDeMascota = (
  mascota: MascotaVista,
  dueño: string | null,
): string => {
  const especie = ESPECIES[mascota.especie];
  const cara = caraDe(mascota);
  const titulo = dueño === null ? "Tu bicho" : `El bicho de ${dueño}`;
  const progreso = Math.round(progresoDeNivel(mascota) * 100);

  // Una muerta no tiene barras que enseñar. Lo unico que hay que contar es que
  // se murio, de que, y cuando se puede volver a empezar.
  if (mascota.salud?.estado === "muerta") {
    return [
      `<b>${titulo}</b>`,
      "",
      ...lineasDeSalud(comoSeLlama(mascota), mascota.salud),
    ].join("\n");
  }

  const rasgos = mascota.rasgos
    .map((id) => RASGOS[id]?.nombre)
    .filter((nombre): nombre is string => Boolean(nombre));

  const lineas = [
    ...(mascota.salud
      ? [...lineasDeSalud(comoSeLlama(mascota), mascota.salud), ""]
      : []),
    `${especie.glifo} <b>${comoSeLlama(mascota)}</b> ${mascota.salud ? "🩺" : GESTOS[cara]}`,
    `<i>${especie.descripcion}</i>`,
    "",
    `Hambre  ${barra(mascota.hambre)} ${Math.round(mascota.hambre)}`,
    `Ánimo   ${barra(mascota.animo)} ${Math.round(mascota.animo)}`,
    `Nivel ${mascota.nivel} · ${progreso}% al siguiente`,
  ];

  if (rasgos.length > 0) {
    lineas.push(`Es ${rasgos.join(" y ").toLowerCase()}.`);
  }
  if (ESPECIES[mascota.especie].rareza === "exclusiva") {
    // Delante de la de staff: las dos son unicas, pero no son lo mismo. Una
    // cuelga de un puesto y la otra no cuelga de nada.
    lineas.push("🌑 Mascota exclusiva. Solo existe una.");
  } else if (ESPECIES[mascota.especie].rareza === "staff") {
    // Marca propia y no la de regalo: no es lo mismo "se lo dieron" que "es
    // del equipo". Sin distinguirlas, el corral no sabe decir quien se gano su
    // bicho y quien lo tiene por el cargo — y eso es justo lo que hace que una
    // legendaria signifique algo.
    lineas.push("👑 Mascota del staff. No la tiene nadie más.");
  } else if (mascota.regalada) {
    lineas.push("✦ Regalo del creador.");
  }
  if (mascota.nivel >= NIVEL_DE_EVOLUCION) {
    lineas.push("Ya está en edad de evolucionar.");
  }

  if (cara === "dormido") {
    lineas.push(
      "",
      "Está dormido de hambre. Se despierta comiendo: <code>/alimentar</code>",
    );
  } else if (cara === "conHambre" || cara === "enfermo") {
    lineas.push("", "Tiene hambre. <code>/alimentar</code>");
  }

  return [`<b>${titulo}</b>`, "", ...lineas].join("\n");
};

/**
 * Lo que se cuenta de la experiencia ganada, si hay algo que contar.
 *
 * **Solo habla cuando pasa algo.** La XP suelta no se enseña: un "+3 XP" en
 * cada racion convierte dar de comer en una barra de progreso y tapa lo unico
 * que de verdad importa del mensaje, que es como ha quedado el bicho. Lo que
 * si se dice es cruzar un nivel, porque eso pasa cada varios dias y es la
 * recompensa de haber vuelto.
 *
 * Que esto exista es el arreglo de un agujero viejo: `haSubido` y `evoluciona`
 * se calculaban desde el primer dia y **no los leia nadie**. El tick los
 * contaba en su resumen del log y ahi se acababan, asi que una mascota podia
 * subir de nivel sin que su dueño se enterara jamas. Ayer subieron dos en
 * produccion, en silencio.
 */
const lineasDeProgreso = (progreso: ProgresoDeMascota): string[] => {
  if (!progreso.haSubido) {
    return [];
  }
  const lineas = ["", `🎉 <b>¡Ha subido a nivel ${progreso.nivel}!</b>`];
  if (progreso.evoluciona) {
    lineas.push("✨ Ya está en edad de evolucionar.");
  }
  return lineas;
};

/** El texto tras servir —o no servir— una racion. */
export const textoDeRacion = (
  mascota: MascotaVista,
  salida: Awaited<ReturnType<PuertoDeMascotas["alimentar"]>>,
): string => {
  const nombre = comoSeLlama(mascota);
  if (salida.ok) {
    const despues = { ...mascota, hambre: salida.hambre };
    const cara = caraDe(despues);
    const remate =
      salida.hambre >= MAXIMO
        ? "No le cabe ni una miga más."
        : "Se lo ha comido todo.";
    return [
      `${GESTOS[cara]} ${nombre} ha comido. ${remate}`,
      `Hambre ${barra(salida.hambre)} ${Math.round(salida.hambre)}`,
      `Te ha costado ${salida.coste} monedas.`,
      ...lineasDeProgreso(salida.progreso),
    ].join("\n");
  }

  if (salida.motivo === "yaLlena") {
    return `${nombre} está lleno. Guárdate las monedas.`;
  }
  if (salida.motivo === "topeDiario") {
    return `${nombre} ya ha comido bastante por hoy. Mañana más.`;
  }
  const faltan = salida.coste - salida.saldo;
  return [
    `No te llega: una ración cuesta ${salida.coste} y tienes ${salida.saldo}.`,
    `Te faltan ${faltan}. Habla un rato y vuelve.`,
  ].join("\n");
};

/** El texto de un huevo que se abre. */
export const textoDeHuevo = (
  salida: Awaited<ReturnType<PuertoDeMascotas["nacer"]>>,
): string => {
  if (salida.ok) {
    const especie = ESPECIES[salida.especie];
    const regalo = salida.gratis ? "El primero va por cuenta de la casa." : "";
    return [
      "🥚 El huevo se resquebraja…",
      "",
      `${especie.glifo} <b>¡Es ${especie.nombre.toLowerCase()}!</b>`,
      `<i>${especie.descripcion}</i>`,
      "",
      regalo,
      "Mírale la ficha con <code>/mascota</code> y dale de comer.",
    ]
      .filter((linea) => linea !== "")
      .join("\n");
  }

  if (salida.motivo === "yaTiene") {
    return "Ya tienes un bicho. Cuida del que tienes.";
  }
  return [
    `Un huevo cuesta ${salida.precio} monedas y tienes ${salida.saldo}.`,
    "Habla un rato en el grupo y vuelve.",
  ].join("\n");
};

/** El corral del grupo. */
export const textoDeCorral = (
  entradas: readonly EntradaDeCorral[],
  nombreDe: NombreDeUsuario,
): string => {
  if (entradas.length === 0) {
    return [
      "🌾 <b>El corral está vacío</b>",
      "",
      "Nadie tiene bicho todavía. El primero es gratis:",
      "<code>/huevo</code>",
    ].join("\n");
  }

  const lineas = entradas.map((entrada, i) => {
    const especie = ESPECIES[entrada.especie];
    const cara = caraDe({
      hambre: entrada.hambre,
      animo: MAXIMO,
      nivel: entrada.nivel,
      xp: 0,
    });
    const rarezaDe = ESPECIES[entrada.especie].rareza;
    const marca =
      rarezaDe === "exclusiva"
        ? " 🌑"
        : rarezaDe === "staff"
          ? " 👑"
          : entrada.regalada
            ? " ✦"
            : "";
    const nombre = entrada.nombre ?? especie.nombre;
    // La salud pisa la cara. Un bicho con la barra llena y seis horas de vida
    // no puede salir sonriendo en la lista.
    const gesto =
      entrada.estadoDeSalud === "muerta"
        ? "🪦"
        : entrada.estadoDeSalud
          ? "🩺"
          : GESTOS[cara];
    return `${i + 1}. ${especie.glifo} <b>${nombre}</b>${marca} — nivel ${entrada.nivel} ${gesto} <i>${nombreDe(entrada.usuario)}</i>`;
  });

  return ["🌾 <b>El corral</b>", "", ...lineas].join("\n");
};

/**
 * El aviso de una mascota grave: el recordatorio o el obituario.
 *
 * Sale al GRUPO y no solo por privado, y eso no es afan de espectaculo: mucha
 * gente tiene el bot bloqueado en privado, y un aviso que no llega convierte la
 * factura en una encerrona. Que ademas se vea es parte de la mecanica.
 *
 * `msQueQuedan` entra ya calculado, no la fecha de vencimiento: quien tiene el
 * reloj es el barrido, y este fichero no lo tiene ni debe.
 */
export const textoDeAvisoDeSalud = (aviso: {
  readonly clase: "recordatorio" | "muerte";
  readonly especie: EspecieId;
  readonly nombre: string | null;
  readonly duenoMencion: string;
  readonly motivo: string | null;
  readonly coste: number;
  readonly msQueQuedan: number;
}): string => {
  const especie = ESPECIES[aviso.especie];
  const nombre = aviso.nombre ?? especie.nombre;

  if (aviso.clase === "muerte") {
    return [
      `🪦 <b>${nombre}</b> no ha superado la operación.`,
      "",
      `Era el bicho de ${aviso.duenoMencion}.`,
      ...(aviso.motivo ? [`<i>${aviso.motivo}</i>`] : []),
      "",
      "No se pagó a tiempo.",
    ].join("\n");
  }

  return [
    `🩺 <b>${nombre} sigue grave.</b>`,
    "",
    `${aviso.duenoMencion}, le quedan <b>${cuantoQueda(aviso.msQueQuedan)}</b>.`,
    `La operación cuesta ${conPuntos(aviso.coste)} monedas: <code>/operar</code>`,
  ].join("\n");
};

/** Una mascota que subio de nivel al cerrarse el dia. */
export interface SubidaDelDia {
  readonly especie: EspecieId;
  readonly nombre: string | null;
  readonly nivel: number;
  readonly evoluciona: boolean;
}

/**
 * El parte de las subidas de anoche, en UN mensaje para todo el grupo.
 *
 * Uno por grupo y no uno por mascota, y eso es lo importante del formato: el
 * cierre corre a las dos de la madrugada, asi que en un grupo con cuarenta
 * bichos la version por mascota seria cuarenta mensajes de noche seguidos. Es
 * la misma forma de incidente que los cuatro `@all` sin cooldown del 21 de
 * agosto, y por eso ademas va detras del ajuste `avisos`.
 *
 * No nombra a las personas: el bicho ya es reconocible por su mote y quien
 * quiera saber de quien es lo mira en el corral. Cuarenta menciones de
 * madrugada seria justo lo que se intenta evitar.
 */
export const textoDeSubidasDelDia = (
  subidas: readonly SubidaDelDia[],
): string | null => {
  if (subidas.length === 0) {
    return null;
  }
  const lineas = subidas.map((subida) => {
    const especie = ESPECIES[subida.especie];
    const nombre = subida.nombre ?? especie.nombre;
    const remate = subida.evoluciona ? " ✨ ya puede evolucionar" : "";
    return `${especie.glifo} <b>${nombre}</b> — nivel ${subida.nivel}${remate}`;
  });
  const titulo =
    subidas.length === 1
      ? "🌙 <b>Anoche subió de nivel</b>"
      : "🌙 <b>Anoche subieron de nivel</b>";
  return [titulo, "", ...lineas].join("\n");
};

/** Lo que se contesta a quien pide su ficha y no tiene bicho. */
export const SIN_MASCOTA = [
  "No tienes bicho todavía.",
  "",
  "El primero es gratis: <code>/huevo</code>",
].join("\n");

/** Lo que se contesta al preguntar por el bicho de alguien que no tiene. */
export const OTRO_SIN_MASCOTA = "Esa persona no tiene bicho.";

export interface PeticionDeMascotas {
  readonly comando: ComandoDeMascotas;
  /** A quien se pregunta, cuando el comando iba dirigido a alguien. */
  readonly objetivo?: bigint;
  readonly puerto: PuertoDeMascotas;
  readonly nombreDe: NombreDeUsuario;
  /** Cuantas caben en el corral. */
  readonly limiteDeCorral?: number;
  /**
   * Lo que se escribio detras del comando. Hoy solo lo usa /nombrar.
   *
   * Llega en bruto y sin validar a proposito: quien valida es esta capa, no
   * el nucleo. Asi la regla de que un nombre no puede romper el HTML vive
   * pegada a lo que compone ese HTML.
   */
  readonly texto?: string;
}

/**
 * Lo que se contesta al jugar con ella.
 *
 * Dice el animo que queda y no solo "hecho": el animo es la barra que menos se
 * mira y la que peor se entiende, asi que el momento de subirlo es el unico en
 * que alguien va a leer en que numero anda.
 */
const textoDeJuego = (mascota: MascotaVista, salida: SalidaDeJuego): string => {
  const nombre = comoSeLlama(mascota);
  if (salida.ok) {
    return [
      // Los DOS numeros se redondean, igual que hace la ficha con sus barras.
      // El animo se guarda como decimal porque el desgaste se calcula desde
      // milisegundos, asi que sin esto sale un "39.900174166666666/100" — que
      // es exactamente lo que se le enseño a la gente el 2026-08-29.
      //
      // La subida tambien, aunque casi siempre valga 15 exacto: cuando el
      // bicho anda cerca del tope, lo que cabe es una fraccion.
      `🎾 Has jugado con ${nombre}. Ánimo +${Math.round(salida.subida)} → ${Math.round(salida.animo)}/${MAXIMO}.`,
      "",
      "Vuelve mañana: se puede jugar una vez al día y es gratis.",
      ...lineasDeProgreso(salida.progreso),
    ].join("\n");
  }
  return salida.motivo === "yaHoy"
    ? `Ya has jugado hoy con ${nombre}. Mañana otra vez.`
    : SIN_MASCOTA;
};

/**
 * Lo que se contesta al pagar —o no poder pagar— la operacion.
 *
 * El caso bueno dice las dos cifras: lo que se ha ido y lo que queda. Es un
 * cobro que puede vaciar una cartera entera, y el sitio donde se ve eso no
 * puede ser el saldo tres horas despues.
 */
const textoDeOperacion = (
  nombre: string,
  salida: SalidaDeOperacion,
): string => {
  if (salida.ok) {
    return [
      `🩺 <b>${nombre} está salvado.</b>`,
      "",
      `Ha costado <b>${conPuntos(salida.pagado)}</b> monedas.`,
      `Te quedan ${conPuntos(salida.saldo)}.`,
      "",
      "Dale de comer, que sale de esta con hambre.",
    ].join("\n");
  }

  switch (salida.motivo) {
    case "sinMascota":
      return SIN_MASCOTA;
    case "sanaYa":
      return `${nombre} está perfectamente. No hay nada que operar.`;
    case "yaMuerta":
      return `Ya no se puede hacer nada por ${nombre}.`;
    case "fueraDePlazo":
      return [
        `Se acabó el plazo de ${nombre}.`,
        "",
        "La operación ya no se puede pagar.",
      ].join("\n");
    case "yaCurada":
      // Es la respuesta al segundo /operar de dos seguidos. Decir "no te llega"
      // aqui mandaria a alguien a buscar dinero que ya ha pagado.
      return `${nombre} ya está operado. No se cobra dos veces.`;
    case "haCambiado":
      return "Se te ha movido el saldo a mitad del cobro. Vuelve a intentarlo.";
    default:
      return [
        `No llega para la operación de ${nombre}.`,
        "",
        `Cuesta <b>${conPuntos(salida.coste)}</b> monedas y tienes ${conPuntos(salida.saldo)}.`,
      ].join("\n");
  }
};

/**
 * Lo que se contesta al encargarle que proteja a alguien.
 *
 * Sin objetivo el comando NO es un error: es como se deja de proteger, y es la
 * unica forma de deshacerlo. Decir "te falta un nombre" ahi obligaria a
 * inventarse una sintaxis para retirarlo.
 */
const textoDeProteger = (
  salida: SalidaDeProteger,
  nombre: string | null,
): string => {
  if (!salida.ok) {
    if (salida.motivo === "sinMascota") {
      return SIN_MASCOTA;
    }
    if (salida.motivo === "aTiMismo") {
      return "Tu bicho ya te protege a ti. Elige a otra persona.";
    }
    return [
      "Tu bicho no sabe proteger a nadie más.",
      "",
      "Es cosa de algunas especies. Mírale la ficha con <code>/mascota</code>.",
    ].join("\n");
  }
  return salida.objetivo === null
    ? "🛡️ Tu bicho ya no protege a nadie más."
    : `🛡️ Tu bicho protegerá también a ${nombre ?? "esa persona"}.`;
};

/**
 * Atiende un comando de mascotas y devuelve el texto, o `null` si no le toca.
 *
 * Devolver `null` y no lanzar cuando el comando no es suyo es lo que deja que
 * la cadena de handlers siga: el primero que responde la corta, asi que
 * contestar algo aqui por error se comeria el comando de otro.
 */
export const atenderComandoDeMascotas = async (
  peticion: PeticionDeMascotas,
): Promise<string | null> => {
  const { comando, objetivo, puerto, nombreDe } = peticion;

  if (comando === "corral") {
    return textoDeCorral(
      await puerto.corral(peticion.limiteDeCorral ?? 10),
      nombreDe,
    );
  }

  if (comando === "huevo") {
    return textoDeHuevo(await puerto.nacer());
  }

  if (comando === "nombrar") {
    const mia = await puerto.mia();
    if (!mia) {
      return SIN_MASCOTA;
    }
    const propuesto = validarNombre(peticion.texto ?? "");
    if (!propuesto.ok) {
      return textoDeFalloAlNombrar(propuesto.motivo);
    }
    const puesto = await puerto.nombrar(propuesto.nombre);
    return puesto
      ? [
          `${ESPECIES[mia.especie].glifo} A partir de ahora se llama <b>${propuesto.nombre}</b>.`,
          "Sale así en su ficha y en el corral.",
        ].join("\n")
      : "No he podido cambiarle el nombre. Inténtalo otra vez.";
  }

  if (comando === "proteger") {
    return textoDeProteger(
      await puerto.proteger(objetivo ?? null),
      objetivo === undefined ? null : nombreDe(objetivo),
    );
  }

  if (comando === "jugar") {
    const mia = await puerto.mia();
    if (!mia) {
      return SIN_MASCOTA;
    }
    return textoDeJuego(mia, await puerto.jugar());
  }

  if (comando === "alimentar") {
    const mia = await puerto.mia();
    if (!mia) {
      return SIN_MASCOTA;
    }
    return textoDeRacion(mia, await puerto.alimentar());
  }

  if (comando === "operar") {
    const mia = await puerto.mia();
    if (!mia) {
      return SIN_MASCOTA;
    }
    return textoDeOperacion(comoSeLlama(mia), await puerto.operar());
  }

  // `/mascota` y `/bicho`: la propia, o la de alguien si se pregunto por otro.
  if (objetivo !== undefined) {
    const suya = await puerto.deOtro(objetivo);
    return suya === null
      ? OTRO_SIN_MASCOTA
      : fichaDeMascota(suya, nombreDe(objetivo));
  }

  const mia = await puerto.mia();
  return mia === null ? SIN_MASCOTA : fichaDeMascota(mia, null);
};
