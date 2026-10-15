/**
 * Los mandos del creador sobre las mascotas: `/pet <que> ...`.
 *
 * Vive fuera de `bot-update.service.ts` a proposito, igual que el adaptador. El
 * nucleo solo puede encoger, y todo lo que se escriba aqui es tamaño que no se
 * le suma — ademas de que esto se prueba suelto, sin arrancar el servicio.
 *
 * **`mandos.ts` decide y esto ejecuta.** Alli se valida lo que se ha pedido y
 * se dice que hay que hacer; aqui se hace, se registra y se redacta. Las
 * salvaguardas que no son decision —el permiso y el apunte de auditoria— van
 * aqui porque son las que necesitan saber quien manda y donde se anota, que es
 * justo lo que un módulo no puede saber.
 *
 * Tres cosas que **no se pueden aflojar**:
 *
 * 1. **Solo el propietario.** `pideSerPropietario` lo dice para `dar`,
 *    `quitar`, `enfermar`, `sanar` y `revivir`; aqui se comprueba contra
 *    `SUPERBOT_OWNER_TELEGRAM_ID`. Un admin de grupo modera: firmar una factura
 *    que vacia una cartera y puede acabar en una mascota muerta no es moderar.
 * 2. **Todo lo que cambia algo se anota**, con su motivo, antes de contestar.
 *    Es lo unico que puede contestar dentro de seis meses a "¿y por que se
 *    murio ese bicho?".
 * 3. **La marcha atras es `sanar`**, y es instantanea y gratis. Por eso el
 *    mensaje de enfermar nombra en grande a quien le toca: el error de haber
 *    respondido al mensaje de al lado tiene que verse en el mismo segundo.
 *
 * Cinco de los ocho subcomandos que `mandos.ts` sabe leer —`huevo`, `dar`,
 * `set`, `quitar` y `ver`— **todavia no estan implementados aqui**. Estan
 * escritos y probados desde el 2026-08-28 y no los llamaba nadie; esta tanda
 * cablea los tres de la enfermedad, que son los que hacen falta hoy, y los deja
 * contestando que aún no estan en vez de fingir que funcionan.
 */

import type { PetState } from "@superbot/data";
import {
  type AjustesDeMascotas,
  diagnosticar,
  ESPECIES,
  EXPLICACION,
  esEspecieId,
  leerMando,
  type MandoDeMascotas,
  pideSerPropietario,
  resumirParaAuditoria,
} from "@superbot/module-games";

/** Lo que hace falta del mundo para ejecutar un mando. */
export interface DependenciasDeMandos {
  /** La mascota de la persona a la que va dirigido, ya leida. */
  readonly buscar: (objetivo: bigint) => Promise<PetState | null>;
  readonly enfermar: (input: {
    readonly id: string;
    readonly desde: Date;
    readonly motivo: string;
    readonly coste: number;
    readonly resto: number;
    readonly vence: Date;
  }) => Promise<boolean>;
  readonly sanar: (id: string) => Promise<boolean>;
  readonly revivir: (id: string, cuando: Date) => Promise<boolean>;
  /** El saldo de la persona a la que va dirigido. De ahi sale la factura. */
  readonly saldoDe: (objetivo: bigint) => Promise<number>;
  /** Deja constancia. Se llama SIEMPRE antes de contestar. */
  readonly anotar: (accion: string, resumen: string) => Promise<void>;
  /** Como se llama alguien, para poder nombrarlo en el mensaje. */
  readonly nombreDe: (usuario: bigint) => string;
  readonly ajustes: AjustesDeMascotas;
  /** El reloj, inyectado. Aqui no hay `new Date()`. */
  readonly ahora: Date;
}

/** Un numero de monedas con puntos de millar. */
const conPuntos = (monedas: number): string =>
  Math.round(monedas)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Las horas de plazo en algo que se lea. */
const enPlazo = (horas: number): string =>
  horas >= 48 ? `${Math.floor(horas / 24)} días` : `${horas} horas`;

const NO_ERES_EL_PROPIETARIO =
  "Esto solo lo puede hacer el propietario del bot.";

const SIN_BICHO = "Esa persona no tiene bicho.";

/** Los cinco que `mandos.ts` sabe leer y este fichero todavia no ejecuta. */
const TODAVIA_NO =
  "Ese mando existe pero aún no está cableado. Hoy van <code>enfermar</code>, <code>sanar</code> y <code>revivir</code>.";

/**
 * Ejecuta `/pet <que> ...` y devuelve el texto, o `null` si no le toca.
 *
 * `esPropietario` entra ya resuelto contra el entorno: este fichero no lee
 * variables, se las dan.
 */
