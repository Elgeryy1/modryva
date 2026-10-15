-- El contador de juguetes del dia.
--
-- Los juguetes suben el animo pagando, y llevan tope diario para que el animo
-- siga midiendo el cuidado y no el saldo. El contador va con su dia al lado,
-- igual que las raciones, para que se reinicie solo al cambiar de fecha.
ALTER TABLE "pets" ADD COLUMN "juguetesHoy" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pets" ADD COLUMN "juguetesDia" TEXT;
