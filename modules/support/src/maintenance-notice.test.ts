import { describe, expect, it } from "vitest";
import { buildMaintenanceNotice } from "./maintenance-notice.js";

const base = { startMs: 1000, durationMin: 10 };

describe("buildMaintenanceNotice", () => {
  it("reports proximo before the start", () => {
    expect(buildMaintenanceNotice({ ...base, nowMs: 500 }).phase).toBe(
      "proximo",
    );
  });

  it("reports en_curso during the window", () => {
    expect(buildMaintenanceNotice({ ...base, nowMs: 1000 }).phase).toBe(
      "en_curso",
    );
    expect(
      buildMaintenanceNotice({ ...base, nowMs: 1000 + 5 * 60000 }).phase,
    ).toBe("en_curso");
  });

  it("reports finalizado at or after the end", () => {
    expect(
      buildMaintenanceNotice({ ...base, nowMs: 1000 + 10 * 60000 }).phase,
    ).toBe("finalizado");
  });

  it("includes a user-facing message", () => {
    expect(
      buildMaintenanceNotice({ ...base, nowMs: 500 }).message.length,
    ).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const input = { ...base, nowMs: 1000 };
    expect(buildMaintenanceNotice(input)).toEqual(
      buildMaintenanceNotice(input),
    );
  });
});
