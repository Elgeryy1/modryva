---
id: settings-panel
title: Settings Panel
type: feature
domain: community
status: implemented
maturity: beta
source: [modules/community/src/settings.ts, apps/bot/src/bot-update.service.ts, apps/api/src/miniapp/config.controller.ts]
tags: [modryva, feature, community]
aliases: [panel de ajustes, settings, cfg]
created: 2026-07-12
updated: 2026-07-12
---

# Settings Panel

Panel de configuración del grupo estilo GroupHelp: UI inline en el chat privado del bot (y espejo en Mini App). `modules/community/src/settings.ts` es **render + parsing puros**: nunca toca repositorios; el servicio inyecta el estado, llama a la función de render y persiste la acción parseada (`settings.ts:1-8`).

## Apertura

- Deep link `/start cfg_<groupId>` en privado, parseado con `parseSettingsStart` (`settings.ts:34-50`).
- `buildSettingsDeepLink` (`settings.ts:93-96`) y `buildMiniAppLink` (`settings.ts:104-109`) construyen los enlaces (el botón web_app se rechaza en grupos, por eso en grupo se usa `url`).

## Callbacks

`parseSettingsCallback` decodifica `cfg:<groupId>:<section>:<action>` (`settings.ts:62-87`). Handler `parseSettingsCallback`/`parseSettingsStart` importados en el bot (`apps/bot/src/bot-update.service.ts:258-259`).

## Secciones

`renderSettingsRoot` (`settings.ts:111-136`) ofrece: 👋 Bienvenida y 📜 Reglas ([[Welcome]]), 🌊 Antiflood, 🤖 Captcha, 🔒 Locks, 🛡 Antiraid. Cada sección tiene su render:

- `renderWelcomePanel` / `renderRulesPanel` (`settings.ts:148-198`).
- `renderFloodPanel` (`settings.ts:231-264`) con acciones `warn|mute|ban|delete` y límite acotado (`clampFloodLimit`, `settings.ts:228-229`).
- `renderCaptchaPanel` (`settings.ts:302-337`) con modos `button|math|text`.
- `renderRaidPanel` (`settings.ts:354-382`) con modos `observe|enforce`.
- `renderLocksPanel` (`settings.ts:402-436`) sobre 15 tipos de contenido bloqueable (`LOCK_TYPES`, `settings.ts:384-400`).

> Antiflood/Captcha/Locks/Antiraid pertenecen al dominio de moderación; este panel es la superficie de configuración compartida que vive en `community`.

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo ChatSetting]], [[Modelo WelcomeConfig]]
- **Utilizado por**: [[Comando settings]] (`/settings`)
- **Relacionado con**: [[Welcome]], [[Quiet Mode]], [[Commands Map]]
