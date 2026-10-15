/**
 * Los mandos del creador: dar un huevo, dar un bicho, tocar sus numeros.
 *
 * Hace falta —hay que compensar a alguien cuando un fallo se coma su bicho, y
 * probar cosas sin esperar a que eclosione un huevo— pero un `/give` mal hecho
 * tira abajo por la puerta de atras la regla que sostiene el catalogo: **el bot
 * nunca vende un bicho concreto**. Si el creador reparte dragones, el corral
 * vuelve a ser la lista de a quien le cae bien el dueño.
 *
 * Por eso este fichero solo DECIDE, y decide poco: valida lo que se ha pedido y
 * dice que hay que hacer. Las salvaguardas que no son decision —el registro con
 * su motivo, el permiso, el tope diario— las aplica el nucleo, que es el unico
 * que sabe quien manda y como se audita.
 *
 * Dos reglas del diseño viven aqui, en el código:
 *
 * 1. **Dar un HUEVO va antes que dar un bicho.** Conserva la sorpresa, no salta
 *    el commit-reveal y no crea una especie que nadie ha sacado. Para compensar
 *    a alguien casi siempre basta con eso.
 * 2. **La razon es obligatoria** en todo lo que crea, cambia o borra. Sin ella
 *    el mando no corre. No es burocracia: es lo que permite contestar dentro de
 *    seis meses a "¿y ese por que tiene un dragon?".
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import { type EspecieId, esEspecieId } from "./especies.js";
import { esFamiliaId, type FamiliaId } from "./familias.js";

/** Los campos que se pueden tocar a mano. */
export type CampoDeMascota = "hambre" | "animo" | "nivel" | "xp";

const CAMPOS: readonly CampoDeMascota[] = ["hambre", "animo", "nivel", "xp"];

export const esCampoDeMascota = (valor: string): valor is CampoDeMascota =>
  (CAMPOS as readonly string[]).includes(valor);

/** Lo que el creador ha pedido, ya entendido. */
export type MandoDeMascotas =
  | {
      readonly tipo: "huevo";
      readonly objetivo: bigint;
      readonly familia?: FamiliaId;
    }
  | {
      readonly tipo: "dar";
      readonly objetivo: bigint;
      readonly especie: EspecieId;
      readonly razon: string;
    }
  | {
      readonly tipo: "set";
      readonly objetivo: bigint;
      readonly campo: CampoDeMascota;
      readonly valor: number;
      readonly razon: string;
    }
  | {
      readonly tipo: "quitar";
      readonly objetivo: bigint;
      readonly razon: string;
    }
  | {
      /**
       * Declarar una enfermedad grave.
       *
       * Es el unico mando que puede acabar en una mascota muerta, y llega
       * respondiendo a un mensaje: responder al equivocado es un accidente de
       * un dedo. La red no es un botón de confirmar sino `sanar`, que deshace
       * al instante y no cuesta nada — y por eso el mensaje que sale al
       * declararla **nombra en grande a quien le toca**, para que el error se
       * vea en el mismo segundo en que se comete.
       *
       * `resto` y `horas` son opcionales: sin ellos manda lo que diga el grupo.
       * Estan aqui para no tener que desplegar cuando una vez haga falta otra
       * cifra.
       */
      readonly tipo: "enfermar";
      readonly objetivo: bigint;
      readonly resto?: number;
      readonly horas?: number;
      readonly razon: string;
    }
  | {
      /** El indulto: la cura sin cobrar nada. */
      readonly tipo: "sanar";
      readonly objetivo: bigint;
      readonly razon: string;
    }
  | {
      /** Devolver a la vida a una fallecida. */
      readonly tipo: "revivir";
      readonly objetivo: bigint;
      readonly razon: string;
    }
  | { readonly tipo: "ver"; readonly objetivo: bigint };

export type ErrorDeMando =
  | "sinObjetivo"
  | "sinSubcomando"
  | "subcomandoDesconocido"
  | "sinRazon"
  | "especieDesconocida"
  | "campoDesconocido"
  | "valorInvalido"
  | "familiaDesconocida"
  | "cifraInvalida";

export type LecturaDeMando =
  | { readonly ok: true; readonly mando: MandoDeMascotas }
  | { readonly ok: false; readonly error: ErrorDeMando };

/** Cuantos mandos puede usar el creador al dia. */
export const TOPE_DE_MANDOS_DIARIOS = 20;

