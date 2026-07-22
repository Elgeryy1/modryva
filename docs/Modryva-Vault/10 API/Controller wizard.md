---
id: controller-wizard
title: Controller wizard
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/wizard.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappWizardController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller wizard

`MiniappWizardController` (`apps/api/src/miniapp/wizard.controller.ts:311`). Asistente de configuración por **playbooks**: elige un preset (comunidad, ventas, solo verificados, modo raid, anuncios, soporte) + un **nivel de seguridad** (`soft`/`normal`/`strict`) y aplica de golpe captcha, antiflood, locks, cuarentena, welcome/rules, membership gate y canal de logs. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:310`).

Instancia welcome, antiflood, captcha, content-lock, group-protection, d1 y foundation (`:312`–`:318`); inyecta [[Servicio admin]] (`:321`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/wizard/playbooks` | Lista los playbooks (id, nombre, descripción). | InitDataGuard + admin | `:325` |
| POST | `groups/:gid/wizard/apply` | Aplica un playbook+nivel; audita `miniapp.wizard.applied`. Body `{ playbook, security, staffChatId?, logsChatId?, supportChatId? }`. | InitDataGuard + admin | `:337` |

`applyWizardSchema` (`:299`) valida el body; `isWizardPlaybookId` (`:291`) valida el id. `PLAYBOOKS` (`:64`) define, por nivel de seguridad, `locksByLevel`, `captchaByLevel`, `floodByLevel`, `quarantineByLevel`, `requireMembershipGate`, `welcomeText`, `rulesText`. `applyPlaybook` (`:381`) escribe todas las secciones en paralelo; `applyLogsDestination` (`:433`) usa `logsChatId` → `staffChatId` → `supportChatId` como fallback.

## Modelos que toca

[[Modelo CaptchaConfig]], [[Modelo AntifloodConfig]], [[Modelo ContentLock]], [[Modelo WelcomeConfig]], [[Modelo GroupProtection]] (membership gate), [[Modelo D1QuarantineConfig]], [[Modelo D1LogConfig]], [[Modelo AuditLog]].

## Consumido desde apps/web

`getWizardPlaybooks` (`apps/web/lib/api-wizard.ts:19`), `applyWizardPlaybook` (`:32`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla wizard]] vía `apps/web/lib/api-wizard.ts`.
- **Consume**: [[Modelo CaptchaConfig]], [[Modelo AntifloodConfig]], [[Modelo WelcomeConfig]], [[Modelo AuditLog]].
- **Relacionado con**: [[Controller config]], [[Controller backup]] (plantillas de negocio), [[Endpoint POST v1 miniapp groups gid wizard apply]], [[API Map]].
