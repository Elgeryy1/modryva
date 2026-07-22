---
id: system-undocumented-sources
title: Undocumented Sources
type: system
domain: system
status: partial
maturity: beta
tags:
  - modryva
  - system
  - traceability
created: 2026-07-12
updated: 2026-07-12
---

# Undocumented Sources

Archivos/áreas **relevantes** aún sin nota atómica en el Vault, priorizados para la siguiente iteración.
Complemento de [[Source Coverage]]. La cola de trabajo real está en [[Generation Plan]].

## Prioridad ALTA (huecos que rompen navegación / centrales)

- **Comandos** — `06 Commands/` está vacío (el agente murió). Faltan `Commands Overview` + ~40 notas
  `[[Comando ...]]`. Fuente: `apps/bot/src/bot-update.service.ts` (82 handlers), `docs/COMMANDS.md`.
- **Controllers restantes (18/24)** — todos los `apps/api/src/miniapp/*.controller.ts` excepto los núcleo:
  `config, automation, backup, ai-pack, entitlement, federation, gamification, lists, moderation-inbox,
  network-analytics, network-risk, owner-network, user-panel, wizard`. → notas `[[Controller ...]]`.
- **Modelos Prisma restantes (~114/127)** — solo se documentaron enums + overview. Prioriza los de
  [[Database Map]] (identidad/RBAC, moderación, comunidad, IA, infra).

## Prioridad MEDIA

- **Módulos sin tocar**: `modules/ai` ([[Módulo ai]]), `modules/automation` ([[Módulo automation]]),
  `modules/support` ([[Módulo support]]), `modules/payments` ([[Módulo payments]]), `modules/files`
  ([[Módulo files]]), `modules/core` ([[Módulo core]]).
- **Worker jobs atómicos**: `[[Job recap.weekly]]`, `[[Job expiration]]`, `[[Job rss]]`,
  `[[Job trivia-announce]]`, `[[Job webhook]]` (fuente `apps/worker/src/*-processor.ts`).
- **Pantallas web (28)**: notas `[[Pantalla ...]]` (fuente `apps/web/app/**/page.tsx`).
- **Componentes casino web**: `apps/web/components/casino/*.tsx` → `[[Componente Casino ...]]`.

## Prioridad BAJA (completar densidad)

- Eventos atómicos (`07 Events/`), flujos (`08 Workflows/`), integraciones (`17 Integrations/`),
  observabilidad (`16 Observability/`), glosario (`22 Glossary/`), personas/roles (`23 People and Roles/`).
- **Notas referenciadas como fantasma pero de alto valor**: [[Riesgo God Object bot-update]],
  despliegue con Docker Compose, [[Docker Compose Stack]], [[Runbook Desplegar]], [[Env Vars]], los `[[ADR-...]]`.
- Features de lógica pura no núcleo de `community` (125 restantes) y `security` (116 restantes): documentar
  por lotes o en notas-resumen; muchas son `partial` (sin cablear) — ver [[Open Questions]] #9.

## Relaciones

- Pertenece a: [[Vault Manifest]]
- Relacionado con: [[Source Coverage]], [[Generation Plan]], [[Vault Health Report]]
