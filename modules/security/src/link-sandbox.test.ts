import { describe, expect, it } from "vitest";
import { decideLinkSandbox } from "./link-sandbox.js";

const HELD_REASON =
  "🔒 Modo sandbox: el primer enlace de un usuario nuevo queda retenido hasta que un administrador lo valide.";
const ALLOWED_REASON = "✅ El enlace se puede publicar sin validacion previa.";

describe("decideLinkSandbox", () => {
  it("holds the first link of a new user", () => {
    expect(decideLinkSandbox({ isNewUser: true, isFirstLink: true })).toEqual({
      hold: true,
      reason: HELD_REASON,
    });
  });

  it("allows a new user whose link is not their first", () => {
    expect(decideLinkSandbox({ isNewUser: true, isFirstLink: false })).toEqual({
      hold: false,
      reason: ALLOWED_REASON,
    });
  });

  it("allows a trusted user posting their first link", () => {
    expect(decideLinkSandbox({ isNewUser: false, isFirstLink: true })).toEqual({
      hold: false,
      reason: ALLOWED_REASON,
    });
  });

  it("allows a trusted user posting a later link", () => {
    expect(decideLinkSandbox({ isNewUser: false, isFirstLink: false })).toEqual(
      {
        hold: false,
        reason: ALLOWED_REASON,
      },
    );
  });

  it("only holds when both conditions are true", () => {
    const combos = [
      { isNewUser: false, isFirstLink: false },
      { isNewUser: false, isFirstLink: true },
      { isNewUser: true, isFirstLink: false },
      { isNewUser: true, isFirstLink: true },
    ] as const;
    const holds = combos.map((c) => decideLinkSandbox(c).hold);
    expect(holds).toEqual([false, false, false, true]);
  });

  it("returns a Spanish held reason with accents and lock emoji", () => {
    const reason = decideLinkSandbox({
      isNewUser: true,
      isFirstLink: true,
    }).reason;
    expect(reason).toContain("🔒");
    expect(reason).toContain("administrador");
    expect(reason).toContain("valide");
  });

  it("is deterministic across repeated calls", () => {
    const input = { isNewUser: true, isFirstLink: true } as const;
    const first = decideLinkSandbox(input);
    const second = decideLinkSandbox(input);
    expect(first).toEqual(second);
  });

  it("does not mutate the input object", () => {
    const input = { isNewUser: true, isFirstLink: true };
    decideLinkSandbox(input);
    expect(input).toEqual({ isNewUser: true, isFirstLink: true });
  });
});
