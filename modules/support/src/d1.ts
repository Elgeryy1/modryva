import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";

export type D1LogCommand =
  | { readonly kind: "status" }
  | { readonly kind: "set"; readonly logTelegramChatId: bigint | "here" }
  | { readonly kind: "off" }
  | { readonly kind: "events" };

export type QuarantineCommand =
  | { readonly kind: "status" }
  | { readonly kind: "on" }
  | { readonly kind: "off" }
  | { readonly kind: "list" }
  | { readonly kind: "approve"; readonly itemId: string }
  | {
      readonly kind: "reject";
      readonly itemId: string;
      readonly note: string | undefined;
    };

export type AppealCommand =
  | {
      readonly kind: "create";
      readonly caseRef: string;
      readonly message: string;
    }
  | { readonly kind: "list" }
  | {
      readonly kind: "accept";
      readonly appealId: string;
      readonly note: string | undefined;
    }
  | {
      readonly kind: "deny";
      readonly appealId: string;
      readonly note: string | undefined;
    };

export type AutomationCommand =
  | { readonly kind: "list" }
  | { readonly kind: "remove"; readonly ruleId: string }
  | {
      readonly kind: "add";
      readonly triggerKind: "contains";
      readonly triggerValue: string;
      readonly actionKind: "reply" | "delete" | "quarantine" | "log";
      readonly actionValue: string | undefined;
    };

export type MissionCommand =
  | { readonly kind: "list" }
  | {
      readonly kind: "add";
      readonly goalKind: "messages";
      readonly goalTarget: number;
      readonly title: string;
      readonly rewardBadge: string;
    }
  | { readonly kind: "close"; readonly missionId: string }
  | { readonly kind: "badges" };

export interface CommandError {
  readonly code: string;
  readonly usage: string;
}

export type CommandResult<T> =
  | { readonly ok: true; readonly command: T }
  | { readonly ok: false; readonly error: CommandError };

export interface QuarantineDecision {
  readonly quarantine: boolean;
  readonly reason: string;
}

export interface AutomationRuleView {
  readonly id: string;
  readonly name: string;
  readonly triggerKind: string;
  readonly triggerValue: string;
  readonly actionKind: string;
  readonly actionValue?: string | undefined;
  readonly active: boolean;
}

export interface QuarantineItemView {
  readonly id: string;
  readonly actorTelegramId: bigint;
  readonly username?: string | undefined;
  readonly text?: string | undefined;
  readonly reason: string;
  readonly status: string;
}

export interface AppealView {
  readonly id: string;
  readonly caseRef: string;
  readonly appellantTelegramId: bigint;
  readonly username?: string | undefined;
  readonly message: string;
  readonly status: string;
}

export interface MissionView {
  readonly id: string;
  readonly title: string;
  readonly goalKind: string;
  readonly goalTarget: number;
  readonly rewardBadge: string;
  readonly active: boolean;
}

export interface MissionProgressView {
  readonly title: string;
  readonly goalTarget: number;
  readonly rewardBadge: string;
  readonly progress: number;
  readonly completedAt?: Date | undefined;
}

export interface BadgeView {
  readonly badgeKey: string;
  readonly title: string;
  readonly awardedAt: Date;
}

export interface DoctorInput {
  readonly antifloodEnabled: boolean;
  readonly captchaEnabled: boolean;
  readonly antiraidEnabled: boolean;
  readonly welcomeMute: boolean;
  readonly logEnabled: boolean;
  readonly quarantineEnabled: boolean;
  readonly pendingQuarantine: number;
  readonly openAppeals: number;
  readonly activeAutomations: number;
  readonly activeMissions: number;
}

const asBigInt = (value: string | undefined): bigint | undefined => {
  if (!value || !/^-?\d+$/u.test(value)) {
    return undefined;
  }
  return BigInt(value);
};

const slug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 32) || "mission";

const textArg = (update: TelegramUpdateEnvelope): string =>
  (update.command?.args ?? []).join(" ").trim();

