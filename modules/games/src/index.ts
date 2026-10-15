/**
 * La API publica de `modules/games`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito: con la
 * estrella el modulo publicaba las tripas enteras, y mover o renombrar un
 * detalle interno era un cambio incompatible en potencia sin forma de saber
 * cual sin buscar por todo el repo.
 *
 * **Los cinco juegos con apellido se quedan como estaban.** Cada juego trae su
 * propio `MIN_PLAYERS`, su `Board` y su `applyMove`; aplanarlos hace que uno
 * tape a otro en silencio (TS2308). Tres en raya se quedo plano porque ya habia
 * codigo importandolo asi, y los que llegaron despues entran con apellido:
 * `connectFour.applyMove`, `impostor.MIN_PLAYERS`. Eso no se toca.
 *
 * Entre los ficheros PLANOS no queda ningun nombre repetido, y eso confirma que
 * los cinco apellidos estaban bien puestos: las colisiones eran justo las que
 * ellos resolvian. Al aplanarlos de prueba salieron 13 nombres ambiguos que
 * `export *` estaba omitiendo en silencio.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-games/src/...`), asi que esta lista **es** la frontera.
 *
 * Los ficheros siguen exportando con `export` normal: sus tests los importan
 * por ruta relativa y deben seguir pudiendo.
 */

