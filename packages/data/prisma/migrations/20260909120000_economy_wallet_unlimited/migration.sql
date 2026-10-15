-- Saldo sin fondo, cartera a cartera.
--
-- `balance` es un `integer`: tiene techo (2.147.483.647) y ademas se gasta, asi
-- que "poner un saldo muy alto" no es un saldo infinito, es un saldo que tarda
-- mas en acabarse y que revienta con "integer out of range" en cuanto alguien
-- dona lo suficiente. Con esta bandera el saldo se CONGELA: la cartera paga
-- siempre, no se le abona nada, y quien cuenta los movimientos es el libro
-- mayor, que los sigue anotando todos.
--
-- Va por cartera (tenant + chat + persona) y no por usuario global a proposito:
-- la economia vive por grupo, y una bandera global regalaria el privilegio en
-- grupos donde nadie lo pidio.

-- AlterTable
ALTER TABLE "economy_wallets" ADD COLUMN     "unlimited" BOOLEAN NOT NULL DEFAULT false;
