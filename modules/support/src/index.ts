/**
 * La API publica de `modules/support`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 386 simbolos; desde fuera se
 * usan 80. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-support/src/...`), asi que esta lista **es** la
 * frontera: lo que no este aqui no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo. Lo
 * que se recorta es lo que sale por aqui, que es lo que ve el resto.
 *
 * Al anadir algo, la pregunta es quien lo consume desde fuera. Si no hay nadie,
 * no entra.
 */

export type { AppealRecord } from "./accepted-appeals-report.js";
export { summarizeAcceptedAppeals } from "./accepted-appeals-report.js";
export { detectAngerLevel } from "./angry-customer.js";
export { analyzeAnnouncement } from "./announcement-composer.js";
export { shouldUnpinAnnouncement } from "./announcement-expiry.js";
export { buildAnnouncementPreviews } from "./announcement-preview.js";
export { detectAnswerBegging } from "./anti-copy.js";
export { categorizeAppeal } from "./appeal-classification.js";
export { estimateAppealEta } from "./appeal-eta.js";
export { bucketAppealsByIncident } from "./appeal-grouping.js";
export { summarizeAppealHistory } from "./appeal-history.js";
export { buildAppealLearning } from "./appeal-learning.js";
export { summarizeAppealForStaff } from "./appeal-summary.js";
export type { MediationEvent, MediationState } from "./async-mediation.js";
export { nextMediationStep } from "./async-mediation.js";
export {
  calculadoraDeApelacionDelicada,
  calculadoraDeAprendizajeDeApelacion,
  calculadoraDeCategoriaDeApelacion,
  calculadoraDeEtaDeApelacion,
  calculadoraDeResumenDeApelacion,
} from "./bot/handlers/calculadoras-de-apelacion.js";
export {
  calculadoraDeAnuncioSensible,
  calculadoraDeAnunciosPorRol,
  calculadoraDeAvisoDeMantenimiento,
  calculadoraDeCaducidadDeAnuncio,
  calculadoraDeCalidadDeDatos,
  calculadoraDeComparacionDeMeses,
  calculadoraDeEnfado,
  calculadoraDeErrorDelBot,
  calculadoraDeEscaladaAHumano,
  calculadoraDeEstadoDeIncidencia,
  calculadoraDeFueraDeTemaDeEstudio,
  calculadoraDeHorario,
  calculadoraDeIncidenciaConocida,
  calculadoraDeInformeDeLanzamiento,
  calculadoraDeMediacion,
  calculadoraDeModoAhorro,
  calculadoraDeNivelDeConocimiento,
  calculadoraDePeticionDeCopia,
  calculadoraDePreguntaCompleta,
  calculadoraDePuntuacionDeDuda,
  calculadoraDeResumenDePublicacion,
  calculadoraDeSeguimientoDeTicket,
  calculadoraDeTratoVip,
  calculadoraDeVistaDeAnuncio,
} from "./bot/handlers/calculadoras-de-soporte.js";
export {
  calculadoraDeBurnoutDeStaff,
  calculadoraDeEscaladaAlOwner,
} from "./bot/handlers/calculadoras-de-staff.js";
export { aplicarCuarentena } from "./bot/handlers/cuarentena.js";
export { informeDeHistorialDeCliente } from "./bot/handlers/informe-de-cliente.js";
export {
  apelacionesPorIncidente,
  historialDeApelaciones,
  informeDeApelacionesAceptadas,
} from "./bot/handlers/informes-apelaciones.js";
export { shouldEscalateBotError } from "./bot-error-escalation.js";
export { summarizeClientHistory } from "./client-history.js";
export {
  automationMatches,
  buildAppealKeyboard,
  buildAppealLog,
  buildDoctorReport,
  buildMissionCompletedText,
  buildQuarantineKeyboard,
  buildQuarantineLog,
  evaluateQuarantineCandidate,
  formatAppeals,
  formatAutomationList,
  formatBadges,
  formatEvents,
  formatMissionProgress,
  formatMissions,
  formatQuarantineList,
  isDoctorCommand,
  parseAppealCallback,
  parseAppealCommand,
  parseAutomationCommand,
  parseD1LogCommand,
  parseMissionCommand,
  parseQuarantineCallback,
  parseQuarantineCommand,
} from "./d1.js";
export { assessDataQuality } from "./data-quality.js";
export { markDelicateAppeal } from "./delicate-appeal.js";
export {
  buildFeedbackRelay,
  parseFeedbackCommand,
  parseFeedbackOrigin,
} from "./feedback.js";
export { decideHumanEscalation } from "./human-escalation.js";
export { shouldEscalateToOwner } from "./inactive-admin-escalation.js";
export type { IncidentEvent, IncidentStatus } from "./incident-status.js";
export { nextIncidentStatus } from "./incident-status.js";
export { assessQuestionCompleteness } from "./incomplete-question.js";
export { classifyKnowledgeLevel } from "./knowledge-level.js";
export { buildKnownIssueNotice } from "./known-issue.js";
export { buildMaintenanceNotice } from "./maintenance-notice.js";
export { compareMonths } from "./month-compare.js";
export {
  formatReminderTime,
  parseNaturalReminder,
} from "./natural-reminder.js";
export { detectOffTopicStudy } from "./off-topic-study.js";
export { buildPostLaunchReport } from "./post-launch.js";
export { scoreDoubt } from "./priority-doubts.js";
export {
  parseReminderCommand,
  parseTaskCommand,
  reminderRunAtMs,
} from "./productivity.js";
export { buildPublishSummary } from "./publish-summary.js";
export {
  decodeConfigRecipe,
  diffConfigRecipe,
  encodeConfigRecipe,
} from "./recipes.js";
export { buildRoleAnnouncements } from "./role-announcements.js";
export { decideSaveMode } from "./save-mode.js";
export { detectSensitiveAnnouncement } from "./sensitive-announcement.js";
export { detectBurnout } from "./staff-burnout.js";
export { formatStatusPage } from "./status-page.js";
export { supportHoursStatus } from "./support-hours.js";
export { shouldSendTicketFollowup } from "./ticket-followup.js";
export type { TicketPriority } from "./tickets.js";
export { parseTicketCommand } from "./tickets.js";
export { buildVerticalReply } from "./vertical-presets.js";
export type { VipClientPlan } from "./vip-client.js";
export { applyVipTreatment } from "./vip-client.js";
