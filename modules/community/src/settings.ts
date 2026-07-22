/**
 * GroupHelp-style settings panel: pure rendering + callback parsing for the
 * private-chat group configuration UI. All state (welcome, antiflood, captcha,
 * locks, antiraid) is passed in; this module never touches repositories, so it
 * stays fully deterministic and testable. The service fetches the state, calls
 * the matching render function and persists any change the parsed action asks
 * for.
 */

export type SettingsPanel = {
  readonly text: string;
  readonly replyMarkup: Record<string, unknown>;
};

type Row = Array<Record<string, unknown>>;

const keyboard = (rows: Row[]): Record<string, unknown> => ({
  inline_keyboard: rows,
});

const btn = (text: string, action: string, groupId: bigint) => ({
  text,
  callback_data: `cfg:${groupId.toString()}:${action}`,
});

const onOff = (value: boolean): string =>
  value ? "✅ Activado" : "❌ Desactivado";

/**
 * Parses the `/start cfg_<groupId>` deep-link payload used to open the panel in
 * private. Returns the (possibly negative) group id, or null if it is not a
 * settings deep link.
 */
export const parseSettingsStart = (arg: string | undefined): bigint | null => {
  if (!arg?.startsWith("cfg_")) {
    return null;
  }

  const raw = arg.slice("cfg_".length);

  if (!/^-?\d+$/u.test(raw)) {
    return null;
  }

  try {
    return BigInt(raw);
  } catch {
    return null;
  }
};

export interface SettingsCallback {
  readonly groupId: bigint;
  readonly section: string;
  readonly action: string;
}

/**
 * Parses a settings callback of the form `cfg:<groupId>:<section>:<action>`.
 * Returns null for any non-settings or malformed callback.
 */
export const parseSettingsCallback = (
  callbackData: string | undefined,
): SettingsCallback | null => {
  if (!callbackData?.startsWith("cfg:")) {
    return null;
  }

  const parts = callbackData.split(":");
  const [, rawGroupId, section, action] = parts;

  if (
    !rawGroupId ||
    !section ||
    !action ||
    !/^-?\d+$/u.test(rawGroupId) ||
    parts.length !== 4
  ) {
    return null;
  }

  try {
    return { groupId: BigInt(rawGroupId), section, action };
  } catch {
    return null;
  }
};

/**
 * Builds the deep link that opens this group's settings panel in the bot's
 * private chat.
 */
export const buildSettingsDeepLink = (
  botUsername: string,
  groupId: bigint,
): string => `https://t.me/${botUsername}?start=cfg_${groupId.toString()}`;

/**
 * Builds the Mini App deep link that opens this group's config panel in the
 * Telegram webview. Rendered as a plain `url` button (web_app buttons are
 * rejected in groups). The `startapp` payload matches the shared codec's
 * `cfg_<gid>` format.
 */
export const buildMiniAppLink = (
  botUsername: string,
  appShortName: string,
  groupId: bigint,
): string =>
  `https://t.me/${botUsername}/${appShortName}?startapp=cfg_${groupId.toString()}`;

export const renderSettingsRoot = (
  groupId: bigint,
  groupTitle: string | undefined,
): SettingsPanel => ({
  text: [
    "⚙️ *Ajustes del grupo*",
    groupTitle ? `_${groupTitle}_` : `_ID ${groupId.toString()}_`,
    "",
    "Elige que quieres configurar. Los cambios se guardan al instante.",
  ].join("\n"),
  replyMarkup: keyboard([
    [
      btn("👋 Bienvenida", "welcome:open", groupId),
      btn("📜 Reglas", "rules:open", groupId),
    ],
    [
      btn("🌊 Antiflood", "flood:open", groupId),
      btn("🤖 Captcha", "captcha:open", groupId),
    ],
    [
      btn("🔒 Locks", "locks:open", groupId),
      btn("🛡 Antiraid", "raid:open", groupId),
    ],
    [btn("✖️ Cerrar", "root:close", groupId)],
  ]),
});

export const renderSettingsClosed = (): SettingsPanel => ({
  text: "⚙️ Ajustes cerrados. Usa /settings en el grupo para volver.",
  replyMarkup: keyboard([]),
});

export interface WelcomePanelState {
  readonly welcomeText: string | null;
  readonly rulesText: string | null;
}