export { verifyAntiBotChallenge } from "./anti-bot-check.js";
export { computeAntiToxicityReward } from "./anti-toxicity-reward.js";
export type { BaccaratBet } from "./baccarat.js";
export { baccaratMultiplier, dealBaccarat } from "./baccarat.js";
export {
  buildShoe,
  dealerPlays,
  handValue,
  isBlackjack,
  settleBlackjack,
} from "./blackjack.js";
export { computeBossProgress } from "./boss-progress.js";
export {
  calculadoraDeCartaDeMiembro,
  calculadoraDeCompraDeCosmetico,
  calculadoraDeCooldownDinamico,
  calculadoraDeCupoDiario,
  calculadoraDeDobleReputacion,
  calculadoraDeDueloDeDebate,
  calculadoraDeGastoDeEnergia,
  calculadoraDeItemsLegendarios,
  calculadoraDeLogrosDeRacha,
  calculadoraDeLogrosNegativos,
  calculadoraDeLogrosSecretos,
  calculadoraDePatronImposible,
  calculadoraDePrestigio,
  calculadoraDeProgresoDeBoss,
  calculadoraDePruebaAntibot,
  calculadoraDeRachaSinSancion,
  calculadoraDeRecompensaColectiva,
  calculadoraDeSancionDeJuego,
} from "./bot/handlers/calculadoras-de-juego.js";
export type { BracketMatch } from "./bracket.js";
export { advanceBracket, BRACKET_BYE, buildBracketRound } from "./bracket.js";
export { describeBullseye, resolveBullseye } from "./bullseye.js";
export type { CasinoCommand } from "./casino.js";
export {
  CASINO,
  CHIP_PACKS,
  parseCasinoCommand,
  resolveDice,
  walletLevel,
} from "./casino.js";
export type { GameId, GameSpec } from "./catalog.js";
export { isGameId, isPlausibleScore, scoreToPoints } from "./catalog.js";
export { computeCollectiveReward } from "./collective-rewards.js";
export * as colorCards from "./color-cards.js";
export { canPurchaseCosmetic } from "./cosmetic-shop.js";
export { crashPoint, settleCrash } from "./crash.js";
export { resolveCreativityChallenge } from "./creativity-challenge.js";
export { checkDailyQuota } from "./daily-quota.js";
export {
  dailyTriviaHash,
  dayKeyFromMs,
  hourKeyFromMs,
  pickDailyIndex,
} from "./daily-trivia.js";
export { resolveDebateDuel } from "./debate-duel.js";
export { describeDuel, resolveDuel } from "./dice-duel.js";
export { applyDoubleRep } from "./double-rep.js";
export { computeDynamicCooldownMs } from "./dynamic-cooldown.js";
export { earnPoints } from "./economy.js";
export { spendEnergy } from "./energy-system.js";
export { commit, newServerSeed } from "./fairness.js";
export { decideGameSanction } from "./game-sanctions.js";
export type { GratitudeEntry } from "./gratitude.js";
export {
  GRATITUDE_PER_THANKS,
  grantGratitude,
  rankGratitude,
} from "./gratitude.js";
export type { GroupCurrencySettings } from "./group-currency.js";
export {
  applyTemporaryName,
  defaultGroupCurrencySettings,
  formatCurrency,
  GROUP_CURRENCY_SETTINGS_KEY,
  groupThousands,
  parseGroupCurrencySettings,
} from "./group-currency.js";
export { scoreStatGuess } from "./group-stat-trivia.js";
export * as groupWordle from "./group-wordle.js";
export type { HangmanState } from "./hangman.js";
export {
  creditRanking,
  guessLetter,
  guessWord,
  isLost,
  isSolved,
  isValidHangmanState,
  missedLetters,
  renderGallows,
  renderMask,
  startHangman,
} from "./hangman.js";
export type { HiLoBet } from "./hilo.js";
export { dealHiLo, hiLoMultiplier } from "./hilo.js";
export { detectImpossiblePattern } from "./impossible-patterns.js";
export * as impostor from "./impostor.js";
export { drawKeno, kenoMultiplier } from "./keno.js";
export { awardLegendaryItems } from "./legendary-items.js";
export * as connectFour from "./match-connect-four.js";
export type { Board, Cell, Mark, Seat } from "./match-tictactoe.js";
export {
  applyMove,
  emptyBoard,
  markFor,
  outcomeOf,
  parseBoard,
  turnOf,
  winnerOf,
} from "./match-tictactoe.js";
export { buildMemberCard } from "./member-cards.js";
export { checkMemoryAnswer, generateMemorySequence } from "./memory-game.js";
export { isMine, minesLayout, minesMultiplier } from "./mines.js";
export { detectNegativeAchievements } from "./negative-achievements.js";
export { describeOverUnder, resolveOverUnder } from "./over-under-seven.js";
export type { AjustesDeMascotas } from "./pets/ajustes.js";
export {
  AJUSTES_POR_DEFECTO,
  HORAS_DE_DUELO,
  HORAS_DE_PLAZO,
  PETS_SETTINGS_KEY,
  parsearAjustes,
  RESTO_TRAS_OPERAR,
} from "./pets/ajustes.js";
export type { ResultadoDeAlimentar } from "./pets/alimentar.js";
export { alimentar, precioDeRacion } from "./pets/alimentar.js";
// --- Mascotas ---
//
// Solo lo que consume el tick del worker. El resto de `pets/` es interno y sus
// propios tests lo importan por ruta relativa: al index sube lo que se usa
// desde fuera, no lo que existe.
//
// Los TIPOS van con `export type`, siempre. Con `export {}` sobre un tipo el
// typecheck pasa y vitest tambien, pero produccion corre con `tsx` —que va
// fichero a fichero y no puede saber que es un tipo— y Node revienta al
// arrancar con "does not provide an export named X".
export type {
  ComandoDeMascotas,
  PeticionDeMascotas,
  SubidaDelDia,
} from "./pets/bot/mascotas.js";
export {
  atenderComandoDeMascotas,
  COMANDOS_DE_MASCOTAS,
  esComandoDeMascotas,
  textoDeAvisoDeSalud,
  textoDeSubidasDelDia,
} from "./pets/bot/mascotas.js";
export type {
  EntradaDeCorral,
  MascotaVista,
  ProgresoDeMascota,
  PuertoDeMascotas,
  SalidaDeHuevo,
  SalidaDeJuego,
  SalidaDeOperacion,
  SalidaDeProteger,
  SalidaDeRacion,
  SaludDeMascota,
} from "./pets/bot/puertos.js";
export type { Eclosion } from "./pets/eclosion.js";
export { abrirHuevo } from "./pets/eclosion.js";
export { bonoDeCasino } from "./pets/en-el-casino.js";
export {
  fusionarModificadores,
  modificadoresDeRoboPorMascota,
} from "./pets/en-el-robo.js";
export { ganadorConMascotas, ganaLosEmpates } from "./pets/en-la-arena.js";
export type {
  DecisionDeOperar,
  Diagnostico,
  Dolencia,
  EstadoDeSalud,
  FalloAlDiagnosticar,
  FalloAlOperar,
  FichaClinica,
  PeticionDeDiagnostico,
} from "./pets/enfermedad.js";
export {
  avisosQueTocan,
  decidirOperacion,
  diagnosticar,
  estadoDeSalud,
  HORAS_DE_AVISO,
  MARGEN_DE_LA_FACTURA,
  msDeDuelo,
  msHastaElPlazo,
  sigueDeDuelo,
  tocaFallecer,
} from "./pets/enfermedad.js";
export type { Especie, EspecieId, Rareza } from "./pets/especies.js";
export { ESPECIES, esEspecieId } from "./pets/especies.js";
export type { Cara, EstadoDeMascota } from "./pets/estado.js";
export {
  animoTrasJugar,
  aplicarPasoDelTiempo,
  caraDe,
  estaDormida,
  HAMBRE_POR_HORA,
  MAXIMO,
} from "./pets/estado.js";
export type { Juguete, JugueteId } from "./pets/juguetes.js";
export {
  esJugueteId,
  JUGUETES,
  JUGUETES_EN_ORDEN,
  JUGUETES_POR_DIA,
  usarJuguete,
} from "./pets/juguetes.js";
export type {
  CampoDeMascota,
  ErrorDeMando,
  LecturaDeMando,
  MandoDeMascotas,
} from "./pets/mandos.js";
export {
  EXPLICACION,
  esCampoDeMascota,
  leerMando,
  marcaComoRegalada,
  pideSerPropietario,
  resumirParaAuditoria,
  TOPE_DE_MANDOS_DIARIOS,
} from "./pets/mandos.js";
export type { CierreDelDia, SubidaDeXp } from "./pets/nivel.js";
export {
  cerrarDia,
  nivelParaXp,
  progresoDeNivel,
  sumarXp,
  XP_POR_DIA_CUIDADO,
  XP_POR_JUEGO,
  XP_POR_RACION,
} from "./pets/nivel.js";
export type { FalloAlNombrar, NombreValidado } from "./pets/nombrar.js";
export {
  LARGO_MAXIMO_DE_NOMBRE,
  LARGO_MINIMO_DE_NOMBRE,
  textoDeFalloAlNombrar,
  validarNombre,
} from "./pets/nombrar.js";
export type { DiaUtc } from "./pets/racha.js";
export {
  diaSiguiente,
  esHitoDeRacha,
  HITOS_DE_RACHA,
  rachaTrasCerrar,
} from "./pets/racha.js";
export type { Rasgo, RasgoId } from "./pets/rasgos.js";
export { esRasgoId, RASGOS } from "./pets/rasgos.js";
export type { ContextoDelGrupo, Rendimiento } from "./pets/rendimiento.js";
export { factorDeEspecie, rendimientoDelDia } from "./pets/rendimiento.js";
export type {
  VentajasDeJuegos,
  VentajasDeMascota,
  VentajasDeRobo,
} from "./pets/ventajas.js";
export {
  SIN_VENTAJAS,
  ventajasDe,
  ventajasDeEspecie,
} from "./pets/ventajas.js";
export { levelForPoints } from "./player-level.js";
export { resolvePlaylistBattle } from "./playlist-battle.js";
export { resolvePlinko } from "./plinko.js";
export { computePrestige } from "./prestige.js";
export type { PurgePlay } from "./purge.js";
export {
  decidePurge,
  isPurgeOpen,
  PURGE_SETTINGS_KEY,
  PURGE_STATE_KEY,
  parsePurgeSettings,
  parsePurgeState,
  renderPurgeBoard,
} from "./purge.js";
export { accuracy, nextDifficulty } from "./quiz-adaptive.js";
export { separateRookieRanking } from "./rookie-ranking.js";
export type { RouletteBet } from "./roulette.js";
export { rouletteMultiplier, spinRoulette } from "./roulette.js";
export * as rps from "./rps.js";
export { divisionForPoints } from "./season-divisions.js";
export { evaluateSecretAchievements } from "./secret-achievements.js";
export { seedFrom, shuffle } from "./seeded-shuffle.js";
export type { OwnedItem, ShopItem, ShopItemId, ShopSettings } from "./shop.js";
export {
  availableItems,
  DOBLON_MULTIPLICADOR,
  defaultShopSettings,
  extendedExpiry,
  formatRemaining,
  isShopItemId,
  isUsable,
  MUTE_ITEM_IDS,
  MUTE_MINUTES,
  parseShopSettings,
  priceOf,
  quotePurchase,
  SEGURO_PCT,
  SHOP_BY_ID,
  SHOP_CATALOG,
  SHOP_SETTINGS_KEY,
  spentDefenceOf,
  stealEffectsOf,
  topeDeCajaFuerte,
  usableItems,
  VAULT_STEP,
  vaultLimitOf,
} from "./shop.js";
export type { SicBoBet } from "./sicbo.js";
export { rollSicBo, sicBoMultiplier } from "./sicbo.js";
export { describeSlot, resolveSlot } from "./slotstorm.js";
export type { SpeedAnswer, SpeedRankEntry } from "./speed-game.js";
export { rankSpeedAnswers, speedWinner } from "./speed-game.js";
export type { StealModifiers } from "./steal.js";
export {
  describirBotin,
  parseStealSettings,
  resolveSteal,
  STEAL_SETTINGS_KEY,
} from "./steal.js";
export { computeStreak } from "./streak.js";
export { evaluateStreakAchievements } from "./streak-achievements.js";
export {
  isCorrectAnswer,
  parseTriviaAnswer,
  parseTriviaCommand,
  pickQuestionIndex,
  TRIVIA_QUESTIONS,
} from "./trivia.js";
