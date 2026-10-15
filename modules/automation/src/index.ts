/**
 * La API publica de `modules/automation`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 146 simbolos; desde fuera se
 * usan 24. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-automation/src/...`), asi que esta lista **es** la
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
  explicacionesValidas,
  fuentesDeConfianzaValidas,
  registrarExplicacionDeRegla,
  registrarReputacionDeFuente,
} from "./bot/handlers/ajustes-guardados.js";
export { calculadoraDeCooldownDeRegla } from "./bot/handlers/calculadoras-de-automatizacion.js";
export type {
  ExplicacionesDeReglaPort,
  FuentesDeConfianzaPort,
  ReputacionDeFuente,
} from "./bot/puertos.js";
export { decideContentReputation } from "./content-reputation.js";
export { rulesForDayPhase } from "./day-phase-rules.js";
export type { ManualEvent } from "./event-mode.js";
export { rulesForManualEvent } from "./event-mode.js";
export { rulesForExamMode } from "./exam-mode.js";
export type { RateLimitStatus } from "./rate-limit-monitor.js";
export { decideReadOnly } from "./read-only-mode.js";
export { checkReviveSilence } from "./revive-silence.js";
export { parseFeedItems, parseRssCommand, selectNewItems } from "./rss.js";
export { checkRuleCooldown } from "./rule-cooldown.js";
export type { EcaRule, RuleCondition, RuleContext } from "./rule-engine.js";
export { evaluateRule, evaluateRules } from "./rule-engine.js";
export { validateRuleExplanation } from "./rule-explanation.js";
export { shouldCloseTopic } from "./topic-close.js";
export { shouldActivateVolumeProtection } from "./volume-trigger.js";
export {
  buildWebhookBody,
  parseWebhookCommand,
  signWebhook,
  verifyWebhookSignature,
} from "./webhooks.js";
