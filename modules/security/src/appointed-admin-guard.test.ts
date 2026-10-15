import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type AdminAction,
  type AdminActionKind,
  APPOINTED_ADMIN_RIGHTS,
  type AppointedAdminSettings,
  classifyMemberTransition,
  defaultAppointedAdminSettings,
  describeAdminGuardReason,
  evaluateAppointedAdmin,
  parseAppointedAdminCommand,
} from "./appointed-admin-guard.js";

const NOW = 1_000_000;

const on = (patch: Partial<AppointedAdminSettings> = {}) => ({
  ...defaultAppointedAdminSettings,
  enabled: true,
  mode: "enforce" as const,
  ...patch,
});

/** `n` actions of one kind, all inside the window. */
const burst = (kind: AdminActionKind, n: number): AdminAction[] =>
  Array.from({ length: n }, (_, i) => ({ kind, ms: NOW - i * 1000 }));

describe("evaluateAppointedAdmin", () => {
  it("does nothing at all while disabled", () => {
    const decision = evaluateAppointedAdmin(
      burst("ban", 50),
      NOW,
      defaultAppointedAdminSettings,
    );
    expect(decision.triggered).toBe(false);
    // Counts stay zero too: a disabled guard must not even appear to be
    // measuring, or a UI would show alarming numbers nobody acts on.
    expect(decision.counts.ban).toBe(0);
  });

  it("trips on a burst of bans at the limit, not one past it", () => {
    const settings = on({ banBurstLimit: 3 });
    expect(
      evaluateAppointedAdmin(burst("ban", 2), NOW, settings).triggered,
    ).toBe(false);
    const tripped = evaluateAppointedAdmin(burst("ban", 3), NOW, settings);
    expect(tripped.triggered).toBe(true);
    expect(tripped.reason).toBe("guard:ban_burst");
  });

  it("ignores actions that fell out of the window", () => {
    // An admin who banned three people yesterday is not raiding today.
    const settings = on({ banBurstLimit: 3, windowSeconds: 60 });
    const old: AdminAction[] = [
      { kind: "ban", ms: NOW - 120_000 },
      { kind: "ban", ms: NOW - 119_000 },
      { kind: "ban", ms: NOW - 118_000 },
    ];
    expect(evaluateAppointedAdmin(old, NOW, settings).triggered).toBe(false);
  });

  it("treats a single promotion attempt as enough", () => {
    const decision = evaluateAppointedAdmin(burst("promote", 1), NOW, on());
    expect(decision.triggered).toBe(true);
    expect(decision.reason).toBe("guard:promote_attempt");
  });

  it("ranks a promotion attempt above a larger ban burst", () => {
    // Severity, not volume: reaching for a power never granted is the louder
    // signal, and the reason drives what STAFF reads first.
    const actions = [...burst("ban", 10), ...burst("promote", 1)];
    expect(evaluateAppointedAdmin(actions, NOW, on()).reason).toBe(
      "guard:promote_attempt",
    );
  });

  it("can be told to tolerate promotion attempts", () => {
    const settings = on({ tripOnPromote: false, banBurstLimit: 99 });
    expect(
      evaluateAppointedAdmin(burst("promote", 5), NOW, settings).triggered,
    ).toBe(false);
  });

  it("counts each kind separately — mixed activity is not a burst", () => {
    // Two bans, two unbans and one pin is a busy admin, not a raider.
    const actions = [
      ...burst("ban", 2),
      ...burst("unban", 2),
      ...burst("chatinfo", 1),
    ];
    const settings = on({
      banBurstLimit: 3,
      unbanBurstLimit: 3,
      chatInfoLimit: 2,
    });
    expect(evaluateAppointedAdmin(actions, NOW, settings).triggered).toBe(
      false,
    );
  });

  it("reports the mode so observe can log without acting", () => {
    const decision = evaluateAppointedAdmin(
      burst("ban", 9),
      NOW,
      on({ mode: "observe", banBurstLimit: 3 }),
    );
    expect(decision.triggered).toBe(true);
    expect(decision.mode).toBe("observe");
  });
});

