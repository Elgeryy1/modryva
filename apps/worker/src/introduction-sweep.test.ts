import { InMemoryIntroductionRepository } from "@superbot/data";
import { describe, expect, it } from "vitest";
import {
  type IntroductionSweepContext,
  processIntroductionSweep,
} from "./guardian-processor.js";

/**
 * El barrido que expulsaba solo no tenia ni un test. El 3 de agosto de 2026
 * saco a trece personas de dos grupos, tres de ellas administradores a los que
 * el propio bot habia ascendido horas antes, y no dejo ni una linea de registro
 * de ninguna: borraba la fila y no escribia auditoria. La lista hubo que
 * reconstruirla desde los updates crudos de Telegram.
 *
 * Desde 2026-08-13 el barrido vuelve a expulsar — pero solo la escalada, solo
 * al agotar los avisos, y re-comprobando quien es la persona antes de cada
 * paso. De ahi lo que se prueba aqui: que en el tick de la ficha NO se expulsa
 * a nadie, que la escalada respeta cadencia/limite/admins, y que todo camino
 * deja rastro.
 */

const AHORA = new Date("2026-08-03T05:30:00Z");
const VENCIDO = new Date("2026-08-03T05:29:00Z");

interface Enviado {
  chatId: bigint;
  text: string;
  threadId: number | undefined;
  replyMarkup: Record<string, unknown> | undefined;
}

interface Auditado {
  action: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
}

const STAFF = -1009000000005n;
const GRUPO = -1009000000004n;

interface OpcionesMontar {
  estado?: string;
  consultaOk?: boolean;
  staffChatId?: bigint | null;
  envioOk?: boolean;
  lanzaAlEnviar?: boolean;
  /** Tema propio para las fichas; sin esto heredan el de Guardian (el 2). */
  temaPresentaciones?: number | null;
  /** Escribir el warn revienta: la ficha tiene que salir igual. */
  warnFalla?: boolean;
  /** Warns activos que ya tenia antes de este barrido. */
  warnsPrevios?: number;
  limiteDeWarns?: number;
  /** Cadencia de la escalada; null la apaga (comportamiento pre-escalada). */
  cadencia?: number | null;
  /** Expulsion automatica al limite. Por defecto encendida, como en produccion. */
  autoKick?: boolean;
  /** El kick de Telegram revienta: la fila tiene que quedarse. */
  kickFalla?: boolean;
  /** `SUPERBOT_INTOCABLES_TELEGRAM_IDS`. Vacia salvo que el test diga otra cosa. */
  intocables?: readonly bigint[];
}