export const atenderMandoDeMascotas = async (peticion: {
  readonly partes: readonly string[];
  readonly objetivo: bigint | undefined;
  readonly esPropietario: boolean;
  readonly dependencias: DependenciasDeMandos;
}): Promise<string | null> => {
  const { partes, objetivo, esPropietario, dependencias } = peticion;

  const lectura = leerMando(partes, objetivo);
  if (!lectura.ok) {
    return EXPLICACION[lectura.error];
  }
  const mando = lectura.mando;

  // El permiso se comprueba ANTES de tocar nada y antes de leer la mascota: si
  // no puedes, ni siquiera te enteras de si esa persona tiene bicho.
  if (pideSerPropietario(mando) && !esPropietario) {
    return NO_ERES_EL_PROPIETARIO;
  }

  if (
    mando.tipo === "huevo" ||
    mando.tipo === "dar" ||
    mando.tipo === "set" ||
    mando.tipo === "quitar" ||
    mando.tipo === "ver"
  ) {
    return TODAVIA_NO;
  }

  const fila = await dependencias.buscar(mando.objetivo);
  if (!fila) {
    return SIN_BICHO;
  }

  const quien = dependencias.nombreDe(mando.objetivo);
  // El mote si lo tiene, y si no el nombre de su especie. La mayoria de las
  // mascotas de produccion **no tienen mote**, asi que un texto que solo
  // contara con el saldria diciendo "su bicho" en el caso mas comun.
  const comoSeLlama =
    fila.nombre ??
    (esEspecieId(fila.especie) ? ESPECIES[fila.especie].nombre : "su bicho");

  if (mando.tipo === "sanar") {
    const sanada = await dependencias.sanar(fila.id);
    if (!sanada) {
      return `${comoSeLlama} no está enfermo. No hay nada que curar.`;
    }
    await dependencias.anotar("pets.sanada", resumirParaAuditoria(mando));
    return `🩺 <b>${comoSeLlama}</b> está curado. Indulto del creador.`;
  }

  if (mando.tipo === "revivir") {
    const viva = await dependencias.revivir(fila.id, dependencias.ahora);
    if (!viva) {
      return `${comoSeLlama} no está muerto.`;
    }
    await dependencias.anotar("pets.revivida", resumirParaAuditoria(mando));
    return [
      `✨ <b>${comoSeLlama}</b> ha vuelto.`,
      "",
      "Vuelve sano y con el reloj a cero. Dale de comer.",
    ].join("\n");
  }

  return enfermarA(mando, fila, quien, comoSeLlama, dependencias);
};

/**
 * Declara la enfermedad.
 *
 * Aparte porque es el unico que compone: lee el saldo, deja que el módulo
 * decida la factura, escribe y redacta un mensaje largo. Los otros dos son una
 * llamada y una linea.
 */
const enfermarA = async (
  mando: Extract<MandoDeMascotas, { tipo: "enfermar" }>,
  fila: PetState,
  quien: string,
  comoSeLlama: string,
  dependencias: DependenciasDeMandos,
): Promise<string> => {
  const { ajustes, ahora } = dependencias;
  const saldo = await dependencias.saldoDe(mando.objetivo);
  const resto = mando.resto ?? ajustes.restoTrasOperar;
  const horas = mando.horas ?? ajustes.horasDePlazo;

  const diagnostico = diagnosticar({
    ficha: fila,
    // El hambre se mira ya envejecida: quien llama le ha pasado el tiempo. Una
    // que este dormida no se puede enfermar, y eso lo decide el módulo.
    hambre: fila.hambre,
    saldo,
    resto,
    horasDePlazo: horas,
    motivo: mando.razon,
    ahora,
  });

  if (!diagnostico.ok) {
    switch (diagnostico.motivo) {
      case "yaEnferma":
        return `${comoSeLlama} ya está enfermo. Míralo con <code>/mascota</code>.`;
      case "yaMuerta":
        return `${comoSeLlama} ya está muerto.`;
      case "dormida":
        return [
          `${comoSeLlama} está dormido de hambre.`,
          "",
          "Nadie va a leer la factura y el plazo vencería solo. Despiértalo antes.",
        ].join("\n");
      case "sinSaldo":
        return [
          `${quien} no tiene con qué pagar una operación.`,
          "",
          `Tiene ${conPuntos(saldo)} monedas y el suelo está en ${conPuntos(resto)}.`,
        ].join("\n");
      default:
        return EXPLICACION.sinRazon;
    }
  }

  const puesta = await dependencias.enfermar({
    id: fila.id,
    desde: diagnostico.dolencia.desde,
    motivo: diagnostico.dolencia.motivo,
    coste: diagnostico.dolencia.coste,
    resto: diagnostico.dolencia.resto,
    vence: diagnostico.dolencia.vence,
  });
  if (!puesta) {
    // La carrera existe: dos mandos seguidos, o alguien que le dio de comer
    // entre medias. La base de datos es quien manda.
    return `${comoSeLlama} ya está enfermo.`;
  }

  await dependencias.anotar("pets.enfermada", resumirParaAuditoria(mando));

  // El nombre de la persona va en grande y el primero. Es la unica red que
  // tiene este mando: si te has equivocado de mensaje al responder, se ve aqui
  // y se deshace con `/pet sanar`.
  return [
    `🩺 <b>${comoSeLlama}, de ${quien}, se ha puesto muy malo.</b>`,
    "",
    `<i>${diagnostico.dolencia.motivo}</i>`,
    "",
    `La operación cuesta <b>${conPuntos(diagnostico.dolencia.coste)}</b> monedas.`,
    `Hay <b>${enPlazo(horas)}</b> para pagarla con <code>/operar</code>.`,
    "",
    `Después le quedarán ${conPuntos(diagnostico.dolencia.resto)} monedas.`,
    "Si no se paga a tiempo, no lo cuenta.",
  ].join("\n");
};
