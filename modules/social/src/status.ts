/**
 * `/status social` — a real diagnostic, not a greeting.
 *
 * The report is blunt about this (§10.2, §5.11): if the automatic pole is not
 * firing, the admin must be able to read WHY off this screen. So every line is
 * either a fact read from the live chat or an explicit "no lo sé", and the
 * permission block distinguishes three states, not two:
 *
 *   ✅ confirmed present   ⚠️ confirmed missing   ❔ could not be checked
 *
 * Collapsing "I asked Telegram and it said no" into the same symbol as "the API
 * call failed" is how a bot ends up telling an admin to fix a permission that
 * was never the problem.
 *
 * Pure: the caller does the asking, this composes the answer.
 */

import type { SocialSettings } from "./settings.js";

/** Tri-state, because "unknown" is a real and common answer. */
export type Check = "yes" | "no" | "unknown";

export interface SocialStatusInputs {
  readonly settings: SocialSettings;
  /** Is the bot an administrator here? */
  readonly botIsAdmin: Check;
  /** Can the bot restrict members (needed for TEMPORARY_MUTE)? */
  readonly canRestrict: Check;
  /** Can the bot delete messages? Not needed by social, shown for context. */
  readonly canDelete: Check;
  /**
   * Does the bot actually receive ordinary group messages?
   *
   * This is the one that decides whether AUTO_FIRST_MESSAGE can work at all.
   * It cannot be asked directly — Telegram has no "is privacy mode off" call —
   * so the caller infers it from whether non-command messages have been seen
   * recently in this chat.
   */
  readonly seesPlainMessages: Check;
  /** Is this a forum (topics) group? */
  readonly isForum: boolean;
  /** Size of the servable media library, per kind. */
  readonly catCount: number;
  readonly dogCount: number;
  /** Round-trip to Telegram in ms, when the caller measured one. */
  readonly telegramLatencyMs: number | null;
}

const MARK: Record<Check, string> = { yes: "✅", no: "⚠️", unknown: "❔" };

const onOff = (enabled: boolean): string => (enabled ? "activa" : "apagada");

const resetLabel = (minutes: number): string => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

/**
 * The verdict on automatic pole, which is the question this screen exists for.
 *
 * Only reported when the group actually asked for automatic mode; telling a
 * group that command mode "works" is noise.
 */
export const autoPoleDiagnosis = (
  inputs: Pick<
    SocialStatusInputs,
    "settings" | "botIsAdmin" | "seesPlainMessages"
  >,
): { readonly mark: Check; readonly line: string } | null => {
  if (!inputs.settings.pole.enabled) {
    return null;
  }
  if (inputs.settings.pole.mode !== "AUTO_FIRST_MESSAGE") {
    return null;
  }
  if (inputs.seesPlainMessages === "yes") {
    return {
      mark: "yes",
      line: "Pole automática: recibo los mensajes del grupo.",
    };
  }
  if (inputs.seesPlainMessages === "no") {
    return {
      mark: "no",
      line:
        inputs.botIsAdmin === "yes"
          ? "Pole automática: NO me llegan los mensajes normales. Desactiva el modo privacidad en BotFather o cambia la pole a modo por comando."
          : "Pole automática: NO me llegan los mensajes normales. Hazme administrador o desactiva el modo privacidad; si no, usa la pole por comando.",
    };
  }
  return {
    mark: "unknown",
    line: "Pole automática: aún no he visto suficientes mensajes para saber si me llegan. Si en un rato no funciona, usa el modo por comando.",
  };
};

/**
 * Renders the whole screen.
 *
 * Plain text with no parse mode, like every other social reply: it contains a
 * timezone string and a group title, and neither is worth a formatting bug.
 */
export const renderSocialStatus = (inputs: SocialStatusInputs): string => {
  const { settings } = inputs;
  const lines: string[] = ["Modryva Social — Estado", ""];

  lines.push(
    `Pole: ${onOff(settings.pole.enabled)}${
      settings.pole.enabled
        ? `, ${settings.pole.mode === "AUTO_FIRST_MESSAGE" ? "automática" : "por comando"}`
        : ""
    }`,
  );
  if (settings.pole.enabled) {
    lines.push(`Zona horaria: ${settings.pole.timezone}`);
    lines.push(`Reinicio: ${resetLabel(settings.pole.resetMinutes)}`);
    lines.push(
      `Puestos: ${settings.pole.positions}`,
      `Alcance: ${
        settings.pole.threadScope === "per-topic"
          ? "un ranking por tema"
          : "todo el grupo"
      }${inputs.isForum ? "" : " (este grupo no usa temas)"}`,
    );
  }

  lines.push(
    `Ruleta: ${onOff(settings.roulette.enabled)}${
      settings.roulette.enabled
        ? `, ${settings.roulette.numerator}/${settings.roulette.denominator}, ${
            settings.roulette.consequence === "TEMPORARY_MUTE"
              ? "silencio temporal"
              : "solo diversión"
          }`
        : ""
    }`,
  );
  lines.push(
    `Paulo: ${onOff(settings.fun.pauloEnabled)} · Gatos: ${onOff(
      settings.fun.catsEnabled,
    )} (${inputs.catCount}) · Perros: ${onOff(settings.fun.dogsEnabled)} (${inputs.dogCount})`,
  );

  lines.push("", "Permisos:");
  lines.push(`${MARK[inputs.botIsAdmin]} Administrador del grupo`);
  lines.push(`${MARK[inputs.canDelete]} Borrar mensajes`);
  lines.push(
    `${MARK[inputs.canRestrict]} Restringir miembros${
      settings.roulette.consequence === "TEMPORARY_MUTE" &&
      inputs.canRestrict !== "yes"
        ? " — la ruleta está en modo silencio y no podré aplicarlo"
        : ""
    }`,
  );

  const auto = autoPoleDiagnosis(inputs);
  if (auto) {
    lines.push(`${MARK[auto.mark]} ${auto.line}`);
  }

  if (inputs.telegramLatencyMs !== null) {
    lines.push("", `Latencia con Telegram: ${inputs.telegramLatencyMs} ms`);
  }

  // Never a token, a version, a chat id or an internal path: this screen is
  // readable by any admin of any group (report §10.2, §16.1).
  return lines.join("\n");
};