export const renderWelcomePanel = (
  groupId: bigint,
  state: WelcomePanelState,
): SettingsPanel => {
  const active = state.welcomeText !== null;

  return {
    text: [
      "👋 *Bienvenida*",
      "",
      `Estado: ${onOff(active)}`,
      "",
      active
        ? `Mensaje actual:\n${state.welcomeText}`
        : "No hay mensaje de bienvenida. Al activar se usa la plantilla por defecto.",
      "",
      "_Pulsa *Cambiar texto* y enviame aqui el nuevo mensaje._",
      "_Variables:_ `{first_name}` `{chat_title}` _· botones:_ `[Texto](buttonurl://url)`",
    ].join("\n"),
    replyMarkup: keyboard([
      [btn(active ? "❌ Desactivar" : "✅ Activar", "welcome:toggle", groupId)],
      [btn("✏️ Cambiar texto", "welcome:settext", groupId)],
      [btn("🔙 Volver", "root:open", groupId)],
    ]),
  };
};

export const renderRulesPanel = (
  groupId: bigint,
  state: WelcomePanelState,
): SettingsPanel => {
  const active = state.rulesText !== null;

  return {
    text: [
      "📜 *Reglas*",
      "",
      active
        ? `Reglas actuales:\n${state.rulesText}`
        : "No hay reglas configuradas.",
      "",
      "_Pulsa *Cambiar texto* y enviame aqui las reglas._",
      "_Los miembros las ven con_ `/rules`_._",
    ].join("\n"),
    replyMarkup: keyboard([
      [btn("✏️ Cambiar texto", "rules:settext", groupId)],
      ...(active ? [[btn("🗑 Borrar reglas", "rules:clear", groupId)]] : []),
      [btn("🔙 Volver", "root:open", groupId)],
    ]),
  };
};

export interface FloodPanelState {
  readonly enabled: boolean;
  readonly messageLimit: number;
  readonly windowSeconds: number;
  readonly action: string;
}

export const FLOOD_ACTIONS = ["warn", "mute", "ban", "delete"] as const;
export const FLOOD_LIMIT_MIN = 3;
export const FLOOD_LIMIT_MAX = 20;

const floodActionLabel: Record<string, string> = {
  warn: "avisar",
  mute: "silenciar",
  ban: "banear",
  delete: "borrar",
  ignore: "ignorar",
};

/** Next action in the cycle; wraps around. */
export const nextFloodAction = (current: string): string => {
  const index = FLOOD_ACTIONS.indexOf(
    current as (typeof FLOOD_ACTIONS)[number],
  );
  return FLOOD_ACTIONS[(index + 1) % FLOOD_ACTIONS.length] ?? "mute";
};

/** Clamp a flood limit into the allowed range. */
export const clampFloodLimit = (value: number): number =>
  Math.max(FLOOD_LIMIT_MIN, Math.min(FLOOD_LIMIT_MAX, value));

export const renderFloodPanel = (
  groupId: bigint,
  state: FloodPanelState,
): SettingsPanel => ({
  text: [
    "🌊 *Antiflood*",
    "",
    `Estado: ${onOff(state.enabled)}`,
    `Limite: *${state.messageLimit}* mensajes en ${state.windowSeconds}s`,
    `Al superarlo: *${floodActionLabel[state.action] ?? state.action}*`,
  ].join("\n"),
  replyMarkup: keyboard([
    [
      btn(
        state.enabled ? "❌ Desactivar" : "✅ Activar",
        "flood:toggle",
        groupId,
      ),
    ],
    [
      btn("➖ Limite", "flood:limitdown", groupId),
      btn(`${state.messageLimit}`, "flood:noop", groupId),
      btn("➕ Limite", "flood:limitup", groupId),
    ],
    [
      btn(
        `Accion: ${floodActionLabel[state.action] ?? state.action} ⏭`,
        "flood:action",
        groupId,
      ),
    ],
    [btn("🔙 Volver", "root:open", groupId)],
  ]),
});

export interface CaptchaPanelState {
  readonly enabled: boolean;
  readonly mode: string;
  readonly failAction: string;
}

export const CAPTCHA_MODES = ["button", "math", "text"] as const;
export const CAPTCHA_FAIL_ACTIONS = ["mute", "ban", "restrict"] as const;

const captchaModeLabel: Record<string, string> = {
  button: "boton",
  math: "matematico",
  text: "texto",
};
const captchaFailLabel: Record<string, string> = {
  mute: "silenciar",
  ban: "banear",
  restrict: "restringir",
};

