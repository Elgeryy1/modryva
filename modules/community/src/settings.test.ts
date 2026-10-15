import { describe, expect, it } from "vitest";
import {
  buildSettingsDeepLink,
  clampFloodLimit,
  isLockTypeValue,
  LOCK_TYPES,
  nextCaptchaFailAction,
  nextCaptchaMode,
  nextFloodAction,
  nextRaidMode,
  parseSettingsCallback,
  parseSettingsStart,
  renderCaptchaPanel,
  renderFloodPanel,
  renderLocksPanel,
  renderRaidPanel,
  renderRulesPanel,
  renderSettingsClosed,
  renderSettingsRoot,
  renderWelcomePanel,
} from "./settings.js";

describe("parseSettingsStart", () => {
  it("parses a positive and negative group id", () => {
    expect(parseSettingsStart("cfg_123")).toBe(123n);
    expect(parseSettingsStart("cfg_-1001234567890")).toBe(-1001234567890n);
  });

  it("rejects non-settings payloads", () => {
    expect(parseSettingsStart(undefined)).toBeNull();
    expect(parseSettingsStart("")).toBeNull();
    expect(parseSettingsStart("hello")).toBeNull();
    expect(parseSettingsStart("cfg_abc")).toBeNull();
    expect(parseSettingsStart("cfg_")).toBeNull();
  });
});

describe("parseSettingsCallback", () => {
  it("parses a well-formed callback", () => {
    expect(parseSettingsCallback("cfg:-100123:flood:toggle")).toEqual({
      groupId: -100123n,
      section: "flood",
      action: "toggle",
    });
  });

  it("parses a lock-type action", () => {
    expect(parseSettingsCallback("cfg:42:lock:photo")).toEqual({
      groupId: 42n,
      section: "lock",
      action: "photo",
    });
  });

  it("rejects malformed callbacks", () => {
    expect(parseSettingsCallback(undefined)).toBeNull();
    expect(parseSettingsCallback("menu:home")).toBeNull();
    expect(parseSettingsCallback("cfg:abc:flood:toggle")).toBeNull();
    expect(parseSettingsCallback("cfg:42:flood")).toBeNull();
    expect(parseSettingsCallback("cfg:42:flood:toggle:extra")).toBeNull();
  });
});

describe("cycles and clamps", () => {
  it("cycles flood action and wraps", () => {
    expect(nextFloodAction("warn")).toBe("mute");
    expect(nextFloodAction("mute")).toBe("ban");
    expect(nextFloodAction("ban")).toBe("delete");
    expect(nextFloodAction("delete")).toBe("warn");
    expect(nextFloodAction("unknown")).toBe("warn");
  });

  it("clamps flood limit", () => {
    expect(clampFloodLimit(1)).toBe(3);
    expect(clampFloodLimit(10)).toBe(10);
    expect(clampFloodLimit(999)).toBe(20);
  });

  it("cycles captcha mode and fail action", () => {
    expect(nextCaptchaMode("button")).toBe("math");
    expect(nextCaptchaMode("math")).toBe("text");
    expect(nextCaptchaMode("text")).toBe("button");
    expect(nextCaptchaFailAction("mute")).toBe("ban");
    expect(nextCaptchaFailAction("restrict")).toBe("mute");
  });

  it("toggles raid mode", () => {
    expect(nextRaidMode("observe")).toBe("enforce");
    expect(nextRaidMode("enforce")).toBe("observe");
  });
});

describe("deep link", () => {
  it("builds a start deep link", () => {
    expect(buildSettingsDeepLink("ModryvaBot", -100123n)).toBe(
      "https://t.me/ModryvaBot?start=cfg_-100123",
    );
  });
});

describe("panels", () => {
  const gid = -100123n;

  it("root offers every section and close", () => {
    const panel = renderSettingsRoot(gid, "Mi grupo");
    expect(panel.text).toContain("Mi grupo");
    const flat = JSON.stringify(panel.replyMarkup);
    for (const section of [
      "welcome",
      "rules",
      "flood",
      "captcha",
      "locks",
      "raid",
    ]) {
      expect(flat).toContain(`cfg:-100123:${section}:open`);
    }
    expect(flat).toContain("cfg:-100123:root:close");
  });

  it("welcome panel reflects active/inactive", () => {
    const off = renderWelcomePanel(gid, { welcomeText: null, rulesText: null });
    expect(off.text).toContain("❌ Desactivado");
    expect(JSON.stringify(off.replyMarkup)).toContain("✅ Activar");

    const on = renderWelcomePanel(gid, {
      welcomeText: "Hola {first_name}",
      rulesText: null,
    });
    expect(on.text).toContain("✅ Activado");
    expect(on.text).toContain("Hola {first_name}");
    expect(JSON.stringify(on.replyMarkup)).toContain("❌ Desactivar");
  });

  it("rules panel only shows clear when set", () => {
    const empty = renderRulesPanel(gid, { welcomeText: null, rulesText: null });
    expect(JSON.stringify(empty.replyMarkup)).not.toContain("rules:clear");

    const set = renderRulesPanel(gid, {
      welcomeText: null,
      rulesText: "No spam",
    });
    expect(set.text).toContain("No spam");
    expect(JSON.stringify(set.replyMarkup)).toContain(
      "cfg:-100123:rules:clear",
    );
  });

  it("flood panel shows limit and action", () => {
    const panel = renderFloodPanel(gid, {
      enabled: true,
      messageLimit: 7,
      windowSeconds: 10,
      action: "mute",
    });
    expect(panel.text).toContain("7");
    expect(panel.text).toContain("silenciar");
    const flat = JSON.stringify(panel.replyMarkup);
    expect(flat).toContain("cfg:-100123:flood:limitup");
    expect(flat).toContain("cfg:-100123:flood:limitdown");
    expect(flat).toContain("cfg:-100123:flood:action");
  });

  it("captcha panel shows mode and fail action", () => {
    const panel = renderCaptchaPanel(gid, {
      enabled: false,
      mode: "math",
      failAction: "ban",
    });
    expect(panel.text).toContain("matematico");
    expect(panel.text).toContain("banear");
    expect(JSON.stringify(panel.replyMarkup)).toContain(
      "cfg:-100123:captcha:mode",
    );
  });

  it("raid panel shows mode", () => {
    const panel = renderRaidPanel(gid, {
      enabled: true,
      mode: "enforce",
      joinLimit: 5,
      windowSeconds: 30,
    });
    expect(panel.text).toContain("aplicar");
    expect(JSON.stringify(panel.replyMarkup)).toContain(
      "cfg:-100123:raid:mode",
    );
  });

  it("locks panel renders every type as a toggle", () => {
    const panel = renderLocksPanel(gid, ["photo", "url"]);
    const flat = JSON.stringify(panel.replyMarkup);
    for (const type of LOCK_TYPES) {
      expect(flat).toContain(`cfg:-100123:lock:${type}`);
    }
    // Locked ones show 🔒, others 🔓.
    expect(flat).toContain("🔒 photo");
    expect(flat).toContain("🔓 text");
    expect(panel.text).toContain("photo");
  });

  it("closed panel has no keyboard", () => {
    const panel = renderSettingsClosed();
    expect(panel.replyMarkup).toEqual({ inline_keyboard: [] });
  });

  it("validates lock type values", () => {
    expect(isLockTypeValue("photo")).toBe(true);
    expect(isLockTypeValue("nope")).toBe(false);
  });
});
