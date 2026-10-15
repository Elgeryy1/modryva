import { describe, expect, it } from "vitest";

import {
  type ArchivoDeMensajesPort,
  archivarMensaje,
  type EdicionArchivable,
  type MensajeArchivable,
  mensajeDesdeUpdate,
  queHacerConElUpdate,
  type UpdateParaArchivo,
} from "./archivo.js";

/**
 * El registro completo, extraido del servicio.
 *
 * Lo que distingue a este de la actividad (`chat-activity.logger`) es que **no
 * se salta nada**: guarda comandos, mensajes solo con foto y ediciones. Los
 * tests de aqui son los que impiden que esa diferencia se pierda en una
 * refactorizacion futura.
 */

const BASE: UpdateParaArchivo = {
  tipo: "message",
  tenantId: "t1",
  chatId: "c1",
  telegramChatId: -100n,
  telegramUserId: 7n,
  mensajeId: 42,
  texto: "hola",
  recibidoEn: new Date("2026-08-20T10:00:00.000Z"),
  hiloId: undefined,
  usuario: "gery",
  nombreVisible: "Gerard",
  respondeAMensajeId: undefined,
  respondeAUsuarioId: undefined,
  adjunto: undefined,
};

const archivoFalso = () => {
  const guardados: MensajeArchivable[] = [];
  const ediciones: EdicionArchivable[] = [];
  const puerto: ArchivoDeMensajesPort = {
    guardar: async (m) => {
      guardados.push(m);
    },
    guardarEdicion: async (e) => {
      ediciones.push(e);
    },
  };
  return { guardados, ediciones, puerto };
};

describe("queHacerConElUpdate", () => {
  it("un mensaje con texto se archiva", () => {
    expect(queHacerConElUpdate(BASE)).toBe("archivar");
  });

  it("un mensaje SOLO con adjunto tambien se archiva", () => {
    // La diferencia con la actividad: aqui una foto sin pie si cuenta.
    expect(
      queHacerConElUpdate({
        ...BASE,
        texto: undefined,
        adjunto: {
          tipo: "photo",
          ficheroId: "f1",
          ficheroUnicoId: "u1",
        },
      }),
    ).toBe("archivar");
  });

  it("sin texto y sin adjunto se ignora: es un evento de servicio", () => {
    expect(
      queHacerConElUpdate({ ...BASE, texto: undefined, adjunto: undefined }),
    ).toBe("ignorar");
  });

  it("una edicion se anota, no se archiva de nuevo", () => {
    expect(queHacerConElUpdate({ ...BASE, tipo: "edited_message" })).toBe(
      "anotar-edicion",
    );
  });

  it("una edicion sin chat o sin mensaje se ignora", () => {
    expect(
      queHacerConElUpdate({
        ...BASE,
        tipo: "edited_message",
        mensajeId: undefined,
      }),
    ).toBe("ignorar");
  });

  it("sin usuario no se archiva", () => {
    expect(queHacerConElUpdate({ ...BASE, telegramUserId: undefined })).toBe(
      "ignorar",
    );
  });
});

describe("mensajeDesdeUpdate", () => {
  it("marca el tipo como text cuando no hay adjunto", () => {
    expect(mensajeDesdeUpdate(BASE)).toMatchObject({ tipo: "text" });
  });

  it("toma el tipo del adjunto cuando lo hay", () => {
    const mensaje = mensajeDesdeUpdate({
      ...BASE,
      adjunto: { tipo: "video", ficheroId: "f", ficheroUnicoId: "u" },
    });
    expect(mensaje).toMatchObject({ tipo: "video" });
  });

  it("omite los campos ausentes en vez de ponerlos a undefined", () => {
    const mensaje = mensajeDesdeUpdate({
      ...BASE,
      usuario: undefined,
      hiloId: undefined,
    });
    expect(mensaje).not.toHaveProperty("usuario");
    expect(mensaje).not.toHaveProperty("hiloId");
  });

  it("conserva a quien se responde", () => {
    const mensaje = mensajeDesdeUpdate({
      ...BASE,
      respondeAMensajeId: 10,
      respondeAUsuarioId: 99n,
    });
    expect(mensaje).toMatchObject({
      respondeAMensajeId: 10,
      respondeAUsuarioId: 99n,
    });
  });
});

describe("archivarMensaje", () => {
  it("guarda el mensaje y devuelve null", async () => {
    const { puerto, guardados } = archivoFalso();
    await expect(archivarMensaje(BASE, puerto)).resolves.toBeNull();
    expect(guardados).toHaveLength(1);
  });

  it("una edicion va por la otra puerta", async () => {
    const { puerto, guardados, ediciones } = archivoFalso();
    await archivarMensaje({ ...BASE, tipo: "edited_message" }, puerto);
    expect(ediciones).toHaveLength(1);
    expect(guardados).toHaveLength(0);
  });

  it("si guardar falla, sigue devolviendo null", async () => {
    // Archivar nunca puede impedir que el bot modere.
    const puerto: ArchivoDeMensajesPort = {
      guardar: async () => {
        throw new Error("disco lleno");
      },
      guardarEdicion: async () => {},
    };
    await expect(archivarMensaje(BASE, puerto)).resolves.toBeNull();
  });

  it("si anotar la edicion falla, tambien", async () => {
    const puerto: ArchivoDeMensajesPort = {
      guardar: async () => {},
      guardarEdicion: async () => {
        throw new Error("disco lleno");
      },
    };
    await expect(
      archivarMensaje({ ...BASE, tipo: "edited_message" }, puerto),
    ).resolves.toBeNull();
  });
});
