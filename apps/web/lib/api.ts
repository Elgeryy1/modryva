import type {
  AppointedAdminPanel,
  DashboardData,
  GuardianConfigInput,
  GuardianConfigIssue,
  GuardianDiagnosticsResult,
  GuardianRosterResult,
  GuardianSessionSummary,
} from "@superbot/shared";
import { getActAsBotUsername, getBotUsername, getInitData } from "./telegram";

// Always same-origin: the Next.js /api proxy forwards to the api container. The
// signed initData travels as `Authorization: tma <initData>`. Never uses an
// absolute api URL / NEXT_PUBLIC_API_URL.
const API_BASE = "/api";

/**
 * Every request gets a deadline.
 *
 * A bare `fetch` that never answers leaves a promise that neither resolves nor
 * rejects, so a screen sitting on "loading" stays there forever — no error, no
 * retry, nothing on screen to act on. That is not hypothetical: it is what the
 * Guardian verification screen did, and a stalled request is indistinguishable
 * from a person who lost interest because the app never gets to report it.
 *
 * 20s is well past a slow mobile network and well short of a person's patience.
 */
const REQUEST_TIMEOUT_MS = 20_000;

export const TIMEOUT_ERROR = "request-timeout";

const fetchWithDeadline = async (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  try {
    return await fetch(url, {
      ...init,
      // Nada de lo que contesta la API es reutilizable, y una respuesta suya
      // guardada por el navegador no es un ahorro: es una respuesta vieja
      // haciéndose pasar por la de ahora. `no-store` salta la caché HTTP en los
      // dos sentidos —ni la lee ni escribe en ella— para esta petición.
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // A timeout and a dead network both surface as an exception with no status.
    // Callers need to tell them apart from an HTTP error, so both become an
    // ApiError with status 0 and a message the UI can explain.
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(TIMEOUT_ERROR, 0);
    }
    throw new ApiError("network-unreachable", 0);
  }
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Per-field validation issues, when the API returned them (e.g. Guardian
     * config's "invalid-settings"). Undefined for every other error shape —
     * callers that don't check for it see no behavior change. */
    readonly issues?: GuardianConfigIssue[],
    /** Solo en el 410 de una sesión de Guardian ya cerrada: cuál de las tres
     * formas de estar cerrada es —"aprobada", "en-revision", "rechazada" o
     * "reemplazada"— para que la Mini App pinte el estado real en vez de una
     * pantalla roja. Ver apps/api/src/guardian/session-outcome.ts. */
    readonly desenlace?: string,
  ) {
    super(message);
  }
}

const formatBanDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleString("es-ES") : "permanente";

const apiErrorMessage = (
  status: number,
  body: {
    error?: string;
    reason?: string;
    bannedAt?: string;
    expiresAt?: string | null;
  },
): string => {
  if (status === 401) {
    return "Tu sesion de la Mini App caduco. Cierrala y vuelve a abrirla.";
  }
  if (body.error === "platform-user-banned") {
    return [
      "Estas baneado de Modryva.",
      `Motivo: ${body.reason ?? "Sin motivo especificado"}.`,
      `Baneado el: ${formatBanDate(body.bannedAt)}.`,
      `Hasta: ${formatBanDate(body.expiresAt)}.`,
    ].join(" ");
  }
  return body.error ?? `http-${status}`;
};

// Casino error codes → friendly Spanish. The API throws these as
// `{ error: "<code>" }`; apiErrorMessage passes them through verbatim, so an
// ApiError.message for a casino call is the raw code. Anything unmapped falls
// back to the resolved message (already Spanish for 401/ban) or a generic line.
const CASINO_ERROR_ES: Record<string, string> = {
  insufficient: "No tienes fichas suficientes para esa apuesta.",
  "invalid-stake": "Esa apuesta no es válida.",
  "invalid-params": "Esa jugada no es válida.",
  "bet-closed": "Esa apuesta ya se había cerrado.",
  "no-bet": "No hay ninguna apuesta activa.",
  "wrong-game": "Esa apuesta pertenece a otro juego.",
  "already-revealed": "Esa casilla ya estaba descubierta.",
  "nothing-revealed": "Descubre al menos una casilla antes de retirarte.",
  "invalid-action": "Esa acción no es válida ahora.",
  "unknown-game": "Ese juego no está disponible.",
  "no-tenant": "El casino no está disponible en este chat.",
  "no-initdata": "Abre el casino desde Telegram para jugar.",
  "insufficient-chips": "No tienes fichas suficientes para enviar eso.",
  "invalid-amount": "Pon una cantidad entera y mayor que cero.",
  "invalid-recipient": "No he podido identificar a esa persona.",
  "self-transfer": "No puedes enviarte fichas a ti mismo.",
  "invalid-request-id": "No se pudo completar el envío. Inténtalo de nuevo.",
};

/**
 * Map any thrown casino error to a human Spanish line for the neutral notice.
 * ApiError.message holds the raw code (or a resolved sentence for 401/ban);
 * a non-ApiError (network drop) becomes a generic connection message.
 */
export const casinoErrorLabel = (e: unknown): string => {
  if (e instanceof ApiError) {
    return CASINO_ERROR_ES[e.message] ?? e.message;
  }
  return "No se pudo conectar. Inténtalo de nuevo.";
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const initData = getInitData();
  if (!initData) {
    throw new ApiError("no-initdata", 0);
  }
  const headers = new Headers(init.headers);
  headers.set("authorization", `tma ${initData}`);
  const actAsBotUsername = getActAsBotUsername();
  if (actAsBotUsername) {
    headers.set("x-platform-act-as-bot-username", actAsBotUsername);
  } else {
    const botUsername = getBotUsername();
    if (botUsername) {
      // Tells the API which managed bot's Mini App this is; it verifies the
      // initData against that bot's token. Absent → the primary bot.
      headers.set("x-bot-username", botUsername);
    }
  }
  if (init.body) {
    headers.set("content-type", "application/json");
  }

  const response = await fetchWithDeadline(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let error = `http-${response.status}`;
    let issues: GuardianConfigIssue[] | undefined;
    try {
      const body = (await response.json()) as {
        error?: string;
        reason?: string;
        bannedAt?: string;
        expiresAt?: string | null;
        issues?: GuardianConfigIssue[];
      };
      error = apiErrorMessage(response.status, body);
      issues = body.issues;
    } catch {
      // keep the generic error
    }
    throw new ApiError(error, response.status, issues);
  }
  return (await response.json()) as T;
}

export interface SessionBot {
  username: string | null;
  name: string | null;
  // Onboarding identity: template is null for the primary bot, else the child
  // bot's ManagedBotTemplate (community/creator/support/business/custom).
  template?: string | null;
  isPrimary?: boolean;
}

export const postSession = (startParam?: string | null) =>
  apiFetch<{
    ok: boolean;
    // botIsAdmin: whether the serving bot is an admin in this group (advisory —
    // onboarding disables moderation purposes when it is only a member).
    group: {
      telegramChatId: string;
      title?: string;
      botIsAdmin?: boolean;
    } | null;
    bot?: SessionBot;
    /**
     * Qué funciones existen en este despliegue.
     *
     * Ausente o false = apagada. El panel oculta las secciones que el bot
     * ignoraría: configurar algo que no va a pasar es peor que no verlo.
     */
    features?: Partial<Record<"social", boolean>>;
  }>("/v1/miniapp/session", {
    method: "POST",
    // Child-bot Mini Apps carry the group in the URL (?sp=), not in signed
    // initData; forward it so the session can resolve + title the group. The
    // group id only selects which group — assertGroupAdmin still authorizes.
    body: JSON.stringify(startParam ? { startParam } : {}),
  });

export const getDashboard = () =>
  apiFetch<DashboardData>("/v1/dashboard", { method: "POST", body: "{}" });

export const getSection = <T>(gid: string, section: string) =>
  apiFetch<T>(`/v1/miniapp/groups/${gid}/config/${section}`);

export const putSection = <T>(gid: string, section: string, body: unknown) =>
  apiFetch<T>(`/v1/miniapp/groups/${gid}/config/${section}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

// --- Welcome buttons + photo (GroupHelp-style). Declared locally rather than
// imported from @superbot/shared to keep server deps out of the browser bundle
// (same convention as config-meta.ts). ---
export type WelcomeButtonType = "rules" | "url" | "contact_admins" | "miniapp";

export interface WelcomeButton {
  type: WelcomeButtonType;
  text: string;
  url?: string;
}

export interface WelcomeSectionValue {
  welcomeText: string | null;
  goodbyeText: string | null;
  welcomeButtons?: WelcomeButton[];
}

export const getWelcomePhoto = (gid: string) =>
  apiFetch<{ imageBase64: string | null; mimeType: string | null }>(
    `/v1/miniapp/groups/${gid}/config/welcome/photo`,
  );

export const uploadWelcomePhoto = (
  gid: string,
  imageBase64: string,
  mimeType: string,
) =>
  apiFetch<{ ok: boolean }>(`/v1/miniapp/groups/${gid}/config/welcome/photo`, {
    method: "POST",
    body: JSON.stringify({ imageBase64, mimeType }),
  });

export const deleteWelcomePhoto = (gid: string) =>
  apiFetch<{ ok: boolean }>(`/v1/miniapp/groups/${gid}/config/welcome/photo`, {
    method: "DELETE",
  });

// --- Lists: blocklist (palabras prohibidas) + filters (auto-respuestas) ---
export interface BlocklistEntry {
  id: string;
  trigger: string;
  reason: string | null;
}

export const getBlocklist = (gid: string) =>
  apiFetch<{ mode: string; entries: BlocklistEntry[] }>(
    `/v1/miniapp/groups/${gid}/blocklist`,
  );

export const setBlocklistMode = (gid: string, mode: string) =>
  apiFetch<{ mode: string }>(`/v1/miniapp/groups/${gid}/blocklist/mode`, {
    method: "PUT",
    body: JSON.stringify({ mode }),
  });

export const addBlocklistEntry = (
  gid: string,
  trigger: string,
  reason?: string,
) =>
  apiFetch<BlocklistEntry>(`/v1/miniapp/groups/${gid}/blocklist/entries`, {
    method: "POST",
    body: JSON.stringify(reason ? { trigger, reason } : { trigger }),
  });

export const removeBlocklistEntry = (gid: string, id: string) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/blocklist/entries/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

export interface FilterEntry {
  id: string;
  trigger: string;
  response: string;
}

export const getFilters = (gid: string) =>
  apiFetch<{ entries: FilterEntry[] }>(`/v1/miniapp/groups/${gid}/filters`);

export const addFilter = (gid: string, trigger: string, response: string) =>
  apiFetch<FilterEntry>(`/v1/miniapp/groups/${gid}/filters`, {
    method: "POST",
    body: JSON.stringify({ trigger, response }),
  });

export const removeFilter = (gid: string, id: string) =>
  apiFetch<{ ok: boolean }>(
    `/v1/miniapp/groups/${gid}/filters/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

// --- Federation (baneos compartidos entre grupos) ---
export interface FederationChatEntry {
  telegramChatId: string;
  title: string | null;
}
export interface FederationBanEntry {
  telegramUserId: string;
  reason: string | null;
}

export type FederationStatus =
  | { inFederation: false }
  | {
      inFederation: true;
      fedId: string;
      name: string;
      ownerTelegramId: string;
      isOwner: boolean;
      isFedAdmin: boolean;
      chatCount: number;
      banCount: number;
      adminCount: number;
      subscribedFedId: string | null;
      // Present only when isFedAdmin — same gate as /fedexport.
      chats?: FederationChatEntry[];
      bans?: FederationBanEntry[];
      admins?: string[];
    };

export const getFederationStatus = (gid: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation`);

export const createFederation = (gid: string, name: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const joinFederation = (gid: string, fedId: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation/join`, {
    method: "POST",
    body: JSON.stringify({ fedId }),
  });

export const leaveFederation = (gid: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation`, {
    method: "DELETE",
  });

export const removeFedBan = (gid: string, telegramUserId: string) =>
  apiFetch<FederationStatus>(
    `/v1/miniapp/groups/${gid}/federation/bans/${encodeURIComponent(telegramUserId)}`,
    { method: "DELETE" },
  );
export const addFedBan = (gid: string, userId: string, reason?: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation/bans`, {
    method: "POST",
    body: JSON.stringify(reason ? { userId, reason } : { userId }),
  });
export const addFedAdmin = (gid: string, userId: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation/admins`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

export const removeFedAdmin = (gid: string, userId: string) =>
  apiFetch<FederationStatus>(
    `/v1/miniapp/groups/${gid}/federation/admins/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
export const renameFederation = (gid: string, name: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation/rename`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const deleteFederation = (gid: string) =>
  apiFetch<FederationStatus>(`/v1/miniapp/groups/${gid}/federation/all`, {
    method: "DELETE",
  });
export const setFederationSubscription = (gid: string, fedId: string) =>
  apiFetch<FederationStatus>(
    `/v1/miniapp/groups/${gid}/federation/subscription`,
    { method: "POST", body: JSON.stringify({ fedId }) },
  );

export const clearFederationSubscription = (gid: string) =>
  apiFetch<FederationStatus>(
    `/v1/miniapp/groups/${gid}/federation/subscription`,
    { method: "DELETE" },
  );

// --- Owner network (red privada de grupos en /config) ---
export interface OwnerNetworkChatEntry {
  chatId: string;
  telegramChatId: string;
  title: string | null;
  logTelegramChatId: string | null;
  requiredGroupCount: number;
  roles?: OwnerNetworkGroupRole[];
  status?: "aligned" | "misaligned";
  misalignedFields?: string[];
}

export interface OwnerNetworkSnapshotSummary {
  id: string;
  reason: string;
  createdAt: string;
}

export interface OwnerNetworkPolicy {
  logTelegramChatId: string | null;
  welcomeMode: "per_group" | "global";
  welcomeText: string | null;
  goodbyeText: string | null;
  rulesMode: "per_group" | "global";
  rulesText: string | null;
  membershipMode: "off" | "require_all";
}

export type OwnerNetworkGroupRole =
  | "staff"
  | "logs"
  | "support"
  | "announcements"
  | "archive";

export type OwnerNetworkRouteEventKind =
  | "logs"
  | "reports"
  | "quarantine"
  | "appeals"
  | "tickets"
  | "raid_alerts"
  | "spam_alerts"
  | "moderation_actions";

export interface OwnerNetworkGroupRouting {
  chatId: string;
  roles: OwnerNetworkGroupRole[];
  label: string | null;
}

export interface OwnerNetworkRouteEntry {
  id?: string;
  sourceChatId: string | null;
  sourceKey?: string;
  eventKind: OwnerNetworkRouteEventKind;
  targetChatId: string;
  enabled: boolean;
}

export type OwnerNetworkStatus =
  | { inNetwork: false }
  | {
      inNetwork: true;
      networkId: string;
      name: string;
      ownerTelegramId: string;
      isOwner: boolean;
      isNetworkAdmin: boolean;
      chatCount: number;
      adminCount: number;
      chats?: OwnerNetworkChatEntry[];
      roles?: OwnerNetworkGroupRouting[];
      routes?: OwnerNetworkRouteEntry[];
      lastSnapshot?: OwnerNetworkSnapshotSummary;
      policy: OwnerNetworkPolicy;
    };

export const getOwnerNetworkStatus = (gid: string) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network`);

export const createOwnerNetwork = (gid: string, name: string) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const joinOwnerNetwork = (gid: string, networkId: string) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network/join`, {
    method: "POST",
    body: JSON.stringify({ networkId }),
  });

export const leaveOwnerNetwork = (gid: string) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network`, {
    method: "DELETE",
  });

export const renameOwnerNetwork = (gid: string, name: string) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network/rename`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const updateOwnerNetworkSettings = (
  gid: string,
  policy: OwnerNetworkPolicy,
) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network/settings`, {
    method: "PUT",
    body: JSON.stringify(policy),
  });

export const updateOwnerNetworkRouting = (
  gid: string,
  body: {
    roles: OwnerNetworkGroupRouting[];
    routes: OwnerNetworkRouteEntry[];
  },
) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network/routing`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const rollbackOwnerNetwork = (gid: string) =>
  apiFetch<OwnerNetworkStatus>(`/v1/miniapp/groups/${gid}/network/rollback`, {
    method: "POST",
  });

// --- Games ---
export interface LeaderboardRow {
  telegramUserId: string;
  points: number;
  name?: string | null;
}

export const startGame = (game: string) =>
  apiFetch<{ sessionId: string; game: string; scope: string }>(
    "/v1/games/start",
    { method: "POST", body: JSON.stringify({ game }) },
  );

export const submitScore = (sessionId: string, score: number) =>
  apiFetch<{ points: number }>("/v1/games/submit", {
    method: "POST",
    body: JSON.stringify({ sessionId, score }),
  });

export const gamesLeaderboard = () =>
  apiFetch<{ scope: string; rows: LeaderboardRow[] }>("/v1/games/leaderboard", {
    method: "POST",
  });

export interface PlayerHomeTop {
  telegramUserId: string;
  name: string | null;
  points: number;
  you: boolean;
}

export interface PlayerHome {
  name: string | null;
  points: number;
  level: number;
  levelFloor: number;
  levelCeil: number;
  streakDays: number;
  rank: number | null;
  dailyPending: boolean;
  top: PlayerHomeTop[];
}

export const playerProfile = () =>
  apiFetch<PlayerHome>("/v1/games/profile", { method: "POST" });

export interface DailyTrivia {
  scope: string;
  dayKey: number;
  question: { question: string; options: string[] };
  answered: boolean;
  correctIndex: number | null;
  yourAnswerCorrect: boolean;
  participants: number;
  correctCount: number;
  board: LeaderboardRow[];
}

export const dailyTrivia = () =>
  apiFetch<DailyTrivia>("/v1/games/daily", { method: "POST" });

export const answerDailyTrivia = (optionIndex: number) =>
  apiFetch<{
    alreadyAnswered: boolean;
    correct: boolean;
    correctIndex: number;
    points: number;
  }>("/v1/games/daily/answer", {
    method: "POST",
    body: JSON.stringify({ optionIndex }),
  });

export interface CoopBossContributor {
  telegramUserId: string;
  name: string | null;
  damage: number;
}

export interface CoopBoss {
  scope: string;
  level: number;
  name: string;
  emoji: string;
  goal: number;
  done: number;
  percent: number;
  remaining: number;
  youAttackedToday: boolean;
  yourDamage: number;
  contributors: CoopBossContributor[];
}

export interface CoopBossAttack extends CoopBoss {
  alreadyAttacked: boolean;
  dealt: number;
  justDefeated: boolean;
  defeatedName: string | null;
  reward: number;
  rewardMessage: string | null;
}

export const coopBoss = () =>
  apiFetch<CoopBoss>("/v1/games/boss", { method: "POST" });

export const attackBoss = () =>
  apiFetch<CoopBossAttack>("/v1/games/boss/attack", { method: "POST" });

export interface QuizBatchQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

// Unlimited solo trivia: each round returns a fresh batch from the 5000+ bank.
export const quizBatch = (round: number) =>
  apiFetch<{ round: number; questions: QuizBatchQuestion[] }>(
    "/v1/games/quiz",
    {
      method: "POST",
      body: JSON.stringify({ round }),
    },
  );

// --- Games config (per-group onboarding: purpose, which games, cadence) ---
export type BotPurpose = "moderate" | "play" | "both";
export type TriviaCadence = "daily" | "hourly";

export interface GameToggles {
  tictactoe: boolean;
  rps: boolean;
  quiz: boolean;
  dailytrivia: boolean;
  boss: boolean;
}

export interface GamesConfig {
  purpose: BotPurpose;
  games: GameToggles;
  triviaCadence: TriviaCadence;
  announce: boolean;
  configured: boolean;
}

export const getGamesConfig = (gid: string) =>
  apiFetch<GamesConfig>(`/v1/miniapp/groups/${gid}/games-config`);

export const putGamesConfig = (gid: string, config: GamesConfig) =>
  apiFetch<GamesConfig>(`/v1/miniapp/groups/${gid}/games-config`, {
    method: "PUT",
    body: JSON.stringify(config),
  });

// --- Ventanas estrictas por horario (schedule_rules) ---
export interface ScheduleRule {
  startHour: number;
  endHour: number;
  strict: boolean;
}
export const getScheduleRules = (gid: string) =>
  apiFetch<{ rules: ScheduleRule[] }>(
    `/v1/miniapp/groups/${gid}/schedule-rules`,
  );
export const putScheduleRules = (gid: string, rules: ScheduleRule[]) =>
  apiFetch<{ rules: ScheduleRule[] }>(
    `/v1/miniapp/groups/${gid}/schedule-rules`,
    { method: "PUT", body: JSON.stringify({ rules }) },
  );

// --- Rituales semanales (rituals) ---
export interface Ritual {
  weekday: number;
  hour: number;
  message: string;
}
export const getRituals = (gid: string) =>
  apiFetch<{ rituals: Ritual[] }>(`/v1/miniapp/groups/${gid}/rituals`);
export const putRituals = (gid: string, rituals: Ritual[]) =>
  apiFetch<{ rituals: Ritual[] }>(`/v1/miniapp/groups/${gid}/rituals`, {
    method: "PUT",
    body: JSON.stringify({ rituals }),
  });

// --- Modo silencio (el bot no anuncia subidas de nivel, etc.) ---
export const getQuiet = (gid: string) =>
  apiFetch<{ enabled: boolean }>(`/v1/miniapp/groups/${gid}/quiet`);
export const putQuiet = (gid: string, enabled: boolean) =>
  apiFetch<{ enabled: boolean }>(`/v1/miniapp/groups/${gid}/quiet`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });

// --- Social core (pole, ruleta, Paulo, gatos y perros) ---
// Shapes declared here rather than imported from @superbot/module-social: that
// package is server code and must not reach the browser bundle. The API
// validates against @superbot/shared and normalises with the module's own
// helper, so a drift in these labels can never produce stored data the bot
// would not honour.
export interface SocialSettings {
  pole: {
    enabled: boolean;
    mode: "COMMAND_CLAIM" | "AUTO_FIRST_MESSAGE";
    timezone: string;
    resetMinutes: number;
    positions: number;
    threadScope: "shared" | "per-topic";
    allowMedia: boolean;
    summaryEnabled: boolean;
  };
  roulette: {
    enabled: boolean;
    consequence: "FUN_ONLY" | "TEMPORARY_MUTE";
    numerator: number;
    denominator: number;
    muteSeconds: number;
    userCooldownSeconds: number;
    chatCooldownSeconds: number;
  };
  fun: { pauloEnabled: boolean; catsEnabled: boolean; dogsEnabled: boolean };
  supportUrl: string;
}

export interface SocialRankingRow {
  userId: string;
  userName: string | null;
  firsts: number;
  seconds: number;
  thirds: number;
  total: number;
}

export const getSocial = (gid: string) =>
  apiFetch<{
    settings: SocialSettings;
    ranking: SocialRankingRow[];
    totalClaims: number;
  }>(`/v1/miniapp/groups/${gid}/social`);

export const putSocial = (gid: string, settings: SocialSettings) =>
  apiFetch<SocialSettings>(`/v1/miniapp/groups/${gid}/social`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });

// --- Moderación de reacciones nativas (reaction_moderation) ---
// Mirrors ReactionModerationConfig in @superbot/module-security. Declared here
// (not imported) to keep server code out of the browser bundle; the API
// sanitizes anyway, so a drift only affects labels, never stored data.
export interface ReactionModerationConfig {
  mode: "off" | "shadow" | "enforce";
  blockedEmojis: string[];
  blockedCustomEmojiIds: string[];
  surgeThreshold: number;
  surgeWindowSeconds: number;
}
export const getReactions = (gid: string) =>
  apiFetch<{ config: ReactionModerationConfig }>(
    `/v1/miniapp/groups/${gid}/reactions`,
  );
export const putReactions = (gid: string, config: ReactionModerationConfig) =>
  apiFetch<{ config: ReactionModerationConfig }>(
    `/v1/miniapp/groups/${gid}/reactions`,
    { method: "PUT", body: JSON.stringify(config) },
  );

// --- Recap semanal (resumen automático de la semana del grupo) ---
export const getWeeklyRecap = (gid: string) =>
  apiFetch<{ enabled: boolean }>(`/v1/miniapp/groups/${gid}/weekly-recap`);
export const putWeeklyRecap = (gid: string, enabled: boolean) =>
  apiFetch<{ enabled: boolean }>(`/v1/miniapp/groups/${gid}/weekly-recap`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });

// --- Platform / promos ---
export interface PlatformPromo {
  id: string;
  codePrefix: string;
  template: string;
  maxUses: number;
  usedCount: number;
  revokedAt: string | null;
  note: string | null;
}

export interface PlatformManagedBot {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  status: string;
  telegramBotId: string | null;
  ownerTelegramId: string | null;
  template: string;
  entitlementId: string | null;
  lastError?: string | null;
}

export interface PlatformPrimaryBot {
  username: string;
  displayName: string;
  status: string;
}

export interface PlatformBotChat {
  chatId: string;
  telegramChatId: string;
  type: string;
  title: string | null;
  username: string | null;
  memberCount: number;
  updatedAt: string;
}

export interface PlatformBotDetails {
  bot: PlatformManagedBot;
  chats: PlatformBotChat[];
}

export interface PlatformMe {
  userId: string;
  isOwner: boolean;
  roles: string[];
  managedBotSlots: number;
  botScope?: "all" | "owned";
  primaryBot?: PlatformPrimaryBot | null;
  bots?: PlatformManagedBot[];
}

export const platformMe = () => apiFetch<PlatformMe>("/v1/platform/me");

export const reactivateBot = (username: string) =>
  apiFetch<{ ok: boolean; reason?: string }>("/v1/platform/mybots/reactivate", {
    method: "POST",
    body: JSON.stringify({ username }),
  });

export const platformBotDetails = (username: string) =>
  apiFetch<PlatformBotDetails>(
    `/v1/platform/bots/${encodeURIComponent(username)}`,
  );

export const sendPlatformBotMessage = (
  username: string,
  body: { chatId: string; text: string; parseMode?: string },
) =>
  apiFetch<{ ok: boolean }>(
    `/v1/platform/bots/${encodeURIComponent(username)}/send-message`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

export const platformPromos = () =>
  apiFetch<{ promos: PlatformPromo[] }>("/v1/platform/promos");

export const createPlatformPromo = (body: {
  template: string;
  maxUses: number;
  expiresInDays?: number;
  note?: string;
}) =>
  apiFetch<{
    promo: PlatformPromo & { code: string };
  }>("/v1/platform/promos", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const grantCustomBot = (body: {
  telegramUserId: string;
  template: string;
  expiresInDays?: number;
}) =>
  apiFetch<{ entitlement: { id: string } }>("/v1/platform/grants/custombot", {
    method: "POST",
    body: JSON.stringify(body),
  });

// --- Platform / AI access codes ---
export interface PlatformAiCode {
  codePrefix: string;
  days: number;
  note: string | null;
  createdByTelegramId: string;
  redeemedByChatId: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

export const platformAiCodes = () =>
  apiFetch<{ codes: PlatformAiCode[] }>("/v1/platform/ai-codes");

export const createPlatformAiCode = (body: { days: number; note?: string }) =>
  apiFetch<{ code: string; days: number }>("/v1/platform/ai-codes", {
    method: "POST",
    body: JSON.stringify(body),
  });

// --- Casino (Mini App tables) ---
export interface CasinoBalance {
  balance: number;
  commit: string;
  clientSeed: string;
  nonce: number;
}

export const casinoBalance = () =>
  apiFetch<CasinoBalance>("/v1/casino/balance", { method: "POST" });

export const casinoBet = (
  game: string,
  stake: number,
  params: Record<string, unknown>,
) =>
  apiFetch<{
    ok: boolean;
    payout: number;
    multiplier: number;
    balance: number;
    detail: unknown;
    proof: { commit: string; clientSeed: string; nonce: number };
    // Social layer: the shared jackpot skims ~1% of every bet and, on a rare
    // provably-fair roll, pays the whole pot out. When that happens the bet
    // response carries the win amount + the (now-reset) pot so the UI can
    // celebrate a jackpot on top of the normal outcome.
    jackpotWon?: number;
    jackpot?: number;
  }>("/v1/casino/bet", {
    method: "POST",
    body: JSON.stringify({ game, stake, params }),
  });

// --- Casino social layer: jackpot, leaderboard, weekly tournament ---

/** The current progressive jackpot pot for this tenant. */
export const getJackpot = () =>
  apiFetch<{ amount: number }>("/v1/casino/jackpot", { method: "GET" });

export type LeaderboardRange = "week" | "all";

export interface CasinoStanding {
  telegramUserId: string;
  name?: string | null;
  net: number;
}

/** Top players by net chips, over this week or all-time. */
export const casinoLeaderboard = (range: LeaderboardRange = "week") =>
  apiFetch<{ range: LeaderboardRange; rows: CasinoStanding[] }>(
    "/v1/casino/leaderboard",
    { method: "POST", body: JSON.stringify({ range }) },
  );

export type MatchSeat = "host" | "guest";

export interface MatchView {
  id: string;
  game: string;
  title: string;
  status: string;
  board: (string | null)[];
  version: number;
  /** Null when you are watching rather than playing. */
  seat: MatchSeat | null;
  yourTurn: boolean;
  host: { id: string; name: string | null };
  guest: { id: string; name: string | null } | null;
  result: string | null;
  outcome: string;
  announced?: boolean;
}

/** Opens a two-player match and announces it in the group. */
export const matchOpen = (game: string) =>
  apiFetch<MatchView>("/v1/games/match/open", {
    method: "POST",
    body: JSON.stringify({ game }),
  });

export const matchJoin = (id: string) =>
  apiFetch<MatchView>("/v1/games/match/join", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

export const matchState = (id: string) =>
  apiFetch<MatchView>("/v1/games/match/state", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

export const matchLobby = () =>
  apiFetch<{
    rows: { id: string; game: string; title: string; host: string | null }[];
  }>("/v1/games/match/lobby", { method: "POST" });

export interface MatchPlayer {
  id: string;
  name: string | null;
  seatIndex: number;
  status: string;
}

/**
 * Lo privado de una partida de grupo: solo lo de quien pregunta.
 *
 * No hay parametro para pedir el de otro, a proposito: el servidor saca de
 * initData a quien pregunta y devuelve unicamente su fila. `players` viene sin
 * secretos por construccion.
 */
export interface MatchSecretView {
  matchId: string;
  game: string | null;
  status?: string;
  players?: MatchPlayer[];
  /** `null` si no juegas esa partida — o si esa partida no existe. */
  secret: unknown;
}

export const matchSecret = (id: string) =>
  apiFetch<MatchSecretView>("/v1/games/match/secret", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

/** La mesa de cartas de colores, y SOLO la mano de quien pregunta. */
export interface CardsTableView {
  matchId: string;
  version: number;
  /** `null` si no juegas: ves la mesa, no la mano de nadie. */
  seat: number | null;
  hand: string[];
  /** Las que puedes tirar ahora. Vacia si no es tu turno. */
  playable: string[];
  table: {
    top: string;
    activeColor: "R" | "Y" | "G" | "B";
    turnSeat: number;
    direction: 1 | -1;
    pendingDraw: number;
    deckSize: number;
    handSizes: Record<number, number>;
    seats: number[];
    finished: boolean;
    winner: number | null;
  } | null;
  players: { seat: number; name: string | null; cards: number }[];
}

export const cardsTable = (id: string) =>
  apiFetch<CardsTableView>("/v1/games/cards/table", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

/**
 * Tira una carta. `version` es la mesa contra la que se decidio la jugada: el
 * servidor rechaza una tirada dirigida a una mesa que ya ha cambiado, para que
 * nadie juegue a ciegas sobre una pantalla vieja.
 */
export const cardsPlay = (
  id: string,
  card: string,
  version: number,
  color?: "R" | "Y" | "G" | "B",
) =>
  apiFetch<CardsTableView>("/v1/games/cards/play", {
    method: "POST",
    body: JSON.stringify({ id, card, version, ...(color ? { color } : {}) }),
  });

export const cardsDraw = (id: string, version: number) =>
  apiFetch<CardsTableView>("/v1/games/cards/draw", {
    method: "POST",
    body: JSON.stringify({ id, version }),
  });

/** El wordle del grupo: un tablero compartido, seis intentos para todos. */
export interface WordleView {
  matchId: string;
  version: number;
  attempts: {
    word: string;
    marks: ("hit" | "present" | "miss")[];
    mine: boolean;
  }[];
  finished: boolean;
  solved: boolean;
  /** Solo llega cuando la partida ha terminado. */
  answer: string | null;
  attemptsLeft: number;
  wordLength: number;
  letters: Record<string, "hit" | "present" | "miss">;
  canGuess: boolean;
  blockedReason: "finished" | "hogging" | null;
}

export const wordleBoard = (id: string) =>
  apiFetch<WordleView>("/v1/games/wordle/board", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

export const wordleGuess = (id: string, word: string, version: number) =>
  apiFetch<WordleView>("/v1/games/wordle/guess", {
    method: "POST",
    body: JSON.stringify({ id, word, version }),
  });

/** `version` is the board the tap was decided against — the server refuses a
 *  move aimed at a position that has since moved on. */
export const matchMove = (id: string, index: number, version: number) =>
  apiFetch<MatchView>("/v1/games/match/move", {
    method: "POST",
    body: JSON.stringify({ id, index, version }),
  });

export interface CasinoRecipient {
  telegramUserId: string;
  name: string | null;
}

/** Players this user can gift chips to; `query` filters by name. */
export const casinoRecipients = (query = "") =>
  apiFetch<{ rows: CasinoRecipient[]; truncated: boolean }>(
    "/v1/casino/recipients",
    { method: "POST", body: JSON.stringify({ query }) },
  );

/**
 * Sends chips to another player.
 *
 * `requestId` must stay the SAME across retries of one intended gift, and
 * change for a new one — it is what stops a double tap becoming two gifts.
 */
export const casinoTransfer = (to: string, amount: number, requestId: string) =>
  apiFetch<{ ok: boolean; repeated: boolean; balance: number }>(
    "/v1/casino/transfer",
    { method: "POST", body: JSON.stringify({ to, amount, requestId }) },
  );

/** The running weekly tournament: pot, deadline, standings and your rank. */
export const casinoTournament = () =>
  apiFetch<{
    period: string;
    endsAt: string;
    prizePool: number;
    standings: CasinoStanding[];
    you?: { rank: number; net: number } | null;
  }>("/v1/casino/tournament", { method: "POST" });

export const crashStart = (stake: number) =>
  apiFetch<{ betId: string; commit: string; balance: number }>(
    "/v1/casino/crash/start",
    { method: "POST", body: JSON.stringify({ stake }) },
  );
export const crashCashout = (betId: string, cashoutAt: number) =>
  apiFetch<{
    win: boolean;
    crash: number;
    payout: number;
    balance: number;
    reveal: string;
  }>("/v1/casino/crash/cashout", {
    method: "POST",
    body: JSON.stringify({ betId, cashoutAt }),
  });

export const minesStart = (stake: number, mineCount: number) =>
  apiFetch<{
    betId: string;
    commit: string;
    mineCount: number;
    balance: number;
  }>("/v1/casino/mines/start", {
    method: "POST",
    body: JSON.stringify({ stake, mineCount }),
  });
export const minesReveal = (betId: string, tile: number) =>
  apiFetch<{
    mine: boolean;
    tile: number;
    revealed?: number;
    multiplier?: number;
    layout?: number[];
    payout?: number;
    balance?: number;
    reveal?: string;
    // Set when the last safe tile is uncovered: the server auto-cashed the bet.
    cleared?: boolean;
  }>("/v1/casino/mines/reveal", {
    method: "POST",
    body: JSON.stringify({ betId, tile }),
  });
export const minesCashout = (betId: string) =>
  apiFetch<{
    payout: number;
    multiplier: number;
    balance: number;
    layout: number[];
    reveal: string;
  }>("/v1/casino/mines/cashout", {
    method: "POST",
    body: JSON.stringify({ betId }),
  });

export const blackjackStart = (stake: number) =>
  apiFetch<{
    betId?: string;
    player?: number[];
    dealerUp?: number;
    total?: number;
    done?: boolean;
    outcome?: string;
    payout?: number;
    balance?: number;
    dealer?: number[];
    dealerTotal?: number;
    playerTotal?: number;
  }>("/v1/casino/blackjack/start", {
    method: "POST",
    body: JSON.stringify({ stake }),
  });
export const blackjackAction = (betId: string, action: string) =>
  apiFetch<{
    done: boolean;
    outcome?: string;
    player: number[];
    total?: number;
    playerTotal?: number;
    dealer?: number[];
    dealerTotal?: number;
    payout?: number;
    balance?: number;
    reveal?: string;
  }>("/v1/casino/blackjack/action", {
    method: "POST",
    body: JSON.stringify({ betId, action }),
  });

// --- Guardian Verification: admin config (gid-scoped, same auth as everything above) ---

export const getGuardianConfig = (gid: string) =>
  apiFetch<GuardianConfigInput>(`/v1/miniapp/groups/${gid}/guardian`);

export const putGuardianConfig = (gid: string, config: GuardianConfigInput) =>
  apiFetch<GuardianConfigInput & { warnings?: GuardianConfigIssue[] }>(
    `/v1/miniapp/groups/${gid}/guardian`,
    { method: "PUT", body: JSON.stringify(config) },
  );

export const getGuardianDiagnostics = (gid: string) =>
  apiFetch<GuardianDiagnosticsResult>(
    `/v1/miniapp/groups/${gid}/guardian/diagnostics`,
  );

export const getGuardianSessions = (gid: string) =>
  apiFetch<{ sessions: GuardianSessionSummary[] }>(
    `/v1/miniapp/groups/${gid}/guardian/sessions`,
  );

// --- Appointed admins (/admin + the guard that can take the badge back) ---

export const getAppointedAdmins = (gid: string) =>
  apiFetch<AppointedAdminPanel>(`/v1/miniapp/groups/${gid}/appointed-admins`);

export const putAppointedAdminSettings = (
  gid: string,
  settings: AppointedAdminPanel["settings"],
) =>
  apiFetch<{ settings: AppointedAdminPanel["settings"] }>(
    `/v1/miniapp/groups/${gid}/appointed-admins/settings`,
    { method: "PUT", body: JSON.stringify(settings) },
  );

export const getGuardianRoster = (gid: string) =>
  apiFetch<GuardianRosterResult>(`/v1/miniapp/groups/${gid}/guardian/roster`);

/** The same screen across every group the caller administers. Takes no group
 * id on purpose — the api derives the list from Telegram admin rights, so this
 * cannot be pointed at a community the caller does not run. */
export const getGuardianRosterAll = () =>
  apiFetch<GuardianRosterResult>("/v1/miniapp/guardian/roster");

// --- Guardian Verification: the verify Mini App itself (session-token auth,
// NOT gid/bot-username — a join-request verifier never has group admin
// rights and typically isn't even a member yet). ---

/**
 * Un sufijo distinto en cada petición de verificación.
 *
 * `cache: "no-store"` arregla el futuro, pero no borra lo ya guardado: si el
 * webview contesta desde su propia caché, la petición NO llega a salir y ni la
 * cabecera nueva del servidor ni esa opción las ve nadie. Cambiar la URL es lo
 * único que obliga a preguntar de verdad, y es lo que desatasca a quien ya
 * arrastra pegado un 410 de una sesión muerta — que se le repetía en todas sus
 * verificaciones siguientes, en cualquier grupo, porque `/v1/guardian/session`
 * es la misma URL para todo el mundo.
 *
 * El token de sesión NO puede hacer este papel aunque distinga a cada uno: es
 * la credencial, y viaja en cabecera justo para no acabar en un log de accesos
 * ni en un historial. Esto es un número de usar y tirar que no identifica nada.
 */
const conSufijoUnico = (path: string): string =>
  `${path}${path.includes("?") ? "&" : "?"}_=${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;

async function guardianFetch<T>(
  path: string,
  sessionToken: string,
  init: RequestInit = {},
): Promise<T> {
  const initData = getInitData();
  if (!initData) {
    throw new ApiError("no-initdata", 0);
  }
  const headers = new Headers(init.headers);
  headers.set("authorization", `tma ${initData}`);
  headers.set("x-guardian-session", sessionToken);
  if (init.body) {
    headers.set("content-type", "application/json");
  }

  const response = await fetchWithDeadline(
    `${API_BASE}${conSufijoUnico(path)}`,
    { ...init, headers },
  );
  if (!response.ok) {
    let error = `http-${response.status}`;
    let desenlace: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: string;
        desenlace?: string;
      };
      error = body.error ?? error;
      desenlace = body.desenlace;
    } catch {
      // keep the generic error
    }
    throw new ApiError(error, response.status, undefined, desenlace);
  }
  return (await response.json()) as T;
}

