import { ApiError, apiFetch } from "./api";

export { ApiError };

export interface GamificationMission {
  kind: "first_message" | "read_rules" | "joined_required_group";
  completed: boolean;
  completedAt: string | null;
}

export interface GamificationRankingRow {
  telegramUserId: string;
  badgeCount: number;
  name?: string | null;
}

export interface GamificationGroupRankingRow {
  telegramUserId: string;
  points: number;
  name?: string | null;
}

export type GamificationStatus =
  | {
      inNetwork: false;
      groupRanking: GamificationGroupRankingRow[];
    }
  | {
      inNetwork: true;
      fedId: string;
      missions: GamificationMission[];
      badges: string[];
      networkRanking: GamificationRankingRow[];
      groupRanking: GamificationGroupRankingRow[];
    };

export const getGamificationStatus = (gid: string) =>
  apiFetch<GamificationStatus>(`/v1/miniapp/groups/${gid}/gamification`);

export interface WelcomeButtonsInput {
  rules: boolean;
  otherGroups: boolean;
  support: boolean;
  verify: boolean;
}

export interface WelcomeButtonsResult extends WelcomeButtonsInput {
  persisted: boolean;
}

export const updateWelcomeButtons = (gid: string, body: WelcomeButtonsInput) =>
  apiFetch<WelcomeButtonsResult>(
    `/v1/miniapp/groups/${gid}/gamification/welcome-buttons`,
    { method: "POST", body: JSON.stringify(body) },
  );

/** Ajustes de la moneda propia del grupo. */
export interface GroupCurrencyInput {
  enabled: boolean;
  nombre: string;
  simbolo: string;
  porMensaje: number;
  cupoDiario: number;
  minCaracteres: number;
  cooldownSegundos: number;
  premioPartida: number;
  monedasPorFicha: number;
  comisionVentaPct: number;
}

export interface GroupCurrencyResult extends GroupCurrencyInput {
  persisted: boolean;
}

export const getGroupCurrency = (gid: string) =>
  apiFetch<GroupCurrencyInput>(`/v1/miniapp/groups/${gid}/currency`);

export const updateGroupCurrency = (gid: string, body: GroupCurrencyInput) =>
  apiFetch<GroupCurrencyResult>(`/v1/miniapp/groups/${gid}/currency`, {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Reglas del robo entre miembros. */
export interface StealRulesInput {
  enabled: boolean;
  baseChancePct: number;
  maxChancePct: number;
  chancePerLevelPct: number;
  lootPct: number;
  lootMax: number;
  finePct: number;
  fineMax: number;
  cooldownSeconds: number;
  victimShieldSeconds: number;
  minVictimBalance: number;
}

/** Reglas de la purga. */
export interface PurgeRulesInput {
  enabled: boolean;
  durationMinutes: number;
  windowStartHour: number;
  windowEndHour: number;
}

export interface EconomyRulesInput {
  steal: StealRulesInput;
  purge: PurgeRulesInput;
}

export interface EconomyRulesResult extends EconomyRulesInput {
  persisted: boolean;
}

export const getEconomyRules = (gid: string) =>
  apiFetch<EconomyRulesInput>(`/v1/miniapp/groups/${gid}/economy-rules`);

export const updateEconomyRules = (gid: string, body: EconomyRulesInput) =>
  apiFetch<EconomyRulesResult>(`/v1/miniapp/groups/${gid}/economy-rules`, {
    method: "POST",
    body: JSON.stringify(body),
  });

/**
 * Los ajustes de la tienda del grupo.
 *
 * El catalogo viene del servidor junto a los ajustes: la pantalla no lleva su
 * propia copia de los objetos ni de los precios, porque una copia en el cliente
 * es una copia que se queda vieja en cuanto se retoca un numero.
 */
export interface ShopRulesInput {
  enabled: boolean;
  precios: Record<string, number>;
  apagados: string[];
  exentosMute: string[];
  muteVictimCooldownSeconds: number;
  muteGraceSeconds: number;
  vaultBase: number;
}

export interface ShopCatalogItem {
  id: string;
  nombre: string;
  icono: string;
  familia: string;
  precio: number;
  precioDinamico: boolean;
}

export const getShopRules = (gid: string) =>
  apiFetch<{ shop: ShopRulesInput; catalogo: ShopCatalogItem[] }>(
    `/v1/miniapp/groups/${gid}/shop-rules`,
  );

export const updateShopRules = (gid: string, body: ShopRulesInput) =>
  apiFetch<{ persisted: boolean; shop: ShopRulesInput }>(
    `/v1/miniapp/groups/${gid}/shop-rules`,
    { method: "POST", body: JSON.stringify(body) },
  );
