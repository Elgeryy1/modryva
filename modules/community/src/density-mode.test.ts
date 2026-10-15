import { describe, expect, it } from "vitest";
import {
  DENSITY_MODES,
  type DensityMode,
  isDensityMode,
  resolveDensity,
} from "./density-mode.js";

describe("DENSITY_MODES", () => {
  it("contains exactly the three supported modes", () => {
    expect(DENSITY_MODES).toEqual(["normal", "compacto", "bateria"]);
  });

  it("has no duplicate entries", () => {
    expect(new Set(DENSITY_MODES).size).toBe(DENSITY_MODES.length);
  });
});

describe("isDensityMode", () => {
  it("accepts every declared mode", () => {
    for (const mode of DENSITY_MODES) {
      expect(isDensityMode(mode)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isDensityMode("denso")).toBe(false);
    expect(isDensityMode("")).toBe(false);
    expect(isDensityMode("low-battery")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isDensityMode("Normal")).toBe(false);
    expect(isDensityMode("BATERIA")).toBe(false);
  });

  it("does not trim surrounding whitespace", () => {
    expect(isDensityMode(" normal")).toBe(false);
    expect(isDensityMode("compacto ")).toBe(false);
  });
});

describe("resolveDensity", () => {
  it("resolves 'normal' to the balanced defaults", () => {
    expect(resolveDensity("normal")).toEqual({
      blur: true,
      animations: true,
      rowsPerScreen: 8,
      images: true,
    });
  });

  it("resolves 'compacto' to more rows without blur", () => {
    expect(resolveDensity("compacto")).toEqual({
      blur: false,
      animations: true,
      rowsPerScreen: 14,
      images: true,
    });
  });

  it("resolves 'bateria' to the power-saving profile", () => {
    expect(resolveDensity("bateria")).toEqual({
      blur: false,
      animations: false,
      rowsPerScreen: 12,
      images: false,
    });
  });

  it("falls back to the 'normal' profile for unknown modes", () => {
    expect(resolveDensity("desconocido")).toEqual(resolveDensity("normal"));
    expect(resolveDensity("")).toEqual(resolveDensity("normal"));
  });

  it("disables blur outside of the normal mode", () => {
    expect(resolveDensity("compacto").blur).toBe(false);
    expect(resolveDensity("bateria").blur).toBe(false);
    expect(resolveDensity("normal").blur).toBe(true);
  });

  it("only the bateria profile disables images and animations", () => {
    const battery = resolveDensity("bateria");
    expect(battery.images).toBe(false);
    expect(battery.animations).toBe(false);
    expect(resolveDensity("normal").images).toBe(true);
    expect(resolveDensity("compacto").images).toBe(true);
  });

  it("gives compacto the most rows per screen", () => {
    const rows = DENSITY_MODES.map((m) => resolveDensity(m).rowsPerScreen);
    const max = Math.max(...rows);
    expect(resolveDensity("compacto").rowsPerScreen).toBe(max);
  });

  it("returns positive integer row counts for every mode", () => {
    for (const mode of DENSITY_MODES) {
      const rows = resolveDensity(mode).rowsPerScreen;
      expect(Number.isInteger(rows)).toBe(true);
      expect(rows).toBeGreaterThan(0);
    }
  });

  it("is deterministic across repeated calls", () => {
    expect(resolveDensity("bateria")).toEqual(resolveDensity("bateria"));
    expect(resolveDensity("compacto")).toEqual(resolveDensity("compacto"));
  });

  it("returns a fresh object on each call (equal but not identical)", () => {
    const first = resolveDensity("normal");
    const second = resolveDensity("normal");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("resolves every declared mode to a complete settings object", () => {
    for (const mode of DENSITY_MODES) {
      const settings = resolveDensity(mode);
      expect(typeof settings.blur).toBe("boolean");
      expect(typeof settings.animations).toBe("boolean");
      expect(typeof settings.images).toBe("boolean");
      expect(typeof settings.rowsPerScreen).toBe("number");
    }
  });

  it("keeps isDensityMode and resolveDensity consistent", () => {
    const candidate: string = "bateria";
    if (isDensityMode(candidate)) {
      const narrowed: DensityMode = candidate;
      expect(DENSITY_MODES).toContain(narrowed);
      expect(resolveDensity(narrowed).images).toBe(false);
    }
  });
});
