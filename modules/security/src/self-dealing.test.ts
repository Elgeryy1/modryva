import { describe, expect, it } from "vitest";
import { detectSelfDealing } from "./self-dealing.js";

const CONFLICT_REASON =
  "🚫 No puedes resolver este caso porque estás implicado. Debe encargarse otro administrador.";
const CLEAR_REASON =
  "✅ No hay conflicto de interés: puedes resolver este caso.";

describe("detectSelfDealing", () => {
  it("flags a conflict when the admin is among the involved parties", () => {
    expect(
      detectSelfDealing({ adminId: 5, involvedUserIds: [1, 2, 5] }),
    ).toEqual({ conflict: true, reason: CONFLICT_REASON });
  });

  it("clears an admin who is not involved", () => {
    expect(
      detectSelfDealing({ adminId: 5, involvedUserIds: [1, 2, 3] }),
    ).toEqual({ conflict: false, reason: CLEAR_REASON });
  });

  it("treats an empty involved list as conflict-free", () => {
    expect(detectSelfDealing({ adminId: 7, involvedUserIds: [] })).toEqual({
      conflict: false,
      reason: CLEAR_REASON,
    });
  });

  it("flags a conflict when the admin is the only involved party", () => {
    expect(detectSelfDealing({ adminId: 42, involvedUserIds: [42] })).toEqual({
      conflict: true,
      reason: CONFLICT_REASON,
    });
  });

  it("tolerates duplicate ids of the involved admin", () => {
    expect(
      detectSelfDealing({ adminId: 9, involvedUserIds: [9, 9, 1] }),
    ).toEqual({ conflict: true, reason: CONFLICT_REASON });
  });

  it("detects the admin regardless of position in the list", () => {
    const first = detectSelfDealing({ adminId: 3, involvedUserIds: [3, 1, 2] });
    const last = detectSelfDealing({ adminId: 3, involvedUserIds: [1, 2, 3] });
    expect(first).toEqual(last);
    expect(first.conflict).toBe(true);
  });

  it("does not match on partial or near ids", () => {
    expect(
      detectSelfDealing({ adminId: 10, involvedUserIds: [1, 100, 0] }),
    ).toEqual({ conflict: false, reason: CLEAR_REASON });
  });

  it("handles negative ids as ordinary distinct values", () => {
    expect(
      detectSelfDealing({ adminId: -5, involvedUserIds: [-1, -5, 5] }),
    ).toEqual({ conflict: true, reason: CONFLICT_REASON });
  });

  it("is deterministic across repeated calls", () => {
    const input = { adminId: 8, involvedUserIds: [4, 8, 12] } as const;
    const a = detectSelfDealing(input);
    const b = detectSelfDealing(input);
    expect(a).toEqual(b);
    expect(a).toEqual({ conflict: true, reason: CONFLICT_REASON });
  });
});
