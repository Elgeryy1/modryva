import { describe, expect, it } from "vitest";
import { decideReadOnly } from "./read-only-mode.js";

describe("decideReadOnly", () => {
  it("engages read-only mode on a high error rate", () => {
    expect(decideReadOnly({ apiErrorRate: 0.7 }).readOnly).toBe(true);
  });

  it("stays in normal mode on a low error rate", () => {
    expect(decideReadOnly({ apiErrorRate: 0.1 }).readOnly).toBe(false);
  });

  it("treats the threshold as inclusive", () => {
    expect(decideReadOnly({ apiErrorRate: 0.5 }).readOnly).toBe(true);
  });

  it("honors a custom threshold", () => {
    expect(
      decideReadOnly({ apiErrorRate: 0.3 }, { threshold: 0.25 }).readOnly,
    ).toBe(true);
  });

  it("always returns a reason", () => {
    expect(decideReadOnly({ apiErrorRate: 0 }).reason.length).toBeGreaterThan(
      0,
    );
  });
});
