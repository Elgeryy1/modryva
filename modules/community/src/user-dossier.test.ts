import { describe, expect, it } from "vitest";
import {
  buildUserDossierKeyboard,
  formatUserDossier,
  parseDossierCallback,
  parseInfoTarget,
  type UserDossier,
} from "./user-dossier.js";

const DAY_MS = 86_400_000;

const dossier = (overrides: Partial<UserDossier> = {}): UserDossier => ({
  telegramUserId: 9000000001n,
  username: "usuario_gamma",
  firstName: "Andres",
  lastName: undefined,
  isBot: false,
  membership: "member",
  customTitle: undefined,
  seenForMs: 11 * DAY_MS,
  firstSeenAt: new Date("2026-07-22T10:19:00Z"),
  messages: 42,
  historicalMessages: 30,
  liveMessages: 12,
  silentForMs: 2 * DAY_MS,
  activeWarnings: 0,
  warnLimit: 3,
  reputation: 3,
  thanksReceived: 1,
  trustTier: "Confianza media",
  languageCode: "es",
  verified: true,
  activeSanction: undefined,
  permissions: undefined,
  isSelf: false,
  ...overrides,
});

describe("formatUserDossier", () => {
  it("leads with the badge, the name and the alias", () => {
    expect(formatUserDossier(dossier())).toContain(
      "✅ Andres (@usuario_gamma)",
    );
  });

  it("shows an admin custom title next to the name", () => {
    const text = formatUserDossier(
      dossier({ membership: "administrator", customTitle: "Capitán España" }),
    );
    expect(text).toContain("🛡️ Andres (@usuario_gamma) — «Capitán España»");
    expect(text).toContain("👀 Situación: Administrador");
  });

  it("prints the identity block a moderator reads first", () => {
    const text = formatUserDossier(dossier());
    expect(text).toContain("🆔 ID: 9000000001");
    expect(text).toContain("👤 Nombre: Andres");
    expect(text).toContain("🌐 Usuario: @usuario_gamma");
  });

  it("shows warnings against the group's own limit", () => {
    expect(formatUserDossier(dossier())).toContain("❗ Advertencias: 0/3");
    expect(
      formatUserDossier(dossier({ activeWarnings: 2, warnLimit: 3 })),
    ).toContain("❗ Advertencias: 2/3");
  });

  it("omits the limit when the group has not set one", () => {
    expect(formatUserDossier(dossier({ warnLimit: undefined }))).toContain(
      "❗ Advertencias: 0\n",
    );
  });

  it("gives the join date AND how long ago it was", () => {
    const text = formatUserDossier(dossier());
    expect(text).toContain("⬇️ Visto desde: 22 jul 2026, 10:19 (hace 11 días)");
  });

  it("admits when it has no join date instead of inventing one", () => {
    expect(
      formatUserDossier(
        dossier({ firstSeenAt: undefined, seenForMs: undefined }),
      ),
    ).toContain("⬇️ Visto desde: no tengo registro");
  });

  it("translates the language code", () => {
    expect(formatUserDossier(dossier({ languageCode: "es" }))).toContain(
      "🗣 Idioma: Español",
    );
    expect(formatUserDossier(dossier({ languageCode: "en-GB" }))).toContain(
      "🗣 Idioma: Inglés",
    );
    // Unknown codes are shown raw rather than guessed at.
    expect(formatUserDossier(dossier({ languageCode: "zz" }))).toContain(
      "🗣 Idioma: zz",
    );
  });

  it("splits historical and live messages in the technical block", () => {
    expect(formatUserDossier(dossier())).toContain(
      "💬 Mensajes: 42 (30 antiguos + 12 en vivo)",
    );
  });

  it("does not fake a split when there is no imported history", () => {
    const text = formatUserDossier(
      dossier({ messages: 12, historicalMessages: 0, liveMessages: 12 }),
    );
    expect(text).toContain("💬 Mensajes: 12");
    expect(text).not.toContain("antiguos");
  });

  it("calls a member with zero messages a ghost", () => {
    expect(
      formatUserDossier(dossier({ messages: 0, silentForMs: undefined })),
    ).toContain("💬 Mensajes: 0 — nunca ha escrito (fantasma)");
  });

  it("says nothing about messages when the count is unknown", () => {
    expect(
      formatUserDossier(
        dossier({ messages: undefined, silentForMs: undefined }),
      ),
    ).not.toContain("💬 Mensajes");
  });

  it("always states the Guardian verification either way", () => {
    expect(formatUserDossier(dossier({ verified: false }))).toContain(
      "🪪 Guardian: sin verificar",
    );
    expect(formatUserDossier(dossier())).toContain("🪪 Guardian: verificado");
  });

  it("surfaces an active sanction in the top block, not buried", () => {
    const text = formatUserDossier(
      dossier({ activeSanction: "silenciado hasta las 14:05" }),
    );
    const top = text.split("── técnico ──")[0] ?? "";
    expect(top).toContain("⛔ Sanción activa: silenciado hasta las 14:05");
  });

  it("renders permissions with a mark per capability", () => {
    const text = formatUserDossier(
      dossier({
        permissions: {
          canSendMessages: true,
          canSendMedia: false,
          canSendLinks: undefined,
          canAddWebPagePreviews: true,
        },
      }),
    );
    expect(text).toContain("🔐 Puede: ✅ escribir · 🚫 media · ✅ previews");
    // An unknown capability is omitted, never rendered as denied.
    expect(text).not.toContain("enlaces");
  });

  it("flags a bot account", () => {
    expect(formatUserDossier(dossier({ isBot: true }))).toContain(
      "🤖 Es una cuenta de bot",
    );
    expect(formatUserDossier(dossier())).not.toContain("🤖");
  });

  it("adds a closing line only when you asked about yourself", () => {
    expect(formatUserDossier(dossier({ isSelf: true }))).toContain(
      "Esto es lo que sé de ti en este grupo.",
    );
    expect(formatUserDossier(dossier())).not.toContain(
      "Esto es lo que sé de ti",
    );
  });
});

