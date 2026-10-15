-- Los dias seguidos de cuidado.
--
-- Arranca en cero para todo el mundo: nadie tiene racha demostrable hacia
-- atras, y regalar una inventada haria que el numero no significara nada desde
-- el primer dia. El primer cierre bien cuidado la pone a uno.
ALTER TABLE "pets" ADD COLUMN "racha" INTEGER NOT NULL DEFAULT 0;
