import { ForbiddenException, type HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappStaffNotesController } from "./staff-notes.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

interface StoredNote {
  id: string;
  tenantId: string;
  chatId: string;
  authorName: string | null;
  text: string;
  createdAtMs: number;
}

class FakeStaffNotes {
  private seq = 0;
  readonly all: StoredNote[] = [];

  async addNote(input: {
    tenantId: string;
    chatId: string;
    authorTelegramId: bigint | null;
    authorName: string | null;
    text: string;
  }): Promise<void> {
    this.seq += 1;
    this.all.push({
      id: `note_${this.seq}`,
      tenantId: input.tenantId,
      chatId: input.chatId,
      authorName: input.authorName,
      text: input.text,
      createdAtMs: this.seq,
    });
  }

  async listNotes(tenantId: string, chatId: string, limit: number) {
    return this.all
      .filter((n) => n.tenantId === tenantId && n.chatId === chatId)
      .reverse()
      .slice(0, limit)
      .map((n) => ({
        id: n.id,
        authorName: n.authorName,
        text: n.text,
        createdAtMs: n.createdAtMs,
      }));
  }

  async deleteNote(
    tenantId: string,
    chatId: string,
    id: string,
  ): Promise<boolean> {
    const idx = this.all.findIndex(
      (n) => n.id === id && n.tenantId === tenantId && n.chatId === chatId,
    );
    if (idx === -1) {
      return false;
    }
    this.all.splice(idx, 1);
    return true;
  }
}

class FakeFoundation {
  readonly audits: Array<Record<string, unknown>> = [];
  async recordAudit(input: Record<string, unknown>) {
    this.audits.push(input);
  }
}

const makeController = (adminOverrides: Partial<MiniappAdminService> = {}) => {
  const admin = {
    assertGroupAdmin: async () => {},
    resolveChat: async (gid: string) => ({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: gid,
      title: "Grupo",
    }),
    ...adminOverrides,
  } as unknown as MiniappAdminService;

  const controller = new MiniappStaffNotesController(admin);
  const notes = new FakeStaffNotes();
  const foundation = new FakeFoundation();
  Object.assign(controller, { notes, foundation });
  return { controller, notes, foundation };
};

const reqWith = (miniapp: MiniappRequest["miniapp"]): MiniappRequest => ({
  headers: {},
  ...(miniapp ? { miniapp } : {}),
});

const ctxFor = (userId: string, user: Record<string, unknown> = {}) => ({
  userId,
  user: { id: Number(userId), ...user },
  startParam: null,
  botUsername: "modryvabot",
  botToken: "123456:test-token",
});

describe("MiniappStaffNotesController", () => {
  it("rejects listing when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.list(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("adds a note and lists it back", async () => {
    const { controller, foundation } = makeController();
    await controller.add(reqWith(ctxFor("42", { first_name: "Ana" })), "-100", {
      text: "Ojo con el usuario 55, ya avisado",
    });
    expect(foundation.audits).toHaveLength(1);

    const res = await controller.list(reqWith(ctxFor("42")), "-100");
    expect(res.notes).toHaveLength(1);
    expect(res.notes[0]?.text).toBe("Ojo con el usuario 55, ya avisado");
    expect(res.notes[0]?.authorName).toBe("Ana");
    expect(typeof res.notes[0]?.createdAt).toBe("string");
  });

  it("rejects an empty note", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.add(reqWith(ctxFor("42")), "-100", { text: "   " }),
      "invalid-note",
    );
  });

  it("derives an @username author when there is no name", async () => {
    const { controller } = makeController();
    await controller.add(
      reqWith(ctxFor("42", { username: "moderador" })),
      "-100",
      {
        text: "nota",
      },
    );
    const res = await controller.list(reqWith(ctxFor("42")), "-100");
    expect(res.notes[0]?.authorName).toBe("@moderador");
  });

  it("deletes a note", async () => {
    const { controller, notes, foundation } = makeController();
    await controller.add(reqWith(ctxFor("42")), "-100", { text: "borrame" });
    const id = notes.all[0]?.id as string;

    const res = await controller.remove(reqWith(ctxFor("42")), "-100", id);
    expect(res).toEqual({ ok: true });
    expect(notes.all).toHaveLength(0);
    // add + delete → two audit entries.
    expect(foundation.audits).toHaveLength(2);
  });

  it("404s deleting a note that does not exist", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.remove(reqWith(ctxFor("42")), "-100", "nope"),
      "note-not-found",
    );
  });

  it("does not delete a note that belongs to another chat", async () => {
    const { controller, notes } = makeController();
    // Seed a note in a different chat directly.
    notes.all.push({
      id: "other",
      tenantId: "t1",
      chatId: "c2",
      authorName: null,
      text: "de otro grupo",
      createdAtMs: 1,
    });
    await expectHttpErrorAsync(
      controller.remove(reqWith(ctxFor("42")), "-100", "other"),
      "note-not-found",
    );
    expect(notes.all).toHaveLength(1);
  });
});
