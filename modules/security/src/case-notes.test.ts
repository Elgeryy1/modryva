import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type CaseNote,
  extractStaffMentions,
  formatCaseNote,
  formatCaseNoteAge,
  parseCaseNoteCommand,
} from "./case-notes.js";

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

const note = (overrides: Partial<CaseNote> = {}): CaseNote => ({
  authorName: "Ana",
  ms: 0,
  text: "sospechoso de spam",
  ...overrides,
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("parseCaseNoteCommand", () => {
  it("parsea /note list como listado", () => {
    expect(
      parseCaseNoteCommand(baseUpdate({ command: cmd("note", ["list"]) })),
    ).toEqual({
      ok: true,
      command: { kind: "list" },
    });
  });

  it("acepta LIST en cualquier caja como listado", () => {
    expect(
      parseCaseNoteCommand(baseUpdate({ command: cmd("note", ["LiSt"]) })),
    ).toEqual({
      ok: true,
      command: { kind: "list" },
    });
  });

  it("parsea /note <texto> uniendo todos los argumentos", () => {
    expect(
      parseCaseNoteCommand(
        baseUpdate({ command: cmd("note", ["evadio", "el", "captcha"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", text: "evadio el captcha" },
    });
  });

  it("trata 'list' con mas palabras como texto de nota, no listado", () => {
    expect(
      parseCaseNoteCommand(
        baseUpdate({ command: cmd("note", ["list", "de", "avisos"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", text: "list de avisos" },
    });
  });

  it("devuelve error de uso para /note sin argumentos", () => {
    const result = parseCaseNoteCommand(baseUpdate({ command: cmd("note") }));
    expect(result).toEqual({
      ok: false,
      error: { usage: expect.stringContaining("/note") },
    });
  });

  it("devuelve error de uso cuando el texto es solo espacios", () => {
    const result = parseCaseNoteCommand(
      baseUpdate({ command: cmd("note", ["  ", ""]) }),
    );
    expect(result?.ok).toBe(false);
  });

  it("devuelve null para otros comandos o sin comando", () => {
    expect(
      parseCaseNoteCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseCaseNoteCommand(baseUpdate())).toBeNull();
  });
});

describe("formatCaseNoteAge", () => {
  it("devuelve 'ahora' para menos de un minuto y para negativos", () => {
    expect(formatCaseNoteAge(0)).toBe("ahora");
    expect(formatCaseNoteAge(59_999)).toBe("ahora");
    expect(formatCaseNoteAge(-5 * MINUTE)).toBe("ahora");
  });

  it("formatea minutos bajo una hora", () => {
    expect(formatCaseNoteAge(MINUTE)).toBe("hace 1m");
    expect(formatCaseNoteAge(59 * MINUTE)).toBe("hace 59m");
  });

  it("formatea horas bajo un dia", () => {
    expect(formatCaseNoteAge(HOUR)).toBe("hace 1h");
    expect(formatCaseNoteAge(23 * HOUR + 59 * MINUTE)).toBe("hace 23h");
  });

  it("formatea dias", () => {
    expect(formatCaseNoteAge(DAY)).toBe("hace 1d");
    expect(formatCaseNoteAge(10 * DAY + 5 * HOUR)).toBe("hace 10d");
  });
});

describe("formatCaseNote", () => {
  it("renderiza autor, antiguedad y texto", () => {
    expect(
      formatCaseNote(
        note({ authorName: "Ana", ms: 0, text: "spam" }),
        2 * HOUR,
      ),
    ).toBe("📝 Ana (hace 2h): spam");
  });

  it("recorta espacios en autor y texto", () => {
    expect(
      formatCaseNote(
        note({ authorName: "  Bob  ", ms: 0, text: "  aviso  " }),
        5 * MINUTE,
      ),
    ).toBe("📝 Bob (hace 5m): aviso");
  });

  it("usa 'staff' cuando el autor esta vacio", () => {
    expect(
      formatCaseNote(note({ authorName: "   ", ms: 0, text: "x" }), 0),
    ).toBe("📝 staff (ahora): x");
  });

  it("es determinista para entradas identicas", () => {
    const n = note({ authorName: "Ana", ms: 1_000, text: "x" });
    expect(formatCaseNote(n, 10 * MINUTE)).toBe(formatCaseNote(n, 10 * MINUTE));
  });
});

describe("extractStaffMentions", () => {
  const staff = ["ana", "bob", "carol"];

  it("extrae solo menciones que son de staff, en minusculas", () => {
    expect(extractStaffMentions("aviso a @Ana y @dave y @BOB", staff)).toEqual([
      "ana",
      "bob",
    ]);
  });

  it("deduplica preservando el orden de primera aparicion", () => {
    expect(extractStaffMentions("@bob @Ana @BOB @ana @carol", staff)).toEqual([
      "bob",
      "ana",
      "carol",
    ]);
  });

  it("devuelve vacio cuando ninguna mencion es de staff", () => {
    expect(extractStaffMentions("@dave y @erin", staff)).toEqual([]);
  });

  it("devuelve vacio para texto sin menciones", () => {
    expect(extractStaffMentions("sin menciones aqui", staff)).toEqual([]);
  });

  it("devuelve vacio para texto vacio", () => {
    expect(extractStaffMentions("", staff)).toEqual([]);
  });

  it("devuelve vacio cuando no hay staff", () => {
    expect(extractStaffMentions("@ana @bob", [])).toEqual([]);
  });

  it("compara el staff sin distinguir mayusculas", () => {
    expect(extractStaffMentions("@ana", ["ANA"])).toEqual(["ana"]);
  });

  it("ignora usernames mas cortos de 3 caracteres", () => {
    expect(extractStaffMentions("@ab y @ana", staff)).toEqual(["ana"]);
  });
});
