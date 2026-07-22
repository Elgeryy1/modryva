import type { TelegramUpdateEnvelope } from "@superbot/domain";

export const PLATFORM_ROLES = [
  "platform_owner",
  "promo_admin",
  "bot_factory_admin",
  "support_admin",
  "auditor",
] as const;

export type PlatformRoleName = (typeof PLATFORM_ROLES)[number];

export const MANAGED_BOT_TEMPLATES = [
  "community",
  "creator",
  "support",
  "business",
  "custom",
] as const;

export type ManagedBotTemplateName = (typeof MANAGED_BOT_TEMPLATES)[number];

export type PlatformCommand =
  | { readonly kind: "platform-panel" }
  | {
      readonly kind: "promo-create";
      readonly template: ManagedBotTemplateName;
      readonly maxUses: number;
      readonly expiresInDays: number | undefined;
      readonly note: string | undefined;
    }
  | { readonly kind: "promo-list" }
  | { readonly kind: "promo-revoke"; readonly codeOrId: string }
  | { readonly kind: "redeem"; readonly code: string }
  | {
      readonly kind: "grant-custombot";
      readonly target: string;
      readonly template: ManagedBotTemplateName;
      readonly expiresInDays: number | undefined;
    }
  | { readonly kind: "revoke-custombot"; readonly target: string }
  | { readonly kind: "my-plan" }
  | { readonly kind: "create-bot" }
  | { readonly kind: "my-bots" }
  | {
      readonly kind: "platform-admin-add";
      readonly target: string;
      readonly role: PlatformRoleName;
    }
  | {
      readonly kind: "platform-admin-remove";
      readonly target: string;
      readonly role: PlatformRoleName;
    }
  | { readonly kind: "platform-admin-list" };

export interface PlatformCommandError {
  readonly code: "format" | "code-required" | "target-required";
  readonly usage: string;
}

export type PlatformCommandResult =
  | { readonly ok: true; readonly command: PlatformCommand }
  | { readonly ok: false; readonly error: PlatformCommandError };

const templateSet: ReadonlySet<string> = new Set(MANAGED_BOT_TEMPLATES);
const roleSet: ReadonlySet<string> = new Set(PLATFORM_ROLES);
const promoCodePattern = /^[A-Z0-9][A-Z0-9_-]{7,79}$/u;

const parseTemplate = (
  value: string | undefined,
): ManagedBotTemplateName | undefined => {
  const template = (value ?? "community").toLowerCase();
  return templateSet.has(template)
    ? (template as ManagedBotTemplateName)
    : undefined;
};

const parseRole = (value: string | undefined): PlatformRoleName | undefined => {
  const role = (value ?? "").toLowerCase();
  return roleSet.has(role) ? (role as PlatformRoleName) : undefined;
};

const parsePositiveInt = (value: string | undefined): number | undefined => {
  if (!value || !/^\d+$/u.test(value)) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseDurationDays = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const match = /^(\d+)(d)?$/iu.exec(value);
  if (!match) {
    return undefined;
  }
  const days = Number.parseInt(match[1] ?? "", 10);
  return Number.isSafeInteger(days) && days > 0 ? days : undefined;
};

const normalizePromoCode = (value: string | undefined): string | undefined => {
  const code = (value ?? "").trim().toUpperCase();
  return promoCodePattern.test(code) ? code : undefined;
};

export const parsePlatformCommand = (
  update: TelegramUpdateEnvelope,
): PlatformCommandResult | null => {
  const name = update.command?.name;
  if (!name) {
    return null;
  }
  const args = update.command.args;

  if (name === "redeem") {
    const code = normalizePromoCode(args[0]);
    return code
      ? { ok: true, command: { kind: "redeem", code } }
      : {
          ok: false,
          error: { code: "code-required", usage: "Uso: /redeem <codigo>" },
        };
  }

  if (name === "myplan") {
    return { ok: true, command: { kind: "my-plan" } };
  }

  if (name === "createbot") {
    return { ok: true, command: { kind: "create-bot" } };
  }

  if (name === "mybots") {
    return { ok: true, command: { kind: "my-bots" } };
  }

  if (name === "platform") {
    return { ok: true, command: { kind: "platform-panel" } };
  }

  if (name === "grant_custombot") {
    const target = args[0];
    const template = parseTemplate(args[1]);
    const expiresInDays = parseDurationDays(args[2]);
    if (!target) {
      return {
        ok: false,
        error: {
          code: "target-required",
          usage: "Uso: /grant_custombot <user_id|@usuario> [plantilla] [dias]",
        },
      };
    }
    if (!template) {
      return {
        ok: false,
        error: {
          code: "format",
          usage:
            "Uso: /grant_custombot <user_id|@usuario> [community|creator|support|business|custom] [dias]",
        },
      };
    }
    return {
      ok: true,
      command: { kind: "grant-custombot", target, template, expiresInDays },
    };
  }

  if (name === "revoke_custombot") {
    const target = args[0];
    return target
      ? { ok: true, command: { kind: "revoke-custombot", target } }
      : {
          ok: false,
          error: {
            code: "target-required",
            usage: "Uso: /revoke_custombot <user_id|@usuario>",
          },
        };
  }

  if (name === "promo_create") {
    const template = parseTemplate(args[0]);
    const maxUses = parsePositiveInt(args[1]) ?? 1;
    const expiresInDays = parseDurationDays(args[2]);
    const note = args.slice(3).join(" ").trim() || undefined;
    if (!template || maxUses > 10_000) {
      return {
        ok: false,
        error: {
          code: "format",
          usage:
            "Uso: /promo_create <community|creator|support|business|custom> [usos] [dias] [nota]",
        },
      };
    }
    return {
      ok: true,
      command: {
        kind: "promo-create",
        template,
        maxUses,
        expiresInDays,
        note,
      },
    };
  }

  if (name === "promo_list") {
    return { ok: true, command: { kind: "promo-list" } };
  }

  if (name === "promo_revoke") {
    const codeOrId = args[0];
    return codeOrId
      ? { ok: true, command: { kind: "promo-revoke", codeOrId } }
      : {
          ok: false,
          error: {
            code: "code-required",
            usage: "Uso: /promo_revoke <codigo|id>",
          },
        };
  }

  if (name === "platform_admin") {
    const action = args[0]?.toLowerCase();
    if (action === "list") {
      return { ok: true, command: { kind: "platform-admin-list" } };
    }

    const target = args[1];
    const role = parseRole(args[2]);
    if ((action === "add" || action === "remove") && target && role) {
      return {
        ok: true,
        command:
          action === "add"
            ? { kind: "platform-admin-add", target, role }
            : { kind: "platform-admin-remove", target, role },
      };
    }
    return {
      ok: false,
      error: {
        code: "format",
        usage:
          "Uso: /platform_admin add|remove <user_id|@usuario> <rol> | /platform_admin list",
      },
    };
  }

  return null;
};
