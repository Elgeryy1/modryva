-- Rango del miembro por actividad y antigüedad (VIP / Titán / Veterano /
-- Leyenda). Moderador no está: ese se nombra a mano, porque implica confianza
-- y no mérito acumulado.
--
-- Aditiva y nullable: nadie tiene rango hasta que el bot se lo calcule, y las
-- filas existentes se quedan exactamente como están.

ALTER TABLE "reputation_profiles" ADD COLUMN "rank" TEXT;
