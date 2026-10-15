-- Estado de preparación de cada recurso para cada bot.
--
-- Antes la fila solo existía cuando la subida YA había salido bien, así que no
-- había forma de saber si a un bot hijo nuevo le faltaba biblioteca o si es que
-- nadie lo había intentado. Ahora la fila se crea al planificar el trabajo y
-- lleva su propio estado.
--
-- Aditiva: la columna nueva de file_id pasa a ser nullable y el resto tiene
-- valor por defecto, así que las filas existentes quedan como 'ready'.

ALTER TABLE "telegram_media_files"
    ALTER COLUMN "telegramFileId" DROP NOT NULL;

ALTER TABLE "telegram_media_files"
    ADD COLUMN "state" TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastError" TEXT;

-- Lo que ya estaba guardado venía de una subida correcta: es 'ready'.
UPDATE "telegram_media_files"
   SET "state" = 'ready', "attempts" = 1
 WHERE "telegramFileId" IS NOT NULL;

-- El job de preparación pregunta "qué le falta a este bot".
CREATE INDEX "telegram_media_files_tenantId_state_idx"
    ON "telegram_media_files"("tenantId", "state");
