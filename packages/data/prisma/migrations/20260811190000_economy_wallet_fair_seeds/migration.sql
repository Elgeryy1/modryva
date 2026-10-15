-- Juego justo para la moneda del grupo.
--
-- Los juegos que se juegan en el chat (/dado, /tragaperras, /mm, /diana,
-- /duelo) pasan a apostar la moneda del grupo en vez de fichas. El casino
-- promete resultados verificables y esa promesa vive en las semillas, que hasta
-- ahora solo tenia `chip_wallets`. Sin estas columnas, mover los juegos habria
-- significado perder el provably-fair sin decirlo.
--
-- Los tres textos son NULOS y no llevan default a proposito: la tabla ya tiene
-- filas de gente que solo hablaba, y esas carteras no necesitan semilla hasta
-- que su dueño apuesta por primera vez (el codigo la siembra entonces, en la
-- misma transaccion de la apuesta). Un default fijo seria peor que nulo: todo
-- el mundo compartiendo la misma semilla es justo lo que este sistema existe
-- para evitar.
--
-- `nonce` si lleva default 0, que es el valor correcto para quien no ha
-- apostado nunca.
--
-- Aditiva: solo añade columnas opcionales, no toca las que ya habia ni obliga a
-- rellenar nada. El codigo viejo la ignora.

-- AlterTable
ALTER TABLE "economy_wallets" ADD COLUMN     "clientSeed" TEXT,
ADD COLUMN     "nonce" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serverSeed" TEXT,
ADD COLUMN     "serverSeedHash" TEXT;
