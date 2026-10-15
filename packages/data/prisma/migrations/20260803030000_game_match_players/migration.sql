-- Asientos de las partidas de grupo (impostor, cartas de colores, wordle en
-- grupo). Los juegos de dos siguen con hostId/guestId en game_matches y no se
-- tocan.
--
-- Una fila por jugador en vez de una lista dentro del JSON del estado por dos
-- motivos, los dos de los que solo aparecen en producción:
--
--   1. Apuntarse es una carrera. Seis personas pulsando "me apunto" a la vez
--      leen el mismo grupo de jugadores y escriben cada una su versión; cinco
--      desaparecen sin dejar rastro. El índice único (matchId, userId) hace que
--      lo resuelva la base de datos.
--   2. `secret` tiene que ser difícil de filtrar. Lo que vive dentro del estado
--      viaja en toda respuesta que devuelva la partida, así que un solo
--      endpoint descuidado le enseña al grupo entero la palabra del impostor o
--      la mano de alguien. Aquí, filtrarlo exige un JOIN que alguien tiene que
--      escribir a propósito.
--
-- Aditiva: crea una tabla nueva y no toca ninguna existente.

-- CreateTable
CREATE TABLE "game_match_players" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "name" TEXT,
    "seatIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'alive',
    "secret" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_match_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_match_players_tenantId_userId_idx" ON "game_match_players"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_match_players_matchId_userId_key" ON "game_match_players"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_match_players_matchId_seatIndex_key" ON "game_match_players"("matchId", "seatIndex");

-- AddForeignKey
ALTER TABLE "game_match_players" ADD CONSTRAINT "game_match_players_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "game_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