/** Textos de cada negativa. Se leen en el chat, asi que dicen que hacer. */
export const EXPLICACION: Record<ErrorDeMando, string> = {
  sinObjetivo: "Responde al mensaje de alguien para decir de quién hablas.",
  sinSubcomando:
    "Qué hago: <code>huevo</code>, <code>dar</code>, <code>set</code>, <code>quitar</code>, <code>enfermar</code>, <code>sanar</code>, <code>revivir</code> o <code>ver</code>.",
  subcomandoDesconocido: "Ese no lo conozco.",
  sinRazon:
    "Falta el motivo, y es obligatorio. Dentro de seis meses tú tampoco te acordarás.",
  especieDesconocida: "Esa especie no está en el catálogo.",
  campoDesconocido: "Sólo puedo tocar hambre, ánimo, nivel o xp.",
  valorInvalido: "El valor tiene que ser un número entero y no negativo.",
  familiaDesconocida: "Esa familia no existe.",
  cifraInvalida:
    "Las cifras van así: <code>2500</code> con cuánto se queda, <code>72h</code> el plazo.",
};

/** Lo mas grande que cabe en un INTEGER de Postgres. */
const MAXIMO_ENTERO = 2_147_483_647;

/**
 * Entiende las cifras de `enfermar`, que van **delante del motivo**.
 *
 * `2500` es con cuanto se queda; `72h` es el plazo. Las dos son opcionales y en
 * cualquier orden, y en cuanto aparece algo que no es una cifra empieza el
 * motivo — asi `enfermar colico por listo` funciona sin escribir numeros.
 *
 * La `h` no es decoracion: sin ella, `enfermar 72 se ha pasado` querria decir
 * "que se quede con 72 monedas" y no "setenta y dos horas", y las dos lecturas
 * son plausibles mirando el mensaje. Con la unidad pegada no hay que adivinar.
 */
const leerEnfermar = (
  partes: readonly string[],
  objetivo: bigint,
): LecturaDeMando => {
  let resto: number | undefined;
  let horas: number | undefined;
  let i = 0;

  while (i < partes.length) {
    const parte = partes[i] ?? "";
    const enHoras = /^(\d+)h$/i.exec(parte);
    if (enHoras) {
      const valor = Number(enHoras[1]);
      if (!Number.isInteger(valor) || valor <= 0) {
        return { ok: false, error: "cifraInvalida" };
      }
      horas = valor;
      i += 1;
      continue;
    }
    if (/^\d+$/.test(parte)) {
      const valor = Number(parte);
      // Cero vale: es "que no le quede nada". Lo que no vale es un numero que
      // no quepa en la columna: `curaResto` es un INTEGER de Postgres, y un
      // valor por encima de eso no lo rechaza nadie hasta que la escritura
      // revienta a mitad de la transaccion, que es el peor sitio para
      // enterarse.
      if (!Number.isSafeInteger(valor) || valor > MAXIMO_ENTERO) {
        return { ok: false, error: "cifraInvalida" };
      }
      resto = valor;
      i += 1;
      continue;
    }
    break;
  }

  const razon = partes.slice(i).join(" ").trim();
  if (!razon) {
    return { ok: false, error: "sinRazon" };
  }
  return {
    ok: true,
    mando: {
      tipo: "enfermar",
      objetivo,
      ...(resto === undefined ? {} : { resto }),
      ...(horas === undefined ? {} : { horas }),
      razon,
    },
  };
};

/**
 * Entiende `/pet <que> [argumentos...]`.
 *
 * `objetivo` lo resuelve el nucleo —sale de a quien se responde— y entra ya
 * hecho: aqui no se navega un update de Telegram.
 */
