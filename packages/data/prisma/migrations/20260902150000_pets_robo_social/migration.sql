-- Las dos columnas que les faltaban a tres especies para hacer algo.
--
-- `protegeA` y `robadoPendiente` existen porque sus efectos necesitan estado
-- que hoy no habia en ninguna parte: no es que estuvieran mal cableados, es
-- que no habia donde guardar la respuesta. Por eso llevaban desde el primer
-- dia escritos en la ficha sin ocurrir.

-- A quien protege ademas de a su dueño. Lo pone `/proteger @alguien`.
--
-- Nulo por defecto: proteger a alguien es una decision, y elegir a dedo a quien
-- protege el bicho de otro seria decidir por esa persona. Se guarda el id de
-- Telegram y no el de la fila porque es lo que trae una mencion.
ALTER TABLE "pets" ADD COLUMN "protegeA" BIGINT;

-- Lo que le robaron y todavia no ha vuelto.
--
-- El efecto declarado del cangrejo es "lo robado vuelve solo, poco a poco", y
-- eso es imposible sin recordar cuanto: sin esta columna, el tick no tendria
-- de donde sacar la cifra a devolver. Se suma al sufrir un robo y baja un poco
-- cada dia en el barrido, hasta cero.
--
-- Entero y nunca negativo. Arranca en cero para todo el mundo: nadie tiene
-- robos demostrables hacia atras y regalar una cifra inventada seria acuñar
-- moneda por un cambio de esquema.
ALTER TABLE "pets" ADD COLUMN "robadoPendiente" INTEGER NOT NULL DEFAULT 0;

-- Buscar quien protege a una persona es una consulta por `protegeA`, y ocurre
-- en CADA robo. Sin indice es un escaneo de la tabla entera por golpe.
CREATE INDEX "pets_tenantId_chatId_protegeA_idx"
  ON "pets" ("tenantId", "chatId", "protegeA");
