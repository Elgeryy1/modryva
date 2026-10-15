-- La enfermedad grave: la unica forma en que una mascota puede morir.
--
-- No la decide el azar ni el hambre. La declara el propietario a mano, con
-- motivo escrito, con una factura y con un plazo. La propiedad de que a hambre
-- cero se duerme y no se muere sigue intacta: lo que dice es que **el abandono
-- no mata**, y esto no es abandono — es una decision de una persona, avisada
-- tres veces antes de que venza.
--
-- Siete columnas y todas nulas o con default, asi que las 41 filas que ya
-- existen quedan sanas sin tocarlas.
--
-- `curaResto` es la que menos se explica sola: la factura no es una cantidad
-- suelta sino un SUELO. La operacion deja la cartera exactamente en ese numero,
-- asi que "que se quede con 2500" se escribe tal cual en vez de calcular una
-- resta que se queda vieja en cuanto el saldo se mueve.
--
-- `curaAvisos` es la marca que impide repetir los recordatorios. Va aqui por lo
-- mismo que `xpDia`: el barrido mira cada mascota cada quince minutos, asi que
-- un aviso sin marca propia saldria 96 veces al dia. Es el fallo que tuvo la XP
-- el 2026-08-28, esta vez evitado antes de llegar a produccion.
--
-- Se marca la muerte, no se borra la fila: un DELETE no se revierte, la ficha
-- tiene que poder enseñar la lapida, y la fila ocupa el unique de (grupo,
-- persona), que es justo lo que sostiene el duelo.
ALTER TABLE "pets" ADD COLUMN "enfermaDesde" TIMESTAMP(3);
ALTER TABLE "pets" ADD COLUMN "enfermaMotivo" TEXT;
ALTER TABLE "pets" ADD COLUMN "curaCoste" INTEGER;
ALTER TABLE "pets" ADD COLUMN "curaResto" INTEGER;
ALTER TABLE "pets" ADD COLUMN "curaVence" TIMESTAMP(3);
ALTER TABLE "pets" ADD COLUMN "curaAvisos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pets" ADD COLUMN "fallecidaEn" TIMESTAMP(3);