export interface GuardianChallengeStepView {
  readonly kind: string;
  readonly action: string;
  readonly timeLimitMs: number;
  readonly accessibleAlternative: string;
}

export interface GuardianSessionView {
  readonly status: string;
  readonly mode: string;
  readonly attemptsRemaining: number;
  readonly maxAttempts: number;
  readonly expiresAtIso: string;
  /** Horas que se guarda la foto, para poder decir el número en pantalla. */
  readonly mediaRetentionHours: number;
  readonly challenge: {
    readonly steps: readonly GuardianChallengeStepView[];
    readonly revealStepsAhead: boolean;
    readonly totalTimeLimitMs: number;
    readonly nonce: string;
  };
}

export const getGuardianVerifySession = (sessionToken: string) =>
  guardianFetch<GuardianSessionView>("/v1/guardian/session", sessionToken);

export const postGuardianConsent = (sessionToken: string, version: string) =>
  guardianFetch<{ ok: boolean }>("/v1/guardian/consent", sessionToken, {
    method: "POST",
    body: JSON.stringify({ version }),
  });

/**
 * Reports which verification screen the person reached. Pure telemetry: it
 * grants nothing and is deliberately fire-and-forget at the call sites, so a
 * failed ping can never block somebody's verification.
 */
export const postGuardianProgress = (sessionToken: string, step: string) =>
  guardianFetch<{ ok: boolean }>("/v1/guardian/progress", sessionToken, {
    method: "POST",
    body: JSON.stringify({ step }),
  });

