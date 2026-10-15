import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Congela la SEMANTICA DE PARTIDA del pipeline antes de repartir los handlers
 * por modulos.
 *
 * El orden de botHandlers() ES el comportamiento del bot: el primer handler
 * que devuelve respuesta corta la cadena. Ese orden vive hoy en la posicion
 * dentro de un array literal de 900 lineas, asi que reordenarlo por accidente
 * no rompe ni el lint, ni el typecheck, ni ninguno de los 8.731 tests que ya
 * existen. Este fichero es el unico sitio que lo detecta.
 *
 * IMPORTANTE: esta lista congela el comportamiento ACTUAL, incluidos los bugs
 * de orden ya conocidos. No se corrigen aqui: se corrigen en su fase, y
 * entonces se actualiza esta lista en el mismo commit, a proposito y con su
 * justificacion escrita al lado.
 *
 * Si un cambio tuyo hace fallar este test, la pregunta no es como callarlo,
 * sino que comportamiento acabas de cambiar sin querer.
 */

const FUENTE = join(__dirname, "bot-update.service.ts");

const leerFuente = (): readonly string[] =>
  readFileSync(FUENTE, "utf8").split("\n");

/** Nombres declarados dentro del bloque de un registro del servicio. */
const nombresDelRegistro = (nombreFuncion: string): readonly string[] => {
  const lineas = leerFuente();
  const inicio = lineas.findIndex((l) => l.includes(nombreFuncion));
  if (inicio < 0) {
    throw new Error(`no encuentro ${nombreFuncion} en la fuente`);
  }
  const nombres: string[] = [];
  for (let i = inicio; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (linea === undefined) break;
    if (i > inicio && linea === "  }") break;
    const encaje = linea.match(/^\s+name: "([^"]+)",?\s*$/);
    const nombre = encaje?.[1];
    if (nombre !== undefined) nombres.push(nombre);
  }
  return nombres;
};

/** Claves de un mapa de gates (GATED_HANDLERS / GATED_POSTPROCESSORS). */
const clavesDelGate = (nombreMapa: string): readonly string[] => {
  const lineas = leerFuente();
  const inicio = lineas.findIndex((l) => l.startsWith(`const ${nombreMapa}`));
  if (inicio < 0) throw new Error(`no encuentro ${nombreMapa}`);
  const claves: string[] = [];
  for (let i = inicio; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (linea === undefined) break;
    if (i > inicio && linea.startsWith("};")) break;
    const encaje = linea.match(/^\s+"([^"]+)":/);
    const clave = encaje?.[1];
    if (clave !== undefined) claves.push(clave);
  }
  return claves;
};

/**
 * Los 178 handlers en su orden exacto de ejecucion, congelado el 2026-08-19.
 *
 * +2 el 2026-09-03: `ayudante.entrada` y `ayudante.mando`, que meten la cuenta
 * del Ayudante en un grupo desde el propio bot. Van delante de `pets.mando`
 * porque no compiten con ningun otro: uno mira `new_chat_members` y el otro
 * solo responde a `/ayudante`.
 *
 * Subio a 174 el 2026-08-21 al anadir `economy.balance-adjust`, el comando de
 * owner para subir o bajar un saldo, y a 175 el 2026-08-25 al anadir
 * `economy.balance-set`, que lo FIJA en una cifra exacta.
 *
 * +1 el 2026-09-09: `economy.unlimited`, el tercero de esa misma puerta. Va
 * pegado a los otros dos porque es el mismo privilegio de owner, y detras
 * porque los otros mueven una cifra y este cambia la regla por la que la cifra
 * se mueve. La lista NO se toca para reordenar ni
 * renombrar: se toca solo al anadir un handler nuevo, y eso deja el numero en
 * el diff, que es como se ve que fue a proposito.
 * a partir de bot-update.service.ts antes de tocar una linea de logica.
 */
