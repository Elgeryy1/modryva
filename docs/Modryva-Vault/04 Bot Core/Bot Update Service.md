---
id: bot-update-service
title: Bot Update Service
type: service
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/bot-update.service.test.ts
  - apps/bot/src/pipeline.ts
  - apps/bot/src/tokens.ts
tags:
  - modryva
  - service
  - botcore
aliases:
  - BotUpdateService
created: 2026-07-12
updated: 2026-07-12
---

# Bot Update Service

`BotUpdateService` (`apps/bot/src/bot-update.service.ts`) es el **God Object** del bot: **18.080 líneas** en
un solo fichero, con ~**180 métodos** y ~**45 dependencias inyectadas** en el constructor. Casi toda la
lógica de features de Modryva pasa por aquí.

## Qué hace

Es el `@Injectable()` que orquesta la [[Bot Pipeline]]:

- **Punto de entrada**: `processWebhook` (`:909`) → `processWebhookScoped` (`:919`) (ver [[Update Lifecycle]]).
- **Multi-bot**: `botTokenScope` (`AsyncLocalStorage`, `:764`) para enviar con el token del bot correcto.
- **Cadena de handlers**: `botHandlers()` (`:1096`) devuelve ~80 handlers cacheados (`botHandlersCache`),
  cada uno delegando a un `handle<X>Command`/`handle<X>Callback` del propio servicio. Orden = prioridad;
  primero que devuelve `BotReply` gana. Ejemplos de arranque: `platform.user-ban-command`, `settings`,
  `chat-activity.logger`, `core.command`, `core.callback`, `inline-game.callback`, `platform.command`,
  `managed-bot.update`, `moderation.command`, `moderation-plus.command`, `antiflood.command`,
  `captcha.command`, `locks.command`, `antiraid.command`…
- **Post-procesadores**: `botPostProcessors()` (`:1782`), 5 efectos que corren siempre: `activity-xp`,
  `activity-record`, `gamification-first-message`, `automation-message`, `automation-new-members`.
- **Entrega**: `deliverReply` delega en [[Delivery]]; `ackCallbackQuery` confirma callbacks.
- **`simulate`** (`:18056`) — dry-run que normaliza el update y devuelve el `BotReply` de `handleCoreCommand`
  sin efectos (usado por el endpoint `/simulate` y tests). Ver [[Controller TelegramWebhook]].

## Superficie por dominio (muestra de los ~180 métodos)

Los `handle<X>Command` cubren prácticamente todos los `modules/*`: moderación (`handleModerationCommand`,
`handleModerationPlusCommand`, `handleModerationExtraCommand`, `applyWarn`, `handleLockCommand`,
`handleAntifloodCommand`, `handleCaptchaCommand`, `handleAntiraidCommand`), comunidad (`handleNotesCommand`,
`handleFiltersCommand`, `handleReputationCommand`, `handleWelcomeCommand`, `handleGratitudeCommand`,
`handleCoopMissionCommand`), IA (`handleAiCommand`, `handleAiPackCommand`, `handleDmChat`,
`handleMentionChat`), juegos/casino (`handleCasinoCommand`, `settleNativeBet`, `handleInlineGameCallback`),
soporte (`handleTicketCommand`, `handleFeedbackCommand`), automatización (`handleAutomationCommand`,
`matchAndRunAutomations`), pagos (`handlePaymentCommand`, `handlePreCheckout`, `handleSuccessfulPayment`),
plataforma/multi-bot (`handlePlatformCommand`, `handleManagedBotUpdate`, `handlePlatformUserBanCommand`) y
federación (`handleFederationCommand`, `enforceFederationBans`). Además utilidades masivas en
`handleUtilityPlusCommand` (`:14784`, ~1.900 líneas ella sola).

## Dependencias

El constructor (`:768-882`) inyecta ~45 repos por token `Symbol` (`apps/bot/src/tokens.ts`). Los últimos
~13 son `@Optional()` y caen a implementaciones `InMemory*` de [[Package data]] si no hay provider (permite
tests y arranque parcial). Ver [[App bot]] para el cableado (`app.module.ts`).

## Deuda técnica

Es un **antipatrón God Object** de manual: un único fichero de 18k líneas concentra toda la lógica de todos
los dominios, con 180 métodos y 45 dependencias. Alto acoplamiento, difícil de testear en aislamiento (su
test hermano `bot-update.service.test.ts` tiene **11.744 líneas**), riesgo de merge conflicts y barrera de
entrada enorme. Ver [[Riesgo God Object bot-update]].

## Relaciones

- Pertenece a: [[Bot Core Map]], [[App bot]]
- Depende de: [[Package data]], [[Package telegram]], [[Package domain]], [[Package auth]], [[Modules Map]]
- Utilizado por: [[Controller TelegramWebhook]], [[Poller]]
- Relacionado con: [[Bot Pipeline]], [[Update Lifecycle]], [[Core Handlers]], [[Delivery]], [[Riesgo God Object bot-update]]