const montar = async (opciones: OpcionesMontar = {}) => {
  const introductions = new InMemoryIntroductionRepository();
  await introductions.start({
    tenantId: "t1",
    chatId: "chat_interno",
    telegramChatId: -1009000000004n,
    telegramUserId: 9000000003n,
    username: "marcosss_r",
    dueAt: VENCIDO,
  });
  const fila = (await introductions.listOverdue(AHORA))[0];

  const enviados: Enviado[] = [];
  const auditoria: Auditado[] = [];
  /** Warns vivos, por id. `revertidos` guarda los que se deshicieron. */
  const warns: string[] = [];
  const revertidos: string[] = [];

  /** Expulsiones ejecutadas (ban+unban) y fichas editadas por la escalada. */
  const kicks: bigint[] = [];
  const editados: { chatId: bigint; messageId: number; text: string }[] = [];

  const context: IntroductionSweepContext = {
    introductions,
    intocables: opciones.intocables ?? [],
    gateway: {
      async getChatMember() {
        const ok = opciones.consultaOk ?? true;
        return ok
          ? { ok: true, status: opciones.estado ?? "member" }
          : { ok: false };
      },
      async sendMessage(input) {
        if (opciones.lanzaAlEnviar) {
          throw new Error("Telegram dijo que no");
        }
        enviados.push({
          chatId: input.chatId,
          text: input.reply.text,
          threadId: input.messageThreadId,
          replyMarkup: input.reply.replyMarkup,
        });
        return opciones.envioOk === false
          ? { ok: false }
          : { ok: true, messageId: 42 };
      },
      async banChatMember(input) {
        if (opciones.kickFalla) {
          throw new Error("Telegram dijo que no al ban");
        }
        kicks.push(input.userId);
        return { ok: true };
      },
      async unbanChatMember() {
        return { ok: true };
      },
      async editMessageText(input) {
        editados.push({
          chatId: input.chatId,
          messageId: input.messageId,
          text: input.reply.text,
        });
        return { ok: true };
      },
    },
    async staffRoom() {
      const staffChatId =
        opciones.staffChatId === undefined
          ? -1009000000005n
          : opciones.staffChatId;
      return {
        staffChatId,
        staffThreadId: 2,
        introductionThreadId: opciones.temaPresentaciones ?? null,
      };
    },
    async chatTitle() {
      return "Grupo Central";
    },
    async introductionSettings() {
      return {
        enabled: true,
        deadlineHours: 12,
        requirePhoto: true,
        requireAge: true,
        requireOrigin: true,
        staffThreadId: null,
        mirrorToStaff: false,
        reminderEveryHours:
          opciones.cadencia === undefined ? 2 : opciones.cadencia,
        autoKickAtLimit: opciones.autoKick ?? true,
      };
    },
    warns: {
      async create() {
        if (opciones.warnFalla) {
          throw new Error("la base de datos dijo que no");
        }
        const recordId = `warn_${warns.length + 1}`;
        warns.push(recordId);
        return { recordId };
      },
      async countActive() {
        return (opciones.warnsPrevios ?? 0) + warns.length;
      },
      async limitFor() {
        return opciones.limiteDeWarns ?? 3;
      },
      async revert(warningId) {
        revertidos.push(warningId);
        const i = warns.indexOf(warningId);
        if (i >= 0) {
          warns.splice(i, 1);
        }
      },
    },
    async resolveBotToken() {
      return "token";
    },
    async audit(input) {
      auditoria.push({
        action: input.action,
        ...(input.resourceId !== undefined
          ? { resourceId: input.resourceId }
          : {}),
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
      });
    },
    now: AHORA,
  };

  return {
    context,
    introductions,
    enviados,
    auditoria,
    warns,
    revertidos,
    kicks,
    editados,
    opciones,
    /** Lo que va a la sala de STAFF. */
    fichas: () => enviados.filter((e) => e.chatId === STAFF),
    /** Lo que va al grupo donde esta la gente. */
    avisos: () => enviados.filter((e) => e.chatId === GRUPO),
    filaId: fila?.id ?? "",
  };
};

/** El mismo barrido, un rato despues: la escalada corre con el reloj. */
const horasDespues = (
  context: IntroductionSweepContext,
  horas: number,
): IntroductionSweepContext => ({
  ...context,
  now: new Date(AHORA.getTime() + horas * 3_600_000),
});