export const leerMando = (
  partes: readonly string[],
  objetivo: bigint | undefined,
): LecturaDeMando => {
  const [que, ...resto] = partes;
  if (!que) {
    return { ok: false, error: "sinSubcomando" };
  }
  if (objetivo === undefined) {
    return { ok: false, error: "sinObjetivo" };
  }

  if (que === "ver") {
    return { ok: true, mando: { tipo: "ver", objetivo } };
  }

  if (que === "huevo") {
    const [familia] = resto;
    if (familia === undefined) {
      return { ok: true, mando: { tipo: "huevo", objetivo } };
    }
    if (!esFamiliaId(familia)) {
      return { ok: false, error: "familiaDesconocida" };
    }
    return { ok: true, mando: { tipo: "huevo", objetivo, familia } };
  }

  if (que === "dar") {
    const [especie, ...motivo] = resto;
    if (!especie || !esEspecieId(especie)) {
      return { ok: false, error: "especieDesconocida" };
    }
    const razon = motivo.join(" ").trim();
    if (!razon) {
      return { ok: false, error: "sinRazon" };
    }
    return { ok: true, mando: { tipo: "dar", objetivo, especie, razon } };
  }

  if (que === "set") {
    const [campo, valorCrudo, ...motivo] = resto;
    if (!campo || !esCampoDeMascota(campo)) {
      return { ok: false, error: "campoDesconocido" };
    }
    const valor = Number(valorCrudo);
    if (!Number.isInteger(valor) || valor < 0) {
      return { ok: false, error: "valorInvalido" };
    }
    const razon = motivo.join(" ").trim();
    if (!razon) {
      return { ok: false, error: "sinRazon" };
    }
    return { ok: true, mando: { tipo: "set", objetivo, campo, valor, razon } };
  }

  if (que === "quitar") {
    const razon = resto.join(" ").trim();
    if (!razon) {
      return { ok: false, error: "sinRazon" };
    }
    return { ok: true, mando: { tipo: "quitar", objetivo, razon } };
  }

  if (que === "enfermar") {
    return leerEnfermar(resto, objetivo);
  }

  if (que === "sanar" || que === "revivir") {
    const razon = resto.join(" ").trim();
    if (!razon) {
      return { ok: false, error: "sinRazon" };
    }
    return {
      ok: true,
      mando: { tipo: que === "sanar" ? "sanar" : "revivir", objetivo, razon },
    };
  }

  return { ok: false, error: "subcomandoDesconocido" };
};

/**
 * Si este mando crea un bicho que hay que marcar como regalado.
 *
 * **`dar` marca; `huevo` no.** No es un descuido: un huevo sale por el mismo
 * commit-reveal que el de cualquiera y la especie no la elige nadie, asi que el
 * bicho que salga es tan legitimo como el resto. Lo que hay que marcar es la
 * especie elegida a dedo, porque es lo unico que no se podia conseguir jugando.
 *
 * Si el regalo fuera invisible, **cualquier** legendaria del corral podria
 * serlo y todas perderian su valor a la vez.
 */
export const marcaComoRegalada = (mando: MandoDeMascotas): boolean =>
  mando.tipo === "dar";

/**
 * Si lo que hace este mando cuenta para el balance de la economia.
 *
 * Nada de lo que da el creador cuenta. Si contara, las curvas de quemado y
 * acuñado mentirian, y ajustar los precios con ellas seria adivinar con pasos
 * extra.
 */
export const cuentaParaElBalance = (): boolean => false;

/** Si el mando necesita ser el propietario y no basta con administrar. */
export const pideSerPropietario = (mando: MandoDeMascotas): boolean =>
  // Un admin de grupo puede arreglar entuertos —dar un huevo, ajustar una
  // barra— pero no crear mitologia: las legendarias solo las reparte el
  // propietario. `dar` cubre las legendarias, asi que va entero.
  //
  // La enfermedad y sus dos deshaceres van aqui por un motivo distinto y mas
  // gordo: firman una factura que puede vaciar una cartera entera y pueden
  // acabar en una mascota muerta. Un admin de grupo modera; esto no es moderar.
  mando.tipo === "dar" ||
  mando.tipo === "quitar" ||
  mando.tipo === "enfermar" ||
  mando.tipo === "sanar" ||
  mando.tipo === "revivir";

/** El resumen que se anota en el registro. Sin esto no queda rastro util. */
export const resumirParaAuditoria = (mando: MandoDeMascotas): string => {
  switch (mando.tipo) {
    case "huevo":
      return `huevo a ${mando.objetivo}${mando.familia ? ` (${mando.familia})` : ""}`;
    case "dar":
      return `dar ${mando.especie} a ${mando.objetivo}: ${mando.razon}`;
    case "set":
      return `set ${mando.campo}=${mando.valor} a ${mando.objetivo}: ${mando.razon}`;
    case "quitar":
      return `quitar a ${mando.objetivo}: ${mando.razon}`;
    case "enfermar":
      return `enfermar a ${mando.objetivo} (resto ${mando.resto ?? "del grupo"}, plazo ${mando.horas ?? "del grupo"}h): ${mando.razon}`;
    case "sanar":
      return `sanar a ${mando.objetivo}: ${mando.razon}`;
    case "revivir":
      return `revivir a ${mando.objetivo}: ${mando.razon}`;
    case "ver":
      return `ver ${mando.objetivo}`;
  }
};