describe("describeAdminGuardReason", () => {
  const counts = { ban: 1, unban: 1, promote: 0, chatinfo: 1 };

  it("reads correctly at one — a threshold of 1 is a normal setting", () => {
    // The live test produced "baneó a 1 personas" in a real group message.
    expect(describeAdminGuardReason("guard:ban_burst", counts, 60)).toContain(
      "1 persona en",
    );
    expect(describeAdminGuardReason("guard:unban_burst", counts, 60)).toContain(
      "1 persona baneada",
    );
    expect(
      describeAdminGuardReason("guard:chatinfo_burst", counts, 60),
    ).toContain("1 vez");
  });

  it("still reads correctly in the plural", () => {
    const many = { ban: 4, unban: 3, promote: 0, chatinfo: 2 };
    expect(describeAdminGuardReason("guard:ban_burst", many, 60)).toContain(
      "4 personas",
    );
    expect(
      describeAdminGuardReason("guard:chatinfo_burst", many, 60),
    ).toContain("2 veces");
  });
});

describe("classifyMemberTransition", () => {
  it("ignores someone leaving on their own", () => {
    // Telegram reports a voluntary exit with `from` = the same person. Without
    // this exclusion every departure would count as the admin kicking someone.
    expect(
      classifyMemberTransition({
        actorId: 7n,
        subjectId: 7n,
        oldStatus: "member",
        newStatus: "left",
      }),
    ).toBeNull();
  });

  it("reads a kick and a ban as the same kind of act", () => {
    expect(
      classifyMemberTransition({
        actorId: 7n,
        subjectId: 9n,
        oldStatus: "member",
        newStatus: "kicked",
      }),
    ).toBe("ban");
    expect(
      classifyMemberTransition({
        actorId: 7n,
        subjectId: 9n,
        oldStatus: "member",
        newStatus: "left",
      }),
    ).toBe("ban");
  });

  it("reads a return from kicked as an unban", () => {
    expect(
      classifyMemberTransition({
        actorId: 7n,
        subjectId: 9n,
        oldStatus: "kicked",
        newStatus: "member",
      }),
    ).toBe("unban");
  });

  it("does not mistake an unban for a kick via the left branch", () => {
    // kicked -> left is Telegram lifting a ban without re-adding the person.
    expect(
      classifyMemberTransition({
        actorId: 7n,
        subjectId: 9n,
        oldStatus: "kicked",
        newStatus: "left",
      }),
    ).toBeNull();
  });

  it("spots a promotion", () => {
    expect(
      classifyMemberTransition({
        actorId: 7n,
        subjectId: 9n,
        oldStatus: "member",
        newStatus: "administrator",
      }),
    ).toBe("promote");
  });

  it("returns null when the actor is unknown", () => {
    expect(
      classifyMemberTransition({
        actorId: undefined,
        subjectId: 9n,
        oldStatus: "member",
        newStatus: "kicked",
      }),
    ).toBeNull();
  });
});

const cmd = (name: string, args: string[] = []) =>
  ({ command: { name, args } }) as unknown as TelegramUpdateEnvelope;

describe("parseAppointedAdminCommand", () => {
  it("takes the target from a mention and the rest as the title", () => {
    const result = parseAppointedAdminCommand(
      cmd("admin", ["@pepe", "Moderador", "de", "noche"]),
      false,
    );
    expect(result).toEqual({
      ok: true,
      command: {
        kind: "appoint",
        targetUsername: "pepe",
        customTitle: "Moderador de noche",
      },
    });
  });

  it("works by reply, where the whole tail is the title", () => {
    // The only way to appoint someone who has no @username at all.
    const result = parseAppointedAdminCommand(cmd("admin", ["Ayudante"]), true);
    expect(result).toEqual({
      ok: true,
      command: {
        kind: "appoint",
        targetUsername: null,
        customTitle: "Ayudante",
      },
    });
  });

  it("refuses to guess when there is neither mention, id nor reply", () => {
    const result = parseAppointedAdminCommand(cmd("admin"), false);
    expect(result?.ok).toBe(false);
  });

  it("accepts a bare numeric id — the only way to reach a bot", () => {
    // A bot never speaks unprompted, so there is no message to reply to, and
    // @username lookup needs a users row it will never have. The live test hit
    // exactly this appointing a throwaway bot.
    const result = parseAppointedAdminCommand(
      cmd("admin", ["9000000011", "Moderador"]),
      false,
    );
    expect(result).toEqual({
      ok: true,
      command: {
        kind: "appoint",
        targetUsername: null,
        targetUserId: 9000000011n,
        customTitle: "Moderador",
      },
    });
  });

  it("does not mistake a short number for an id", () => {
    // "5" is far more likely a stray argument than a Telegram user id.
    const result = parseAppointedAdminCommand(cmd("admin", ["5"]), false);
    expect(result?.ok).toBe(false);
  });

  it("parses revoke, list and adopt", () => {
    expect(
      parseAppointedAdminCommand(cmd("desadmin", ["@pepe"]), false),
    ).toEqual({
      ok: true,
      command: { kind: "revoke", targetUsername: "pepe" },
    });
    expect(parseAppointedAdminCommand(cmd("adminlist"), false)?.ok).toBe(true);
    expect(parseAppointedAdminCommand(cmd("adoptaradmins"), false)?.ok).toBe(
      true,
    );
  });

  it("ignores commands that are not its own", () => {
    expect(
      parseAppointedAdminCommand(cmd("promote", ["@pepe"]), false),
    ).toBeNull();
    expect(parseAppointedAdminCommand(cmd("ban"), false)).toBeNull();
  });
});