export const postGuardianAttemptStart = (sessionToken: string) =>
  guardianFetch<{ attemptId: string }>(
    "/v1/guardian/attempt/start",
    sessionToken,
    { method: "POST" },
  );

/**
 * Miga de pan del navegador: por qué pantalla va, o qué ha reventado.
 *
 * Deliberadamente NO usa guardianFetch: ese exige initData de Telegram, y una
 * miga tiene que poder salir justo cuando el cliente está roto. El endpoint del
 * otro lado es de solo escritura y no contesta nada.
 *
 * sendBeacon y no fetch porque sobrevive a que la pestaña se muera un instante
 * después — que es exactamente el caso que existe para cazar. Devuelve void: es
 * dispara-y-olvida, y nadie debe poder esperarla ni fallar por ella.
 */
export const postGuardianClientEvent = (
  sessionToken: string,
  event: string,
  detail?: string,
): void => {
  if (!sessionToken) {
    return;
  }
  const url = `${API_BASE}/v1/guardian/client-event`;
  const body = JSON.stringify({
    session: sessionToken,
    event,
    ...(detail ? { detail } : {}),
  });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // La telemetría no puede tumbar una verificación. Nunca.
  }
};

export interface GuardianStepResult {
  readonly action: string;
  readonly detectedAt: number;
}

