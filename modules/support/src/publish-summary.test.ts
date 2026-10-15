import { describe, expect, it } from "vitest";
import { buildPublishSummary } from "./publish-summary.js";

describe("buildPublishSummary", () => {
  it("summarizes groups and pins without silent flag", () => {
    expect(buildPublishSummary({ groups: 4, pinIn: 2, silent: false })).toBe(
      "📢 Vas a enviar esto a 4 grupos y fijarlo en 2.",
    );
  });

  it("appends the silent note when silent is true", () => {
    expect(buildPublishSummary({ groups: 4, pinIn: 2, silent: true })).toBe(
      "📢 Vas a enviar esto a 4 grupos y fijarlo en 2, sin notificación.",
    );
  });

  it("uses singular grupo for a single group", () => {
    expect(buildPublishSummary({ groups: 1, pinIn: 0, silent: false })).toBe(
      "📢 Vas a enviar esto a 1 grupo.",
    );
  });

  it("omits the pin clause when pinIn is zero", () => {
    expect(buildPublishSummary({ groups: 3, pinIn: 0, silent: false })).toBe(
      "📢 Vas a enviar esto a 3 grupos.",
    );
  });

  it("warns when there are no groups", () => {
    expect(buildPublishSummary({ groups: 0, pinIn: 2, silent: true })).toBe(
      "🚫 No hay ningún grupo seleccionado para publicar.",
    );
  });

  it("treats negative groups as none", () => {
    expect(buildPublishSummary({ groups: -5, pinIn: 1, silent: false })).toBe(
      "🚫 No hay ningún grupo seleccionado para publicar.",
    );
  });

  it("caps pinIn at the number of groups", () => {
    expect(buildPublishSummary({ groups: 2, pinIn: 9, silent: false })).toBe(
      "📢 Vas a enviar esto a 2 grupos y fijarlo en 2.",
    );
  });

  it("floors fractional counts", () => {
    expect(
      buildPublishSummary({ groups: 3.9, pinIn: 1.8, silent: false }),
    ).toBe("📢 Vas a enviar esto a 3 grupos y fijarlo en 1.");
  });

  it("treats negative pinIn as no pinning", () => {
    expect(buildPublishSummary({ groups: 3, pinIn: -2, silent: true })).toBe(
      "📢 Vas a enviar esto a 3 grupos, sin notificación.",
    );
  });

  it("is deterministic for identical input", () => {
    const input = { groups: 5, pinIn: 3, silent: true } as const;
    expect(buildPublishSummary(input)).toBe(buildPublishSummary(input));
  });
});
