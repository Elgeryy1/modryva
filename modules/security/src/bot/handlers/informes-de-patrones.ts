import { detectCircularArgument } from "../../circular-argument.js";
import { detectCopyPaste } from "../../copypaste-detector.js";
import { detectGreetingSpam } from "../../greeting-spam.js";
import { detectInhumanRhythm } from "../../human-rhythm.js";
import { detectJokeEscalation } from "../../joke-escalation.js";
import { detectSignatureSpam } from "../../signature-spam.js";

/**
 * Los cinco informes de staff que buscan un patron en los mensajes recientes.
 *
 * En el nucleo eran cinco casos de un `switch` de 25, y los cinco hacian **la
 * misma consulta** —los mensajes recientes del chat— y repetian el mismo
 * `.filter().reverse().map()` palabra por palabra. Cinco viajes a la base para
 * mirar exactamente las mismas filas.
 *
 * Aqui reciben los mensajes ya buscados **una vez** y devuelven el texto.
 *
 * El orden importa y no es evidente: los detectores esperan los mensajes **del
 * mas viejo al mas nuevo**, y el repositorio los devuelve al reves. Ese
 * `.reverse()` estaba repetido en cada caso; ahora vive en el nucleo, en el
 * unico sitio donde se traduce la fila.
 */

/** Un mensaje reciente, con lo que estos cinco informes necesitan de el. */
export interface MensajeReciente {
  /** Quien lo escribio, si se sabe. */
  readonly autorId: number | undefined;
  readonly texto: string;
  readonly tieneEnlace: boolean;
  /** Cuando se escribio, en milisegundos. */
  readonly enMs: number;
}

/**
 * Los mensajes que tienen autor y texto, con el autor ya estrechado a numero.
 *
 * El predicado de tipo es lo que evita un `as number` en cada uso: filtrar por
 * `!== undefined` no estrecha el tipo por si solo, y castear seria fiarse de
 * que el filtro de arriba no cambie nunca.
 */
const conAutorConocido = (
  mensajes: readonly MensajeReciente[],
): { authorId: number; text: string }[] =>
  mensajes
    .filter(
      (m): m is MensajeReciente & { autorId: number } =>
        m.autorId !== undefined && m.texto.length > 0,
    )
    .map((m) => ({ authorId: m.autorId, text: m.texto }));

/** `/discusion_circular`: dos personas dando vueltas a lo mismo. */
export const informeDeDiscusionCircular = (
  mensajes: readonly MensajeReciente[],
): string => {
  const conAutor = conAutorConocido(mensajes);
  const r = detectCircularArgument(conAutor);
  return r.circular
    ? `🔁 Discusión circular entre ${r.authors.join(" y ")} (${r.repeats} vueltas)`
    : "No hay discusión circular reciente.";
};

/** `/copia_pega`: el mismo mensaje repetido desde varias cuentas. */
export const informeDeCopiaPega = (
  mensajes: readonly MensajeReciente[],
): string => {
  const conAutor = conAutorConocido(mensajes);
  const informe = detectCopyPaste(conAutor);
  return informe.matched
    ? informe.clusters
        .map((c) => `"${c.sample}" (${c.authors.length} cuentas)`)
        .join("\n")
    : "Sin mensajes copipasteados detectados.";
};

/** `/spam_saludo`: saludar y colar un enlace justo despues. */
export const informeDeSpamDeSaludo = (
  mensajes: readonly MensajeReciente[],
): string => {
  const senal = detectGreetingSpam(
    mensajes
      .filter((m) => m.texto)
      .map((m) => ({ text: m.texto, hasLink: m.tieneEnlace })),
  );
  return senal.matched
    ? `👋 Patrón de saludo+enlace detectado (mensaje ${senal.greetingIndex + 1})`
    : "Sin patrón de saludo+enlace reciente.";
};

/**
 * `/ritmo_humano`: si alguien escribe con la regularidad de un bot.
 *
 * Es el unico de los cinco que mira a UNA persona, asi que recibe a quien.
 */
export const informeDeRitmoHumano = (
  mensajes: readonly MensajeReciente[],
  deQuien: number,
): string => {
  const cuando = mensajes
    .filter((m) => m.autorId === deQuien)
    .map((m) => m.enMs)
    .sort((a, b) => a - b);
  const v = detectInhumanRhythm(cuando);
  return v.suspicious
    ? `🤖 Ritmo sospechoso (desviación ${v.stdDevMs}ms en ${v.intervalCount} intervalos)`
    : "Ritmo de escritura normal.";
};

/** `/escalada_broma`: una broma que acabo en insulto. */
export const informeDeEscaladaDeBroma = (
  mensajes: readonly MensajeReciente[],
): string => {
  const r = detectJokeEscalation(
    mensajes.filter((m) => m.texto).map((m) => ({ text: m.texto })),
  );
  return r.escalating
    ? "😬 Una broma reciente parece haber escalado a insulto."
    : "Sin escalada de bromas detectada.";
};

/**
 * `/spam_firma`: quien repite la misma coletilla en muchos mensajes.
 *
 * Va aparte de los cinco de arriba porque agrupa **por autor** en vez de mirar
 * la conversacion entera: la firma de spam es de una persona, no del chat.
 */
export const informeDeFirmasDeSpam = (
  mensajes: readonly MensajeReciente[],
  nombreDe: (id: string) => string,
): string => {
  const porAutor = new Map<string, string[]>();
  for (const m of mensajes) {
    if (m.autorId === undefined || !m.texto) continue;
    // `MensajeReciente.autorId` es `number` por herencia del nucleo. Se
    // convierte aqui para agrupar; unificarlo a cadena como en
    // `DormantMemberInput` toca los cinco informes de arriba y sus tests, y
    // va en su propio cambio.
    const clave = String(m.autorId);
    const suyos = porAutor.get(clave) ?? [];
    suyos.push(m.texto);
    porAutor.set(clave, suyos);
  }

  if (porAutor.size === 0) {
    return "Aún no hay mensajes para analizar firmas de spam.";
  }

  const senalados: string[] = [];
  for (const [autorId, suyos] of porAutor) {
    const r = detectSignatureSpam(suyos);
    if (r.matched && r.signature !== undefined) {
      senalados.push(
        `${nombreDe(autorId)}: "${r.signature}" (${r.occurrences} veces)`,
      );
    }
  }

  return senalados.length > 0
    ? `📛 Firmas de spam repetidas:\n${senalados.join("\n")}`
    : "🧼 Sin firmas de spam repetidas detectadas.";
};
