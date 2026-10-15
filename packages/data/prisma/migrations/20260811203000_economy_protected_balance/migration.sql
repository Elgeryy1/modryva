-- Caja fuerte: saldo a salvo de robos.
--
-- Hasta ahora lo unico que limitaba un robo era un suelo GLOBAL del grupo
-- (`minVictimBalance`): igual para todos, asi que no habia forma de dejar
-- intocable una cantidad concreta de una persona concreta.
--
-- Cuenta DENTRO de `balance`, no es un segundo monedero. Solo marca cuanto de
-- ese saldo no puede tocar `/robar`. Guardarlo aparte es lo que evita que el
-- robo tenga que adivinar que parte era intocable.
--
-- Default 0: quien no lo use no nota nada, y las filas que ya existen quedan
-- exactamente como estaban.
--
-- Aditiva: una columna con default, sin tocar nada de lo que habia.

-- AlterTable
ALTER TABLE "economy_wallets" ADD COLUMN     "protectedBalance" INTEGER NOT NULL DEFAULT 0;
