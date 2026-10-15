import { describe, expect, it } from "vitest";
import {
  classifyPowerChange,
  describePowerAlert,
  type PowerChangeInput,
} from "./power-watch.js";

const BOT = 9000n;
const ADMIN = 111n;
const VICTIM = 222n;

const change = (over: Partial<PowerChangeInput>): PowerChangeInput => ({
  actorId: ADMIN,
  subjectId: VICTIM,
  oldStatus: "member",
  newStatus: "member",
  botId: BOT,
  subjectIsAppointedByUs: false,
  ...over,
});

describe("classifyPowerChange — the bot itself", () => {
  it("flags the bot losing its admin badge", () => {
    // The opening move of a takeover, and the reason this module exists.
    const alert = classifyPowerChange(
      change({
        subjectId: BOT,
        oldStatus: "administrator",
        newStatus: "member",
      }),
    );
    expect(alert?.kind).toBe("bot_demoted");
    expect(alert?.weakensDefence).toBe(true);
    expect(alert?.actorId).toBe(ADMIN);
  });

  it("flags the bot being removed from the chat", () => {
    expect(
      classifyPowerChange(
        change({
          subjectId: BOT,
          oldStatus: "administrator",
          newStatus: "kicked",
        }),
      )?.kind,
    ).toBe("bot_removed");
  });

  it("treats a removal as a removal even from plain membership", () => {
    // Being thrown out matters whether or not the badge came off first.
    expect(
      classifyPowerChange(
        change({ subjectId: BOT, oldStatus: "member", newStatus: "left" }),
      )?.kind,
    ).toBe("bot_removed");
  });

  it("says nothing when the bot is PROMOTED", () => {
    expect(
      classifyPowerChange(
        change({
          subjectId: BOT,
          oldStatus: "member",
          newStatus: "administrator",
        }),
      ),
    ).toBeNull();
  });

  it("still reports when the actor id happens to be the bot itself", () => {
    // A bot cannot demote itself, so Telegram naming the bot as `from` here
    // means something else acted through it. Staying silent would hide the one
    // event this module exists for.
    expect(
      classifyPowerChange(
        change({
          actorId: BOT,
          subjectId: BOT,
          oldStatus: "administrator",
          newStatus: "member",
        }),
      )?.kind,
    ).toBe("bot_demoted");
  });
});

describe("classifyPowerChange — other people", () => {
  it("flags an admin promoted outside the bot", () => {
    const alert = classifyPowerChange(
      change({ oldStatus: "member", newStatus: "administrator" }),
    );
    expect(alert?.kind).toBe("outsider_promoted");
    expect(alert?.subjectId).toBe(VICTIM);
  });

  it("stays quiet when the promoted admin IS one of ours", () => {
    // /admin already logged it, and appointed-admin-guard owns them from here.
    expect(
      classifyPowerChange(
        change({
          oldStatus: "member",
          newStatus: "administrator",
          subjectIsAppointedByUs: true,
        }),
      ),
    ).toBeNull();
  });

  it("stays quiet when the BOT is the one promoting", () => {
    // Otherwise every single /admin would fire its own alarm and the team would
    // learn to ignore the alert that matters.
    expect(
      classifyPowerChange(
        change({
          actorId: BOT,
          oldStatus: "member",
          newStatus: "administrator",
        }),
      ),
    ).toBeNull();
  });

  it("flags one of our admins being demoted by someone else", () => {
    expect(
      classifyPowerChange(
        change({
          oldStatus: "administrator",
          newStatus: "member",
          subjectIsAppointedByUs: true,
        }),
      )?.kind,
    ).toBe("ours_demoted");
  });

  it("stays quiet when an admin steps down on their own", () => {
    // Telegram reports a self-demotion with `from` set to that same person.
    // Without this, every voluntary departure would page the team.
    expect(
      classifyPowerChange(
        change({
          actorId: VICTIM,
          subjectId: VICTIM,
          oldStatus: "administrator",
          newStatus: "member",
          subjectIsAppointedByUs: true,
        }),
      ),
    ).toBeNull();
  });

  it("stays quiet for an ordinary member joining or leaving", () => {
    expect(
      classifyPowerChange(change({ oldStatus: "left", newStatus: "member" })),
    ).toBeNull();
    expect(
      classifyPowerChange(change({ oldStatus: "member", newStatus: "kicked" })),
    ).toBeNull();
  });

  it("files an ownership transfer as its own thing, not as a promotion", () => {
    // Becoming `creator` IS a gain of power, so without an explicit earlier
    // branch the gravest possible event would be filed as the quietest alert.
    const alert = classifyPowerChange(
      change({ oldStatus: "member", newStatus: "creator" }),
    );
    expect(alert?.kind).toBe("owner_transferred");
    // Reaches the STAFF room: the new owner can remove the bot at will.
    expect(alert?.weakensDefence).toBe(true);
  });

  it("reports an ownership transfer even to an admin the bot appointed", () => {
    // Having been appointed by the bot says nothing about later being handed
    // the entire group.
    expect(
      classifyPowerChange(
        change({
          oldStatus: "administrator",
          newStatus: "creator",
          subjectIsAppointedByUs: true,
        }),
      )?.kind,
    ).toBe("owner_transferred");
  });

  it("keeps an outside promotion as the quietest alert", () => {
    // Promoting by hand is the intended way to create an admin trusted with
    // the bot's own settings, so this fires during correct operation.
    const alert = classifyPowerChange(
      change({ oldStatus: "member", newStatus: "administrator" }),
    );
    expect(alert?.kind).toBe("outsider_promoted");
    expect(alert?.weakensDefence).toBe(false);
  });

  it("returns null when Telegram omitted who acted", () => {
    expect(
      classifyPowerChange(
        change({
          actorId: undefined,
          oldStatus: "member",
          newStatus: "administrator",
        }),
      ),
    ).toBeNull();
  });
});

