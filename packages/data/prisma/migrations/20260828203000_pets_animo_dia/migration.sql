-- El dia en que se jugo con la mascota.
--
-- Jugar es gratis y sube el animo, asi que el limite tiene que ser el reloj y
-- no el dinero. Nace nula: a toda mascota que ya existe le toca su primer juego
-- hoy mismo, que es justo lo que hace falta — hasta ahora el animo solo bajaba.
ALTER TABLE "pets" ADD COLUMN "animoDia" TEXT;
