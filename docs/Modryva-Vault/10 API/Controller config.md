---
id: controller-config
title: Controller config
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/config.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappConfigController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller config

`MiniappConfigController` (`apps/api/src/miniapp/config.controller.ts:75`). Es el **núcleo de la configuración por grupo** de la Mini App: sesión, config de juegos/onboarding, ventanas estrictas, rituales, modo silencio, recap semanal y las secciones clásicas de moderación (welcome, rules, flood, captcha, locks, warns, hygiene, membershipGate, raid). Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:73`).

Inyecta [[Servicio admin]] (`@Inject(MiniappAdminService)`, `:87`) e instancia nueve repositorios de `@superbot/data` (`:76`–`:84`): welcome, antiflood, captcha, content-lock, moderation-extra (warns), group-protection (hygiene/membershipGate), antiraid, foundation (auditoría) y chat-setting.

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| POST | `session` | Resuelve grupo+bot de la sesión desde `start_param` firmado (o body en bots hijos). Sólo `config`/`onboarding` resuelven grupo. | InitDataGuard (+`assertGroupAdmin` si hay grupo) | `:91` |
| GET | `groups/:gid/games-config` | Config de juegos/onboarding (`GAMES_CONFIG_KEY`). | InitDataGuard + admin | `:146` |
| PUT | `groups/:gid/games-config` | Guarda config de juegos; valida con `gamesConfigSchema`; audita `miniapp.games.configured`. | InitDataGuard + admin | `:157` |
| GET | `groups/:gid/schedule-rules` | Ventanas de moderación estricta por horario (`SCHEDULE_RULES_KEY`). | InitDataGuard + admin | `:190` |
| PUT | `groups/:gid/schedule-rules` | Guarda reglas horarias; audita `miniapp.scheduleRules.updated`. | InitDataGuard + admin | `:202` |
| GET | `groups/:gid/rituals` | Rituales semanales programados (`RITUALS_KEY`). | InitDataGuard + admin | `:237` |
| PUT | `groups/:gid/rituals` | Guarda rituales; audita `miniapp.rituals.updated`. | InitDataGuard + admin | `:249` |
| GET | `groups/:gid/quiet` | Estado del modo silencio (`CHAT_QUIET_KEY`). | InitDataGuard + admin | `:284` |
| PUT | `groups/:gid/quiet` | Activa/desactiva modo silencio; audita `miniapp.quiet.updated`. | InitDataGuard + admin | `:296` |
| GET | `groups/:gid/weekly-recap` | Estado del recap semanal (`WEEKLY_RECAP_KEY`). | InitDataGuard + admin | `:329` |
| PUT | `groups/:gid/weekly-recap` | Activa/desactiva recap; audita `miniapp.weekly-recap.updated`. | InitDataGuard + admin | `:341` |
| GET | `groups/:gid/config` | Snapshot de 5 secciones (welcome, rules, flood, captcha, locks). | InitDataGuard + admin | `:374` |
| GET | `groups/:gid/config/:section` | Lee una sección concreta (`isSectionName`). | InitDataGuard + admin | `:391` |
| PUT | `groups/:gid/config/:section` | Escribe una sección validando con `SECTION_SCHEMAS[section]`; audita `miniapp.<section>.updated`. | InitDataGuard + admin | `:404` |

`SectionName` cubre: `welcome`, `rules`, `flood`, `captcha`, `locks`, `warns`, `hygiene`, `membershipGate`, `raid` (`readSection` `:449`, `writeSection` `:541`). Secciones no incluidas en el snapshot se leen/escriben una a una vía `/config/:section`.

## Autorización

`authorize(req, gid)` (`:442`) = `assertGroupAdmin(gid, userId, bot)` + `resolveChat(gid, bot)` de [[Servicio admin]] (mismo patrón que casi todos los controllers `v1/miniapp`). El bot servidor sale del contexto initData (`ctx.botUsername`, `ctx.botToken`).

## Modelos que toca

[[Modelo ChatSetting]] (games-config, schedule-rules, rituals, quiet, weekly-recap), [[Modelo WelcomeConfig]] (welcome/rules), [[Modelo AntifloodConfig]], [[Modelo CaptchaConfig]], [[Modelo ContentLock]], [[Modelo WarnPolicy]], [[Modelo GroupProtection]] (hygiene/membershipGate), [[Modelo AntiraidConfig]] y [[Modelo AuditLog]] (via `foundation.recordAudit`).

## Consumido desde apps/web

`postSession` (`apps/web/lib/api.ts:128`), `getSection`/`putSection` (`:150`/`:153`), `getGamesConfig`/`putGamesConfig` (`:579`/`:582`), `getScheduleRules`/`putScheduleRules` (`:594`/`:598`), `getRituals`/`putRituals` (`:610`/`:612`), `getQuiet`/`putQuiet` (`:619`/`:621`), `getWeeklyRecap`/`putWeeklyRecap` (`:628`/`:630`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`, `@superbot/shared` (schemas y `decodeStartParam`).
- **Utilizado por**: [[Pantalla config]], [[Pantalla Mini App]] vía `apps/web/lib/api.ts`.
- **Consume**: [[Modelo ChatSetting]], [[Modelo WelcomeConfig]], [[Modelo AuditLog]].
- **Relacionado con**: [[API Map]], [[Endpoint GET v1 miniapp groups gid config section]], [[Endpoint PUT v1 miniapp groups gid config section]], [[Endpoint POST v1 miniapp session]], [[Controller wizard]], [[Controller backup]].
