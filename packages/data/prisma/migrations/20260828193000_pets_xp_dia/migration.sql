-- La marca del ultimo dia cuya XP ya se cobro.
--
-- Sin ella la XP se repartia en cada revision del tick (una cada quince
-- minutos) en vez de una vez al dia. Nace nula a proposito: `null` es "aun no
-- se le ha cerrado ningun dia", asi que a las mascotas que ya existen les
-- tocara su primer cierre legitimo en el siguiente barrido, ni antes ni dos
-- veces.
ALTER TABLE "pets" ADD COLUMN "xpDia" TEXT;
