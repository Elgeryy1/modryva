-- El Ayudante: una cuenta de usuario (userbot) al lado del bot, con una cola
-- en un solo sentido (el bot encola, el ayudante sirve) y el estado propio que
-- necesitan sus primeros bloques: censo, historial de alias, registro de
-- administracion, atribucion de invitaciones, avisos privados, deteccion de
-- multicuenta y el watchdog.
--
-- Ninguna tabla guarda fotos, IPs ni contenido de mensajes privados de
-- terceros: eso sigue viviendo donde ya vivia (guardian_media, el consultor),
-- fuera del alcance de estas tablas por decision, no por descuido.

-- CreateEnum
CREATE TYPE "EstadoSolicitudAyudante" AS ENUM ('pendiente', 'en_proceso', 'hecho', 'fallo');

-- CreateEnum
CREATE TYPE "EstadoAvisoPrivado" AS ENUM ('pendiente', 'enviado', 'rebotado', 'bloqueado');

-- CreateTable
CREATE TABLE "ayudante_solicitudes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "estado" "EstadoSolicitudAyudante" NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "resultado" JSONB,
    "error" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reclamadaEn" TIMESTAMP(3),
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "ayudante_solicitudes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ayudante_solicitudes_estado_creadaEn_idx" ON "ayudante_solicitudes"("estado", "creadaEn");

-- CreateTable
CREATE TABLE "ayudante_censo_miembros" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "alias" TEXT,
    "nombre" TEXT,
    "presente" BOOLEAN NOT NULL DEFAULT true,
    "vistoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaConexionEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ayudante_censo_miembros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ayudante_censo_miembros_tenantId_chatId_userTelegramId_key" ON "ayudante_censo_miembros"("tenantId", "chatId", "userTelegramId");

-- CreateIndex
CREATE INDEX "ayudante_censo_miembros_tenantId_chatId_presente_idx" ON "ayudante_censo_miembros"("tenantId", "chatId", "presente");

-- CreateTable
CREATE TABLE "ayudante_alias_historial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "alias" TEXT,
    "detectadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ayudante_alias_historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ayudante_alias_historial_tenantId_chatId_userTelegramId_idx" ON "ayudante_alias_historial"("tenantId", "chatId", "userTelegramId");

-- CreateTable
CREATE TABLE "ayudante_admin_log_eventos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramEventId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "actorTelegramId" BIGINT NOT NULL,
    "objetivoTelegramId" BIGINT,
    "detalle" JSONB,
    "ocurrioEn" TIMESTAMP(3) NOT NULL,
    "ingresadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ayudante_admin_log_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ayudante_admin_log_eventos_tenantId_chatId_telegramEventId_key" ON "ayudante_admin_log_eventos"("tenantId", "chatId", "telegramEventId");

-- CreateIndex
CREATE INDEX "ayudante_admin_log_eventos_tenantId_chatId_ocurrioEn_idx" ON "ayudante_admin_log_eventos"("tenantId", "chatId", "ocurrioEn");

-- CreateTable
CREATE TABLE "ayudante_enlaces_invitacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "enlaceId" TEXT NOT NULL,
    "creadorTelegramId" BIGINT NOT NULL,
    -- Usos de por vida segun Telegram (se sobrescribe al sincronizar) y
    -- cuantos de ellos ya se pagaron en comision. La comision se calcula
    -- siempre sobre la diferencia: sin la segunda columna, cada ejecucion del
    -- ranking pagaria otra vez la vida entera del enlace.
    "usosTotal" INTEGER NOT NULL DEFAULT 0,
    "usosLiquidados" INTEGER NOT NULL DEFAULT 0,
    "sincronizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ayudante_enlaces_invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ayudante_enlaces_invitacion_tenantId_chatId_enlaceId_key" ON "ayudante_enlaces_invitacion"("tenantId", "chatId", "enlaceId");

-- CreateIndex
CREATE INDEX "ayudante_enlaces_invitacion_tenantId_chatId_creadorTelegra_idx" ON "ayudante_enlaces_invitacion"("tenantId", "chatId", "creadorTelegramId");

-- CreateTable
CREATE TABLE "ayudante_avisos_privados" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "destinatarioTelegramId" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" "EstadoAvisoPrivado" NOT NULL DEFAULT 'pendiente',
    "detalle" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMP(3),

    CONSTRAINT "ayudante_avisos_privados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ayudante_avisos_privados_tenantId_destinatarioTelegramId_t_idx" ON "ayudante_avisos_privados"("tenantId", "destinatarioTelegramId", "tipo");

-- CreateTable
CREATE TABLE "ayudante_avatar_hashes" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "detectadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ayudante_avatar_hashes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ayudante_avatar_hashes_telegramId_hash_key" ON "ayudante_avatar_hashes"("telegramId", "hash");

-- CreateIndex
CREATE INDEX "ayudante_avatar_hashes_hash_idx" ON "ayudante_avatar_hashes"("hash");

-- CreateTable
CREATE TABLE "ayudante_watchdog_mediciones" (
    "id" TEXT NOT NULL,
    "medidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latenciaMs" INTEGER,
    "ok" BOOLEAN NOT NULL,

    CONSTRAINT "ayudante_watchdog_mediciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ayudante_watchdog_mediciones_medidoEn_idx" ON "ayudante_watchdog_mediciones"("medidoEn");