export interface GuardianSubmitAttemptInput {
  readonly attemptId: string;
  readonly mediaBase64: string;
  readonly declaredMimeType: string;
  readonly durationMs?: number;
  readonly width?: number;
  readonly height?: number;
  readonly clientFaceCount?: number;
  readonly clientQualityScore?: number;
  readonly challengeNonce: string;
  readonly stepResults: readonly GuardianStepResult[];
  readonly sessionStartedAtMs: number;
  /** Age the user typed in the Mini App before the photo (STAFF-facing only). */
  readonly declaredAge?: number;
  /** Required when the group's Guardian config asks for 2 photos (double
   * verification) — a different gesture than the first, AI-compared against
   * it to confirm it's the same person. */
  readonly secondMediaBase64?: string;
  readonly secondDeclaredMimeType?: string;
}

export type GuardianSubmitAttemptResult =
  | {
      readonly outcome: "retry";
      readonly reasonCode: string;
      readonly attemptsRemaining: number;
    }
  | {
      readonly outcome: "resolved";
      readonly decision: string;
      readonly reasonCode: string;
    }
  /** El servidor decidió pero no pudo guardarlo. Reintentable. */
  | { readonly outcome: "technical-failure" };

export const postGuardianAttemptSubmit = (
  sessionToken: string,
  input: GuardianSubmitAttemptInput,
) =>
  guardianFetch<GuardianSubmitAttemptResult>(
    "/v1/guardian/attempt/submit",
    sessionToken,
    { method: "POST", body: JSON.stringify(input) },
  );

