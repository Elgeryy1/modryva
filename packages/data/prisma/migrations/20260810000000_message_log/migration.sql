-- Registro completo de mensajes.
--
-- Decision explicita del propietario (2026-08-09): Modryva guarda TODO lo que
-- ve —texto, fotos, videos y audios, en todos los grupos— y sin caducidad, para
-- que el bot consultor pueda ensenarlo en `/info`.
--
-- Tabla nueva y no una columna mas en `chat_activity_events`, que era la
-- alternativa obvia y es la equivocada por dos razones que no son de estilo:
-- aquella caduca a los 90 dias (`data.retention_cleanup` la barre) y alimenta
-- heuristicas de moderacion que cuentan filas. Meter aqui el historico entero
-- habria roto lo primero y falseado lo segundo, las dos cosas en silencio.
--
-- Sin job de retencion, a diferencia del resto del esquema. Es deliberado y es
-- lo que hay que mirar primero si algun dia esta tabla se come el disco.
--
-- El indice (objectStorageKey, mediaFileId) no es para consultar: ES la cola de
-- trabajo del job que baja los bytes. Un mensaje con file_id y sin clave de
-- almacen es un fichero pendiente de descargar. Se resolvio asi en vez de
-- encolar en `job_outbox` porque esa tabla, a dia de hoy, no la drena nadie:
-- encolar alli habria sido escribir en un agujero negro.
--
-- Aditiva: crea una tabla nueva y no toca ninguna existente.

-- CreateTable
CREATE TABLE "message_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "telegramChatId" BIGINT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "threadId" INTEGER,
    "username" TEXT,
    "displayName" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "replyToMessageId" INTEGER,
    "replyToUserId" BIGINT,
    "mediaFileId" TEXT,
    "mediaUniqueId" TEXT,
    "mediaMimeType" TEXT,
    "mediaSizeBytes" INTEGER,
    "objectStorageKey" TEXT,
    "mediaAttempts" INTEGER NOT NULL DEFAULT 0,
    "mediaError" TEXT,
    "editedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_log_telegramUserId_sentAt_idx" ON "message_log"("telegramUserId", "sentAt");

-- CreateIndex
CREATE INDEX "message_log_telegramChatId_sentAt_idx" ON "message_log"("telegramChatId", "sentAt");

-- CreateIndex
CREATE INDEX "message_log_objectStorageKey_mediaFileId_idx" ON "message_log"("objectStorageKey", "mediaFileId");

-- CreateIndex
-- Lo que hace que reprocesar un update repetido no duplique la fila. El bot
-- deduplica ya por (botKey, updateId) en `update_inbox`, pero eso no cubre el
-- mismo mensaje llegando por un camino distinto.
CREATE UNIQUE INDEX "message_log_telegramChatId_messageId_key" ON "message_log"("telegramChatId", "messageId");
