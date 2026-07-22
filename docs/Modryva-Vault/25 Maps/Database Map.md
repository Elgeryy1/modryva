---
id: moc-database
title: Database Map
type: moc
domain: data
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - data
  - model
created: 2026-07-12
updated: 2026-07-12
---

# Database Map

Modelo de datos: **127 modelos + 11 enums** en `packages/data/prisma/schema.prisma`, accedidos vía
repositorios en `packages/data/src/`. Índice detallado en `09 Data/` → [[Data Model Overview]].

## Dominios de datos

- **Plataforma / multi-bot** → [[Modelo Tenant]], [[Modelo ManagedBot]], [[Modelo Entitlement]], [[Modelo PromoCode]] (ver [[Modryva Hub Map]])
- **Identidad / RBAC** → [[Modelo AppUser]], [[Modelo Chat]], [[Modelo Membership]], [[Modelo Role]], [[Modelo Permission]], [[Modelo RoleBinding]]
- **Moderación** → [[Modelo ModerationCase]], [[Modelo Sanction]], [[Modelo Warning]], [[Modelo Report]], [[Modelo Appeal]], [[Modelo CaptchaConfig]] (ver [[Security Map]])
- **Comunidad** → [[Modelo ChatSetting]], [[Modelo CustomCommand]], [[Modelo Poll]], [[Modelo Reminder]], [[Modelo Giveaway]], [[Modelo WelcomeConfig]]
- **IA** → [[Modelo AiConversation]], [[Modelo AiMessage]], [[Modelo AiUsage]], [[Modelo AiAccessCode]]
- **Juegos / economía** → [[Modelo ChipWallet]], [[Modelo ChipLedger]], [[Modelo CasinoBet]], [[Modelo GameScore]] (ver [[Casino Map]])
- **Owner Network** → [[Owner Network Models]] (15+ modelos `OwnerNetwork*`)
- **Infra / operación** → [[Modelo UpdateInbox]], [[Modelo IdempotencyKey]], [[Modelo JobOutbox]], [[Modelo AuditLog]], [[Modelo Webhook]]

## Enums

[[Enum SanctionKind]] · [[Enum CaptchaMode]] · [[Enum PolicyAction]] · [[Enum ManagedBotStatus]] ·
[[Enum ManagedBotTemplate]] · [[Enum PlatformRole]] · [[Enum EntitlementKind]] · [[Enum EntitlementSource]] ·
[[Enum TenantStatus]] · [[Enum ModuleStatus]] · [[Enum AuditActorType]]

## Migraciones

No hay carpeta `prisma/migrations` real: el Dockerfile solo hace `prisma generate`. Para tablas nuevas se
usa `db push` contra el host. Ver [[Runbook Migraciones Prisma]] y [[Riesgo Sin migraciones Prisma versionadas]].

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Package data]], [[Security Map]], [[Casino Map]], [[Modryva Hub Map]]
