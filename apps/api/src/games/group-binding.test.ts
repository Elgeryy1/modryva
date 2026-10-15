import { describe, expect, it } from "vitest";
import { MEMBER_STATUSES, resolveGroupForCaller } from "./group-binding.js";

/**
 * El control que faltaba.
 *
 * `match.service` cogia el id del grupo del `start_param` de la Mini App y solo
 * comprobaba que fuera numerico. El `start_param` lo elige quien construye el
 * enlace: abrir `t.me/<bot>/<app>?startapp=games_<grupo_ajeno>` bastaba para que
 * el bot publicara un mensaje con tu nombre en un grupo del que no eres miembro.
 * La firma de Telegram demuestra que el valor paso por esta Mini App; no
 * demuestra que te corresponda.
 *
 * `games.service` SI hacia las dos comprobaciones. Dos caminos leyendo el mismo
 * dato, uno atandolo a quien pregunta y el otro no: por eso el arreglo es una
 * funcion compartida y no un bloque copiado.
 */

const chat = { chatId: "chat_interno" };
const base = {
  tenantId: "t1",
  telegramChatId: -1001234567890n,
  telegramUserId: 42n,
  token: "bot:token",
};

const deps = (opciones: {
  chatEncontrado?: boolean;
  estado?: string;
  telegramFalla?: boolean;
}) => ({
  foundation: {
    findChatByTelegramId: async () =>
      opciones.chatEncontrado === false ? null : chat,
  },
  gateway: {
    getChatMember: async () => {
      if (opciones.telegramFalla) {
        throw new Error("Telegram dijo que no");
      }
      return { ok: true, status: opciones.estado ?? "member" };
    },
  },
});

describe("resolveGroupForCaller", () => {
  it("deja pasar a un miembro", async () => {
    expect(await resolveGroupForCaller(deps({}), base)).toEqual(chat);
  });

  it("rechaza a quien NO esta en el grupo", async () => {
    expect(
      await resolveGroupForCaller(deps({ estado: "left" }), base),
    ).toBeNull();
  });

  it("rechaza a quien esta EXPULSADO", async () => {
    // Es la mitad que mas duele del agujero: sin esta comprobacion, alguien
    // baneado de un grupo seguia pudiendo hacer que el bot escribiera su nombre
    // en el.
    expect(
      await resolveGroupForCaller(deps({ estado: "kicked" }), base),
    ).toBeNull();
  });

  it("deja pasar a un silenciado: sigue siendo miembro", async () => {
    expect(
      await resolveGroupForCaller(deps({ estado: "restricted" }), base),
    ).toEqual(chat);
    expect(MEMBER_STATUSES.has("restricted")).toBe(true);
  });

  it("rechaza un grupo que no es de este tenant", async () => {
    // Sin esto, un bot podria escribir en los grupos servidos por otro.
    expect(
      await resolveGroupForCaller(deps({ chatEncontrado: false }), base),
    ).toBeNull();
  });

  it("falla CERRADO si Telegram no contesta", async () => {
    // Un fallo de red no puede ser lo que conceda el acceso.
    expect(
      await resolveGroupForCaller(deps({ telegramFalla: true }), base),
    ).toBeNull();
  });

  it("ni 'left' ni 'kicked' cuentan como pertenencia", async () => {
    expect(MEMBER_STATUSES.has("left")).toBe(false);
    expect(MEMBER_STATUSES.has("kicked")).toBe(false);
  });
});
