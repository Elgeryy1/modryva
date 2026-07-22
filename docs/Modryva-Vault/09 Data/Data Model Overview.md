---
id: data-model-overview
title: Data Model Overview
type: moc
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
  - moc
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Data Model Overview

HUB del dominio de **datos** de Modryva. La única fuente de verdad es el schema de Prisma
(`packages/data/prisma/schema.prisma`, 2130 líneas): **127 modelos + 11 enums**, todos con `@@map`
a nombres de tabla en snake_case y PostgreSQL como datasource. El acceso a datos se canaliza por
**repositorios** en `packages/data/src/*.ts` (patrón `Prisma<Nombre>Repository`); apps y módulos
consumen esos repositorios, casi nunca el cliente Prisma directo.

Ver el índice navegable en [[Database Map]]. Convenciones en [[Conventions]]. Inventario global en
[[Repository Inventory]].

> Regla del Vault: cada afirmación cita evidencia. El "quién lee/escribe" de cada modelo se verificó
> por `grep` de accesos al delegado Prisma en `packages/data/src`. Lo no verificable se marca
> explícitamente y se registra en [[Open Questions]].

## Cómo leer los datos

- **`id`**: cuid (`@default(cuid())`) en casi todos los modelos.
- **`tenantId`**: casi todos los modelos cuelgan de un [[Modelo Tenant]] (multi-bot). Muchos usan
  `onDelete: Cascade` para limpieza en cadena.
- **Identidad de Telegram**: se guarda como `BigInt` (`telegramUserId`, `telegramChatId`,
  `ownerTelegramId`, …). Los ids internos (cuid) y los ids de Telegram conviven: los modelos de
  configuración suelen referenciar el `Chat` interno (`chatId: String`), mientras que los modelos de
  eventos/economía suelen guardar el id de Telegram crudo (`BigInt`) para escribir sin resolver el chat.
- **Timestamps**: `createdAt @default(now())` + `updatedAt @updatedAt` es el patrón dominante.

## Dominios (los 127 modelos agrupados)

### Plataforma / multi-bot (7 + Owner Network)
Concesión de acceso y fábrica de bots hijos (estilo GroupHelp). Ver [[Modryva Hub Map]].
[[Modelo Tenant]], [[Modelo ManagedBot]], [[Modelo PlatformRoleAssignment]], [[Modelo PlatformUserBan]],
[[Modelo PromoCode]], [[Modelo PromoRedemption]], [[Modelo Entitlement]].

### Identidad / RBAC (9)
Usuarios, chats, membresías y control de acceso basado en roles.
[[Modelo AppUser]], [[Modelo Chat]], [[Modelo Membership]], [[Modelo Role]], [[Modelo Permission]],
[[Modelo RoleBinding]], [[Modelo Approval]], [[Modelo FeatureFlag]], [[Modelo ModuleState]]
(+ `Topic`, `UserPreference`, `NativeAdminSnapshot`).

### Infra / operación (7)
Idempotencia, colas, auditoría, backups. Ver [[Infrastructure Map]].
[[Modelo UpdateInbox]], [[Modelo CallbackInbox]], [[Modelo IdempotencyKey]], [[Modelo JobOutbox]],
[[Modelo AuditLog]], [[Modelo SecurityAlert]], [[Modelo Backup]] (+ `SecretRef`, `PrivacyRequest`).

### Moderación / seguridad (~13 núcleo + más)
Casos, sanciones, warns, captcha, antiflood/antiraid, listas. Ver [[Security Map]].
[[Modelo ChatSetting]], [[Modelo ModerationCase]], [[Modelo Sanction]], [[Modelo Warning]],
[[Modelo Report]], [[Modelo Evidence]], [[Modelo Appeal]], [[Modelo CaptchaConfig]],
[[Modelo AntifloodConfig]], [[Modelo AntiraidConfig]], [[Modelo WarnPolicyConfig]],
[[Modelo BlocklistConfig]], [[Modelo WelcomeConfig]] (+ `SpamProfile`, `AntifloodEvent`,
`AntiraidEvent`, `BlocklistEntry`, `CaptchaSession`, `PolicyRule`, `GroupHygieneConfig`,
`GroupMembershipGate`, `VerifiedUser`, `ContentLockConfig`, `QuarantineConfig`, `QuarantineItem`,
`D1*`).

### Comunidad (8 núcleo + más)
Comandos custom, filtros, encuestas, recordatorios, sorteos, actividad, misiones cooperativas.
[[Modelo CustomCommand]], [[Modelo Filter]], [[Modelo Poll]], [[Modelo Reminder]], [[Modelo Giveaway]],
[[Modelo ActivityDaily]], [[Modelo UserActivity]], [[Modelo CoopMissionState]] (+ `Note`, `Task`,
`AfkStatus`, `InviteStat`, `ReputationProfile`, `GratitudePoint`, `PostReaction`, `Mission`,
`MissionProgress`, `UserBadge`, `ScheduledPost`, `Feed`, `AutomationRule`, `ChatActivityEvent`).

