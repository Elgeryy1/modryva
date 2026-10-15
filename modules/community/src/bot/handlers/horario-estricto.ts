import { isStrictAtHour, type TimeRule } from "../../scheduled-rules.js";

/**
 * `scheduled-strict.ambient`: en las franjas marcadas como estrictas, no se
 * permiten enlaces.
 *
 * Se lleva la orquestacion entera. En el nucleo solo queda traducir el update y
 * darle los puertos.
 *
 * **El orden de las tres preguntas es comportamiento**, no casualidad:
 *
 * 1. Primero la franja, que es una lectura de ajustes.
 * 2. Solo si hay franja estricta se pregunta por el admin, que cuesta una
 *    llamada a Telegram.
 * 3. Y solo entonces se borra.
 *
 * Invertir 1 y 2 haria una llamada a Telegram por cada mensaje con enlace,
 * incluso fuera de horario. Con el retraso de entrega siendo LA metrica de la
 * incidencia de Guardian, eso no es un detalle.
 */

/** Lo que el handler necesita del resto del sistema. */
export interface PuertosDeHorarioEstricto {
  /** Las reglas del chat, tal como estan guardadas. */
  reglasDelChat(): Promise<unknown>;
  /** Si quien escribe puede saltarse la franja. Se pregunta lo mas tarde posible. */
  esAdministrador(): Promise<boolean>;
  /** Borra el mensaje. Que falle no impide contestar. */
  borrarMensaje(): Promise<void>;
}

/** El update ya normalizado. */
export interface MensajeParaHorario {
  readonly esComando: boolean;
  readonly tieneEnlace: boolean;
}

/**
 * Las reglas guardadas, con la forma comprobada.
 *
 * El nucleo hacia `Array.isArray(raw) ? (raw as TimeRule[]) : []`, que se fia
 * de que los elementos tengan la forma. Vienen de la base de datos, donde cabe
 * cualquier cosa: un ajuste viejo, una edicion a mano. Aqui se comprueban de
 * verdad y lo que no encaja se descarta, que es lo mismo que hacia el código
 * anterior con una lista entera mal formada — solo que ahora tambien con una
 * lista donde solo sobra un elemento.
 */
export const reglasValidas = (crudo: unknown): readonly TimeRule[] => {
  if (!Array.isArray(crudo)) return [];
  return crudo.filter((r): r is TimeRule => {
    if (typeof r !== "object" || r === null) return false;
    const c = r as Record<string, unknown>;
    return (
      typeof c.startHour === "number" &&
      typeof c.endHour === "number" &&
      typeof c.strict === "boolean"
    );
  });
};

/** El aviso, o `null` si no hay que hacer nada. */
export const aplicarHorarioEstricto = async (
  mensaje: MensajeParaHorario,
  horaActual: number,
  puertos: PuertosDeHorarioEstricto,
): Promise<string | null> => {
  if (mensaje.esComando || !mensaje.tieneEnlace) {
    return null;
  }

  const reglas = reglasValidas(await puertos.reglasDelChat());
  if (reglas.length === 0 || !isStrictAtHour(reglas, horaActual)) {
    return null;
  }

  if (await puertos.esAdministrador()) {
    return null;
  }

  try {
    await puertos.borrarMensaje();
  } catch {
    // Que Telegram rechace el borrado no puede dejar sin respuesta a quien
    // escribio: se le dice igual por que no se permite.
  }

  return "🌙 Modo estricto por horario: no se permiten enlaces a esta hora.";
};