describe("processIntroductionSweep — el tick de la ficha no expulsa", () => {
  it("no toca ningun metodo de expulsion, ni existiendo", async () => {
    // El gateway se envuelve en un Proxy que responde a CUALQUIER metodo. La
    // unica expulsion legitima es la de la escalada al agotar los avisos, y en
    // el tick que abre la ficha la escalada aun no ha vencido — si el barrido
    // toca banChatMember AQUI, algo ha vuelto a romperse como el 3 de agosto,
    // y este test lo caza. Un doble que solo implementa dos metodos petaria
    // con TypeError, que es una senal, pero por el motivo equivocado y facil
    // de silenciar con un catch.
    const { context, fichas } = await montar();
    const llamados: string[] = [];
    const espiado = new Proxy(context.gateway as Record<string, unknown>, {
      get(target, prop: string) {
        llamados.push(prop);
        const real = target[prop];
        return typeof real === "function"
          ? real
          : async () => ({ ok: true, status: "member" });
      },
    }) as IntroductionSweepContext["gateway"];

    await processIntroductionSweep({ ...context, gateway: espiado });

    expect(llamados).toContain("sendMessage");
    expect(llamados).not.toContain("banChatMember");
    expect(llamados).not.toContain("unbanChatMember");
    expect(llamados).not.toContain("restrictChatMember");
    expect(fichas()).toHaveLength(1);
  });

  it("publica una ficha en la sala de STAFF, en su tema", async () => {
    const { context, fichas } = await montar();
    const resumen = await processIntroductionSweep(context);

    expect(resumen.reported).toBe(1);
    expect(resumen.processed).toBe(1);
    expect(fichas()).toHaveLength(1);
    expect(fichas()[0]?.chatId).toBe(STAFF);
    expect(fichas()[0]?.threadId).toBe(2);
    expect(fichas()[0]?.text).toContain("9000000003");
    expect(fichas()[0]?.replyMarkup).toBeDefined();
  });

  it("deja la fila viva: los botones necesitan algo sobre lo que actuar", async () => {
    const { context, introductions } = await montar();
    await processIntroductionSweep(context);

    const fila = await introductions.find("t1", "chat_interno", 9000000003n);
    expect(fila).not.toBeNull();
    expect(fila?.reportedAt).toEqual(AHORA);
  });

  it("no republica la ficha en el siguiente tick", async () => {
    const { context, fichas } = await montar();
    await processIntroductionSweep(context);
    const segundo = await processIntroductionSweep(context);

    expect(fichas()).toHaveLength(1);
    expect(segundo.processed).toBe(0);
  });
});

describe("processIntroductionSweep — a quien no le toca", () => {
  it.each([
    "administrator",
    "creator",
  ])("un %s no llega ni a la sala de STAFF", async (estado) => {
    const { context, enviados, auditoria, introductions } = await montar({
      estado,
    });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.skippedAdmin).toBe(1);
    expect(resumen.reported).toBe(0);
    expect(enviados).toHaveLength(0);
    expect(auditoria.map((a) => a.action)).toContain(
      "introduction.skipped_admin",
    );
    // Y se cierra el caso: dejarlo abierto lo re-listaria cada minuto.
    expect(
      await introductions.find("t1", "chat_interno", 9000000003n),
    ).toBeNull();
  });

  it("un intocable no llega a la sala de STAFF aunque sea un miembro raso", async () => {
    // El caso que la comprobacion de admin no cubre: sin cargo ninguno.
    const { context, enviados, auditoria, introductions } = await montar({
      estado: "member",
      intocables: [9000000003n],
    });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.skippedIntocable).toBe(1);
    expect(resumen.skippedAdmin).toBe(0);
    expect(resumen.reported).toBe(0);
    expect(enviados).toHaveLength(0);
    expect(auditoria.map((a) => a.action)).toContain(
      "introduction.skipped_untouchable",
    );
    expect(
      await introductions.find("t1", "chat_interno", 9000000003n),
    ).toBeNull();
  });

  it("y si entra en la lista con la ficha ya abierta, la escalada lo suelta", async () => {
    // Quien ya estaba en el embudo antes de ser intocable. Sin la segunda
    // comprobacion, la escalada seguiria avisandole hasta expulsarle.
    const opciones: OpcionesMontar = {};
    const { context, warns, kicks, auditoria } = await montar(opciones);
    await processIntroductionSweep(context);
    opciones.intocables = [9000000003n];
    const resumen = await processIntroductionSweep(
      horasDespues({ ...context, intocables: [9000000003n] }, 2),
    );

    expect(resumen.skippedIntocable).toBe(1);
    expect(warns).toHaveLength(1); // solo el previo a entrar en la lista
    expect(kicks).toHaveLength(0);
    expect(auditoria.map((a) => a.action)).toContain(
      "introduction.skipped_untouchable",
    );
  });

  it.each([
    "left",
    "kicked",
  ])("a quien ya no esta (%s) no se le abre ficha", async (estado) => {
    const { context, enviados, auditoria } = await montar({ estado });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.alreadyGone).toBe(1);
    expect(enviados).toHaveLength(0);
    expect(auditoria.map((a) => a.action)).toContain(
      "introduction.already_gone",
    );
  });

  it("si la consulta a Telegram falla, sigue adelante y lo mira una persona", async () => {
    // Un fallo de red no puede ser lo que decide. Ante la duda, que lo vea
    // alguien — es la direccion barata de equivocarse.
    const { context, fichas } = await montar({ consultaOk: false });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.reported).toBe(1);
    expect(fichas()).toHaveLength(1);
  });
});

