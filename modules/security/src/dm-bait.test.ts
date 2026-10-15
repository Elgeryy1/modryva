import { describe, expect, it } from "vitest";
import { detectDmBait } from "./dm-bait.js";

describe("detectDmBait", () => {
  it("detects a single phrase ignoring caps, accents and emojis", () => {
    expect(detectDmBait("Mándame DM ahora mismo 😉")).toEqual({
      matched: true,
      phrases: ["mandame dm"],
    });
  });

  it("matches accented variants like escribeme por privado", () => {
    expect(detectDmBait("Escríbeme por privado y hablamos")).toEqual({
      matched: true,
      phrases: ["escribeme por privado"],
    });
  });

  it("returns phrases in DM_BAIT_PHRASES order, not text order", () => {
    expect(detectDmBait("Te escribo al privado, mándame DM")).toEqual({
      matched: true,
      phrases: ["mandame dm", "te escribo al privado"],
    });
  });

  it("deduplicates a phrase that appears several times", () => {
    expect(detectDmBait("mandame dm, en serio, mándame DM")).toEqual({
      matched: true,
      phrases: ["mandame dm"],
    });
  });

  it("collapses internal whitespace before matching", () => {
    expect(detectDmBait("hablame\n\tpor   dm")).toEqual({
      matched: true,
      phrases: ["hablame por dm"],
    });
  });

  it("fires every phrase when all are present", () => {
    expect(
      detectDmBait(
        "mándame dm, escríbeme por privado, te escribo al privado, háblame por dm, contáctame en privado",
      ),
    ).toEqual({
      matched: true,
      phrases: [
        "mandame dm",
        "escribeme por privado",
        "te escribo al privado",
        "hablame por dm",
        "contactame en privado",
      ],
    });
  });

  it("returns no match for clean text", () => {
    expect(detectDmBait("Hola, ¿cómo estás hoy?")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles undefined", () => {
    expect(detectDmBait(undefined)).toEqual({ matched: false, phrases: [] });
  });

  it("handles an empty string", () => {
    expect(detectDmBait("")).toEqual({ matched: false, phrases: [] });
  });

  it("handles a whitespace-only string", () => {
    expect(detectDmBait("   \n\t  ")).toEqual({ matched: false, phrases: [] });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const text = "Te escribo al privado, mándame DM";
    expect(detectDmBait(text)).toEqual(detectDmBait(text));
  });
});
