import { describe, expect, it } from "vitest";
import {
  type AdminPerms,
  adminActedRecently,
  adminHasDangerousPermission,
  adminModerates,
  findExcessPermissions,
  PERM_AUDIT_REASONS,
} from "./permission-audit.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const admin = (overrides: Partial<AdminPerms> = {}): AdminPerms => {
  const { lastActionMs, ...rest } = overrides;
  return {
    userId: "u1",
    canBan: false,
    canDelete: false,
    canPin: false,
    canPromote: false,
    ...rest,
    ...(lastActionMs !== undefined ? { lastActionMs } : {}),
  };
};

const NOW = 10 * DAY;
const STALE = 7 * DAY;

describe("adminModerates", () => {
  it("is true when the admin can ban", () => {
    expect(adminModerates(admin({ canBan: true }))).toBe(true);
  });

  it("is true when the admin can delete", () => {
    expect(adminModerates(admin({ canDelete: true }))).toBe(true);
  });

  it("is false with only pin or promote", () => {
    expect(adminModerates(admin({ canPin: true, canPromote: true }))).toBe(
      false,
    );
  });
});

describe("adminHasDangerousPermission", () => {
  it("flags ban, delete and promote as dangerous", () => {
    expect(adminHasDangerousPermission(admin({ canBan: true }))).toBe(true);
    expect(adminHasDangerousPermission(admin({ canDelete: true }))).toBe(true);
    expect(adminHasDangerousPermission(admin({ canPromote: true }))).toBe(true);
  });

  it("does not treat pin alone as dangerous", () => {
    expect(adminHasDangerousPermission(admin({ canPin: true }))).toBe(false);
  });

  it("is false for an admin with no powers", () => {
    expect(adminHasDangerousPermission(admin())).toBe(false);
  });
});

describe("adminActedRecently", () => {
  it("is true when the last action is within the window", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW - HOUR }), NOW, STALE),
    ).toBe(true);
  });

  it("is true exactly at the window edge", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW - STALE }), NOW, STALE),
    ).toBe(true);
  });

  it("is false just past the window edge", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW - STALE - 1 }), NOW, STALE),
    ).toBe(false);
  });

  it("is false when the admin never acted", () => {
    expect(adminActedRecently(admin(), NOW, STALE)).toBe(false);
  });

  it("treats a future action timestamp as recent", () => {
    expect(
      adminActedRecently(admin({ lastActionMs: NOW + HOUR }), NOW, STALE),
    ).toBe(true);
  });

  it("treats action-now as recent with a zero window", () => {
    expect(adminActedRecently(admin({ lastActionMs: NOW }), NOW, 0)).toBe(true);
  });
});

describe("findExcessPermissions", () => {
  it("returns empty for no admins", () => {
    expect(findExcessPermissions([], NOW, STALE)).toEqual([]);
  });

  it("flags a promoter that does not moderate", () => {
    const result = findExcessPermissions(
      [admin({ userId: "p", canPromote: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "p", reason: PERM_AUDIT_REASONS.promoteWithoutModeration },
    ]);
  });

  it("does not flag a promoter that also moderates recently", () => {
    const result = findExcessPermissions(
      [
        admin({
          userId: "p",
          canPromote: true,
          canBan: true,
          lastActionMs: NOW - HOUR,
        }),
      ],
      NOW,
      STALE,
    );
    expect(result).toEqual([]);
  });

  it("flags a moderating promoter that has gone stale", () => {
    const result = findExcessPermissions(
      [
        admin({
          userId: "p",
          canPromote: true,
          canBan: true,
          lastActionMs: NOW - STALE - DAY,
        }),
      ],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "p", reason: PERM_AUDIT_REASONS.staleDangerous },
    ]);
  });

  it("flags dangerous powers that were never used", () => {
    const result = findExcessPermissions(
      [admin({ userId: "b", canBan: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "b", reason: PERM_AUDIT_REASONS.staleDangerous },
    ]);
  });

  it("does not flag dangerous powers used recently", () => {
    const result = findExcessPermissions(
      [admin({ userId: "b", canDelete: true, lastActionMs: NOW - MINUTE })],
      NOW,
      STALE,
    );
    expect(result).toEqual([]);
  });

  it("never flags an admin with only harmless pin power", () => {
    const result = findExcessPermissions(
      [admin({ userId: "pin", canPin: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([]);
  });

  it("emits at most one finding per admin, preferring the promote reason", () => {
    const result = findExcessPermissions(
      [admin({ userId: "x", canPromote: true, canPin: true })],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      { userId: "x", reason: PERM_AUDIT_REASONS.promoteWithoutModeration },
    ]);
  });

  it("preserves input order across mixed findings", () => {
    const result = findExcessPermissions(
      [
        admin({ userId: "clean", canBan: true, lastActionMs: NOW - HOUR }),
        admin({ userId: "promoter", canPromote: true }),
        admin({ userId: "stale", canDelete: true }),
        admin({ userId: "harmless", canPin: true }),
      ],
      NOW,
      STALE,
    );
    expect(result).toEqual([
      {
        userId: "promoter",
        reason: PERM_AUDIT_REASONS.promoteWithoutModeration,
      },
      { userId: "stale", reason: PERM_AUDIT_REASONS.staleDangerous },
    ]);
  });

  it("is deterministic for identical inputs", () => {
    const admins = [
      admin({ userId: "a", canPromote: true }),
      admin({ userId: "b", canBan: true }),
    ];
    expect(findExcessPermissions(admins, NOW, STALE)).toEqual(
      findExcessPermissions(admins, NOW, STALE),
    );
  });

  it("does not mutate the input array", () => {
    const admins: readonly AdminPerms[] = [
      admin({ userId: "a", canPromote: true }),
    ];
    findExcessPermissions(admins, NOW, STALE);
    expect(admins.length).toBe(1);
  });
});