describe("processIntroductionSweep — deja rastro siempre", () => {
  it("la ficha publicada se audita con la hora de entrada y la del plazo", async () => {
    const { context, auditoria } = await montar();
    await processIntroductionSweep(context);

    const registro = auditoria.find(
      (a) => a.action === "introduction.staff_asked",
    );
    expect(registro).toBeDefined();
    expect(registro?.resourceId).toBe("9000000003");
    expect(registro?.payload?.joinedAt).toBeDefined();
    expect(registro?.payload?.dueAt).toBe(VENCIDO.toISOString());
  });

  it("un grupo sin sala de STAFF se audita en vez de callarse", async () => {
    const { context, enviados, auditoria } = await montar({
      staffChatId: null,
    });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.noStaffChat).toBe(1);
    expect(enviados).toHaveLength(0);
    expect(auditoria.map((a) => a.action)).toContain(
      "introduction.no_staff_chat",
    );
  });
});

describe("processIntroductionSweep — cuando el envio no llega", () => {
  it("un envio rechazado deshace la marca para reintentarlo", async () => {
    const { context, introductions, filaId } = await montar({ envioOk: false });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.errors).toBe(1);
    expect(resumen.reported).toBe(0);
    expect(resumen.failures).toContain("staff-card-not-sent");
    const fila = await introductions.findById(filaId);
    expect(fila?.reportedAt).toBeNull();
  });

  it("un envio que revienta tampoco deja la fila marcada", async () => {
    const { context, introductions, filaId } = await montar({
      lanzaAlEnviar: true,
    });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.errors).toBe(1);
    const fila = await introductions.findById(filaId);
    expect(fila?.reportedAt).toBeNull();
  });
});

/**
 * Donde aterriza la ficha.
 *
 * Las presentaciones y los informes de Guardian compartian tema porque el
 * worker avisa —con razon— de que tener dos ajustes de "donde avisa el bot al
 * equipo" garantiza que uno acabe sin configurar. Por eso esto NO es una sala
 * aparte, solo un tema opcional: sin poner nada, todo sigue yendo donde iba.
 */
describe("el tema donde se publica la ficha", () => {
  it("usa el tema propio cuando el grupo lo ha puesto", async () => {
    const { context, fichas } = await montar({ temaPresentaciones: 963 });

    await processIntroductionSweep(context);

    expect(fichas()[0]?.threadId).toBe(963);
  });

  it("sin tema propio sigue yendo al de Guardian", async () => {
    // La compatibilidad es el requisito: los grupos que no toquen nada no
    // pueden notar el cambio.
    const { context, fichas } = await montar();

    await processIntroductionSweep(context);

    expect(fichas()[0]?.threadId).toBe(2);
  });
});

/**
 * El aviso automatico al vencer el plazo.
 *
 * Lo pidieron los grupos: que vencer el plazo no sea solo una ficha que el staff
 * ve y la persona no. Pero un aviso que se pone solo es una sancion que se pone
 * sola, asi que lo que se prueba aqui es sobre todo lo que NO hace.
 */
