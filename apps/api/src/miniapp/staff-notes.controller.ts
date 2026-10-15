import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaFoundationRepository,
  PrismaStaffNoteRepository,
  type StaffNoteRecord,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappContext,
  type MiniappRequest,
} from "./init-data.guard.js";

const NOTE_LIMIT = 100;
const addSchema = z.object({ text: z.string().trim().min(1).max(4000) });

interface NoteView {
  readonly id: string;
  readonly authorName: string | null;
  readonly text: string;
  readonly createdAt: string;
}

const toView = (note: StaffNoteRecord): NoteView => ({
  id: note.id,
  authorName: note.authorName,
  text: note.text,
  createdAt: new Date(note.createdAtMs).toISOString(),
});

/**
 * The staff-only notes board (`/note` in chat) surfaced in the Mini App: a
 * shared scratchpad where admins leave context about the group and its cases.
 * The chat keeps `/note <texto>` / `/note list`; this adds a proper list + add +
 * delete UI. Scoped to the single group the admin opened `/config` for; delete
 * is re-scoped by tenant+chat in the repository so one group's admin can never
 * remove another group's note.
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappStaffNotesController {
  private readonly notes = new PrismaStaffNoteRepository();
  private readonly foundation = new PrismaFoundationRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/notes")
  async list(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const notes = await this.notes.listNotes(
      auth.chat.tenantId,
      auth.chat.chatId,
      NOTE_LIMIT,
    );
    return { notes: notes.map(toView) };
  }

  @Post("groups/:gid/notes")
  async add(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-note" });
    }
    const auth = await this.authorize(req, gid);
    await this.notes.addNote({
      tenantId: auth.chat.tenantId,
      chatId: auth.chat.chatId,
      authorTelegramId: safeBigInt(auth.telegramUserId),
      authorName: authorNameOf(auth.user),
      text: parsed.data.text,
    });
    await this.foundation.recordAudit({
      tenantId: auth.chat.tenantId,
      actorType: "user",
      action: "miniapp.staffnote.add",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: { source: "miniapp", telegramUserId: auth.telegramUserId },
    });
    return { ok: true };
  }

  @Delete("groups/:gid/notes/:id")
  async remove(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
  ) {
    const auth = await this.authorize(req, gid);
    const removed = await this.notes.deleteNote(
      auth.chat.tenantId,
      auth.chat.chatId,
      id,
    );
    if (!removed) {
      throw new NotFoundException({ error: "note-not-found" });
    }
    await this.foundation.recordAudit({
      tenantId: auth.chat.tenantId,
      actorType: "user",
      action: "miniapp.staffnote.delete",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: { id, source: "miniapp", telegramUserId: auth.telegramUserId },
    });
    return { ok: true };
  }

  private async authorize(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedNotes> {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return { chat, telegramUserId: ctx.userId, user: ctx.user };
  }
}

interface AuthorizedNotes {
  readonly chat: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: string;
    readonly title?: string | undefined;
  };
  readonly telegramUserId: string;
  readonly user: MiniappContext["user"];
}

const safeBigInt = (value: string): bigint | null => {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

/** Best-effort display name from the initData user object. */
const authorNameOf = (user: Record<string, unknown>): string | null => {
  const first = typeof user.first_name === "string" ? user.first_name : "";
  const last = typeof user.last_name === "string" ? user.last_name : "";
  const full = `${first} ${last}`.trim();
  if (full) {
    return full;
  }
  const username = typeof user.username === "string" ? user.username : "";
  return username ? `@${username}` : null;
};
