import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Voz/tono del bot por grupo: adorna los mensajes salientes segun el tono
 * configurado (serio, cercano, gamer, academico, ironico). Logica pura y
 * determinista; sin I/O ni estado. La decoracion es user-facing (con acentos)
 * mientras que la deteccion/parseo trabaja con tokens sin acentos.
 */

/** Tonos soportados, en orden de presentacion. Solo lectura. */
export const BOT_VOICES = [
  "serio",
  "cercano",
  "gamer",
  "academico",
  "ironico",
] as const;

/** Union de los tonos validos. */
export type BotVoice = (typeof BOT_VOICES)[number];

/**
 * True cuando `v` es exactamente uno de los tonos soportados. Actua como type
 * guard para estrechar `string` a `BotVoice`. Pure y deterministica.
 */
export const isBotVoice = (v: string): v is BotVoice =>
  (BOT_VOICES as readonly string[]).includes(v);

const VOICE_DECORATORS: Readonly<
  Record<BotVoice, (message: string) => string>
> = {
  serio: (message) => message,
  cercano: (message) => `😊 ${message} ¡Un abrazo!`,
  gamer: (message) => `🎮 ${message} ¡A darle, crack!`,
  academico: (message) =>
    `📚 ${message} (referencia disponible bajo petición).`,
  ironico: (message) => `🙃 ${message}... o eso dicen.`,
};

/**
 * Adorna `baseMessage` segun `voice`. El tono "serio" devuelve el mensaje sin
 * cambios (neutro/formal); los demas anaden un prefijo/sufijo caracteristico.
 * Si `voice` no es un tono valido, devuelve `baseMessage` intacto. El texto
 * resultante es user-facing (con acentos). Pure y deterministica.
 */
export const applyBotVoice = (baseMessage: string, voice: string): string => {
  if (!isBotVoice(voice)) {
    return baseMessage;
  }
  return VOICE_DECORATORS[voice](baseMessage);
};

/** Comando parseado para fijar el tono del bot en el grupo. */
export interface BotVoiceCommand {
  readonly voice: BotVoice;
}

/** Motivo por el que `/voz` no pudo parsearse. */
export interface BotVoiceCommandError {
  readonly code: "missing-voice" | "invalid-voice";
  readonly usage: string;
}

/** Union discriminada del resultado de parsear `/voz`. */
export type BotVoiceCommandResult =
  | { readonly ok: true; readonly command: BotVoiceCommand }
  | { readonly ok: false; readonly error: BotVoiceCommandError };

const VOICE_USAGE = `Uso: /voz ${BOT_VOICES.join("|")}`;

/**
 * Parsea `/voz <tono>` en `{ voice }`. Devuelve error "missing-voice" cuando no
 * hay argumento y "invalid-voice" cuando el argumento no es un tono soportado.
 * Devuelve null cuando el update no lleva el comando `/voz`. El tono se compara
 * en minusculas. Pure y deterministica.
 */
export const parseVoiceCommand = (
  update: TelegramUpdateEnvelope,
): BotVoiceCommandResult | null => {
  if (update.command?.name !== "voz") {
    return null;
  }

  const raw = update.command?.args?.[0]?.toLowerCase();

  if (raw === undefined || raw.length === 0) {
    return { ok: false, error: { code: "missing-voice", usage: VOICE_USAGE } };
  }

  if (!isBotVoice(raw)) {
    return { ok: false, error: { code: "invalid-voice", usage: VOICE_USAGE } };
  }

  return { ok: true, command: { voice: raw } };
};
