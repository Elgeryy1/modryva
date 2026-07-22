export * from "./ai-access-repository.js";
export * from "./ai-repository.js";
export * from "./analytics-repository.js";
export * from "./antiflood-repository.js";
export * from "./antiraid-repository.js";
export * from "./automation-repository.js";
export * from "./captcha-repository.js";
export * from "./chat-activity-repository.js";
export * from "./chat-setting-repository.js";
export * from "./chip-repository.js";
export * from "./client.js";
export * from "./community-repository.js";
export * from "./content-lock-repository.js";
export * from "./coop-mission-repository.js";
export * from "./custom-command-repository.js";
export * from "./d1-repository.js";
export * from "./economy-repository.js";
export * from "./entitlement-repository.js";
export * from "./expiration-repository.js";
export * from "./federation-repository.js";
export * from "./feed-repository.js";
export * from "./feedback-repository.js";
export * from "./file-repository.js";
export * from "./foundation-repository.js";
export * from "./game-repository.js";
export * from "./gamification-repository.js";
export * from "./giveaway-repository.js";
export * from "./gratitude-repository.js";
export * from "./group-protection-repository.js";
export * from "./guardian-repository.js";
export * from "./incident-repository.js";
export * from "./internal-role-repository.js";
export * from "./invite-repository.js";
export * from "./moderation-extra-repository.js";
export * from "./moderation-repository.js";
export * from "./owner-network-repository.js";
export * from "./owner-network-risk-repository.js";
export * from "./payment-repository.js";
export * from "./platform-repository.js";
export * from "./poll-repository.js";
export * from "./productivity-repository.js";
export * from "./reencrypt-managed-tokens.js";
export * from "./reputation-repository.js";
export * from "./scheduled-post-repository.js";
export * from "./staff-note-repository.js";
export * from "./ticket-repository.js";
export * from "./webhook-repository.js";
export * from "./welcome-repository.js";
// Guardian-verification wiring task: admin-governance audit (aggressive-admin + consistency-check).
export * from "./admin-decision-repository.js";
// Content-signal STAFF-annotation wiring (PII/QR-bait/shortener-quarantine):
export * from "./domain-reputation-repository.js";
// NEW: known-admin-repository (external-admin audit command, guardian-verification branch)
export * from "./known-admin-repository.js";
// NEW: ECA rule engine activation — new parallel automation surface (eca-rule-repository)
// plus the JobOutbox-backed pending-action queue (job-outbox-repository).
export * from "./eca-rule-repository.js";
export * from "./job-outbox-repository.js";
// NEW: adaptive-quiz wiring — per-user/per-chat difficulty level (quiz-difficulty-repository).
export * from "./quiz-difficulty-repository.js";
// NEW: playlist-battle / creativity-challenge wiring — shared submit+vote table (battle-entries-repository).
export * from "./battle-entries-repository.js";
// NEW: group-progress games wiring — per-member resource tally for "ciudad cooperativa" (coop-city-repository).
export * from "./coop-city-repository.js";
// NEW: "/memoria" Simon-sequence minigame wiring — seed-based session, no plaintext answer stored (memory-sequence-repository).
export * from "./memory-sequence-repository.js";
// NEW: real-vote counter for "/duelo_debate" (debate-duel-repository) — reuses ChatActivityRepository, no new table.
export * from "./debate-duel-repository.js";
// NEW: "juego de velocidad" wiring (/velocidad) — round + per-user answer submissions (speed-game-repository).
export * from "./speed-game-repository.js";
// NEW: "torneo por eliminatorias" wiring (/torneo_crear, /torneo_ganador) — single-elimination bracket state
// (bracket-tournament-repository), built on modules/games/src/bracket.ts (buildBracketRound/advanceBracket).
export * from "./bracket-tournament-repository.js";