describe("buildUserDossierKeyboard", () => {
  it("offers the moderation actions to someone who can moderate", () => {
    const kb = buildUserDossierKeyboard(99n, { canModerate: true });
    const data = JSON.stringify(kb);
    for (const action of ["warns", "roles", "mute", "ban", "perms"]) {
      expect(data).toContain(`info:${action}:99`);
    }
  });

  it("hides the moderation buttons from someone who cannot use them", () => {
    const data = JSON.stringify(
      buildUserDossierKeyboard(99n, { canModerate: false }),
    );
    expect(data).toContain("info:warns:99");
    expect(data).toContain("info:perms:99");
    expect(data).not.toContain("info:ban:99");
    expect(data).not.toContain("info:mute:99");
  });
});

describe("parseDossierCallback", () => {
  it("reads a valid action", () => {
    expect(parseDossierCallback("info:ban:12345")).toEqual({
      action: "ban",
      telegramUserId: 12345n,
    });
  });

  it.each([
    undefined,
    "",
    "otracosa:ban:12345",
    "info:ban",
    "info:ban:abc",
    // An action that is not in the allowlist must not slip through.
    "info:promote:12345",
    "info::12345",
  ])("rejects %s", (data) => {
    expect(parseDossierCallback(data)).toBeNull();
  });
});

describe("parseInfoTarget", () => {
  it("treats a bare /info as being about yourself", () => {
    expect(parseInfoTarget([])).toEqual({ ok: true, target: { kind: "self" } });
    expect(parseInfoTarget(["  "])).toEqual({
      ok: true,
      target: { kind: "self" },
    });
  });

  it("reads a numeric id", () => {
    expect(parseInfoTarget(["1000000001"])).toEqual({
      ok: true,
      target: { kind: "id", telegramUserId: 1000000001n },
    });
  });

  it("reads an @username with or without the at sign", () => {
    expect(parseInfoTarget(["@usuario_delta"])).toEqual({
      ok: true,
      target: { kind: "username", username: "usuario_delta" },
    });
    expect(parseInfoTarget(["usuario_delta"])).toEqual({
      ok: true,
      target: { kind: "username", username: "usuario_delta" },
    });
  });

  it.each([
    "@ab", // shorter than Telegram allows
    "@1nvalid", // Telegram handles never start with a digit
    "@con-guion",
    "hola mundo",
  ])("rejects %s", (raw) => {
    expect(parseInfoTarget([raw])).toEqual({ ok: false, error: "no-target" });
  });
});
