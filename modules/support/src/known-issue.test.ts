import { describe, expect, it } from "vitest";
import { buildKnownIssueNotice } from "./known-issue.js";

const MESSAGE =
  "🛠️ Ya estamos revisando esto. Gracias por avisarnos, un miembro del equipo lo está atendiendo.";

describe("buildKnownIssueNotice", () => {
  it("activates exactly at the default threshold of 5", () => {
    expect(buildKnownIssueNotice(5)).toEqual({
      active: true,
      message: MESSAGE,
    });
  });

  it("stays inactive just below the default threshold", () => {
    expect(buildKnownIssueNotice(4)).toEqual({ active: false, message: "" });
  });

  it("activates above the default threshold", () => {
    expect(buildKnownIssueNotice(12)).toEqual({
      active: true,
      message: MESSAGE,
    });
  });

  it("honours a custom threshold", () => {
    expect(buildKnownIssueNotice(3, { threshold: 3 })).toEqual({
      active: true,
      message: MESSAGE,
    });
    expect(buildKnownIssueNotice(2, { threshold: 3 })).toEqual({
      active: false,
      message: "",
    });
  });

  it("treats zero complaints as inactive", () => {
    expect(buildKnownIssueNotice(0)).toEqual({ active: false, message: "" });
  });

  it("clamps negative complaint counts to zero", () => {
    expect(buildKnownIssueNotice(-10)).toEqual({ active: false, message: "" });
  });

  it("truncates fractional complaint counts toward zero", () => {
    expect(buildKnownIssueNotice(5.9)).toEqual({
      active: true,
      message: MESSAGE,
    });
    expect(buildKnownIssueNotice(4.9)).toEqual({ active: false, message: "" });
  });

  it("falls back to the default threshold for non-positive thresholds", () => {
    expect(buildKnownIssueNotice(4, { threshold: 0 })).toEqual({
      active: false,
      message: "",
    });
    expect(buildKnownIssueNotice(5, { threshold: -2 })).toEqual({
      active: true,
      message: MESSAGE,
    });
  });

  it("handles non-finite complaint counts as zero", () => {
    expect(buildKnownIssueNotice(Number.NaN)).toEqual({
      active: false,
      message: "",
    });
  });

  it("is deterministic across repeated calls", () => {
    const first = buildKnownIssueNotice(7, { threshold: 4 });
    const second = buildKnownIssueNotice(7, { threshold: 4 });
    expect(first).toEqual(second);
    expect(first).toEqual({ active: true, message: MESSAGE });
  });
});
