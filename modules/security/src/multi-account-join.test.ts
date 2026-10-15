import { describe, expect, it } from "vitest";
import { detectMultiAccountJoin } from "./multi-account-join.js";

describe("detectMultiAccountJoin", () => {
  it("flags three similar names joining within the window", () => {
    expect(
      detectMultiAccountJoin([
        { name: "Ivan01", joinMs: 1000 },
        { name: "Ivan02", joinMs: 2000 },
        { name: "Ivan03", joinMs: 3000 },
      ]),
    ).toEqual({ suspicious: true, clusterSize: 3, clusterPrefix: "ivan" });
  });

  it("does not flag similar names spread beyond the window", () => {
    expect(
      detectMultiAccountJoin([
        { name: "Ivan01", joinMs: 0 },
        { name: "Ivan02", joinMs: 100000 },
        { name: "Ivan03", joinMs: 200000 },
      ]),
    ).toEqual({ suspicious: false, clusterSize: 1, clusterPrefix: "ivan" });
  });

  it("does not cluster accounts with different prefixes", () => {
    expect(
      detectMultiAccountJoin([
        { name: "Alice", joinMs: 1000 },
        { name: "Bruno", joinMs: 1100 },
        { name: "Carla", joinMs: 1200 },
      ]),
    ).toEqual({ suspicious: false, clusterSize: 1, clusterPrefix: "alic" });
  });

  it("returns an empty verdict for no joins", () => {
    expect(detectMultiAccountJoin([])).toEqual({
      suspicious: false,
      clusterSize: 0,
      clusterPrefix: "",
    });
  });

  it("skips names shorter than the prefix length", () => {
    expect(
      detectMultiAccountJoin([
        { name: "ab", joinMs: 1000 },
        { name: "abc", joinMs: 2000 },
        { name: "ab", joinMs: 3000 },
      ]),
    ).toEqual({ suspicious: false, clusterSize: 0, clusterPrefix: "" });
  });

  it("normalizes accents so accented names cluster", () => {
    expect(
      detectMultiAccountJoin([
        { name: "Iván1", joinMs: 1000 },
        { name: "Ivan2", joinMs: 2000 },
        { name: "IVAN3", joinMs: 3000 },
      ]),
    ).toEqual({ suspicious: true, clusterSize: 3, clusterPrefix: "ivan" });
  });

  it("lowers the threshold with a custom minCluster", () => {
    expect(
      detectMultiAccountJoin(
        [
          { name: "Botito1", joinMs: 1000 },
          { name: "Botito2", joinMs: 2000 },
        ],
        { minCluster: 2 },
      ),
    ).toEqual({ suspicious: true, clusterSize: 2, clusterPrefix: "boti" });
  });

  it("respects a tighter custom window", () => {
    expect(
      detectMultiAccountJoin(
        [
          { name: "Ivan01", joinMs: 1000 },
          { name: "Ivan02", joinMs: 2000 },
          { name: "Ivan03", joinMs: 3000 },
        ],
        { windowMs: 1000 },
      ),
    ).toEqual({ suspicious: false, clusterSize: 2, clusterPrefix: "ivan" });
  });

  it("is independent of input ordering", () => {
    const shuffled = detectMultiAccountJoin([
      { name: "Ivan03", joinMs: 3000 },
      { name: "Ivan01", joinMs: 1000 },
      { name: "Ivan02", joinMs: 2000 },
    ]);
    expect(shuffled).toEqual({
      suspicious: true,
      clusterSize: 3,
      clusterPrefix: "ivan",
    });
  });

  it("reports the largest cluster when several groups are present", () => {
    expect(
      detectMultiAccountJoin([
        { name: "Spam01", joinMs: 1000 },
        { name: "Spam02", joinMs: 1500 },
        { name: "Spam03", joinMs: 2000 },
        { name: "Ivan01", joinMs: 1000 },
        { name: "Ivan02", joinMs: 1200 },
      ]),
    ).toEqual({ suspicious: true, clusterSize: 3, clusterPrefix: "spam" });
  });

  it("treats a single qualifying join as a cluster of one", () => {
    expect(detectMultiAccountJoin([{ name: "Alberto", joinMs: 1000 }])).toEqual(
      { suspicious: false, clusterSize: 1, clusterPrefix: "albe" },
    );
  });
});
