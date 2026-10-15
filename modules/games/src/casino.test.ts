import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { diceMultiplier, parseCasinoCommand, resolveDice } from "./casino.js";

const cmd = (name: string, args: string[] = []): TelegramUpdateEnvelope =>
  ({ command: { name, args } }) as unknown as TelegramUpdateEnvelope;

describe("casino dice math", () => {
  it("prices bets by win chance with a 2% edge", () => {
    // 50% chance → ~1.96x, 25% chance → ~3.92x, 10% chance → ~9.8x.
    expect(diceMultiplier("bajo", 50)).toBeCloseTo(1.96, 2);
    expect(diceMultiplier("bajo", 25)).toBeCloseTo(3.92, 2);
    expect(diceMultiplier("alto", 90)).toBeCloseTo(9.8, 2);
    // Impossible targets pay nothing.
    expect(diceMultiplier("bajo", 100)).toBe(0);
  });

  it("resolves provably-fair, deterministic, in range", () => {
    const a = resolveDice("srv", "cli", 1, "bajo", 50);
    const b = resolveDice("srv", "cli", 1, "bajo", 50);
    expect(a).toEqual(b);
    expect(a.detail.roll).toBeGreaterThanOrEqual(0);
    expect(a.detail.roll).toBeLessThan(100);
    // A win pays the target's multiplier; a loss pays 0.
    expect(a.multiplier).toBe(a.detail.win ? diceMultiplier("bajo", 50) : 0);
  });

  it("bajo wins under target, alto wins at/above target", () => {
    // Search nonces to find a low and a high roll and check the win logic.
    for (let nonce = 0; nonce < 50; nonce += 1) {
      const r = resolveDice("s", "c", nonce, "bajo", 50);
      expect(r.detail.win).toBe(r.detail.roll < 50);
      const h = resolveDice("s", "c", nonce, "alto", 50);
      expect(h.detail.win).toBe(h.detail.roll >= 50);
    }
  });
});

describe("casino command parsing", () => {
  it("parses wallet / daily / verify / help aliases", () => {
    expect(parseCasinoCommand(cmd("cartera"))).toEqual({
      ok: true,
      command: { kind: "wallet" },
    });
    expect(parseCasinoCommand(cmd("bono"))).toEqual({
      ok: true,
      command: { kind: "daily" },
    });
    expect(parseCasinoCommand(cmd("verificar"))).toEqual({
      ok: true,
      command: { kind: "verify" },
    });
    expect(parseCasinoCommand(cmd("casino"))).toEqual({
      ok: true,
      command: { kind: "help" },
    });
  });

  it("returns null for unrelated commands so the chain continues", () => {
    expect(parseCasinoCommand(cmd("ban"))).toBeNull();
    expect(parseCasinoCommand(cmd("dice"))).toBeNull(); // native fun dice, not ours
  });

  it("parses a dice bet with defaults and explicit args", () => {
    expect(parseCasinoCommand(cmd("dado", ["100"]))).toEqual({
      ok: true,
      command: { kind: "dice", stake: 100, side: "bajo", target: 50 },
    });
    expect(parseCasinoCommand(cmd("dado", ["250", "alto", "70"]))).toEqual({
      ok: true,
      command: { kind: "dice", stake: 250, side: "alto", target: 70 },
    });
  });

  it("rejects malformed dice bets with a usage hint", () => {
    const bad = parseCasinoCommand(cmd("dado", ["abc"]));
    expect(bad?.ok).toBe(false);
    const badTarget = parseCasinoCommand(cmd("dado", ["100", "bajo", "150"]));
    expect(badTarget?.ok).toBe(false);
  });
});