export const parseD1LogCommand = (
  update: TelegramUpdateEnvelope,
): CommandResult<D1LogCommand> | null => {
  if (
    update.command?.name !== "logs" &&
    update.command?.name !== "logchannel"
  ) {
    return null;
  }
  const args = update.command.args;
  const sub = (args[0] ?? "status").toLowerCase();
  if (sub === "status") {
    return { ok: true, command: { kind: "status" } };
  }
  if (sub === "events") {
    return { ok: true, command: { kind: "events" } };
  }
  if (sub === "off" || sub === "disable") {
    return { ok: true, command: { kind: "off" } };
  }
  if (sub === "set") {
    const target = args[1] ?? "here";
    if (target.toLowerCase() === "here") {
      return { ok: true, command: { kind: "set", logTelegramChatId: "here" } };
    }
    const id = asBigInt(target);
    return id
      ? { ok: true, command: { kind: "set", logTelegramChatId: id } }
      : {
          ok: false,
          error: {
            code: "chat-id-required",
            usage: "Uso: /logs set here | /logs set <telegram_chat_id>",
          },
        };
  }
  return {
    ok: false,
    error: { code: "usage", usage: "Uso: /logs [status|set|off|events]" },
  };
};

export const parseQuarantineCommand = (
  update: TelegramUpdateEnvelope,
): CommandResult<QuarantineCommand> | null => {
  const name = update.command?.name;
  if (
    !name ||
    !["quarantine", "modqueue", "qapprove", "qreject"].includes(name)
  ) {
    return null;
  }
  const args = update.command?.args ?? [];
  if (name === "qapprove" || name === "qreject") {
    const itemId = args[0];
    if (!itemId) {
      return {
        ok: false,
        error: { code: "id-required", usage: `Uso: /${name} <id>` },
      };
    }
    return {
      ok: true,
      command:
        name === "qapprove"
          ? { kind: "approve", itemId }
          : {
              kind: "reject",
              itemId,
              note: args.slice(1).join(" ").trim() || undefined,
            },
    };
  }
  const sub = (args[0] ?? "status").toLowerCase();
  if (sub === "on" || sub === "off" || sub === "status" || sub === "list") {
    return { ok: true, command: { kind: sub } as QuarantineCommand };
  }
  return {
    ok: false,
    error: {
      code: "usage",
      usage:
        "Uso: /quarantine [on|off|status|list] | /qapprove <id> | /qreject <id>",
    },
  };
};

export const parseQuarantineCallback = (
  callbackData: string | undefined,
): {
  readonly action: "approve" | "reject";
  readonly itemId: string;
} | null => {
  const match = /^d1:q:(approve|reject):(.+)$/u.exec(callbackData ?? "");
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { action: match[1] as "approve" | "reject", itemId: match[2] };
};

export const parseAppealCommand = (
  update: TelegramUpdateEnvelope,
): CommandResult<AppealCommand> | null => {
  const name = update.command?.name;
  if (
    !name ||
    !["appeal", "appeals", "appeal_accept", "appeal_deny"].includes(name)
  ) {
    return null;
  }
  const args = update.command?.args ?? [];
  if (name === "appeals") {
    return { ok: true, command: { kind: "list" } };
  }
  if (name === "appeal_accept" || name === "appeal_deny") {
    const appealId = args[0];
    if (!appealId) {
      return {
        ok: false,
        error: { code: "id-required", usage: `Uso: /${name} <id> [nota]` },
      };
    }
    return {
      ok: true,
      command:
        name === "appeal_accept"
          ? {
              kind: "accept",
              appealId,
              note: args.slice(1).join(" ").trim() || undefined,
            }
          : {
              kind: "deny",
              appealId,
              note: args.slice(1).join(" ").trim() || undefined,
            },
    };
  }
  const caseRef = args[0];
  const message = args.slice(1).join(" ").trim();
  if (!caseRef || !message) {
    return {
      ok: false,
      error: { code: "usage", usage: "Uso: /appeal <caso|sancion> <texto>" },
    };
  }
  return { ok: true, command: { kind: "create", caseRef, message } };
};

