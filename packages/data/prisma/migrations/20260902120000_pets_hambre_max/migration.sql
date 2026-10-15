-- Lo mejor que estuvo la barra de hambre durante el dia, y de que dia es.
--
-- Existe porque el cierre del dia corre en el primer barrido pasada la
-- medianoche UTC —las dos de la madrugada en España—, y hasta hoy preguntaba
-- por el hambre de ESE instante. Esa es la hora en que el bicho lleva mas
-- tiempo sin que nadie lo mire, asi que la XP no premiaba haber cuidado a la
-- mascota: premiaba el horario. Quien le daba de comer toda la tarde llegaba a
-- las dos con la barra ya baja y se quedaba sin nada.
--
-- Dos columnas y no una, por lo mismo que `racionesHoy` y `racionesDia`: un
-- maximo sin su dia no se distingue de uno viejo, y con el dia al lado se
-- reinicia solo sin necesidad de un barrido que lo ponga a cero.
--
-- Arranca en cero y sin dia: el primer barrido de cada mascota lo pone al
-- hambre que tenga en ese momento. Sembrarlo con el hambre actual regalaria un
-- dia cuidado a quien lleva la mascota dormida una semana.
ALTER TABLE "pets" ADD COLUMN "hambreMax" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pets" ADD COLUMN "hambreMaxDia" TEXT;
