import { describe, expect, it } from "vitest";
import {
  DEFAULT_ESCALATION_THRESHOLD_MS,
  formatEscalationNotice,
  shouldEscalateToOwner,
} from "./inactive-admin-escalation.js";

describe("shouldEscalateToOwner", () => {
  it("escalates when no admin responded and the threshold is exactly reached", () => {
    expect(
      shouldEscalateToOwner({
        alertMs: 0,
        nowMs: DEFAULT_ESCALATION_THRESHOLD_MS,
        lastAdminResponseMs: undefined,
      }),
    ).toEqual({ escalate: true, waitedMs: DEFAULT_ESCALATION_THRESHOLD_MS });
  });

  it("does not escalate one millisecond before the threshold", () => {
    expect(
      shouldEscalateToOwner({
        alertMs: 0,
        nowMs: DEFAULT_ESCALATION_THRESHOLD_MS - 1,
        lastAdminResponseMs: undefined,
      }),
    ).toEqual({
      escalate: false,
      waitedMs: DEFAULT_ESCALATION_THRESHOLD_MS - 1,
    });
  });

  it("does not escalate when an admin responded after the alert", () => {
    expect(
      shouldEscalateToOwner({
        alertMs: 1000,
        nowMs: 1_000_000,
        lastAdminResponseMs: 5000,
      }),
    ).toEqual({ escalate: false, waitedMs: 999_000 });
  });

  it("treats a response strictly before the alert as stale and still escalates", () => {
    expect(
      shouldEscalateToOwner({
        alertMs: 10_000,
        nowMs: 10_000 + DEFAULT_ESCALATION_THRESHOLD_MS,
        lastAdminResponseMs: 5000,
      }),
    ).toEqual({ escalate: true, waitedMs: DEFAULT_ESCALATION_THRESHOLD_MS });
  });

  it("counts a response exactly at the alert time as a response", () => {
    expect(
      shouldEscalateToOwner({
        alertMs: 10_000,
        nowMs: 10_000 + DEFAULT_ESCALATION_THRESHOLD_MS,
        lastAdminResponseMs: 10_000,
      }),
    ).toEqual({ escalate: false, waitedMs: DEFAULT_ESCALATION_THRESHOLD_MS });
  });

  it("honors a custom threshold", () => {
    expect(
      shouldEscalateToOwner(
        { alertMs: 0, nowMs: 1000, lastAdminResponseMs: undefined },
        { thresholdMs: 1000 },
      ),
    ).toEqual({ escalate: true, waitedMs: 1000 });
  });

  it("does not escalate on negative wait from clock skew", () => {
    expect(
      shouldEscalateToOwner({
        alertMs: 5000,
        nowMs: 4000,
        lastAdminResponseMs: undefined,
      }),
    ).toEqual({ escalate: false, waitedMs: -1000 });
  });

  it("is deterministic for repeated identical calls", () => {
    const input = {
      alertMs: 0,
      nowMs: DEFAULT_ESCALATION_THRESHOLD_MS + 5000,
      lastAdminResponseMs: undefined,
    } as const;
    expect(shouldEscalateToOwner(input)).toEqual(shouldEscalateToOwner(input));
  });
});

describe("formatEscalationNotice", () => {
  it("renders whole minutes of waiting with Spanish accents", () => {
    expect(
      formatEscalationNotice({
        ownerMention: "@owner",
        waitedMs: DEFAULT_ESCALATION_THRESHOLD_MS,
      }),
    ).toBe(
      "🚨 Escalando al owner @owner: ningún administrador respondió a la alerta crítica tras 15 min de espera.",
    );
  });

  it("floors fractional minutes", () => {
    expect(
      formatEscalationNotice({ ownerMention: "@jefe", waitedMs: 119_000 }),
    ).toBe(
      "🚨 Escalando al owner @jefe: ningún administrador respondió a la alerta crítica tras 1 min de espera.",
    );
  });

  it("clamps negative waits to zero minutes", () => {
    expect(
      formatEscalationNotice({ ownerMention: "@owner", waitedMs: -5000 }),
    ).toBe(
      "🚨 Escalando al owner @owner: ningún administrador respondió a la alerta crítica tras 0 min de espera.",
    );
  });
});
