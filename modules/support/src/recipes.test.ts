import { describe, expect, it } from "vitest";
import {
  CONFIG_RECIPE_PREFIX,
  type ConfigRecipeChange,
  decodeConfigRecipe,
  diffConfigRecipe,
  encodeConfigRecipe,
} from "./recipes.js";

describe("encodeConfigRecipe", () => {
  it("prefixes the token with the version marker", () => {
    const token = encodeConfigRecipe({ welcome: true });
    expect(token.startsWith(CONFIG_RECIPE_PREFIX)).toBe(true);
  });

  it("produces base64url characters only in the body", () => {
    const body = encodeConfigRecipe({ a: 1, b: "hola mundo" }).slice(
      CONFIG_RECIPE_PREFIX.length,
    );
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is deterministic regardless of key order", () => {
    const first = encodeConfigRecipe({ a: 1, b: 2, c: 3 });
    const second = encodeConfigRecipe({ c: 3, b: 2, a: 1 });
    expect(first).toBe(second);
  });

  it("orders nested object keys stably", () => {
    const first = encodeConfigRecipe({ nested: { x: 1, y: 2 } });
    const second = encodeConfigRecipe({ nested: { y: 2, x: 1 } });
    expect(first).toBe(second);
  });

  it("encodes an empty config", () => {
    const token = encodeConfigRecipe({});
    expect(token.length).toBeGreaterThan(CONFIG_RECIPE_PREFIX.length);
  });
});

describe("decodeConfigRecipe", () => {
  it("round-trips a config with mixed value types", () => {
    const config = {
      welcome: true,
      antiflood: 5,
      rules: "no spam",
      tags: ["a", "b"],
      nested: { deep: { flag: false } },
      empty: null,
    };
    const result = decodeConfigRecipe(encodeConfigRecipe(config));
    expect(result).toEqual({ ok: true, config });
  });

  it("round-trips unicode and accented text", () => {
    const config = { motd: "Bienvenido, corazon 💤 café" };
    const result = decodeConfigRecipe(encodeConfigRecipe(config));
    expect(result.ok && result.config).toEqual(config);
  });

  it("tolerates surrounding whitespace", () => {
    const token = encodeConfigRecipe({ a: 1 });
    expect(decodeConfigRecipe(`  ${token}  `)).toEqual({
      ok: true,
      config: { a: 1 },
    });
  });

  it("rejects an unknown version prefix", () => {
    const result = decodeConfigRecipe("r9.abcdef");
    expect(result).toEqual({
      ok: false,
      error: "prefijo de version desconocido",
    });
  });

  it("rejects a token without the prefix", () => {
    const result = decodeConfigRecipe("just-some-text");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty body after the prefix", () => {
    const result = decodeConfigRecipe(CONFIG_RECIPE_PREFIX);
    expect(result).toEqual({ ok: false, error: "receta vacia" });
  });

  it("rejects invalid base64url characters", () => {
    const result = decodeConfigRecipe(`${CONFIG_RECIPE_PREFIX}not*valid*`);
    expect(result).toEqual({
      ok: false,
      error: "codificacion base64url invalida",
    });
  });

  it("rejects a payload that is not a plain object", () => {
    const arrayToken = encodeConfigRecipe([1, 2, 3] as unknown as Record<
      string,
      unknown
    >);
    expect(decodeConfigRecipe(arrayToken)).toEqual({
      ok: false,
      error: "la receta no es un objeto de config",
    });
  });

  it("rejects a primitive JSON payload", () => {
    const numberToken = encodeConfigRecipe(
      42 as unknown as Record<string, unknown>,
    );
    const result = decodeConfigRecipe(numberToken);
    expect(result.ok).toBe(false);
  });
});

describe("diffConfigRecipe", () => {
  it("returns no changes for identical configs", () => {
    const config = { a: 1, b: { c: 2 } };
    expect(diffConfigRecipe(config, { a: 1, b: { c: 2 } })).toEqual([]);
  });

  it("reports changed values with from and to", () => {
    const changes = diffConfigRecipe({ antiflood: 3 }, { antiflood: 7 });
    expect(changes).toEqual<ConfigRecipeChange[]>([
      { key: "antiflood", from: 3, to: 7 },
    ]);
  });

  it("reports added keys with from undefined", () => {
    const changes = diffConfigRecipe({}, { welcome: true });
    expect(changes).toEqual<ConfigRecipeChange[]>([
      { key: "welcome", from: undefined, to: true },
    ]);
  });

  it("ignores keys present only in current", () => {
    const changes = diffConfigRecipe({ legacy: 1 }, { antiflood: 2 });
    expect(changes).toEqual<ConfigRecipeChange[]>([
      { key: "antiflood", from: undefined, to: 2 },
    ]);
  });

  it("detects structural changes in nested objects", () => {
    const changes = diffConfigRecipe(
      { rules: { spam: true } },
      { rules: { spam: false } },
    );
    expect(changes).toEqual<ConfigRecipeChange[]>([
      { key: "rules", from: { spam: true }, to: { spam: false } },
    ]);
  });

  it("treats nested objects with reordered keys as equal", () => {
    const changes = diffConfigRecipe(
      { rules: { a: 1, b: 2 } },
      { rules: { b: 2, a: 1 } },
    );
    expect(changes).toEqual([]);
  });

  it("orders changes by key alphabetically and is deterministic", () => {
    const changes = diffConfigRecipe({}, { zeta: 1, alpha: 2, mid: 3 });
    expect(changes.map((change) => change.key)).toEqual([
      "alpha",
      "mid",
      "zeta",
    ]);
  });

  it("distinguishes null from missing", () => {
    const changes = diffConfigRecipe({ a: null }, { a: null });
    expect(changes).toEqual([]);
  });
});
