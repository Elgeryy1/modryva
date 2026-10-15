import { enteroDelArgumento } from "@superbot/shared";

import { decideContentReputation } from "../../content-reputation.js";
import { validateRuleExplanation } from "../../rule-explanation.js";
import type {
  ExplicacionesDeReglaPort,
  FuentesDeConfianzaPort,
  ReputacionDeFuente,
} from "../puertos.js";

/**
 * Los dos casos de `/utility_plus` que LEEN lo guardado, lo mezclan y lo
 * vuelven a escribir.
 *
 * Son los unicos dos de automatización que merecian salir del nucleo. El
 * criterio del repo es que una extraccion profunda vale la pena cuando la
 * orquestacion tiene decisiones dentro, y aqui las hay: se lee un mapa que
 * puede venir de cualquier forma, hay que decidir que hacer con lo que no
 * encaja, y solo despues se escribe.
 *
 * Los otros cinco (`fase_dia`, `modo_evento`, `modo_examen`,
 * `modo_solo_lectura`, `cerrar_topic`) son decision pura y una escritura, sin
 * una sola bifurcacion que cambie el resultado. Sacarlos produce un fichero que
 * envuelve una llamada a un puerto, que es el microfichero que la guia dice que
 * hay que evitar. Se quedan, y esta escrito por que.
 */

/**
 * Lo guardado, quedandose solo con las entradas que tienen la forma correcta.
 *
 * El nucleo hacia `raw as Record<string, {trusted: boolean; score: number}>`
 * despues de comprobar unicamente `typeof raw === "object"`. Eso deja pasar
 * cualquier objeto: un mapa con valores de otra forma se leia como si fuera
 * bueno, se le anadia la fuente nueva y se volvia a escribir entero, con la
 * basura dentro. Un `as` no comprueba nada; solo silencia al compilador.
 *
 * Descartar la entrada mala y no el mapa entero es deliberado: una fuente
 * corrupta no puede llevarse por delante las que si estan bien.
 */
export const fuentesDeConfianzaValidas = (
  crudo: unknown,
): Record<string, ReputacionDeFuente> => {
  if (typeof crudo !== "object" || crudo === null) {
    return {};
  }
  const salida: Record<string, ReputacionDeFuente> = {};
  for (const [nombre, valor] of Object.entries(crudo)) {
    if (
      typeof valor === "object" &&
      valor !== null &&
      typeof (valor as ReputacionDeFuente).trusted === "boolean" &&
      typeof (valor as ReputacionDeFuente).score === "number"
    ) {
      const v = valor as ReputacionDeFuente;
      salida[nombre] = { trusted: v.trusted, score: v.score };
    }
  }
  return salida;
};

/** Lo guardado, quedandose solo con las explicaciones que son texto. */
export const explicacionesValidas = (
  crudo: unknown,
): Record<string, string> => {
  if (typeof crudo !== "object" || crudo === null) {
    return {};
  }
  const salida: Record<string, string> = {};
  for (const [nombre, valor] of Object.entries(crudo)) {
    if (typeof valor === "string") {
      salida[nombre] = valor;
    }
  }
  return salida;
};

/**
 * `/reputacion_contenido`: apunta si una fuente se ha ganado la confianza.
 *
 * El orden de los efectos importa y por eso esta aqui y no en el nucleo:
 * primero se decide, luego se lee lo que habia, se mezcla y se escribe. Si se
 * escribiera antes de leer, la fuente nueva se llevaria por delante el mapa
 * entero.
 */
export const registrarReputacionDeFuente = async (
  args: readonly string[],
  fuentes: FuentesDeConfianzaPort | undefined,
): Promise<string> => {
  const fuente = args[0]?.trim();
  const aprobaciones = enteroDelArgumento(args[1]);
  const rechazos = enteroDelArgumento(args[2]);
  if (!fuente || aprobaciones === null || rechazos === null) {
    return "Uso: /reputacion_contenido <fuente> <aprobaciones> <rechazos>";
  }

  const v = decideContentReputation({
    approvals: aprobaciones,
    rejections: rechazos,
  });

  // Sin puerto —fuera de un grupo— se calcula igual pero no se guarda nada. Es
  // lo que hacia el nucleo con su `if (context.chatId)`, y el mensaje sigue
  // diciendo lo mismo que decia entonces.
  if (fuentes) {
    const guardadas = await fuentes.leer();
    await fuentes.guardar({
      ...guardadas,
      [fuente]: { trusted: v.trusted, score: v.score },
    });
  }

  return v.trusted
    ? `✅ "${fuente}" confiable (score ${v.score}) — añadida a la lista de confianza`
    : `⚠️ "${fuente}" no confiable (score ${v.score})`;
};

/**
 * `/validar_explicacion`: guarda el porqué oficial de una regla, si vale.
 *
 * Solo se guarda cuando la explicacion pasa la validacion. Guardar una
 * insuficiente seria peor que no guardar ninguna: la regla parece explicada y
 * nadie vuelve a mirarla.
 */
export const registrarExplicacionDeRegla = async (
  args: readonly string[],
  explicaciones: ExplicacionesDeReglaPort | undefined,
): Promise<string> => {
  const [nombreCrudo, explicacionCruda] = args.join(" ").split("|");
  const nombre = nombreCrudo?.trim();
  const explicacion = explicacionCruda?.trim();
  if (!nombre || !explicacion) {
    return "Uso: /validar_explicacion <nombre>|<explicación>";
  }

  const v = validateRuleExplanation({ name: nombre, explanation: explicacion });
  if (!v.valid) {
    return `⚠️ ${v.issue ?? "Explicación insuficiente."}`;
  }

  if (explicaciones) {
    const guardadas = await explicaciones.leer();
    await explicaciones.guardar({ ...guardadas, [nombre]: explicacion });
  }

  return "✅ Explicación suficiente y guardada como la explicación oficial de la regla.";
};
