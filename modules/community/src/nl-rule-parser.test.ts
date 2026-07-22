import { describe, expect, it } from "vitest";
import { parseNaturalRule } from "./nl-rule-parser.js";

describe("parseNaturalRule", () => {
  it("parses the canonical full rule", () => {
    expect(
      parseNaturalRule("bloquea links de usuarios nuevos durante 24 horas"),
    ).toEqual({
      action: "bloquear",
      target: "links",
      scope: "nuevos",
      durationMs: 86_400_000,
      ok: true,
    });
  });

  it("parses permitir with scope todos and minutes", () => {
    expect(
      parseNaturalRule("permite media para todos durante 30 minutos"),
    ).toEqual({
      action: "permitir",
      target: "media",
      scope: "todos",
      durationMs: 1_800_000,
      ok: true,
    });
  });

  it("parses silenciar menciones with a days duration and no scope", () => {
    expect(parseNaturalRule("silencia menciones durante 2 dias")).toEqual({
      action: "silenciar",
      target: "menciones",
      durationMs: 172_800_000,
      ok: true,
    });
  });

  it("handles accented input by stripping diacritics", () => {
    expect(
      parseNaturalRule("silencia menciones de usuarios nuevos durante 3 días"),
    ).toEqual({
      action: "silenciar",
      target: "menciones",
      scope: "nuevos",
      durationMs: 259_200_000,
      ok: true,
    });
  });

  it("is not ok when a target is missing but keeps the action and scope", () => {
    expect(parseNaturalRule("bloquea a todos")).toEqual({
      action: "bloquear",
      scope: "todos",
      ok: false,
    });
  });

  it("omits durationMs when no duration clause is present", () => {
    expect(parseNaturalRule("bloquea links")).toEqual({
      action: "bloquear",
      target: "links",
      ok: true,
    });
  });

  it("ignores a duration with an amount of zero", () => {
    const result = parseNaturalRule("bloquea links durante 0 horas");
    expect(result.durationMs).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("returns not ok for unrecognized text", () => {
    expect(parseNaturalRule("hola que tal")).toEqual({ ok: false });
  });

  it("returns not ok for an empty string", () => {
    expect(parseNaturalRule("")).toEqual({ ok: false });
  });

  it("returns not ok for undefined", () => {
    expect(parseNaturalRule(undefined)).toEqual({ ok: false });
  });

  it("is deterministic across repeated calls", () => {
    const input = "prohibe enlaces de usuarios nuevos durante 12 horas";
    expect(parseNaturalRule(input)).toEqual(parseNaturalRule(input));
  });
});
