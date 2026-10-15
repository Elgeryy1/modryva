import { describe, expect, it } from "vitest";
import {
  classifyEditRisk,
  EDIT_RISK_BIG_CHANGE_MIN_CHARS,
  EDIT_RISK_BIG_CHANGE_RATIO,
  EDIT_RISK_LATE_SECONDS,
  type EditRiskInput,
} from "./edit-risk.js";

const edit = (overrides: Partial<EditRiskInput> = {}): EditRiskInput => ({
  oldHasUrl: false,
  newHasUrl: false,
  oldLen: 100,
  newLen: 100,
  secondsAfterPost: 0,
  ...overrides,
});

describe("classifyEditRisk exposed constants", () => {
  it("keeps the documented thresholds", () => {
    expect(EDIT_RISK_LATE_SECONDS).toBe(300);
    expect(EDIT_RISK_BIG_CHANGE_MIN_CHARS).toBe(20);
    expect(EDIT_RISK_BIG_CHANGE_RATIO).toBe(0.5);
  });
});

describe("classifyEditRisk alto", () => {
  it("flags a new url added late as alto", () => {
    const result = classifyEditRisk(
      edit({ newHasUrl: true, secondsAfterPost: EDIT_RISK_LATE_SECONDS }),
    );
    expect(result.risk).toBe("alto");
    expect(result.reason).toBe(
      "Enlace nuevo añadido mucho después de publicar",
    );
  });

  it("flags a big late content change as alto", () => {
    const result = classifyEditRisk(
      edit({ oldLen: 20, newLen: 200, secondsAfterPost: 600 }),
    );
    expect(result.risk).toBe("alto");
    expect(result.reason).toBe(
      "Cambio grande de contenido mucho después de publicar",
    );
  });

  it("prioritises the url reason over the growth reason when both apply", () => {
    const result = classifyEditRisk(
      edit({
        newHasUrl: true,
        oldLen: 10,
        newLen: 300,
        secondsAfterPost: 1000,
      }),
    );
    expect(result.risk).toBe("alto");
    expect(result.reason).toBe(
      "Enlace nuevo añadido mucho después de publicar",
    );
  });

  it("treats exactly the late threshold as late", () => {
    const result = classifyEditRisk(
      edit({ newHasUrl: true, secondsAfterPost: EDIT_RISK_LATE_SECONDS }),
    );
    expect(result.risk).toBe("alto");
  });
});

describe("classifyEditRisk medio", () => {
  it("flags a new url added quickly as medio", () => {
    const result = classifyEditRisk(
      edit({ newHasUrl: true, secondsAfterPost: 5 }),
    );
    expect(result.risk).toBe("medio");
    expect(result.reason).toBe("Enlace nuevo añadido al editar");
  });

  it("flags a big quick content change as medio", () => {
    const result = classifyEditRisk(
      edit({ oldLen: 20, newLen: 200, secondsAfterPost: 10 }),
    );
    expect(result.risk).toBe("medio");
    expect(result.reason).toBe("Cambio grande de contenido al editar");
  });

  it("counts a big shrink (deletion) as a big change", () => {
    const result = classifyEditRisk(
      edit({ oldLen: 200, newLen: 20, secondsAfterPost: 0 }),
    );
    expect(result.risk).toBe("medio");
    expect(result.reason).toBe("Cambio grande de contenido al editar");
  });
});

describe("classifyEditRisk bajo", () => {
  it("treats a tiny late edit with no url as bajo", () => {
    const result = classifyEditRisk(
      edit({ oldLen: 100, newLen: 105, secondsAfterPost: 5000 }),
    );
    expect(result.risk).toBe("bajo");
    expect(result.reason).toBe("Edición menor sin señales de riesgo");
  });

  it("does not raise risk when a url is removed", () => {
    const result = classifyEditRisk(
      edit({
        oldHasUrl: true,
        newHasUrl: false,
        secondsAfterPost: 9999,
      }),
    );
    expect(result.risk).toBe("bajo");
  });

  it("does not raise risk when the url was already present", () => {
    const result = classifyEditRisk(
      edit({ oldHasUrl: true, newHasUrl: true, secondsAfterPost: 9999 }),
    );
    expect(result.risk).toBe("bajo");
  });

  it("ignores a change below the absolute minimum even if late", () => {
    const result = classifyEditRisk(
      edit({ oldLen: 5, newLen: 20, secondsAfterPost: 9999 }),
    );
    // delta = 15 < EDIT_RISK_BIG_CHANGE_MIN_CHARS
    expect(result.risk).toBe("bajo");
  });

  it("ignores a change below the ratio even if large in absolute terms", () => {
    const result = classifyEditRisk(
      edit({ oldLen: 1000, newLen: 1030, secondsAfterPost: 9999 }),
    );
    // delta = 30 >= min chars but 30/1000 = 0.03 < ratio
    expect(result.risk).toBe("bajo");
  });
});

describe("classifyEditRisk edge cases", () => {
  it("clamps negative secondsAfterPost to zero (not late)", () => {
    const result = classifyEditRisk(
      edit({ newHasUrl: true, secondsAfterPost: -100 }),
    );
    expect(result.risk).toBe("medio");
  });

  it("handles oldLen zero without dividing by zero", () => {
    const result = classifyEditRisk(
      edit({ oldLen: 0, newLen: 50, secondsAfterPost: 0 }),
    );
    expect(result.risk).toBe("medio");
    expect(result.reason).toBe("Cambio grande de contenido al editar");
  });

  it("treats an identical edit as bajo", () => {
    const result = classifyEditRisk(edit({ oldLen: 50, newLen: 50 }));
    expect(result.risk).toBe("bajo");
  });

  it("is deterministic for identical inputs", () => {
    const input = edit({
      newHasUrl: true,
      oldLen: 10,
      newLen: 400,
      secondsAfterPost: 800,
    });
    expect(classifyEditRisk(input)).toEqual(classifyEditRisk(input));
  });

  it("returns one of the three allowed levels across a sweep", () => {
    const levels = new Set<string>();
    for (let s = 0; s <= 600; s += 150) {
      for (const nl of [50, 100, 400]) {
        for (const url of [false, true]) {
          levels.add(
            classifyEditRisk(
              edit({
                newHasUrl: url,
                oldLen: 100,
                newLen: nl,
                secondsAfterPost: s,
              }),
            ).risk,
          );
        }
      }
    }
    for (const level of levels) {
      expect(["bajo", "medio", "alto"]).toContain(level);
    }
  });
});
