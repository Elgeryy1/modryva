import { describe, expect, it } from "vitest";
import { buildSanctionSignature } from "./sanction-signature.js";

describe("buildSanctionSignature", () => {
  it("includes staff, reason and case id", () => {
    expect(
      buildSanctionSignature({ staff: "Ana", reason: "spam", caseId: "42" }),
    ).toBe("🛡️ Aplicado por Ana · Motivo: spam · Caso #42");
  });

  it("is deterministic for identical input", () => {
    const input = { staff: "Bob", reason: "flood", caseId: "7" };
    expect(buildSanctionSignature(input)).toBe(buildSanctionSignature(input));
  });

  it("handles empty fields without throwing", () => {
    expect(buildSanctionSignature({ staff: "", reason: "", caseId: "" })).toBe(
      "🛡️ Aplicado por  · Motivo:  · Caso #",
    );
  });
});