const ORDEN_HANDLERS: readonly string[] = [
  "casino.grant",
  "economy.balance-adjust",
  "economy.balance-set",
  "economy.unlimited",
  "platform.user-ban-command",
  "settings",
  "chat-activity.logger",
  "message-log.archive",
  "social.command",
  "games.command",
  "guardian.retry-start",
  "core.command",
  "games.callback",
  "core.callback",
  "guardian.decided-label",
  "inline-game.callback",
  "platform.command",
  "managed-bot.update",
  "moderation.command",
  "moderation.nuke-command",
  "moderation.sanctions-log",
  "moderation.report-mirror",
  "moderation.report-resolve",
  "moderation-plus.command",
  "moderation-extra.command",
  "antiflood.command",
  "captcha.command",
  "locks.command",
  "topic-locks.command",
  "antiraid.command",
  "warn-config.command",
  "blocklist.command",
  "hygiene.command",
  "char-filter.command",
  "sanction-reasons.command",
  "tolerance.command",
  "protection-summary.command",
  "idgroup.command",
  "vertical.command",
  "announcement.command",
  "config-mode.command",
  "rules-clarity.command",
  "staff-note.command",
  // Añadido el 2026-08-28 con la feature de mascotas. Va DELANTE de
  // `economy.command` y eso es una decision, no el sitio donde cayo: sus cinco
  // nombres (`mascota`, `bicho`, `alimentar`, `corral`, `huevo`) se
  // comprobaron uno a uno contra el nucleo entero y no choca ninguno. Si algun
  // dia se añade un comando de economia con uno de esos nombres, este se lo
  // comeria en silencio, porque el primero que responde corta la cadena.
  "ayudante.entrada",
  "ayudante.mando",
  "pets.mando",
  "pets.command",
  "economy.command",
  "recipe.command",
  "incident.command",
  "coop-mission.command",
  "gratitude.command",
  "language.command",
  "join-gate.command",
  "feedback.command",
  "federation.command",
  "d1.logs-command",
  "d1.quarantine-command",
  "d1.quarantine-callback",
  "d1.appeal-command",
  "d1.appeal-callback",
  "d1.doctor-command",
  "automation.command",
  "mission.command",
  "notes.command",
  "filters.command",
  "welcome.command",
  "reputation.command",
  "trust-tier.command",
  "ranks.command",
  "user-dossier.command",
  "user-dossier.callback",
  "bot-voice.send-command",
  "rookie-ranking.command",
  "hall-of-fame.command",
  "invite.command",
  "stats.command",
  "poll.command",
  "poll.vote",
  "giveaway.command",
  "giveaway.join",
  "schedule.command",
  "ticket.command",
  "reminder.command",
  "task.command",
  "rss.command",
  "webhook.command",
  "custom-command.config",
  "command-alias.config",
  "group-glossary.config",
  "bot-voice.config",
  "staff-shift.config",
  "rituals.config",
  "scheduled-rules.config",
  "module-rename.config",
  "dock.config",
  "density-mode.command",
  "interest-tags.command",
  "idea-voting.command",
  "scavenger-hunt.command",
  "season-album.command",
  "notes-port.command",
  "files.command",
  "attachment",
  "games.hub",
  "casino.command",
  "casino.duel-callback",
  "trivia.command",
  "trivia.answer",
  "quiz.scores",
  "quiz.command",
  "quiz.answer",
  "admin-tool.command",
  "warn.remove-callback",
  "human-verify.callback",
  "join-request",
  "guardian.command",
  "guardian.staff-callback",
  "permission.audit",
  "quote.command",
  "reaction.command",
  "reaction.callback",
  "fun.command",
  "fun.callback",
  "utility.command",
  "utility-plus.command",
  "data-reports.command",
  "afk.command",
  "ai.command",
  "payment.command",
  "payment.pre-checkout",
  "payment.successful",
  "welcome.buttons-callback",
  "captcha.callback",
  "captcha.text-answer",
  "bot.onboarding",
  "power.watch",
  "appointed-admin.guard",
  "chat-member.update",
  "reaction.perm-invalidate",
  "members.new",
  "edit-guard.ambient",
  "reaction.ambient",
  "reaction.moderate",
  "scheduled-strict.ambient",
  "members.left",
  "service-message.clean",
  "membership-gate.check",
  "content-lock.ambient",
  "blocklist.ambient",
  "char-filter.ambient",
  "dangerous-file.ambient",
  "privacy-leak.ambient",
  "scam-signals.ambient",
  "social-signals.ambient",
  "night-mode.ambient",
  "automation.ambient",
  "quarantine.ambient",
  "afk.ambient",
  "social.auto-pole",
  "introduction.message",
  "introduction.admin",
  "introduction.mirror",
  "introduction.staff-callback",
  "introduction.join",
  "community.mention-all",
  "community.mention-admins",
  "afk.phrase",
  "notes.recall",
  "custom-command.dispatch",
  "filter.ambient",
  "panel.text-input",
  "feedback.staff-reply",
  "feedback.dm",
  "dm-chat",
  "mention-chat",
  "mission.progress",
  "antiflood.message",
  "scam.watch",
  "games.text",
];

/** Los 6 postprocesadores en su orden exacto, congelado el 2026-08-19. */
const ORDEN_POSTPROCESADORES: readonly string[] = [
  "activity-xp",
  "activity-currency",
  "activity-record",
  "gamification-first-message",
  "automation-message",
  "automation-new-members",
];

describe("pipeline: orden congelado", () => {
  it("mantiene los 177 handlers en el mismo orden", () => {
    expect(nombresDelRegistro("private botHandlers()")).toEqual(ORDEN_HANDLERS);
  });

  it("no registra dos handlers con el mismo nombre", () => {
    const vistos = nombresDelRegistro("private botHandlers()");
    expect(vistos.length).toBe(new Set(vistos).size);
  });

  it("mantiene los 6 postprocesadores en el mismo orden", () => {
    expect(nombresDelRegistro("private botPostProcessors()")).toEqual(
      ORDEN_POSTPROCESADORES,
    );
  });
});

describe("pipeline: los gates apuntan a handlers que existen", () => {
  it("toda clave de GATED_HANDLERS es un handler registrado", () => {
    const registrados = new Set(nombresDelRegistro("private botHandlers()"));
    const huerfanas = clavesDelGate("GATED_HANDLERS").filter(
      (clave) => !registrados.has(clave),
    );
    // Una clave huerfana es una puerta desactivada en silencio: el handler
    // pasa a ejecutarse siempre, tambien en modo pasivo, y no falla nada.
    expect(huerfanas).toEqual([]);
  });

  it("toda clave de GATED_POSTPROCESSORS es un postprocesador registrado", () => {
    const registrados = new Set(
      nombresDelRegistro("private botPostProcessors()"),
    );
    const huerfanas = clavesDelGate("GATED_POSTPROCESSORS").filter(
      (clave) => !registrados.has(clave),
    );
    expect(huerfanas).toEqual([]);
  });
});
