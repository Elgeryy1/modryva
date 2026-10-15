-- Pone al dia el nombre de tres indices que el schema y las migraciones venian
-- llamando de forma distinta.
--
-- No cambia ni una columna ni un dato: son los mismos indices, sobre las mismas
-- columnas, con el nombre que Prisma les da hoy por convencion. La deriva es
-- vieja y no la causo ningun cambio reciente — se ve corriendo `db:drift-check`
-- contra cualquier commit anterior a este.
--
-- Va en su propio commit a proposito. Aparecio al generar la migracion de
-- `pets`, porque Prisma mete toda la deriva pendiente en la primera migracion
-- que se genere; meterla ahi habria hecho que un cambio de mascotas tocara
-- indices de presentaciones y de verificacion, que no tienen nada que ver.

-- RenameIndex
ALTER INDEX "introduction_pending_tenant_chat_user_key" RENAME TO "introduction_pending_tenantId_chatId_telegramUserId_key";

-- RenameIndex
ALTER INDEX "member_activity_profiles_tenantId_chatId_historicalLastMessageA" RENAME TO "member_activity_profiles_tenantId_chatId_historicalLastMess_idx";

-- RenameIndex
ALTER INDEX "verification_staff_reports_session_chat_message_key" RENAME TO "verification_staff_reports_sessionId_telegramChatId_message_key";
