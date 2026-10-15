import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Presets de webhook de alertas para Discord y Slack construidos sobre el
 * motor HMAC existente. Este modulo es logica pura: solo construye los cuerpos
 * JSON que luego otra capa firma y envia. Nunca hace fetch ni toca la red.
 */

/**
 * Severidad de una alerta. Determina el color del embed (Discord) y el emoji
 * de cabecera (Slack).
 */
export type AlertSeverity = "info" | "warn" | "critical";

/**
 * Un evento de alerta plano y serializable. `url` es opcional y, cuando esta
 * presente, se anexa como enlace al final del cuerpo.
 */
export interface AlertEvent {
  readonly kind: string;
  readonly groupTitle: string;
  readonly text: string;
  readonly severity: AlertSeverity;
  readonly url?: string;
}

/** Destinos de preset soportados por el comando `/alertpreset`. */
export const ALERT_PRESET_TARGETS = ["discord", "slack", "generic"] as const;

/** Un destino de preset valido (uno de {@link ALERT_PRESET_TARGETS}). */
export type AlertPresetTarget = (typeof ALERT_PRESET_TARGETS)[number];

/**
 * Colores de embed de Discord (enteros decimales de 24 bits) por severidad.
 * info = azul, warn = ambar, critical = rojo.
 */
export const ALERT_SEVERITY_COLORS: Readonly<Record<AlertSeverity, number>> = {
  info: 0x3498db,
  warn: 0xf1c40f,
  critical: 0xe74c3c,
};

/**
 * Emoji de cabecera por severidad, usado en el bloque de titulo de Slack y en
 * el titulo del embed de Discord.
 */
export const ALERT_SEVERITY_EMOJIS: Readonly<Record<AlertSeverity, string>> = {
  info: "🔵",
  warn: "🟡",
  critical: "🔴",
};

const alertSeverities: ReadonlySet<string> = new Set([
  "info",
  "warn",
  "critical",
]);

/** True si `value` es una {@link AlertSeverity} valida. */
export const isAlertSeverity = (value: string): value is AlertSeverity =>
  alertSeverities.has(value);

/**
 * Devuelve el color de embed de Discord para una severidad. Determinista.
 */
export const alertSeverityColor = (severity: AlertSeverity): number =>
  ALERT_SEVERITY_COLORS[severity];

/**
 * Construye el titulo humano de una alerta, p.ej. `"🔴 [critical] antiflood"`.
 * Usa el emoji y la severidad en minusculas seguidos del `kind`. Puro.
 */
export const buildAlertTitle = (event: AlertEvent): string =>
  `${ALERT_SEVERITY_EMOJIS[event.severity]} [${event.severity}] ${event.kind}`;

/**
 * Construye el cuerpo (payload) de webhook de Discord con un unico embed cuyo
 * color depende de la severidad. Incluye un campo con el titulo del grupo y,
 * si hay `url`, la adjunta como propiedad `url` del embed. Devuelve JSON plano;
 * no realiza ninguna peticion. Puro y determinista.
 */
export const buildDiscordAlertPayload = (event: AlertEvent): unknown => {
  const embed: Record<string, unknown> = {
    title: buildAlertTitle(event),
    description: event.text,
    color: alertSeverityColor(event.severity),
    fields: [
      {
        name: "Grupo",
        value: event.groupTitle,
        inline: true,
      },
    ],
  };

  if (event.url !== undefined) {
    embed.url = event.url;
  }

  return { embeds: [embed] };
};

/**
 * Construye el cuerpo (payload) de webhook de Slack usando Block Kit: un bloque
 * de cabecera con el titulo, una seccion con el texto y el grupo, y, si hay
 * `url`, un bloque de contexto con el enlace. Devuelve JSON plano; no realiza
 * ninguna peticion. Puro y determinista.
 */
export const buildSlackAlertPayload = (event: AlertEvent): unknown => {
  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: buildAlertTitle(event),
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${event.groupTitle}*\n${event.text}`,
      },
    },
  ];

  if (event.url !== undefined) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${event.url}|Ver detalle>`,
        },
      ],
    });
  }

  return { blocks };
};

/** El comando `/alertpreset <target>` ya parseado. */
export interface AlertPresetCommand {
  readonly target: AlertPresetTarget;
}

/** Error de parseo del comando `/alertpreset`. */
export interface AlertPresetCommandError {
  readonly code: "missing-target" | "invalid-target";
  readonly usage: string;
}

/** Resultado discriminado del parseo de `/alertpreset`. */
export type AlertPresetCommandResult =
  | { readonly ok: true; readonly command: AlertPresetCommand }
  | { readonly ok: false; readonly error: AlertPresetCommandError };

const ALERT_PRESET_USAGE = `Uso: /alertpreset ${ALERT_PRESET_TARGETS.join("|")}`;

/**
 * Parsea `/alertpreset discord|slack|generic`. Devuelve null cuando el update
 * no lleva el comando `/alertpreset` (no es el nuestro). Devuelve un error
 * discriminado cuando falta el destino o no es valido. Puro y determinista.
 */
export const parseAlertPresetCommand = (
  update: TelegramUpdateEnvelope,
): AlertPresetCommandResult | null => {
  if (update.command?.name !== "alertpreset") {
    return null;
  }

  const raw = update.command?.args?.[0]?.toLowerCase();

  if (raw === undefined || raw.length === 0) {
    return {
      ok: false,
      error: { code: "missing-target", usage: ALERT_PRESET_USAGE },
    };
  }

  const target = ALERT_PRESET_TARGETS.find((candidate) => candidate === raw);

  if (target === undefined) {
    return {
      ok: false,
      error: { code: "invalid-target", usage: ALERT_PRESET_USAGE },
    };
  }

  return { ok: true, command: { target } };
};
