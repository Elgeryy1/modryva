import type { MessageLogRepository } from "@superbot/data";
import type { ObjectStorageDriver } from "@superbot/module-files";
import { generateObjectKey } from "@superbot/module-files";

/**
 * Baja los ficheros de los mensajes archivados.
 *
 * El bot solo apunta el `file_id` cuando ve el mensaje; bajar los bytes ahi
 * habria puesto una ida y vuelta a Telegram en el camino de cada mensaje del
 * grupo, que es lo que convierte un webhook en un cuello de botella. Aqui, en
 * cambio, tardar no le importa a nadie.
 *
 * La cola no es una tabla aparte: es el propio estado de `message_log`. Una
 * fila con `mediaFileId` y sin `objectStorageKey` es un fichero pendiente. Se
 * hizo asi en vez de encolar en `job_outbox` porque esa tabla no la drena nadie
 * hoy — encolar alli habria sido escribir en un agujero negro.
 */

/** Cuantos ficheros por vuelta. */
const LOTE = 25;

/**
 * Intentos antes de rendirse con un fichero.
 *
 * Existe un limite porque hay fallos que no se arreglan reintentando: Telegram
 * caduca las rutas de getFile y un fichero viejo puede haber desaparecido de
 * sus servidores. Sin tope, esas filas se reintentarian en cada vuelta para
 * siempre y taparian a las que si se pueden bajar.
 */
const MAX_INTENTOS = 3;

export interface MessageMediaContext {
  readonly messages: MessageLogRepository;
  readonly storage: ObjectStorageDriver;
  readonly downloadFile: (input: {
    fileId: string;
    token: string | undefined;
  }) => Promise<Buffer | null>;
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
}

export interface MessageMediaSummary {
  readonly processed: number;
  readonly stored: number;
  readonly failed: number;
}

/** Extension a partir del tipo MIME, para que el fichero se pueda abrir luego. */
const extensionDe = (mime: string | null): string => {
  if (!mime) return "bin";
  const conocidas: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "application/pdf": "pdf",
  };
  const encontrada = conocidas[mime];
  if (encontrada) return encontrada;
  // `image/svg+xml` -> `svg`. Mejor eso que dejarlo todo en .bin.
  const cola = mime.split("/")[1]?.split("+")[0];
  return cola && /^[a-z0-9]{1,8}$/u.test(cola) ? cola : "bin";
};

/**
 * messages.media_fetch — una vuelta de descargas.
 *
 * Best-effort fila a fila: un fichero que falla suma su intento y no arrastra
 * al resto del lote. Lo contrario convertia una foto borrada en Telegram en un
 * job envenenado que bloqueaba todas las descargas detras.
 */
export const processMessageMedia = async (
  context: MessageMediaContext,
): Promise<MessageMediaSummary> => {
  const pendientes = await context.messages.listPendingMedia(
    LOTE,
    MAX_INTENTOS,
  );
  let stored = 0;
  let failed = 0;

  for (const pendiente of pendientes) {
    try {
      const token = await context.resolveBotToken(pendiente.tenantId);
      const bytes = await context.downloadFile({
        fileId: pendiente.mediaFileId,
        token,
      });
      if (!bytes || bytes.length === 0) {
        // Ausente no es lo mismo que roto: Telegram puede haberlo perdido y no
        // va a aparecer reintentando. Se cuenta el intento y se pasa.
        await context.messages.markMediaFailed(
          pendiente.id,
          "Telegram no ha devuelto el fichero",
        );
        failed += 1;
        continue;
      }

      // Una carpeta por persona: `usuarios/<id>/mensajes/...`. Tiene que
      // coincidir con lo que escribe el rescate del historial; si los dos
      // caminos guardaran distinto, la carpeta de alguien tendria la mitad de
      // sus fotos en otro sitio y nadie se enteraria hasta ir a buscarlas.
      const clave = generateObjectKey(
        `usuarios/${pendiente.telegramUserId.toString()}/mensajes`,
        extensionDe(pendiente.mediaMimeType),
      );
      await context.storage.put({
        key: clave,
        data: bytes,
        contentType: pendiente.mediaMimeType ?? "application/octet-stream",
      });
      await context.messages.markMediaStored(pendiente.id, clave);
      stored += 1;
    } catch (error) {
      await context.messages
        .markMediaFailed(
          pendiente.id,
          error instanceof Error ? error.message : String(error),
        )
        .catch(() => undefined);
      failed += 1;
    }
  }

  return { processed: pendientes.length, stored, failed };
};
