import type { MessageLogRepository, PendingMedia } from "@superbot/data";
import type { ObjectStorageDriver } from "@superbot/module-files";
import { describe, expect, it } from "vitest";
import { processMessageMedia } from "./message-media-processor.js";

const pendiente = (extra: Partial<PendingMedia> = {}): PendingMedia => ({
  id: "ml_1",
  tenantId: "t1",
  telegramUserId: 111222333n,
  mediaFileId: "AgACAgQ",
  mediaMimeType: "image/jpeg",
  attempts: 0,
  ...extra,
});

/** Almacen de mentira que apunta lo que le mandan guardar. */
const almacen = (): ObjectStorageDriver & { guardado: Map<string, Buffer> } => {
  const guardado = new Map<string, Buffer>();
  return {
    kind: "local",
    guardado,
    async put(input) {
      guardado.set(input.key, input.data);
    },
    async get(key) {
      return guardado.get(key) ?? null;
    },
    async delete(key) {
      guardado.delete(key);
    },
    async exists(key) {
      return guardado.has(key);
    },
  };
};

/** Repositorio de mentira con lo justo que el job toca. */
const repositorio = (
  pendientes: PendingMedia[],
): MessageLogRepository & {
  guardados: { id: string; clave: string }[];
  fallados: { id: string; error: string }[];
} => {
  const guardados: { id: string; clave: string }[] = [];
  const fallados: { id: string; error: string }[] = [];
  return {
    guardados,
    fallados,
    async record() {},
    async recordEdit() {},
    async listByUser() {
      return [];
    },
    async countByUser() {
      return 0;
    },
    async searchByUser() {
      return [];
    },
    async listPendingMedia() {
      return pendientes;
    },
    async markMediaStored(id, clave) {
      guardados.push({ id, clave });
    },
    async markMediaFailed(id, error) {
      fallados.push({ id, error });
    },
    async purgeUser() {
      return [];
    },
  };
};

describe("processMessageMedia", () => {
  it("guarda los bytes y apunta la clave", async () => {
    const repo = repositorio([pendiente()]);
    const store = almacen();
    const resumen = await processMessageMedia({
      messages: repo,
      storage: store,
      downloadFile: async () => Buffer.from("unos bytes"),
      resolveBotToken: async () => "token",
    });

    expect(resumen).toEqual({ processed: 1, stored: 1, failed: 0 });
    expect(repo.guardados).toHaveLength(1);
    // Una carpeta por persona, y la extension del MIME para que el fichero se
    // pueda abrir luego. Tiene que coincidir con lo que escribe el rescate del
    // historial, o la carpeta de alguien acabaria partida en dos sitios.
    expect(repo.guardados[0]?.clave).toMatch(
      /^usuarios\/111222333\/mensajes\/.+\.jpg$/u,
    );
    expect(store.guardado.size).toBe(1);
  });

  it("cuenta el intento cuando Telegram ya no tiene el fichero", async () => {
    // Ausente no es lo mismo que roto: no va a aparecer reintentando, pero el
    // intento tiene que contar para que el tope acabe soltando la fila.
    const repo = repositorio([pendiente()]);
    const resumen = await processMessageMedia({
      messages: repo,
      storage: almacen(),
      downloadFile: async () => null,
      resolveBotToken: async () => "token",
    });

    expect(resumen).toEqual({ processed: 1, stored: 0, failed: 1 });
    expect(repo.fallados).toHaveLength(1);
  });

  it("un fichero que revienta no arrastra a los demas del lote", async () => {
    // El fallo que esto evita: una foto borrada convertia el job en veneno y
    // bloqueaba todas las descargas que venian detras.
    const repo = repositorio([
      pendiente({ id: "malo", mediaFileId: "explota" }),
      pendiente({ id: "bueno" }),
    ]);
    const resumen = await processMessageMedia({
      messages: repo,
      storage: almacen(),
      downloadFile: async ({ fileId }) => {
        if (fileId === "explota") throw new Error("400 Bad Request");
        return Buffer.from("ok");
      },
      resolveBotToken: async () => "token",
    });

    expect(resumen).toEqual({ processed: 2, stored: 1, failed: 1 });
    expect(repo.fallados[0]?.id).toBe("malo");
    expect(repo.guardados[0]?.id).toBe("bueno");
  });

  it("no se traga un tipo desconocido: deja .bin en vez de inventarse una extension", async () => {
    const repo = repositorio([pendiente({ mediaMimeType: null })]);
    await processMessageMedia({
      messages: repo,
      storage: almacen(),
      downloadFile: async () => Buffer.from("x"),
      resolveBotToken: async () => "token",
    });
    expect(repo.guardados[0]?.clave).toMatch(/\.bin$/u);
  });
});
