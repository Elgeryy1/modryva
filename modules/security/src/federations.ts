import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Comando de federacion ya validado, discriminado por `kind`. La persistencia
 * (crear la fed con su id, propagar bans, etc.) la resuelve el servicio; este
 * modulo solo produce la intencion parseada.
 */
export type FederationCommand =
  | { readonly kind: "new"; readonly name: string }
  | { readonly kind: "join"; readonly fedId: string }
  | { readonly kind: "leave" }
  | { readonly kind: "chatfed" }
  | {
      readonly kind: "fban";
      readonly targetTelegramUserId: bigint;
      readonly reason: string | undefined;
    }
  | { readonly kind: "unfban"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "info"; readonly fedId: string | undefined }
  | { readonly kind: "stat"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "fpromote"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "fdemote"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "fedadmins" }
  | { readonly kind: "setfedlog" }
  | { readonly kind: "subfed"; readonly fedId: string }
  | { readonly kind: "export" }
  | { readonly kind: "import"; readonly data: string };

/**
 * Error de parseo con codigo estable y texto de uso para el usuario.
 */
export interface FederationCommandError {
  readonly code:
    | "name-required"
    | "fedid-required"
    | "target-required"
    | "data-required";
  readonly usage: string;
}

/**
 * Resultado del parser: `ok:true` con el comando o `ok:false` con el error.
 */
export type FederationCommandResult =
  | { readonly ok: true; readonly command: FederationCommand }
  | { readonly ok: false; readonly error: FederationCommandError };

const federationCommandNames: ReadonlySet<string> = new Set([
  "newfed",
  "joinfed",
  "leavefed",
  "chatfed",
  "fban",
  "unfban",
  "fedinfo",
  "fedstat",
  "fpromote",
  "fdemote",
  "fedadmins",
  "setfedlog",
  "subfed",
  "fedexport",
  "fedimport",
]);

const targetIdPattern = /^-?\d+$/;

const parseTargetId = (raw: string | undefined): bigint | null => {
  if (raw === undefined || !targetIdPattern.test(raw)) {
    return null;
  }
  return BigInt(raw);
};

const nameRequiredError = (): FederationCommandResult => ({
  ok: false,
  error: { code: "name-required", usage: "Uso: /newfed <nombre>" },
});

const fedIdRequiredError = (command: string): FederationCommandResult => ({
  ok: false,
  error: { code: "fedid-required", usage: `Uso: /${command} <fedId>` },
});

const targetRequiredError = (command: string): FederationCommandResult => ({
  ok: false,
  error: { code: "target-required", usage: `Uso: /${command} <id_usuario>` },
});

const dataRequiredError = (): FederationCommandResult => ({
  ok: false,
  error: { code: "data-required", usage: "Uso: /fedimport <json>" },
});

/**
 * Parsea los comandos de federacion (`newfed`, `joinfed`, `leavefed`, `chatfed`,
 * `fban`, `unfban`, `fedinfo`, `fedstat`, `fpromote`, `fdemote`, `fedadmins`,
 * `setfedlog`, `subfed`, `fedexport`, `fedimport`). Devuelve null si el comando
 * no pertenece al modulo, `ok:false` si los argumentos son invalidos, u `ok:true`
 * con el comando. Pura: solo lee `update.command`.
 */
export const parseFederationCommand = (
  update: TelegramUpdateEnvelope,
): FederationCommandResult | null => {
  const name = update.command?.name;

  if (!name || !federationCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  switch (name) {
    case "newfed": {
      const fedName = args.join(" ").trim();
      if (fedName.length === 0) {
        return nameRequiredError();
      }
      return { ok: true, command: { kind: "new", name: fedName } };
    }
    case "joinfed": {
      const fedId = (args[0] ?? "").trim();
      if (fedId.length === 0) {
        return fedIdRequiredError("joinfed");
      }
      return { ok: true, command: { kind: "join", fedId } };
    }
    case "leavefed": {
      return { ok: true, command: { kind: "leave" } };
    }
    case "chatfed": {
      return { ok: true, command: { kind: "chatfed" } };
    }
    case "fban": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetRequiredError("fban");
      }
      const reasonText = args.slice(1).join(" ").trim();
      const reason = reasonText.length > 0 ? reasonText : undefined;
      return {
        ok: true,
        command: {
          kind: "fban",
          targetTelegramUserId,
          ...(reason !== undefined ? { reason } : { reason: undefined }),
        },
      };
    }
    case "unfban": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetRequiredError("unfban");
      }
      return { ok: true, command: { kind: "unfban", targetTelegramUserId } };
    }
    case "fedinfo": {
      const raw = (args[0] ?? "").trim();
      const fedId = raw.length > 0 ? raw : undefined;
      return {
        ok: true,
        command: {
          kind: "info",
          ...(fedId !== undefined ? { fedId } : { fedId: undefined }),
        },
      };
    }
    case "fedstat": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetRequiredError("fedstat");
      }
      return { ok: true, command: { kind: "stat", targetTelegramUserId } };
    }
    case "fpromote": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetRequiredError("fpromote");
      }
      return { ok: true, command: { kind: "fpromote", targetTelegramUserId } };
    }
    case "fdemote": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetRequiredError("fdemote");
      }
      return { ok: true, command: { kind: "fdemote", targetTelegramUserId } };
    }
    case "fedadmins": {
      return { ok: true, command: { kind: "fedadmins" } };
    }
    case "setfedlog": {
      return { ok: true, command: { kind: "setfedlog" } };
    }
    case "subfed": {
      const fedId = (args[0] ?? "").trim();
      if (fedId.length === 0) {
        return fedIdRequiredError("subfed");
      }
      return { ok: true, command: { kind: "subfed", fedId } };
    }
    case "fedexport": {
      return { ok: true, command: { kind: "export" } };
    }
    case "fedimport": {
      const data = args.join(" ").trim();
      if (data.length === 0) {
        return dataRequiredError();
      }
      return { ok: true, command: { kind: "import", data } };
    }
    default:
      return null;
  }
};

