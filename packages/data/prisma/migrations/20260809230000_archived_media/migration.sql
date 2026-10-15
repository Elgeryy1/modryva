-- Archivo de fotos para el bot consultor.
--
-- Una tabla nueva en vez de alargar la retencion de `verification_media`, que
-- era la alternativa obvia y es la equivocada: esa retencion es la promesa que
-- la Mini App le ensena a cada persona antes de sacarse la foto ("tu foto se
-- borra sola en N horas"), y el barrido es quien la cumple. Tocarla habria
-- cambiado en silencio lo que se le prometio a gente que ya se verifico.
--
-- Aqui la copia es explicita: tiene su propia fecha, su propio origen y su
-- propia razon de ser, de modo que quien mire el esquema dentro de un ano vea
-- que alguien decidio conservar esto, y no que se le olvido borrarlo.
--
-- `capturedAt` es la fecha del mensaje original. El archivador puede correr
-- meses despues, y fechar las fotos el dia del rescate haria ilegible la unica
-- pregunta que se le hace a esta tabla: cuando entro esta persona.
--
-- Aditiva: crea una tabla nueva y no toca ninguna existente.

-- CreateTable
CREATE TABLE "archived_media" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "objectStorageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sourceChatId" BIGINT,
    "sourceMessageId" INTEGER,
    "sessionId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "archived_media_telegramUserId_capturedAt_idx" ON "archived_media"("telegramUserId", "capturedAt");

-- CreateIndex
CREATE INDEX "archived_media_sha256_idx" ON "archived_media"("sha256");

-- CreateIndex
CREATE INDEX "archived_media_sessionId_idx" ON "archived_media"("sessionId");

-- CreateIndex
-- Lo que hace que el archivador se pueda repetir sin duplicar: reprocesar un
-- canal entero es la operacion normal, no la excepcion.
CREATE UNIQUE INDEX "archived_media_sourceChatId_sourceMessageId_key" ON "archived_media"("sourceChatId", "sourceMessageId");
