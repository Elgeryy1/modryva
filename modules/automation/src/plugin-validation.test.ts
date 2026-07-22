import { describe, expect, it } from "vitest";
import {
  PLUGIN_ALLOWED_SCOPES,
  type PluginManifest,
  pluginScopeIsWrite,
  validatePluginManifest,
} from "./plugin-validation.js";

const manifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  name: "welcome-plugin",
  scopes: ["messages.read"],
  readOnly: true,
  requiresApproval: false,
  ...overrides,
});

describe("PLUGIN_ALLOWED_SCOPES", () => {
  it("has no duplicate scopes", () => {
    expect(new Set(PLUGIN_ALLOWED_SCOPES).size).toBe(
      PLUGIN_ALLOWED_SCOPES.length,
    );
  });

  it("includes both read and write variants", () => {
    expect(PLUGIN_ALLOWED_SCOPES).toContain("messages.read");
    expect(PLUGIN_ALLOWED_SCOPES).toContain("messages.write");
  });
});

describe("pluginScopeIsWrite", () => {
  it("is true for .write scopes", () => {
    expect(pluginScopeIsWrite("messages.write")).toBe(true);
    expect(pluginScopeIsWrite("config.write")).toBe(true);
  });

  it("is false for read scopes", () => {
    expect(pluginScopeIsWrite("messages.read")).toBe(false);
    expect(pluginScopeIsWrite("members.read")).toBe(false);
  });
});

describe("validatePluginManifest", () => {
  it("accepts a read-only manifest with a known read scope", () => {
    const result = validatePluginManifest(manifest());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("accepts a write manifest that requires approval and is not read-only", () => {
    const result = validatePluginManifest(
      manifest({
        scopes: ["messages.read", "messages.write"],
        readOnly: false,
        requiresApproval: true,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects an empty name", () => {
    const result = validatePluginManifest(manifest({ name: "" }));
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "El nombre del plugin no puede estar vacio.",
    );
  });

  it("rejects a whitespace-only name", () => {
    const result = validatePluginManifest(manifest({ name: "   " }));
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "El nombre del plugin no puede estar vacio.",
    );
  });

  it("rejects an unknown scope", () => {
    const result = validatePluginManifest(
      manifest({ scopes: ["messages.read", "wallet.drain"] }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('Scope desconocido: "wallet.drain".');
  });

  it("rejects duplicate scopes", () => {
    const result = validatePluginManifest(
      manifest({ scopes: ["messages.read", "messages.read"] }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('Scope duplicado: "messages.read".');
  });

  it("rejects a write scope declared as read-only", () => {
    const result = validatePluginManifest(
      manifest({
        scopes: ["messages.write"],
        readOnly: true,
        requiresApproval: true,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "El manifiesto declara scopes de escritura pero esta marcado como solo lectura.",
    );
  });

  it("rejects write without approval", () => {
    const result = validatePluginManifest(
      manifest({
        scopes: ["config.write"],
        readOnly: false,
        requiresApproval: false,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "Un plugin con escritura debe requerir aprobacion.",
    );
  });

  it("does not require approval for a read-only manifest", () => {
    const result = validatePluginManifest(
      manifest({
        scopes: ["messages.read", "members.read"],
        readOnly: true,
        requiresApproval: false,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("accepts an empty scopes list with a valid name", () => {
    const result = validatePluginManifest(
      manifest({ scopes: [], readOnly: true }),
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("skips the duplicate check for unknown scopes", () => {
    const result = validatePluginManifest(
      manifest({ scopes: ["bad.scope", "bad.scope"] }),
    );
    const unknownCount = result.issues.filter((i) =>
      i.startsWith("Scope desconocido"),
    ).length;
    expect(unknownCount).toBe(2);
    expect(result.issues.some((i) => i.startsWith("Scope duplicado"))).toBe(
      false,
    );
  });

  it("accumulates multiple issues at once", () => {
    const result = validatePluginManifest(
      manifest({
        name: "",
        scopes: ["nope.read", "messages.write"],
        readOnly: false,
        requiresApproval: false,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves issue order derived from scope order", () => {
    const result = validatePluginManifest(
      manifest({
        name: "",
        scopes: ["aaa.read", "bbb.read"],
        readOnly: true,
      }),
    );
    expect(result.issues[0]).toBe("El nombre del plugin no puede estar vacio.");
    expect(result.issues[1]).toBe('Scope desconocido: "aaa.read".');
    expect(result.issues[2]).toBe('Scope desconocido: "bbb.read".');
  });

  it("is deterministic for identical inputs", () => {
    const input = manifest({
      scopes: ["messages.write", "config.write"],
      readOnly: false,
      requiresApproval: false,
    });
    expect(validatePluginManifest(input)).toEqual(
      validatePluginManifest(input),
    );
  });

  it("flags write-as-read-only and missing approval independently", () => {
    const readOnlyResult = validatePluginManifest(
      manifest({
        scopes: ["moderation.write"],
        readOnly: true,
        requiresApproval: false,
      }),
    );
    expect(
      readOnlyResult.issues.some((i) =>
        i.startsWith("El manifiesto declara scopes de escritura"),
      ),
    ).toBe(true);
    expect(
      readOnlyResult.issues.some((i) =>
        i.startsWith("Un plugin con escritura debe requerir aprobacion"),
      ),
    ).toBe(false);
  });
});
