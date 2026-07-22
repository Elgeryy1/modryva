import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Catalogo de motivos de sancion reutilizables. Detector puro + comando de
 * consulta; el envio de mensajes y la aplicacion de la sancion viven en el
 * servicio. Cada preset sugiere una accion de moderacion por defecto, pero el
 * moderador siempre puede elegir otra. Todo determinista, sin I/O.
 */

/** Acciones de moderacion que un preset puede sugerir. */
export type SanctionSuggestedAction = "warn" | "mute" | "ban";

/** Un motivo de sancion predefinido con su etiqueta y accion sugerida. */
export interface SanctionReasonPreset {
  readonly key: string;
  readonly label: string;
  readonly suggestedAction: SanctionSuggestedAction;
}

/**
 * Motivos de sancion soportados. El orden es estable y define el orden de
 * `formatSanctionReasonList`. Las keys son unicas y en minusculas con guiones.
 */
export const SANCTION_REASON_PRESETS: readonly SanctionReasonPreset[] = [
  { key: "spam-comercial", label: "Spam comercial", suggestedAction: "ban" },
  { key: "insulto-leve", label: "Insulto leve", suggestedAction: "warn" },
  { key: "acoso", label: "Acoso", suggestedAction: "ban" },
  { key: "flood", label: "Flood", suggestedAction: "mute" },
  { key: "off-topic", label: "Fuera de tema", suggestedAction: "warn" },
  { key: "scam", label: "Estafa", suggestedAction: "ban" },
  { key: "nsfw", label: "Contenido NSFW", suggestedAction: "ban" },
  { key: "raid", label: "Raid", suggestedAction: "ban" },
];

const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Resuelve un motivo a partir de una entrada libre. Coincide primero por key
 * exacta y, si no, por texto contenido: la entrada aparece dentro de la key o
 * de la label (o viceversa), comparando en minusculas. Devuelve null cuando la
 * entrada esta vacia o no coincide con ningun preset. Determinista: recorre los
 * presets en orden y devuelve la primera coincidencia.
 */
export const resolveSanctionReason = (
  input: string,
): SanctionReasonPreset | null => {
  const needle = normalize(input);
  if (needle.length === 0) {
    return null;
  }

  const exact = SANCTION_REASON_PRESETS.find((preset) => preset.key === needle);
  if (exact) {
    return exact;
  }

  return (
    SANCTION_REASON_PRESETS.find((preset) => {
      const label = preset.label.toLowerCase();
      return (
        preset.key.includes(needle) ||
        needle.includes(preset.key) ||
        label.includes(needle) ||
        needle.includes(label)
      );
    }) ?? null
  );
};

const actionLabels: Readonly<Record<SanctionSuggestedAction, string>> = {
  warn: "aviso",
  mute: "silenciar",
  ban: "expulsar",
};

/**
 * Formatea el catalogo completo como una lista legible, una linea por preset:
 * `"- spam-comercial: Spam comercial (expulsar)"`. Determinista y sin saltos de
 * linea finales.
 */
export const formatSanctionReasonList = (): string =>
  SANCTION_REASON_PRESETS.map(
    (preset) =>
      `- ${preset.key}: ${preset.label} (${actionLabels[preset.suggestedAction]})`,
  ).join("\n");

/** Comando `/reasons` ya parseado. */
export type SanctionReasonCommand =
  | { readonly kind: "list" }
  | { readonly kind: "use"; readonly reasonKey: string };

/** Error de uso de `/reasons` con el texto de ayuda a mostrar. */
export interface SanctionReasonCommandError {
  readonly usage: string;
}

export type SanctionReasonCommandResult =
  | { readonly ok: true; readonly command: SanctionReasonCommand }
  | { readonly ok: false; readonly error: SanctionReasonCommandError };

const REASONS_USAGE = "Uso: /reasons [motivo]";

/**
 * Parsea `/reasons` (lista el catalogo) y `/reasons <motivo>` (resuelve el
 * motivo y devuelve su key). Devuelve null cuando el update no es `/reasons`.
 * Devuelve `{ ok: false }` cuando el motivo dado no coincide con ningun preset.
 * Pura y determinista.
 */
export const parseSanctionReasonCommand = (
  update: TelegramUpdateEnvelope,
): SanctionReasonCommandResult | null => {
  if (update.command?.name !== "reasons") {
    return null;
  }

  const argument = (update.command?.args ?? []).join(" ").trim();
  if (argument.length === 0) {
    return { ok: true, command: { kind: "list" } };
  }

  const resolved = resolveSanctionReason(argument);
  if (!resolved) {
    return { ok: false, error: { usage: REASONS_USAGE } };
  }

  return { ok: true, command: { kind: "use", reasonKey: resolved.key } };
};