describe("el aviso automatico", () => {
  it("pone el warn, lo dice en el grupo con el porque y lo dice en la ficha", async () => {
    const { context, fichas, avisos, warns } = await montar();
    const resumen = await processIntroductionSweep(context);

    expect(resumen.warned).toBe(1);
    expect(resumen.warnErrors).toBe(0);
    expect(warns).toEqual(["warn_1"]);

    // En el grupo: el porque, las instrucciones y el contador.
    expect(avisos()).toHaveLength(1);
    const aviso = avisos()[0]?.text ?? "";
    expect(aviso).toContain("aviso automático 1/3");
    expect(aviso).toContain("plazo ha vencido");
    expect(aviso).toContain("año de nacimiento");

    // Y en la ficha del staff, el mismo numero.
    expect(fichas()[0]?.text).toContain("Aviso automático 1/3");
  });

  it("el boton lleva el id del warn, no el de la fila", async () => {
    // Confundirlos deja un boton que dice "warn retirado" sin retirar nada.
    const { context, avisos, filaId } = await montar();
    await processIntroductionSweep(context);

    const teclado = JSON.stringify(avisos()[0]?.replyMarkup);
    expect(teclado).toContain("warn:remove:warn_1");
    expect(teclado).not.toContain(filaId);
  });

  it("al llegar al limite sin expulsion automatica lo dice y no sanciona", async () => {
    // El contador diria "3/3" y no pasaria nada. Un aviso que anuncia una
    // consecuencia que no llega se queda sin credito la primera vez que alguien
    // lo comprueba, asi que con autoKick apagado el mensaje dice que decide un
    // admin. (Con autoKick encendido la consecuencia SI llega y el texto es
    // otro — probado en la escalada, mas abajo.)
    const { context, fichas, avisos } = await montar({
      warnsPrevios: 2,
      autoKick: false,
    });
    const llamados: string[] = [];
    const espiado = new Proxy(context.gateway as Record<string, unknown>, {
      get(target, prop: string) {
        llamados.push(prop);
        const real = target[prop];
        return typeof real === "function"
          ? real
          : async () => ({ ok: true, status: "member" });
      },
    }) as IntroductionSweepContext["gateway"];

    await processIntroductionSweep({ ...context, gateway: espiado });

    expect(avisos()[0]?.text).toContain("aviso automático 3/3");
    expect(avisos()[0]?.text).toContain("No te he sancionado");
    expect(fichas()[0]?.text).toContain("límite alcanzado");
    expect(llamados).not.toContain("banChatMember");
    expect(llamados).not.toContain("restrictChatMember");
  });

  it("si la ficha no llega a publicarse, el warn se deshace", async () => {
    // Si no, quedaria un aviso puesto por una ficha que nadie vio — y el
    // siguiente barrido, al estar la fila sin marcar, pondria otro encima.
    const { context, warns, revertidos, avisos } = await montar({
      envioOk: false,
    });
    const resumen = await processIntroductionSweep(context);

    expect(revertidos).toEqual(["warn_1"]);
    expect(warns).toEqual([]);
    expect(resumen.warned).toBe(0);
    expect(avisos()).toHaveLength(0);
  });

  it("dos barridos con la ficha fallando no acumulan dos warns", async () => {
    const { context, warns } = await montar({ envioOk: false });
    await processIntroductionSweep(context);
    await processIntroductionSweep(context);

    expect(warns).toEqual([]);
  });

  it("si escribir el warn falla, la ficha sale igual y sin anunciar un aviso que no existe", async () => {
    // Cambiar el fallo pequeño (no hay warn) por el grande (nadie decide) seria
    // el peor negocio posible. Y la ficha calla en vez de mentir: anunciar un
    // aviso inexistente manda al staff a buscarlo al historial.
    const { context, fichas, avisos } = await montar({ warnFalla: true });
    const resumen = await processIntroductionSweep(context);

    expect(resumen.reported).toBe(1);
    expect(resumen.warned).toBe(0);
    expect(resumen.warnErrors).toBe(1);
    expect(fichas()).toHaveLength(1);
    expect(fichas()[0]?.text).not.toContain("Aviso automático");
    expect(avisos()).toHaveLength(0);
  });

  it("a un admin y a quien ya se fue no se les avisa de nada", async () => {
    for (const estado of ["administrator", "left"]) {
      const { context, warns, avisos } = await montar({ estado });
      await processIntroductionSweep(context);
      expect(warns).toEqual([]);
      expect(avisos()).toHaveLength(0);
    }
  });

  it("el aviso queda auditado con su contador", async () => {
    const { context, auditoria } = await montar();
    await processIntroductionSweep(context);

    const registro = auditoria.find((a) => a.action === "introduction.warned");
    expect(registro?.resourceId).toBe("9000000003");
    expect(registro?.payload?.count).toBe(1);
    expect(registro?.payload?.limit).toBe(3);
  });
});