// --- Mandatory introduction gate (foto + edad + procedencia, o fuera) ---

export interface IntroductionSettingsDto {
  enabled: boolean;
  deadlineHours: number;
  requirePhoto: boolean;
  requireAge: boolean;
  requireOrigin: boolean;
  /**
   * Tema del grupo de STAFF donde van las fichas (null = el de Guardian). No
   * hay control para editarlo en esta pantalla, pero está declarado a
   * propósito: el guardado hace `{ ...settings, ...patch }` y manda el objeto
   * entero, así que si este campo desapareciera del tipo, alguien lo quitaría
   * del formulario "porque no se usa" y el siguiente guardado lo borraría en
   * silencio — las fichas volverían al tema de Guardian sin que nadie tocara
   * ese ajuste.
   */
  staffThreadId: number | null;
  /**
   * Copiar al staff también las presentaciones buenas, no solo las fichas de
   * quien no se presentó. Se enciende desde el grupo con `/presentaciones on`.
   *
   * Declarado aquí por el mismo motivo que `staffThreadId`, y con más motivo:
   * si desapareciera del tipo, el siguiente guardado desde esta pantalla
   * apagaría el espejo sin que nadie tocara ese interruptor, y el tema de
   * presentaciones dejaría de recibir copias en silencio.
   */
  mirrorToStaff: boolean;
}