### IA (8)
Conversaciones, memoria, uso, y control de acceso de pago (por chat / por usuario / suscripción Stars).
[[Modelo AiConversation]], [[Modelo AiMessage]], [[Modelo AiUsage]], [[Modelo AiMemory]],
[[Modelo AiAccessCode]], [[Modelo AiChatAccess]], [[Modelo AiUserAccess]], [[Modelo AiSubscription]].

### Juegos / economía (3 núcleo + casino)
[[Modelo GameSession]], [[Modelo GameScore]], [[Modelo EconomyWallet]]. El casino de fichas vive en
`chip-repository.ts` (`ChipWallet`, `ChipLedger`, `CasinoBet`, `CasinoDuel`, `Jackpot`, `Tournament`).
Ver [[Casino Map]].

### Pagos (3)
[[Modelo Product]], [[Modelo Invoice]], [[Modelo Payment]] (Telegram Stars, `currency` por defecto `XTR`).

### Webhooks / integraciones (2)
[[Modelo Webhook]], [[Modelo WebhookDelivery]].

### Owner Network — federación de dueño (16 modelos)
Resumen consolidado en [[Owner Network Models]].

## Enums (11)

[[Enum TenantStatus]], [[Enum ModuleStatus]], [[Enum AuditActorType]], [[Enum SanctionKind]],
[[Enum CaptchaMode]], [[Enum PolicyAction]], [[Enum ManagedBotStatus]], [[Enum ManagedBotTemplate]],
[[Enum PlatformRole]], [[Enum EntitlementKind]], [[Enum EntitlementSource]].

## Hallazgo transversal: modelos definidos pero sin cablear

Varios modelos existen en el schema (la tabla se crea) pero **no tienen ningún lector/escritor
verificado en la capa de aplicación** (sin repositorio Prisma que use su delegado, más allá — en
algún caso — de `packages/data/prisma/seed.ts`). Son andamiaje de plataforma/moderación aún no
conectado:

- **RBAC de plataforma sin uso**: `Role`, `Permission`, `RoleBinding`, `Approval` — definidos con sus
  relaciones a `Tenant`/`AppUser` pero sin repositorio que los consulte.
- **Flags/módulos solo sembrados**: `FeatureFlag`, `ModuleState` — únicamente `seed.ts` escribe
  `ModuleState`; la config efectiva de features vive en [[Modelo ChatSetting]] (`chat_settings`).
- **Infra no cableada**: `CallbackInbox`, `IdempotencyKey`, `JobOutbox`, `SecurityAlert`, `Backup`,
  `SecretRef`, `PrivacyRequest`. Solo [[Modelo UpdateInbox]] tiene escritor real
  (`foundation-repository.ts`).
- **Moderación no cableada**: `Evidence`, `Appeal`, `SpamProfile` — el flujo de apelaciones activo usa
  en cambio `D1Appeal` (`d1-repository.ts`).

Estado marcado en cada nota individual y consolidado en [[Open Questions]].

## Modelos SIN nota atómica (pendientes)

Cubiertos en grupo por [[Owner Network Models]] o por este overview; crear nota atómica bajo demanda:

`Topic`, `UserPreference`, `NativeAdminSnapshot`, `SecretRef`, `PrivacyRequest`, `SpamProfile`,
`AntifloodEvent`, `AntiraidEvent`, `Note`, `StaffNote`, `Incident`, `GratitudePoint`, `PollVote`,
`Task`, `AfkStatus`, `Ticket`, `TicketMessage`, `ScheduledPost`, `GiveawayEntry`, `InviteStat`,
`ReputationProfile`, `ContentLockConfig`, `BlocklistEntry`, `GroupHygieneConfig`, `GroupMembershipGate`,
`VerifiedUser`, `PanelEditState`, `FeedbackConfig`, `FeedbackUser`, `PostReaction`, `CaptchaSession`,
`PolicyRule`, `ChipWallet`, `ChipLedger`, `CasinoDuel`, `CasinoBet`, `Jackpot`, `Tournament`,
`D1LogConfig`, `D1Event`, `QuarantineConfig`, `QuarantineItem`, `D1Appeal`, `AutomationRule`,
`Mission`, `MissionProgress`, `UserBadge`, `ChatActivityEvent`, `Feed` (nota creada), `Reminder`
(nota creada), y los 16 `Federation*`/`OwnerNetwork*` (ver [[Owner Network Models]]).

## Relaciones

- Pertenece a: [[Repository Inventory]]
- Relacionado con: [[Database Map]], [[Security Map]], [[Casino Map]], [[Modryva Hub Map]], [[Conventions]]
- Produce: las notas `Modelo <Name>` y `Enum <Name>` de esta carpeta.
