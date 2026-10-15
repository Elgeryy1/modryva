-- Tope de la caja fuerte.
--
-- `protectedBalance` existe desde el 2026-08-11 y el robo lo respeta, pero
-- hasta ahora NADA en el codigo lo escribia: no habia comando, ni endpoint, ni
-- boton. Lo unico que hay dentro entro con un UPDATE a mano. Esta columna es la
-- mitad que faltaba, la que permite abrir la puerta (/guardar y /sacar) sin
-- que la caja fuerte se convierta en un interruptor de inmunidad.
--
-- Sin tope, guardarlo todo haria a cualquiera intocable y el robo dejaria de
-- existir el dia que alguien lo contara en el grupo. Con tope, poner a salvo es
-- una decision: lo que metes deja de rendir en la ruleta de los robos.
--
-- Default 0 y NO significa "no cabe nada": significa "el basico del grupo". El
-- tope efectivo lo calcula quien lee, sumando lo que se haya comprado en la
-- tienda. Asi las filas que ya existen se quedan exactamente como estaban.
--
-- Aditiva: una columna con default, sin tocar nada de lo que habia.

-- AlterTable
ALTER TABLE "economy_wallets" ADD COLUMN     "vaultLimit" INTEGER NOT NULL DEFAULT 0;
