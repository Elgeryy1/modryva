import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildOnDutyReply,
  isShiftActive,
  onDutyStaff,
  parseShiftCommand,
  SHIFT_COMMAND_USAGE,
  type Shift,
} from "./staff-shift.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  chat: { chatId: 100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 7n, username: "tester", languageCode: "es" },
  command: undefined,
  callbackData: undefined,
  messageText: undefined,
  content: {
    hasText: true,
    hasUrl: false,
    hasMention: false,
    isForward: false,
    viaBot: false,
    hasPhoto: false,
    hasVideo: false,
    hasAnimation: false,
    hasSticker: false,
    hasAudio: false,
    hasVoice: false,
    hasDocument: false,
    hasContact: false,
    hasLocation: false,
    hasPoll: false,
  },
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 555,
  newChatMemberIds: [],
  isTextMessage: true,
  raw: {},
  ...overrides,
});

const cmd = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope["command"] => ({
  name,
  raw: args.length > 0 ? `/${name} ${args.join(" ")}` : `/${name}`,
  args,
});

const shift = (overrides: Partial<Shift> = {}): Shift => ({
  staffId: "@ana",
  startHour: 9,
  endHour: 17,
  ...overrides,
});

describe("isShiftActive", () => {
  it("covers a same-day window inclusive of start, exclusive of end", () => {
    const s = shift({ startHour: 9, endHour: 17 });
    expect(isShiftActive(s, 9)).toBe(true);
    expect(isShiftActive(s, 12)).toBe(true);
    expect(isShiftActive(s, 16)).toBe(true);
    expect(isShiftActive(s, 17)).toBe(false);
    expect(isShiftActive(s, 8)).toBe(false);
  });

  it("covers a window that wraps past midnight", () => {
    const s = shift({ startHour: 22, endHour: 6 });
    expect(isShiftActive(s, 22)).toBe(true);
    expect(isShiftActive(s, 23)).toBe(true);
    expect(isShiftActive(s, 0)).toBe(true);
    expect(isShiftActive(s, 5)).toBe(true);
    expect(isShiftActive(s, 6)).toBe(false);
    expect(isShiftActive(s, 12)).toBe(false);
  });

  it("treats startHour === endHour as a full 24h shift", () => {
    const s = shift({ startHour: 9, endHour: 9 });
    expect(isShiftActive(s, 0)).toBe(true);
    expect(isShiftActive(s, 9)).toBe(true);
    expect(isShiftActive(s, 23)).toBe(true);
  });

  it("normalizes out-of-range or fractional query hours", () => {
    const s = shift({ startHour: 9, endHour: 17 });
    expect(isShiftActive(s, 33)).toBe(true); // 33 -> 9
    expect(isShiftActive(s, 12.9)).toBe(true); // floors to 12
    expect(isShiftActive(s, -15)).toBe(true); // -15 -> 9
  });

  it("is never active for shifts with invalid hour bounds", () => {
    expect(isShiftActive(shift({ startHour: -1, endHour: 5 }), 3)).toBe(false);
    expect(isShiftActive(shift({ startHour: 9, endHour: 24 }), 12)).toBe(false);
    expect(isShiftActive(shift({ startHour: 9.5, endHour: 17 }), 12)).toBe(
      false,
    );
  });

  it("is never active for a non-finite query hour", () => {
    expect(isShiftActive(shift(), Number.NaN)).toBe(false);
    expect(isShiftActive(shift(), Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("onDutyStaff", () => {
  it("returns staff on duty preserving shift order", () => {
    const shifts = [
      shift({ staffId: "@ana", startHour: 9, endHour: 17 }),
      shift({ staffId: "@bob", startHour: 8, endHour: 12 }),
      shift({ staffId: "@cid", startHour: 20, endHour: 23 }),
    ];
    expect(onDutyStaff(shifts, 10)).toEqual(["@ana", "@bob"]);
  });

  it("deduplicates a staff id covered by several shifts", () => {
    const shifts = [
      shift({ staffId: "@ana", startHour: 9, endHour: 12 }),
      shift({ staffId: "@ana", startHour: 10, endHour: 14 }),
    ];
    expect(onDutyStaff(shifts, 11)).toEqual(["@ana"]);
  });

  it("returns an empty array when nobody is on duty", () => {
    const shifts = [shift({ startHour: 9, endHour: 17 })];
    expect(onDutyStaff(shifts, 3)).toEqual([]);
  });

  it("returns an empty array for no shifts", () => {
    expect(onDutyStaff([], 12)).toEqual([]);
  });

  it("includes midnight-wrapping shifts in the early hours", () => {
    const shifts = [
      shift({ staffId: "@night", startHour: 22, endHour: 6 }),
      shift({ staffId: "@day", startHour: 9, endHour: 17 }),
    ];
    expect(onDutyStaff(shifts, 2)).toEqual(["@night"]);
  });
});

describe("buildOnDutyReply", () => {
  it("lists the staff on duty with a zero-padded hour", () => {
    expect(buildOnDutyReply(["@ana", "@bob"], 9)).toBe(
      "🛡️ De guardia a las 09:00: @ana, @bob",
    );
  });

  it("reports nobody on duty", () => {
    expect(buildOnDutyReply([], 14)).toBe("🛡️ Nadie de guardia a las 14:00.");
  });

  it("normalizes the hour used in the label", () => {
    expect(buildOnDutyReply(["@ana"], 26)).toBe(
      "🛡️ De guardia a las 02:00: @ana",
    );
  });

  it("uses a generic label for a non-finite hour", () => {
    expect(buildOnDutyReply([], Number.NaN)).toBe(
      "🛡️ Nadie de guardia a esa hora.",
    );
  });

  it("is deterministic for identical inputs", () => {
    expect(buildOnDutyReply(["@ana"], 9)).toBe(buildOnDutyReply(["@ana"], 9));
  });
});

describe("parseShiftCommand", () => {
  it("returns null for other commands or no command", () => {
    expect(parseShiftCommand(baseUpdate({ command: cmd("ban") }))).toBeNull();
    expect(parseShiftCommand(baseUpdate())).toBeNull();
  });

  it("parses /turno list", () => {
    expect(
      parseShiftCommand(baseUpdate({ command: cmd("turno", ["list"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses subcommands case-insensitively", () => {
    expect(
      parseShiftCommand(baseUpdate({ command: cmd("turno", ["LIST"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses /turno set with staff and hours", () => {
    expect(
      parseShiftCommand(
        baseUpdate({ command: cmd("turno", ["set", "@ana", "9", "17"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set", staffId: "@ana", startHour: 9, endHour: 17 },
    });
  });

  it("parses a midnight-wrapping set (22 to 6)", () => {
    expect(
      parseShiftCommand(
        baseUpdate({ command: cmd("turno", ["set", "@nite", "22", "6"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set", staffId: "@nite", startHour: 22, endHour: 6 },
    });
  });

  it("parses /turno clear with a staff id", () => {
    expect(
      parseShiftCommand(
        baseUpdate({ command: cmd("turno", ["clear", "@ana"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "clear", staffId: "@ana" } });
  });

  it("errors when no subcommand is given", () => {
    expect(parseShiftCommand(baseUpdate({ command: cmd("turno") }))).toEqual({
      ok: false,
      error: { code: "missing-subcommand", usage: SHIFT_COMMAND_USAGE },
    });
  });

  it("errors on an unknown subcommand", () => {
    expect(
      parseShiftCommand(baseUpdate({ command: cmd("turno", ["frobnicate"]) })),
    ).toEqual({
      ok: false,
      error: { code: "unknown-subcommand", usage: SHIFT_COMMAND_USAGE },
    });
  });

  it("errors when set is missing args", () => {
    expect(
      parseShiftCommand(
        baseUpdate({ command: cmd("turno", ["set", "@ana", "9"]) }),
      ),
    ).toEqual({
      ok: false,
      error: { code: "missing-args", usage: SHIFT_COMMAND_USAGE },
    });
  });

  it("errors when clear is missing the staff id", () => {
    expect(
      parseShiftCommand(baseUpdate({ command: cmd("turno", ["clear"]) })),
    ).toEqual({
      ok: false,
      error: { code: "missing-args", usage: SHIFT_COMMAND_USAGE },
    });
  });

  it("errors on out-of-range or non-numeric hours", () => {
    expect(
      parseShiftCommand(
        baseUpdate({ command: cmd("turno", ["set", "@ana", "9", "24"]) }),
      ),
    ).toEqual({
      ok: false,
      error: { code: "invalid-hour", usage: SHIFT_COMMAND_USAGE },
    });
    expect(
      parseShiftCommand(
        baseUpdate({ command: cmd("turno", ["set", "@ana", "nine", "17"]) }),
      ),
    ).toEqual({
      ok: false,
      error: { code: "invalid-hour", usage: SHIFT_COMMAND_USAGE },
    });
  });

  it("accepts the boundary hours 0 and 23", () => {
    expect(
      parseShiftCommand(
        baseUpdate({ command: cmd("turno", ["set", "@ana", "0", "23"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set", staffId: "@ana", startHour: 0, endHour: 23 },
    });
  });
});
