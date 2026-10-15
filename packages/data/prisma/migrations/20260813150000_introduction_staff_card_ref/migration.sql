-- Dónde quedó publicada la ficha de STAFF de cada presentación pendiente,
-- para que la escalada pueda editarla al expulsar. Nullables: las filas
-- anteriores no tienen ficha localizable y la escalada lo tolera.
ALTER TABLE "introduction_pending"
  ADD COLUMN "staffChatId" BIGINT,
  ADD COLUMN "staffThreadId" INTEGER,
  ADD COLUMN "staffMessageId" INTEGER;
