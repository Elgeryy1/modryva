-- Anuncios programados con foto, botones y repeticion.
--
-- Hasta ahora un ScheduledPost era texto plano y de un solo disparo: se
-- enviaba, se marcaba `sent` y ahi moria. No habia forma de programar el mismo
-- anuncio recurrente que ya se manda a mano, ni de que llevara la imagen y el
-- boton que lo hacen util.
--
-- Las cuatro columnas son NULLABLE a proposito: cada fila que ya existe sigue
-- comportandose exactamente igual que antes (texto plano, un disparo) sin
-- tocar un solo dato.
ALTER TABLE "scheduled_posts" ADD COLUMN "photoFileId" TEXT;
ALTER TABLE "scheduled_posts" ADD COLUMN "parseMode" TEXT;
ALTER TABLE "scheduled_posts" ADD COLUMN "replyMarkup" JSONB;
ALTER TABLE "scheduled_posts" ADD COLUMN "repeatMinutes" INTEGER;