export const parseAppealCallback = (
  callbackData: string | undefined,
): { readonly action: "accept" | "deny"; readonly appealId: string } | null => {
  const match = /^d1:a:(accept|deny):(.+)$/u.exec(callbackData ?? "");
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { action: match[1] as "accept" | "deny", appealId: match[2] };
};

export const isDoctorCommand = (update: TelegramUpdateEnvelope): boolean =>
  update.command?.name === "diagnose" || update.command?.name === "doctor";

export const parseAutomationCommand = (
  update: TelegramUpdateEnvelope,
): CommandResult<AutomationCommand> | null => {
  if (
    update.command?.name !== "auto" &&
    update.command?.name !== "automation"
  ) {
    return null;
  }
  const args = update.command.args;
  const sub = (args[0] ?? "list").toLowerCase();
  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }
  if (sub === "remove" || sub === "rm") {
    const ruleId = args[1];
    return ruleId
      ? { ok: true, command: { kind: "remove", ruleId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /auto remove <id>" },
        };
  }
  if (sub !== "add") {
    return {
      ok: false,
      error: {
        code: "usage",
        usage:
          "Uso: /auto add contains <texto> -> reply|delete|quarantine|log [texto]",
      },
    };
  }
  const body = textArg(update);
  const match =
    /^add\s+contains\s+(.+?)\s*->\s*(reply|delete|quarantine|log)\s*(.*)$/iu.exec(
      body,
    );
  if (!match?.[1] || !match[2]) {
    return {
      ok: false,
      error: {
        code: "usage",
        usage:
          "Uso: /auto add contains <texto> -> reply|delete|quarantine|log [texto]",
      },
    };
  }
  const normalizedAction = match[2].toLowerCase() as
    | "reply"
    | "delete"
    | "quarantine"
    | "log";
  const actionValue = match[3]?.trim() || undefined;
  if (
    (normalizedAction === "reply" || normalizedAction === "log") &&
    !actionValue
  ) {
    return {
      ok: false,
      error: {
        code: "text-required",
        usage: "Las acciones reply/log necesitan texto despues de la accion.",
      },
    };
  }
  return {
    ok: true,
    command: {
      kind: "add",
      triggerKind: "contains",
      triggerValue: match[1].trim(),
      actionKind: normalizedAction,
      actionValue,
    },
  };
};

export const parseMissionCommand = (
  update: TelegramUpdateEnvelope,
): CommandResult<MissionCommand> | null => {
  const name = update.command?.name;
  if (!name || !["mission", "missions", "mybadges"].includes(name)) {
    return null;
  }
  if (name === "mybadges") {
    return { ok: true, command: { kind: "badges" } };
  }
  const args = update.command?.args ?? [];
  const sub = name === "missions" ? "list" : (args[0] ?? "list").toLowerCase();
  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }
  if (sub === "close") {
    const missionId = args[1];
    return missionId
      ? { ok: true, command: { kind: "close", missionId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /mission close <id>" },
        };
  }
  if (sub !== "add") {
    return {
      ok: false,
      error: {
        code: "usage",
        usage: "Uso: /mission add messages <objetivo> <titulo>",
      },
    };
  }
  const goalKind = (args[1] ?? "").toLowerCase();
  const goalTarget = Number.parseInt(args[2] ?? "", 10);
  const title = args.slice(3).join(" ").trim();
  if (
    goalKind !== "messages" ||
    !Number.isInteger(goalTarget) ||
    goalTarget < 1 ||
    !title
  ) {
    return {
      ok: false,
      error: {
        code: "usage",
        usage: "Uso: /mission add messages <objetivo> <titulo>",
      },
    };
  }
  return {
    ok: true,
    command: {
      kind: "add",
      goalKind: "messages",
      goalTarget: Math.min(goalTarget, 10_000),
      title,
      rewardBadge: slug(title),
    },
  };
};

