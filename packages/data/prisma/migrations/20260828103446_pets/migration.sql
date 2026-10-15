-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "especie" TEXT NOT NULL,
    "rasgos" TEXT[],
    "nombre" TEXT,
    "hambre" INTEGER NOT NULL DEFAULT 100,
    "animo" INTEGER NOT NULL DEFAULT 100,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "vistaEn" TIMESTAMP(3) NOT NULL,
    "racionesHoy" INTEGER NOT NULL DEFAULT 0,
    "racionesDia" TEXT,
    "serverSeed" TEXT,
    "serverSeedHash" TEXT,
    "clientSeed" TEXT,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "huevosSinRara" INTEGER NOT NULL DEFAULT 0,
    "regalada" BOOLEAN NOT NULL DEFAULT false,
    "nacidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pets_tenantId_chatId_nivel_idx" ON "pets"("tenantId", "chatId", "nivel");

-- CreateIndex
CREATE INDEX "pets_vistaEn_idx" ON "pets"("vistaEn");

-- CreateIndex
CREATE UNIQUE INDEX "pets_tenantId_chatId_userTelegramId_key" ON "pets"("tenantId", "chatId", "userTelegramId");
