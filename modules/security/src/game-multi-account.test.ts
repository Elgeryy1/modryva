import { describe, expect, it } from "vitest";
import {
  detectGameMultiAccounts,
  type GameMultiAccountPlayer,
} from "./game-multi-account.js";

describe("detectGameMultiAccounts", () => {
  it("groups players sharing ip and deviceHash with ids sorted ascending", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "u3", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "u1", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "u2", ip: "1.1.1.1", deviceHash: "dev-a" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([
      { key: "1.1.1.1|dev-a", ids: ["u1", "u2", "u3"] },
    ]);
  });

  it("returns empty for an empty input", () => {
    expect(detectGameMultiAccounts([])).toEqual([]);
  });

  it("ignores players with unique signals", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "a", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "b", ip: "2.2.2.2", deviceHash: "dev-b" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([]);
  });

  it("does not group when only the ip matches", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "a", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "b", ip: "1.1.1.1", deviceHash: "dev-b" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([]);
  });

  it("does not group when only the deviceHash matches", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "a", ip: "1.1.1.1", deviceHash: "dev-x" },
      { id: "b", ip: "9.9.9.9", deviceHash: "dev-x" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([]);
  });

  it("de-duplicates repeated ids within a group", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "u1", ip: "5.5.5.5", deviceHash: "dev-z" },
      { id: "u1", ip: "5.5.5.5", deviceHash: "dev-z" },
      { id: "u2", ip: "5.5.5.5", deviceHash: "dev-z" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([
      { key: "5.5.5.5|dev-z", ids: ["u1", "u2"] },
    ]);
  });

  it("orders groups by size descending", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "b1", ip: "2.2.2.2", deviceHash: "dev-b" },
      { id: "b2", ip: "2.2.2.2", deviceHash: "dev-b" },
      { id: "a1", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "a2", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "a3", ip: "1.1.1.1", deviceHash: "dev-a" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([
      { key: "1.1.1.1|dev-a", ids: ["a1", "a2", "a3"] },
      { key: "2.2.2.2|dev-b", ids: ["b1", "b2"] },
    ]);
  });

  it("breaks size ties by key ascending", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "z1", ip: "2.2.2.2", deviceHash: "dev-b" },
      { id: "z2", ip: "2.2.2.2", deviceHash: "dev-b" },
      { id: "y1", ip: "1.1.1.1", deviceHash: "dev-c" },
      { id: "y2", ip: "1.1.1.1", deviceHash: "dev-c" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([
      { key: "1.1.1.1|dev-c", ids: ["y1", "y2"] },
      { key: "2.2.2.2|dev-b", ids: ["z1", "z2"] },
    ]);
  });

  it("is order-independent for the same set of players", () => {
    const ordered: readonly GameMultiAccountPlayer[] = [
      { id: "a1", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "a2", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "b1", ip: "2.2.2.2", deviceHash: "dev-b" },
      { id: "b2", ip: "2.2.2.2", deviceHash: "dev-b" },
    ];
    const shuffled: readonly GameMultiAccountPlayer[] = [
      { id: "b2", ip: "2.2.2.2", deviceHash: "dev-b" },
      { id: "a2", ip: "1.1.1.1", deviceHash: "dev-a" },
      { id: "b1", ip: "2.2.2.2", deviceHash: "dev-b" },
      { id: "a1", ip: "1.1.1.1", deviceHash: "dev-a" },
    ];
    expect(detectGameMultiAccounts(shuffled)).toEqual(
      detectGameMultiAccounts(ordered),
    );
  });

  it("handles a single player without flagging anything", () => {
    const players: readonly GameMultiAccountPlayer[] = [
      { id: "solo", ip: "3.3.3.3", deviceHash: "dev-solo" },
    ];
    expect(detectGameMultiAccounts(players)).toEqual([]);
  });
});