export const evaluateQuarantineCandidate = (
  content: MessageContentFlags,
  text: string | undefined,
  strictness: string,
): QuarantineDecision | null => {
  const lower = (text ?? "").toLowerCase();
  const suspiciousWords =
    /\b(airdrop|free|gratis|promo|giveaway|wallet|crypto|casino|onlyfans|viagra)\b/u;
  const inviteLink = /(?:t\.me|telegram\.me|joinchat)/u.test(lower);
  const shortener = /\b(bit\.ly|tinyurl|cutt\.ly|rebrand\.ly|shorturl)\b/u.test(
    lower,
  );

  if (
    content.hasUrl &&
    (suspiciousWords.test(lower) || inviteLink || shortener)
  ) {
    return { quarantine: true, reason: "url sospechosa" };
  }
  if (content.isForward && content.hasUrl) {
    return { quarantine: true, reason: "reenviado con enlace" };
  }
  if (strictness === "strict" && content.hasUrl) {
    return { quarantine: true, reason: "enlace en modo estricto" };
  }
  if (
    strictness === "strict" &&
    (content.hasDocument || content.hasAnimation)
  ) {
    return { quarantine: true, reason: "adjunto en modo estricto" };
  }
  return null;
};

export const automationMatches = (
  rule: AutomationRuleView,
  text: string | undefined,
): boolean => {
  if (!rule.active || rule.triggerKind !== "contains" || !text) {
    return false;
  }
  return text.toLowerCase().includes(rule.triggerValue.toLowerCase());
};

export const buildQuarantineKeyboard = (
  itemId: string,
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      { text: "Aprobar", callback_data: `d1:q:approve:${itemId}` },
      { text: "Rechazar", callback_data: `d1:q:reject:${itemId}` },
    ],
  ],
});

export const buildAppealKeyboard = (
  appealId: string,
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      { text: "Aceptar", callback_data: `d1:a:accept:${appealId}` },
      { text: "Denegar", callback_data: `d1:a:deny:${appealId}` },
    ],
  ],
});

export const buildQuarantineLog = (item: QuarantineItemView): string => {
  const name = item.username
    ? `@${item.username}`
    : item.actorTelegramId.toString();
  return [
    `D1 Cuarentena: ${item.reason}`,
    `Item: ${item.id}`,
    `Usuario: ${name} (${item.actorTelegramId.toString()})`,
    item.text ? `Texto: ${item.text.slice(0, 800)}` : "Sin texto capturado.",
  ].join("\n");
};

export const buildAppealLog = (appeal: AppealView): string => {
  const name = appeal.username
    ? `@${appeal.username}`
    : appeal.appellantTelegramId.toString();
  return [
    "D1 Apelacion nueva",
    `ID: ${appeal.id}`,
    `Caso: ${appeal.caseRef}`,
    `Usuario: ${name} (${appeal.appellantTelegramId.toString()})`,
    `Mensaje: ${appeal.message.slice(0, 1200)}`,
  ].join("\n");
};

export const formatEvents = (
  events: readonly { kind: string; title: string }[],
): string =>
  events.length === 0
    ? "No hay eventos D1 recientes."
    : `Eventos D1 recientes:\n${events
        .map((event, index) => `${index + 1}. [${event.kind}] ${event.title}`)
        .join("\n")}`;

export const formatQuarantineList = (
  items: readonly QuarantineItemView[],
): string =>
  items.length === 0
    ? "No hay mensajes pendientes en cuarentena."
    : `Cuarentena pendiente:\n${items
        .map(
          (item) =>
            `${item.id} - ${item.username ? `@${item.username}` : item.actorTelegramId.toString()} - ${item.reason}`,
        )
        .join("\n")}`;

export const formatAppeals = (appeals: readonly AppealView[]): string =>
  appeals.length === 0
    ? "No hay apelaciones abiertas."
    : `Apelaciones abiertas:\n${appeals
        .map(
          (appeal) =>
            `${appeal.id} - caso ${appeal.caseRef} - ${appeal.username ? `@${appeal.username}` : appeal.appellantTelegramId.toString()}`,
        )
        .join("\n")}`;