/**
 * Vista de una federacion para renderizar `formatFedInfo`. Los conteos y el
 * `subscribedFedId` los provee el servicio; este modulo solo formatea.
 */
export interface FedInfoView {
  readonly name: string;
  readonly fedId: string;
  readonly ownerTelegramId: bigint;
  readonly chatCount: number;
  readonly banCount: number;
  readonly adminCount: number;
  readonly subscribedFedId: string | undefined;
}

/**
 * Formatea la ficha de una federacion en texto multilinea en espanol sin
 * acentos. Incluye nombre, FedID, owner y conteos; anade la fed suscrita si la
 * federacion esta suscrita a otra.
 */
export const formatFedInfo = (view: FedInfoView): string => {
  const lines: string[] = [
    `Federacion: ${view.name}`,
    `FedID: ${view.fedId}`,
    `Owner: ${view.ownerTelegramId.toString()}`,
    `Chats: ${view.chatCount}`,
    `Bans: ${view.banCount}`,
    `Admins: ${view.adminCount}`,
  ];

  if (view.subscribedFedId !== undefined) {
    lines.push(`Suscrita a: ${view.subscribedFedId}`);
  }

  return lines.join("\n");
};

/**
 * Entrada de un fedban: usuario baneado y razon opcional.
 */
export interface FedBanEntry {
  readonly subjectTelegramId: bigint;
  readonly reason: string | undefined;
}

/**
 * Formatea el estado de un usuario en las federaciones donde esta baneado. Si
 * la lista esta vacia devuelve un texto informativo; si no, una linea por cada
 * federacion con el motivo o "sin motivo".
 */
export const formatFedStat = (
  feds: readonly {
    readonly name: string;
    readonly fedId: string;
    readonly reason: string | undefined;
  }[],
): string => {
  if (feds.length === 0) {
    return "Este usuario no esta baneado en ninguna federacion.";
  }

  return feds
    .map((fed) => {
      const reason =
        fed.reason !== undefined && fed.reason.length > 0
          ? fed.reason
          : "sin motivo";
      return `En ${fed.name} (${fed.fedId}): ${reason}`;
    })
    .join("\n");
};

interface SerializedFedBan {
  readonly id: string;
  readonly reason: string | undefined;
}

interface SerializedFedBans {
  readonly version: 1;
  readonly bans: readonly SerializedFedBan[];
}

/**
 * Serializa una lista de fedbans a JSON estable y determinista. El id de usuario
 * se guarda como string para no perder precision de bigint.
 */
export const serializeFedBans = (bans: readonly FedBanEntry[]): string => {
  const payload: SerializedFedBans = {
    version: 1,
    bans: bans.map((ban) => ({
      id: ban.subjectTelegramId.toString(),
      reason: ban.reason,
    })),
  };
  return JSON.stringify(payload);
};

const digitsPattern = /^-?\d+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Parsea de forma segura el JSON producido por `serializeFedBans`. Devuelve `[]`
 * si el payload no contiene bans, o null si el JSON es invalido o mal formado.
 * Ignora las entradas individuales que no tengan un id de digitos valido.
 */
export const parseFedImport = (raw: string): FedBanEntry[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const bans = parsed.bans;
  if (bans === undefined) {
    return [];
  }

  if (!Array.isArray(bans)) {
    return null;
  }

  const entries: FedBanEntry[] = [];

  for (const item of bans) {
    if (!isRecord(item)) {
      continue;
    }

    const id = item.id;
    if (typeof id !== "string" || !digitsPattern.test(id)) {
      continue;
    }

    const rawReason = item.reason;
    const reason = typeof rawReason === "string" ? rawReason : undefined;

    entries.push({
      subjectTelegramId: BigInt(id),
      ...(reason !== undefined ? { reason } : { reason: undefined }),
    });
  }

  return entries;
};