export const nextCaptchaMode = (current: string): string => {
  const index = CAPTCHA_MODES.indexOf(
    current as (typeof CAPTCHA_MODES)[number],
  );
  return CAPTCHA_MODES[(index + 1) % CAPTCHA_MODES.length] ?? "button";
};

export const nextCaptchaFailAction = (current: string): string => {
  const index = CAPTCHA_FAIL_ACTIONS.indexOf(
    current as (typeof CAPTCHA_FAIL_ACTIONS)[number],
  );
  return (
    CAPTCHA_FAIL_ACTIONS[(index + 1) % CAPTCHA_FAIL_ACTIONS.length] ?? "mute"
  );
};

export const renderCaptchaPanel = (
  groupId: bigint,
  state: CaptchaPanelState,
): SettingsPanel => ({
  text: [
    "🤖 *Captcha de entrada*",
    "",
    `Estado: ${onOff(state.enabled)}`,
    `Modo: *${captchaModeLabel[state.mode] ?? state.mode}*`,
    `Si no lo resuelve: *${captchaFailLabel[state.failAction] ?? state.failAction}*`,
  ].join("\n"),
  replyMarkup: keyboard([
    [
      btn(
        state.enabled ? "❌ Desactivar" : "✅ Activar",
        "captcha:toggle",
        groupId,
      ),
    ],
    [
      btn(
        `Modo: ${captchaModeLabel[state.mode] ?? state.mode} ⏭`,
        "captcha:mode",
        groupId,
      ),
    ],
    [
      btn(
        `Si falla: ${captchaFailLabel[state.failAction] ?? state.failAction} ⏭`,
        "captcha:failaction",
        groupId,
      ),
    ],
    [btn("🔙 Volver", "root:open", groupId)],
  ]),
});

export interface RaidPanelState {
  readonly enabled: boolean;
  readonly mode: string;
  readonly joinLimit: number;
  readonly windowSeconds: number;
}

export const nextRaidMode = (current: string): string =>
  current === "observe" ? "enforce" : "observe";

const raidModeLabel: Record<string, string> = {
  observe: "observar",
  enforce: "aplicar",
};

export const renderRaidPanel = (
  groupId: bigint,
  state: RaidPanelState,
): SettingsPanel => ({
  text: [
    "🛡 *Antiraid*",
    "",
    `Estado: ${onOff(state.enabled)}`,
    `Modo: *${raidModeLabel[state.mode] ?? state.mode}*`,
    `Umbral: *${state.joinLimit}* entradas en ${state.windowSeconds}s`,
  ].join("\n"),
  replyMarkup: keyboard([
    [
      btn(
        state.enabled ? "❌ Desactivar" : "✅ Activar",
        "raid:toggle",
        groupId,
      ),
    ],
    [
      btn(
        `Modo: ${raidModeLabel[state.mode] ?? state.mode} ⏭`,
        "raid:mode",
        groupId,
      ),
    ],
    [btn("🔙 Volver", "root:open", groupId)],
  ]),
});

export const LOCK_TYPES = [
  "text",
  "url",
  "mention",
  "forward",
  "via_bot",
  "photo",
  "video",
  "gif",
  "sticker",
  "audio",
  "voice",
  "document",
  "contact",
  "location",
  "poll",
] as const;

export const renderLocksPanel = (
  groupId: bigint,
  locked: readonly string[],
): SettingsPanel => {
  const lockedSet = new Set(locked);
  const rows: Row[] = [];

  for (let i = 0; i < LOCK_TYPES.length; i += 3) {
    rows.push(
      LOCK_TYPES.slice(i, i + 3).map((type) =>
        btn(
          `${lockedSet.has(type) ? "🔒" : "🔓"} ${type}`,
          `lock:${type}`,
          groupId,
        ),
      ),
    );
  }

  rows.push([btn("🔙 Volver", "root:open", groupId)]);

  return {
    text: [
      "🔒 *Locks de contenido*",
      "",
      "Pulsa para bloquear (🔒) o permitir (🔓) cada tipo de contenido.",
      "Los mensajes con contenido bloqueado se borran automaticamente.",
      "",
      lockedSet.size > 0
        ? `Bloqueados: ${[...lockedSet].join(", ")}`
        : "Nada bloqueado ahora mismo.",
    ].join("\n"),
    replyMarkup: keyboard(rows),
  };
};

export const isLockTypeValue = (value: string): boolean =>
  (LOCK_TYPES as readonly string[]).includes(value);
