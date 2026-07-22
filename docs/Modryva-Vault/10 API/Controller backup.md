---
id: controller-backup
title: Controller backup
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/backup.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappBackupController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller backup

`MiniappBackupController` (`apps/api/src/miniapp/backup.controller.ts:325`). Exporta/importa toda la config de un grupo (secciones + capa de red), clona de un grupo a otro y aplica **plantillas de negocio** predefinidas. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:323`). Formato de backup `version: 2` (`BACKUP_VERSION`, `:36`); acepta importar `version 1` o `2` (`:482`).

Instancia 11 repositorios (`:326`–`:337`): welcome, antiflood, captcha, content-lock, moderation-extra, group-protection, foundation, federation, owner-network, automation, gamification, internal-roles. Inyecta [[Servicio admin]] (`:339`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/backup/export` | Devuelve `BackupPayload` (secciones + `network`). | InitDataGuard + admin | `:343` |
| POST | `groups/:gid/backup/import` | Aplica secciones + capa de red desde `{ payload }`; audita `miniapp.backup.imported`. | InitDataGuard + admin | `:352` |
| POST | `groups/:gid/backup/clone` | Copia la config del `gid` a `{ targetGid }` (autoriza ambos); audita `miniapp.backup.cloned`. | InitDataGuard + admin de ambos | `:379` |
| GET | `groups/:gid/backup/templates` | Lista las plantillas de negocio disponibles. | InitDataGuard + admin | `:423` |
| POST | `groups/:gid/backup/templates/:id/apply` | Aplica una plantilla; audita `miniapp.backup.template_applied`. | InitDataGuard + admin | `:435` |

`BUSINESS_TEMPLATES` (`:178`): `community`, `sales`, `support`, `courses`, `gaming`, `crypto` — cada una con sus secciones (welcome/rules/flood/captcha/locks/hygiene/warns…) por `baseSections(overrides)` (`:160`).

## Qué guarda el backup

`BackupSections` (`:38`): welcome, rules, flood, captcha, locks, warns, hygiene, membershipGate, gamificationWelcomeButtons. `NetworkBackup` (`:90`): config de red, roles de grupo, rutas, automatizaciones y roles internos (sólo si el chat pertenece a una federación, `exportNetwork` `:583`). `applyNetworkBackup` (`:696`) **reemplaza** roles/rutas/automatizaciones/roles internos (borra y recrea).

## Modelos que toca

[[Modelo WelcomeConfig]], [[Modelo AntifloodConfig]], [[Modelo CaptchaConfig]], [[Modelo ContentLock]], [[Modelo WarnPolicy]], [[Modelo GroupProtection]], [[Modelo Federation]], [[Modelo OwnerNetworkConfig]], [[Modelo Automation]], [[Modelo InternalRole]], [[Modelo AuditLog]].

## Consumido desde apps/web

`exportBackup` (`apps/web/lib/api-backup.ts:54`), `importBackup` (`:57`), `cloneBackup` (`:63`), `getBackupTemplates` (`:69`), `applyBackupTemplate` (`:74`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla backup]] vía `apps/web/lib/api-backup.ts`.
- **Consume**: [[Modelo OwnerNetworkConfig]], [[Modelo Automation]], [[Modelo AuditLog]].
- **Relacionado con**: [[Controller config]], [[Controller owner-network]], [[Controller automation]], [[Endpoint GET v1 miniapp groups gid backup export]], [[Endpoint POST v1 miniapp groups gid backup import]], [[API Map]].
