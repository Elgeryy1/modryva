import { describe, expect, it } from "vitest";
import { detectStaleStaffRoles } from "./stale-staff.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 180 * DAY_MS;

describe("detectStaleStaffRoles", () => {
  it("flags a role older than the default 180-day max", () => {
    const now = 200 * DAY_MS;
    expect(detectStaleStaffRoles([{ staffId: 1, grantedMs: 0 }], now)).toEqual([
      { staffId: 1, ageMs: 200 * DAY_MS },
    ]);
  });

  it("does not flag a role younger than the default max", () => {
    const now = 100 * DAY_MS;
    expect(detectStaleStaffRoles([{ staffId: 1, grantedMs: 0 }], now)).toEqual(
      [],
    );
  });

  it("does not flag a role exactly at the boundary (strictly greater)", () => {
    const now = DEFAULT_MAX_AGE_MS;
    expect(detectStaleStaffRoles([{ staffId: 7, grantedMs: 0 }], now)).toEqual(
      [],
    );
  });

  it("flags a role one millisecond past the boundary", () => {
    const now = DEFAULT_MAX_AGE_MS + 1;
    expect(detectStaleStaffRoles([{ staffId: 7, grantedMs: 0 }], now)).toEqual([
      { staffId: 7, ageMs: DEFAULT_MAX_AGE_MS + 1 },
    ]);
  });

  it("sorts by ageMs descending", () => {
    const now = 300 * DAY_MS;
    const result = detectStaleStaffRoles(
      [
        { staffId: 1, grantedMs: 50 * DAY_MS },
        { staffId: 2, grantedMs: 0 },
        { staffId: 3, grantedMs: 100 * DAY_MS },
      ],
      now,
    );
    expect(result).toEqual([
      { staffId: 2, ageMs: 300 * DAY_MS },
      { staffId: 1, ageMs: 250 * DAY_MS },
      { staffId: 3, ageMs: 200 * DAY_MS },
    ]);
  });

  it("breaks ties on equal ageMs by staffId ascending", () => {
    const now = 200 * DAY_MS;
    const result = detectStaleStaffRoles(
      [
        { staffId: 9, grantedMs: 0 },
        { staffId: 4, grantedMs: 0 },
        { staffId: 6, grantedMs: 0 },
      ],
      now,
    );
    expect(result).toEqual([
      { staffId: 4, ageMs: 200 * DAY_MS },
      { staffId: 6, ageMs: 200 * DAY_MS },
      { staffId: 9, ageMs: 200 * DAY_MS },
    ]);
  });

  it("honors a custom maxAgeMs", () => {
    const now = 40 * DAY_MS;
    const result = detectStaleStaffRoles([{ staffId: 1, grantedMs: 0 }], now, {
      maxAgeMs: 30 * DAY_MS,
    });
    expect(result).toEqual([{ staffId: 1, ageMs: 40 * DAY_MS }]);
  });

  it("returns an empty list for empty input", () => {
    expect(detectStaleStaffRoles([], 500 * DAY_MS)).toEqual([]);
  });

  it("ignores roles granted in the future (negative age)", () => {
    const now = 10 * DAY_MS;
    expect(
      detectStaleStaffRoles([{ staffId: 1, grantedMs: 50 * DAY_MS }], now),
    ).toEqual([]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const now = 400 * DAY_MS;
    const input = [
      { staffId: 2, grantedMs: 0 },
      { staffId: 1, grantedMs: 0 },
    ] as const;
    const first = detectStaleStaffRoles(input, now);
    const second = detectStaleStaffRoles(input, now);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { staffId: 1, ageMs: 400 * DAY_MS },
      { staffId: 2, ageMs: 400 * DAY_MS },
    ]);
  });
});
