import { describe, expect, it } from "vitest";
import {
  DEFAULT_TICKET_FOLLOWUP_DELAY_MS,
  shouldSendTicketFollowup,
  TICKET_FOLLOWUP_MESSAGE,
} from "./ticket-followup.js";

describe("shouldSendTicketFollowup", () => {
  const DAY = DEFAULT_TICKET_FOLLOWUP_DELAY_MS;

  it("does not send before the default 24h delay", () => {
    expect(shouldSendTicketFollowup(0, DAY - 1)).toEqual({
      send: false,
      message: TICKET_FOLLOWUP_MESSAGE,
      elapsedMs: DAY - 1,
    });
  });

  it("sends exactly at the delay boundary", () => {
    expect(shouldSendTicketFollowup(0, DAY)).toEqual({
      send: true,
      message: TICKET_FOLLOWUP_MESSAGE,
      elapsedMs: DAY,
    });
  });

  it("sends after the delay boundary", () => {
    const result = shouldSendTicketFollowup(1000, 1000 + DAY + 5000);
    expect(result.send).toBe(true);
    expect(result.elapsedMs).toBe(DAY + 5000);
  });

  it("honors a custom shorter delay", () => {
    expect(shouldSendTicketFollowup(0, 500, { delayMs: 400 })).toEqual({
      send: true,
      message: TICKET_FOLLOWUP_MESSAGE,
      elapsedMs: 500,
    });
  });

  it("does not send when custom delay not yet reached", () => {
    expect(shouldSendTicketFollowup(0, 300, { delayMs: 400 }).send).toBe(false);
  });

  it("clamps future resolvedMs to zero elapsed and does not send", () => {
    expect(shouldSendTicketFollowup(2000, 1000)).toEqual({
      send: false,
      message: TICKET_FOLLOWUP_MESSAGE,
      elapsedMs: 0,
    });
  });

  it("treats a zero delay as due once any time passes", () => {
    expect(shouldSendTicketFollowup(0, 1, { delayMs: 0 }).send).toBe(true);
    expect(shouldSendTicketFollowup(5, 5, { delayMs: 0 }).send).toBe(true);
  });

  it("ignores a non-finite delay and falls back to the default", () => {
    expect(shouldSendTicketFollowup(0, DAY, { delayMs: Number.NaN }).send).toBe(
      true,
    );
    expect(
      shouldSendTicketFollowup(0, DAY - 1, { delayMs: Number.NaN }).send,
    ).toBe(false);
  });

  it("uses the default delay when options object is empty", () => {
    expect(shouldSendTicketFollowup(0, DAY - 1, {}).send).toBe(false);
    expect(shouldSendTicketFollowup(0, DAY, {}).send).toBe(true);
  });

  it("carries accented Spanish copy in the message", () => {
    const result = shouldSendTicketFollowup(0, DAY);
    expect(result.message).toContain("¿Quedó");
    expect(result.message).toContain("aún");
  });

  it("is deterministic for identical inputs", () => {
    const a = shouldSendTicketFollowup(100, 100 + DAY);
    const b = shouldSendTicketFollowup(100, 100 + DAY);
    expect(a).toEqual(b);
  });
});