describe("describePowerAlert", () => {
  const labels = { actor: "@ana", subject: "@luis" };

  it("says who is involved in every alert, because 'someone' is not actionable", () => {
    for (const kind of [
      "bot_demoted",
      "bot_removed",
      "outsider_promoted",
      "ours_demoted",
      "owner_transferred",
    ] as const) {
      const text = describePowerAlert(
        { kind, actorId: 1n, subjectId: 2n, weakensDefence: true },
        labels,
      );
      expect(text).toMatch(/@ana|@luis/u);
      expect(text.length).toBeGreaterThan(40);
    }
  });

  it("never tells the group to redo a manual promotion through /admin", () => {
    // That advice would convert an admin trusted with the bot's own settings
    // into a bot-appointed one, which by this project's rule may NOT change
    // them — the alert would be walking the group into a downgrade.
    const text = describePowerAlert(
      {
        kind: "outsider_promoted",
        actorId: 1n,
        subjectId: 2n,
        weakensDefence: false,
      },
      labels,
    );
    expect(text).not.toContain("/admin");
  });

  it("keeps the loud emoji for the events that are actually incidents", () => {
    const quiet = describePowerAlert(
      {
        kind: "outsider_promoted",
        actorId: 1n,
        subjectId: 2n,
        weakensDefence: false,
      },
      labels,
    );
    const loud = describePowerAlert(
      {
        kind: "owner_transferred",
        actorId: 1n,
        subjectId: 2n,
        weakensDefence: true,
      },
      labels,
    );
    // A routine promotion must not compete visually with losing the group.
    expect(quiet.startsWith("ℹ️")).toBe(true);
    expect(loud.startsWith("🚨")).toBe(true);
  });

  it("tells the group what the demotion actually costs them", () => {
    const text = describePowerAlert(
      { kind: "bot_demoted", actorId: 1n, subjectId: 2n, weakensDefence: true },
      labels,
    );
    expect(text).toContain("verificar");
    expect(text).toContain("primer paso de un ataque");
  });

  it("explains that an outside admin cannot be stopped later", () => {
    const text = describePowerAlert(
      {
        kind: "outsider_promoted",
        actorId: 1n,
        subjectId: 2n,
        weakensDefence: false,
      },
      labels,
    );
    expect(text).toContain("@luis");
    expect(text).toContain("no me deja quitarle los permisos");
  });

  it("spells out that an ownership transfer is irreversible by anyone", () => {
    const text = describePowerAlert(
      {
        kind: "owner_transferred",
        actorId: 1n,
        subjectId: 2n,
        weakensDefence: true,
      },
      labels,
    );
    expect(text).toContain("no lo puede deshacer nadie");
    expect(text).toContain("comprometida");
  });
});
