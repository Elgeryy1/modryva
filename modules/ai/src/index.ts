/**
 * La API publica de `modules/ai`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 50 simbolos; desde fuera se
 * usan 25. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-ai/src/...`), asi que esta lista **es** la
 * frontera: lo que no este aqui no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo. Lo
 * que se recorta es lo que sale por aqui, que es lo que ve el resto.
 *
 * Al anadir algo, la pregunta es quien lo consume desde fuera. Si no hay nadie,
 * no entra.
 */

export {
  buildAiMessages,
  parseAiCommand,
  sanitizeAiInput,
} from "./commands.js";
export type { DegradedModeDecision, DegradedState } from "./degraded-mode.js";
export { decideDegradedMode, formatDegradedNotice } from "./degraded-mode.js";
export {
  buildDmSystemHint,
  shouldAutoChat,
  truncateDmInput,
} from "./dm-chat.js";
export type { AiMemoryScope } from "./memory.js";
export {
  buildAiMemorySystemHint,
  describeMemory,
  extractAiMemoryFacts,
  memoryKeyForNote,
  parseRememberCommand,
  renderMemoryList,
} from "./memory.js";
export { extractMentionPrompt } from "./mention-chat.js";
export type {
  AiCompleteOptions,
  AiMessageInput,
  AiProvider,
} from "./provider.js";
export {
  AiRouter,
  buildAiProviderFromEnv,
  FailingAiProvider,
  FakeAiProvider,
} from "./provider.js";