/**
 * La escalada: lo que pasa DESPUES de la ficha.
 *
 * Hasta agosto de 2026, nada — un aviso a las 12 h y silencio, y el tema de
 * STAFF acumulando fichas que nadie pulsaba. Ahora la ficha es el principio:
 * aviso a cada cadencia y, si el grupo lo tiene encendido, expulsion al agotar
 * el limite. Lo que mas se prueba sigue siendo lo que NO hace: no expulsa
 * antes de hora, no expulsa a admins, no cuenta como expulsado a quien
 * Telegram no dejo expulsar.
 */
describe("la escalada", () => {
  it("no escala antes de que venza la cadencia", async () => {
    const { context, warns, kicks } = await montar();
    await processIntroductionSweep(context);
    const resumen = await processIntroductionSweep(horasDespues(context, 1));

    expect(warns).toHaveLength(1); // solo el de la ficha
    expect(kicks).toHaveLength(0);
    expect(resumen.escalatedWarns).toBe(0);
  });

  it("a la cadencia pone el siguiente aviso, con boton y consecuencia", async () => {
    const { context, warns, avisos, introductions, filaId } = await montar();
    await processIntroductionSweep(context);
    const resumen = await processIntroductionSweep(horasDespues(context, 2));

    expect(resumen.escalatedWarns).toBe(1);
    expect(warns).toHaveLength(2);
    expect(avisos()).toHaveLength(2);
    const segundo = avisos()[1]?.text ?? "";
    expect(segundo).toContain("aviso automático 2/3");
    expect(segundo).toContain("Al siguiente aviso sales del grupo");
    // El boton de quitar el warn, como en el primero.
    expect(JSON.stringify(avisos()[1]?.replyMarkup)).toContain(
      "warn:remove:warn_2",
    );
    const fila = await introductions.findById(filaId);
    expect(fila?.reminders).toBe(1);
  });

  it("no repite el aviso dentro de la misma ventana", async () => {
    const { context, warns } = await montar();
    await processIntroductionSweep(context);
    await processIntroductionSweep(horasDespues(context, 2));
    const resumen = await processIntroductionSweep(horasDespues(context, 2.5));

    expect(warns).toHaveLength(2);
    expect(resumen.escalatedWarns).toBe(0);
  });

  it("al agotar el limite expulsa, lo anuncia, cierra la ficha y lo audita", async () => {
    const {
      context,
      warns,
      kicks,
      avisos,
      editados,
      auditoria,
      introductions,
    } = await montar();
    await processIntroductionSweep(context); // ficha + 1/3
    await processIntroductionSweep(horasDespues(context, 2)); // 2/3
    const resumen = await processIntroductionSweep(horasDespues(context, 4)); // 3/3 → kick

    expect(warns).toHaveLength(3);
    expect(resumen.autoKicked).toBe(1);
    expect(kicks).toEqual([9000000003n]);

    // El anuncio publico del kick sustituye al aviso 3/3: quien mira ve por
    // que ha salido y que puede volver.
    const ultimo = avisos().at(-1)?.text ?? "";
    expect(ultimo).toContain("sale del grupo");
    expect(ultimo).toContain("3/3");
    expect(ultimo).toContain("volver a entrar");

    // La ficha del staff queda cerrada, con el veredicto y sin botones.
    expect(editados).toHaveLength(1);
    expect(editados[0]?.chatId).toBe(STAFF);
    expect(editados[0]?.messageId).toBe(42);
    expect(editados[0]?.text).toContain("Expulsado automáticamente");

    // Y la fila muere: el caso esta resuelto.
    expect(
      await introductions.find("t1", "chat_interno", 9000000003n),
    ).toBeNull();
    const registro = auditoria.find(
      (a) => a.action === "introduction.auto_kicked",
    );
    expect(registro?.resourceId).toBe("9000000003");
    expect(registro?.payload?.count).toBe(3);
  });

  it("sin expulsion automatica se planta en el limite y la ficha queda", async () => {
    const { context, warns, kicks, introductions, filaId } = await montar({
      autoKick: false,
    });
    await processIntroductionSweep(context);
    await processIntroductionSweep(horasDespues(context, 2));
    await processIntroductionSweep(horasDespues(context, 4));
    const resumen = await processIntroductionSweep(horasDespues(context, 6));

    expect(warns).toHaveLength(3); // 3/3 y ni uno mas: "4/3" no existe
    expect(kicks).toHaveLength(0);
    expect(resumen.autoKicked).toBe(0);
    expect(await introductions.findById(filaId)).not.toBeNull();
  });

  it("un admin en plena escalada sale del embudo, no del grupo", async () => {
    // Ascendido DESPUES de abrirse su ficha — exactamente la carambola del 3
    // de agosto. La escalada lo re-comprueba en cada paso.
    const opciones: OpcionesMontar = {};
    const { context, warns, kicks, auditoria, introductions } =
      await montar(opciones);
    await processIntroductionSweep(context);
    opciones.estado = "administrator";
    const resumen = await processIntroductionSweep(horasDespues(context, 2));

    expect(resumen.skippedAdmin).toBe(1);
    expect(warns).toHaveLength(1); // solo el previo al ascenso
    expect(kicks).toHaveLength(0);
    expect(auditoria.map((a) => a.action)).toContain(
      "introduction.skipped_admin",
    );
    expect(
      await introductions.find("t1", "chat_interno", 9000000003n),
    ).toBeNull();
  });

  it("si Telegram rechaza el kick, la fila se queda para una persona", async () => {
    // Nunca contar como expulsado a quien sigue dentro: la ficha sigue
    // abierta y el proximo tick lo reintentara.
    const opciones: OpcionesMontar = {};
    const { context, kicks, auditoria, introductions, filaId } =
      await montar(opciones);
    await processIntroductionSweep(context);
    await processIntroductionSweep(horasDespues(context, 2));
    opciones.kickFalla = true;
    const resumen = await processIntroductionSweep(horasDespues(context, 4));

    expect(resumen.autoKicked).toBe(0);
    expect(resumen.errors).toBe(1);
    expect(kicks).toHaveLength(0);
    expect(auditoria.map((a) => a.action)).toContain(
      "introduction.auto_kick_failed",
    );
    expect(await introductions.findById(filaId)).not.toBeNull();
  });

  it("con la cadencia a null todo queda como antes de la escalada", async () => {
    const { context, warns, kicks } = await montar({ cadencia: null });
    await processIntroductionSweep(context);
    const resumen = await processIntroductionSweep(horasDespues(context, 6));

    expect(warns).toHaveLength(1);
    expect(kicks).toHaveLength(0);
    expect(resumen.escalatedWarns).toBe(0);
    expect(resumen.autoKicked).toBe(0);
  });
});