export const getIntroductionSettings = (gid: string) =>
  apiFetch<{ settings: IntroductionSettingsDto }>(
    `/v1/miniapp/groups/${gid}/introduction`,
  );

export const putIntroductionSettings = (
  gid: string,
  settings: IntroductionSettingsDto,
) =>
  apiFetch<{ settings: IntroductionSettingsDto }>(
    `/v1/miniapp/groups/${gid}/introduction`,
    { method: "PUT", body: JSON.stringify(settings) },
  );

/**
 * La tienda del grupo.
 *
 * El grupo NO viaja en la ruta: sale del `start_param` firmado por Telegram, y
 * la API comprueba ademas que quien pregunta este dentro. Poner el id en la
 * URL invitaria a cambiarlo, que es justo lo que no puede servir de nada.
 */
export interface ShopItemDto {
  id: string;
  nombre: string;
  icono: string;
  resumen: string;
  familia: "ataque" | "defensa" | "economia" | "castigo" | "vanidad";
  /** null = el precio depende del caso (la fianza). */
  precio: number | null;
  /** Lo que le cae encima a otra persona se compra en el chat, no aqui. */
  comprableAqui: boolean;
  pidePayload: boolean;
}

export interface ShopOwnedDto {
  id: string;
  nombre: string;
  icono: string;
  usos: number;
  /** null = no caduca (los consumibles). */
  restante: string | null;
  texto?: string;
}

export interface ShopViewDto {
  enabled: boolean;
  currency: { nombre: string; simbolo: string };
  balance: number;
  vault: {
    guardado: number;
    tope: number;
    /** Caja sin limite: `tope` no es un numero que enseñar. */
    sinTope?: boolean;
    expuesto: number;
  };
  items: ShopItemDto[];
  inventario: ShopOwnedDto[];
}

export const getShop = () => apiFetch<ShopViewDto>("/v1/shop");

export const buyShopItem = (item: string, texto?: string) =>
  apiFetch<{
    ok: boolean;
    error?: string;
    precio?: number;
    balance: number;
  }>("/v1/shop/buy", {
    method: "POST",
    body: JSON.stringify({ item, ...(texto ? { texto } : {}) }),
  });

/** Positivo guarda en la caja fuerte, negativo saca. */
export const moveShopVault = (amount: number) =>
  apiFetch<{
    ok: boolean;
    error?: string;
    guardado: number;
    tope: number;
    expuesto: number;
    balance: number;
  }>("/v1/shop/vault", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
