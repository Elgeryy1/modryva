/**
 * Qué significa de verdad que Telegram rechace un approve/decline sobre una
 * solicitud de entrada.
 *
 * Hasta ahora los tres casos posibles se trataban como uno solo —un ERROR que
 * dice "person NOT admitted/rejected"— y dos de ellos son falsos. El más común
 * de largo, `USER_ALREADY_PARTICIPANT` sobre un approve, significa justo lo
 * contrario de lo que grita: la persona está dentro. En 40 h de producción eso
 * fueron 27 gritos falsos, y su único efecto real es enterrar el grito
 * verdadero del día que alguien se quede fuera de verdad.
 *
 * La clave es que el texto de Telegram NO basta para leer lo que pasó: hace
 * falta el texto MÁS lo que queríamos. "Ya es participante" es el final feliz
 * de un approve y un problema serio de un decline — dijimos que no entrara y
 * resulta que está dentro.
 *
 * OJO, no unificar a ciegas con `isRequestAlreadyGone` del worker: allí un
 * decline NO busca echar a nadie, solo liberar la solicitud pendiente (Telegram
 * no acepta una segunda mientras haya una viva). Con ese objetivo, "ya es
 * participante" sí es un final correcto. Dos definiciones distintas de benigno
 * porque son dos trabajos distintos, no porque una esté mal.
 */

/** Lo que se le pidió a Telegram, que es la mitad de la lectura. */
export type JoinRequestIntent = "approve" | "decline";

export type JoinRequestFailure =
  /**
   * El estado que buscábamos ya era cierto antes de llamar. No hay nada que
   * hacer, y tampoco nada que avisar: la persona está donde queríamos.
   */
  | "already-settled"
  /**
   * La solicitud ya no está pendiente, y Telegram no dice qué fue de la
   * persona: puede haberla admitido otro, puede haberla retirado ella, puede
   * haber caducado. Visible pero no alarmante — salvo que nadie más la haya
   * atendido, en cuyo caso el que llama sí sabe que importa.
   */
  | "no-longer-pending"
  /** Todo lo demás: permisos, red, chat inexistente. Esto sí es un fallo. */
  | "failed";

/**
 * El mensaje de error tal cual, venga como venga. `telegramFailure` construye
 * un `Error` con la `description` de Telegram dentro del texto, pero esto se
 * lee desde tres servicios distintos y no cuesta nada aceptar cualquier cosa
 * con `.message` antes que fallar al clasificar por un `instanceof` perdido
 * entre módulos.
 */
const messageOf = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const raw = (error as { message?: unknown }).message;
    return typeof raw === "string" ? raw : "";
  }
  return "";
};

const says = (error: unknown, token: string): boolean =>
  messageOf(error).toUpperCase().includes(token);

/**
 * Lee un fallo de `approveChatJoinRequest` / `declineChatJoinRequest`.
 *
 * Deliberadamente NO existe un caso "todo bien" aquí: esta función solo se
 * llama desde un `catch`, y devolver "failed" ante cualquier cosa que no
 * reconozca es lo que mantiene el ruido bajo sin volverse sorda. Un código de
 * Telegram nuevo sale por la puerta ruidosa, no por la silenciosa.
 */
export const classifyJoinRequestFailure = (
  intent: JoinRequestIntent,
  error: unknown,
): JoinRequestFailure => {
  if (says(error, "USER_ALREADY_PARTICIPANT")) {
    // Sobre un approve es el final que queríamos. Sobre un decline es lo
    // contrario de lo que pedimos, y de las cosas peores que pueden pasar
    // calladas: rechazamos a alguien y sigue dentro del grupo.
    return intent === "approve" ? "already-settled" : "failed";
  }
  if (says(error, "HIDE_REQUESTER_MISSING")) {
    return "no-longer-pending";
  }
  return "failed";
};