describe("APPOINTED_ADMIN_RIGHTS", () => {
  it("never grants the power to create admins", () => {
    // The rule the whole feature rests on: an appointed admin who could
    // promote would create administrators Telegram then forbids the bot from
    // demoting, so one rogue admin outgrows the guard in a single command.
    expect(APPOINTED_ADMIN_RIGHTS.can_promote_members).toBe(false);
  });

  it("never grants the power to add members", () => {
    // Adding people directly, or handing out an invite link, walks straight
    // past Guardian verification. Admission is the bot's job.
    expect(APPOINTED_ADMIN_RIGHTS.can_invite_users).toBe(false);
  });

  it("states both withheld rights explicitly instead of omitting them", () => {
    // Omitting a field leaves the outcome to Telegram's default for a missing
    // value. The two that matter are declared at the call site on purpose.
    expect(Object.hasOwn(APPOINTED_ADMIN_RIGHTS, "can_promote_members")).toBe(
      true,
    );
    expect(Object.hasOwn(APPOINTED_ADMIN_RIGHTS, "can_invite_users")).toBe(
      true,
    );
  });

  it("NO concede ningún permiso nativo que el bot pueda ejecutar él", () => {
    // La regla entera: si hay comando, el botón de Telegram no se da. Una
    // expulsión desde el menú no deja caso, motivo ni forma de apelarla; la
    // misma hecha con /ban, sí.
    expect(APPOINTED_ADMIN_RIGHTS.can_restrict_members).toBe(false); // /ban /kick /mute
    expect(APPOINTED_ADMIN_RIGHTS.can_delete_messages).toBe(false); // /del /purge
    expect(APPOINTED_ADMIN_RIGHTS.can_pin_messages).toBe(false); // /pin
    expect(APPOINTED_ADMIN_RIGHTS.can_change_info).toBe(false); // /settitle
  });

  it("deja EXACTAMENTE un permiso en true, y es el que no sanciona", () => {
    // Estructural, no estético: Telegram lee una promoción con todo en false
    // como una DEGRADACIÓN. Tiene que quedar uno en pie, y can_manage_chat es
    // el correcto porque no otorga ninguna acción de moderación.
    const granted = Object.entries(APPOINTED_ADMIN_RIGHTS)
      .filter(([, value]) => value === true)
      .map(([name]) => name);
    expect(granted).toEqual(["can_manage_chat"]);
  });

  it("no concede permisos que nadie necesita", () => {
    // «Solo los necesarios»: las historias y las videollamadas no son
    // moderación y el rol no las pide.
    expect(APPOINTED_ADMIN_RIGHTS.can_post_stories).toBe(false);
    expect(APPOINTED_ADMIN_RIGHTS.can_edit_stories).toBe(false);
    expect(APPOINTED_ADMIN_RIGHTS.can_delete_stories).toBe(false);
    expect(APPOINTED_ADMIN_RIGHTS.can_manage_video_chats).toBe(false);
  });

  it("declara todos los permisos, ninguno omitido", () => {
    // Un campo ausente deja la decisión al valor por defecto de Telegram. El
    // conjunto se enuncia entero para que se lea de un vistazo qué se da.
    for (const right of [
      "can_manage_chat",
      "can_change_info",
      "can_delete_messages",
      "can_restrict_members",
      "can_pin_messages",
      "can_manage_video_chats",
      "can_post_stories",
      "can_edit_stories",
      "can_delete_stories",
      "can_invite_users",
      "can_promote_members",
      "can_manage_topics",
    ]) {
      expect(Object.hasOwn(APPOINTED_ADMIN_RIGHTS, right), right).toBe(true);
    }
  });
});
