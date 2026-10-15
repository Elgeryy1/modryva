-- Libro mayor de la moneda del grupo.
--
-- `economy_wallets` ya existia (y llevaba tiempo sin usarla nadie) pero solo
-- guarda el saldo. Un saldo a secas no puede responder a "quien me ha robado",
-- que es la primera pregunta que llega en cuanto el robo existe, y tampoco
-- protege de pagar dos veces la misma concesion si un update se reprocesa.
--
-- Tabla aparte y no columnas mas en `economy_wallets` porque son cosas de vida
-- distinta: la cartera es un valor actual que se sobreescribe, esto es un
-- historico que solo crece.
--
-- El unique compuesto es la idempotencia: (tenant, chat, usuario, motivo, ref).
-- Ojo al usarlo desde el codigo — en Postgres dos NULL NO colisionan, asi que un
-- `refId` nulo desactiva la proteccion en vez de reforzarla. Los movimientos que
-- de verdad son irrepetibles (donaciones, robos) tienen que traer un uuid.
--
-- Sin job de retencion, igual que `chip_ledger`: el historial de movimientos es
-- justo lo que se consulta cuando hay una queja, y esa queja llega tarde.
--
-- Aditiva: crea una tabla nueva y no toca ninguna existente.

-- CreateTable
CREATE TABLE "economy_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "economy_ledger_tenantId_chatId_telegramUserId_idx" ON "economy_ledger"("tenantId", "chatId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "economy_ledger_tenantId_chatId_telegramUserId_reason_refId_key" ON "economy_ledger"("tenantId", "chatId", "telegramUserId", "reason", "refId");
