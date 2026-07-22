---
id: owner-network-models
title: Owner Network Models
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/federation-repository.ts
  - packages/data/src/owner-network-repository.ts
  - packages/data/src/owner-network-risk-repository.ts
  - packages/data/src/internal-role-repository.ts
  - packages/data/src/automation-repository.ts
  - packages/data/src/gamification-repository.ts
  - packages/data/src/entitlement-repository.ts
tags:
  - modryva
  - model
  - data
aliases: [Modelo Federation, Modelo FederationChat, Modelo FederationBan, Modelo FederationAdmin, Modelo OwnerNetworkConfig, Modelo GamificationWelcomeButtons, Modelo InternalRole, Modelo RiskProfile]
created: 2026-07-12
updated: 2026-07-12
---

# Owner Network Models

La **Owner Network** (o federación de dueño) permite a una persona que administra varios grupos
tratarlos como una red: config compartida (bienvenida, reglas, membresía), enrutado de eventos entre
grupos, riesgo de usuario agregado, roles internos, gamificación y su propio plan/entitlement. Todos
los modelos cuelgan de un `fedId` (id de federación) y un `tenantId`.

Grupo de **17 modelos** (4 `Federation*` + 13 `OwnerNetwork*`). No se crea nota atómica por cada uno;
este es el resumen consolidado. Ver también [[Modryva Hub Map]] y [[Módulo automation]].

## Federación base (repo `federation-repository.ts`)

| Modelo | Tabla | Propósito | Claves |
|---|---|---|---|
| `Federation` | `federations` | La federación en sí (nombre, dueño, chat de log, federación suscrita). | `fedId @unique` |
| `FederationChat` | `federation_chats` | Grupos que pertenecen a la federación. | `chatId @unique`, `@@index([fedId])` |
| `FederationBan` | `federation_bans` | Baneos que se propagan a todos los grupos de la fed. | `@@unique([fedId, subjectTelegramId])` |
| `FederationAdmin` | `federation_admins` | Admins de la federación. | `@@unique([fedId, telegramUserId])` |

## Configuración y enrutado (repo `owner-network-repository.ts`)

| Modelo | Tabla | Propósito | Claves |
|---|---|---|---|
| `OwnerNetworkConfig` | `owner_network_configs` | Config central: modos de bienvenida/reglas/membresía, textos, chat de log. | `fedId @unique` |
| `OwnerNetworkGroupRole` | `owner_network_group_roles` | Rol de cada grupo dentro de la red (con etiqueta). | `@@unique([fedId, chatId, role])` |
| `OwnerNetworkRoute` | `owner_network_routes` | Enrutado de eventos entre grupos (source → target por `eventKind`). | `@@unique([fedId, sourceKey, eventKind])` |
| `OwnerNetworkConfigSnapshot` | `owner_network_config_snapshots` | Instantáneas de config para rollback/auditoría (`payload Json`). | `@@index([fedId])` |

## Riesgo, roles internos y notas

| Modelo | Tabla | Repo | Propósito |
|---|---|---|---|
| `OwnerNetworkUserRisk` | `owner_network_user_risks` | `owner-network-risk-repository.ts` | Score de riesgo agregado por usuario (deleted/report/quarantine/link/sanction counts, `chatIds String[]`). `@@unique([fedId, telegramUserId])`. |
| `OwnerNetworkUserRole` | `owner_network_user_roles` | `internal-role-repository.ts` | Rol interno del usuario en la red. `@@unique([fedId, telegramUserId])`. |
| `OwnerNetworkUserNote` | `owner_network_user_notes` | `internal-role-repository.ts` | Notas de staff sobre un usuario (autor + sujeto). |

## Gamificación (repo `gamification-repository.ts`)

| Modelo | Tabla | Propósito |
|---|---|---|
| `OwnerNetworkBadge` | `owner_network_badges` | Insignias otorgadas. `@@unique([fedId, telegramUserId, badge])`. |
| `OwnerNetworkMission` | `owner_network_missions` | Misiones por usuario (con `completedAt`). `@@unique([fedId, telegramUserId, kind])`. |
| `OwnerNetworkWelcomeButtons` | `owner_network_welcome_buttons` | Botones del mensaje de bienvenida (rules/otherGroups/support/verify). `chatId @unique`. |

## Automatización y plan

| Modelo | Tabla | Repo | Propósito |
|---|---|---|---|
| `OwnerNetworkAutomation` | `owner_network_automations` | `automation-repository.ts` | Reglas trigger/condition/action (`Json`) a nivel de red o chat. |
| `OwnerNetworkEntitlement` | `owner_network_entitlements` | `entitlement-repository.ts` | Plan de la red (`free`/pro), `maxChats`, `premiumUntil`. `fedId @unique`. |
| `OwnerNetworkPremiumCode` | `owner_network_premium_codes` | `entitlement-repository.ts` | Códigos premium canjeables (plan, maxChats, días). `code @unique`. |

## Notas de fiabilidad

- Todos llevan `tenantId` + `@@index([tenantId])` y `@@index([fedId])`; el `fedId` es la clave de
  agrupación transversal (no es FK relacional declarada, se une por valor).
- El enrutado (`OwnerNetworkRoute`) y la config (`OwnerNetworkConfig`) son el núcleo del "cerebro" de
  la red; el resto son satélites (riesgo, roles, gamificación, plan).

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Módulo automation]], [[Módulo community]], [[Módulo security]]
- Relacionado con: [[Database Map]], [[Modryva Hub Map]], [[Modelo Tenant]]