export const formatAutomationList = (
  rules: readonly AutomationRuleView[],
): string =>
  rules.length === 0
    ? "No hay automatizaciones. Usa /auto add contains <texto> -> reply <respuesta>."
    : `Automatizaciones:\n${rules
        .map(
          (rule) =>
            `${rule.id} - si ${rule.triggerKind} "${rule.triggerValue}" -> ${rule.actionKind}${rule.actionValue ? ` "${rule.actionValue}"` : ""}`,
        )
        .join("\n")}`;

export const formatMissions = (missions: readonly MissionView[]): string =>
  missions.length === 0
    ? "No hay misiones activas."
    : `Misiones:\n${missions
        .map(
          (mission) =>
            `${mission.id} - ${mission.title} (${mission.goalKind} ${mission.goalTarget}) -> badge ${mission.rewardBadge}`,
        )
        .join("\n")}`;

export const formatMissionProgress = (
  progress: readonly MissionProgressView[],
): string =>
  progress.length === 0
    ? "Aun no tienes progreso en misiones."
    : `Tu progreso:\n${progress
        .map((row) => {
          const done = row.completedAt
            ? "completada"
            : `${row.progress}/${row.goalTarget}`;
          return `${row.title}: ${done}`;
        })
        .join("\n")}`;

export const formatBadges = (badges: readonly BadgeView[]): string =>
  badges.length === 0
    ? "Aun no tienes badges."
    : `Tus badges:\n${badges.map((badge) => `${badge.badgeKey} - ${badge.title}`).join("\n")}`;

export const buildMissionCompletedText = (
  title: string,
  rewardBadge: string,
): string => `Mision completada: ${title}\nBadge desbloqueado: ${rewardBadge}`;

export const buildDoctorReport = (input: DoctorInput): string => {
  let score = 100;
  const recommendations: string[] = [];
  if (!input.antifloodEnabled) {
    score -= 15;
    recommendations.push("Activa /antiflood_on para frenar spam rapido.");
  }
  if (!input.captchaEnabled && !input.welcomeMute) {
    score -= 15;
    recommendations.push(
      "Activa captcha o welcome-mute para filtrar entradas.",
    );
  }
  if (!input.antiraidEnabled) {
    score -= 10;
    recommendations.push("Activa /antiraid_on en grupos publicos.");
  }
  if (!input.logEnabled) {
    score -= 10;
    recommendations.push("Configura /logs set here o un canal de logs.");
  }
  if (!input.quarantineEnabled) {
    score -= 10;
    recommendations.push(
      "Activa /quarantine on para revisar mensajes dudosos.",
    );
  }
  if (input.pendingQuarantine > 5) {
    score -= 10;
    recommendations.push(
      "Hay mucha cuarentena pendiente; revisa /quarantine list.",
    );
  }
  if (input.openAppeals > 0) {
    recommendations.push(`Hay ${input.openAppeals} apelaciones abiertas.`);
  }
  if (input.activeAutomations === 0) {
    recommendations.push("Crea una automatizacion simple con /auto add.");
  }
  if (input.activeMissions === 0) {
    recommendations.push(
      "Crea una mision de comunidad con /mission add messages 10 ...",
    );
  }

  return [
    `D1 Doctor del grupo: ${Math.max(0, score)}/100`,
    "",
    `Antiflood: ${input.antifloodEnabled ? "ON" : "OFF"}`,
    `Captcha/welcome-mute: ${input.captchaEnabled || input.welcomeMute ? "ON" : "OFF"}`,
    `Antiraid: ${input.antiraidEnabled ? "ON" : "OFF"}`,
    `Logs: ${input.logEnabled ? "ON" : "OFF"}`,
    `Cuarentena: ${input.quarantineEnabled ? "ON" : "OFF"} (${input.pendingQuarantine} pendientes)`,
    `Apelaciones abiertas: ${input.openAppeals}`,
    `Automatizaciones activas: ${input.activeAutomations}`,
    `Misiones activas: ${input.activeMissions}`,
    "",
    recommendations.length > 0
      ? `Recomendaciones:\n${recommendations.map((item) => `- ${item}`).join("\n")}`
      : "Todo lo esencial esta cubierto.",
  ].join("\n");
};
