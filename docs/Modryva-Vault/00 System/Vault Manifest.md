---
id: system-vault-manifest
title: Vault Manifest
type: moc
domain: system
status: partial
maturity: beta
tags:
  - modryva
  - system
  - moc
created: 2026-07-12
updated: 2026-07-12
---

# Vault Manifest

Índice maestro del **cerebro externo de Modryva**. Explica cómo está organizado, cómo navegarlo y cómo
ampliarlo. Punto de entrada humano: [[Modryva Home]].

## Cómo navegar

1. Empieza en [[Modryva Home]] (centro de mando) → elige un dominio.
2. Cada dominio tiene un **MOC** en `25 Maps/` (`<Dominio> Map`) que indexa sus notas.
3. Cada dominio grande tiene además un **hub** (`Módulo <x>`, `API Overview`, `Data Model Overview`…) con
   el detalle.
4. Abre el **Graph View** (con los grupos de color de `.obsidian/graph.json`) para ver los clústeres.

## Estructura de carpetas (pobladas)

> Recuentos exactos y actualizados en [[Vault Health Report]]. Aquí, el rol de cada carpeta.

- `00 System/` — meta del Vault (9): [[Repository Inventory]], [[Conventions]], [[Generation Plan]],
  [[Generation Log]], [[Vault Manifest]], [[Source Coverage]], [[Undocumented Sources]],
  [[Open Questions]], [[Vault Health Report]].
- `01 Home/` — [[Modryva Home]] (centro de mando).
- `02 Product/` — [[Product Overview]], [[Companion sin admin]] (qué es el producto y sus superficies).
- `03 Architecture/` — [[Arquitectura General]], 4 apps, 5 packages, [[Monorepo Layout]].
- `04 Bot Core/` — pipeline del bot ([[Bot Pipeline]], [[Bot Update Service]], [[Update Lifecycle]]…).
- `05 Modules/` — los **9 módulos** con hub `Módulo <x>` **+ features documentadas** (~134 notas): Community,
  Games, AI, Automation, Support (Security vive en `12`). Iter 4 hizo fan-out de 1 agente por módulo.
- `06 Commands/` — [[Commands Overview]] + ~50 notas `Comando <x>` (dispatch verificado en `poller.ts` /
  `bot-update.service.ts`).
- `07 Events/` — 7 tipos de update de Telegram ([[Evento message]], [[Evento callback_query]]…).
- `08 Workflows/` — Jobs (`Job <x>`) + Flujos (`Flujo <x>`: [[Flujo Update de Telegram]], Ban, Mute, Warn,
  Apelación, Onboarding de grupo, Recap Semanal).
- `09 Data/` — [[Data Model Overview]], 11 enums, ~110 notas `Modelo <x>` (cobertura ~100% del schema) +
  [[Owner Network Models]].
- `10 API/` — [[API Overview]], [[Guard InitData]], controllers, endpoints y servicios.
- `11 Modryva Hub/` — plataforma multi-bot ([[Modryva Hub Overview]], [[Managed Bots]], [[Bot Scoping]]…).
- `12 Security/` — [[Módulo security]] + ~33 sistemas/features de moderación ([[Antiflood]], [[Antiraid]],
  [[Captcha]], [[Warn Policy]], [[Federations]], detectores…).
- `13 Infrastructure/` — despliegue con Docker Compose, [[Docker Compose Stack]], [[Env Vars]], Env atómicas,
  [[Local Development Setup]].
- `14 Guides/` — 6 guías de onboarding de desarrollador ([[Guía Añadir un Comando]], [[Guía Depurar un Error]]…).
- `15 Testing/` — [[Testing Strategy]], [[Casino Bug Audit 2026-07]].
- `16 Web UI/` — 22 pantallas `Pantalla <x>` de la Mini App + [[Componente Casino shared]].
- `17 Integrations/` — 8 integraciones externas ([[Integración Telegram Bot API]], PostgreSQL, Redis…).
- `18 Decisions/` — 7 ADRs (ADR-001…ADR-007).
- `19 Roadmap/` — items de mejora ([[Roadmap Migraciones Prisma versionadas]]…).
- `20 Runbooks/` — 6 runbooks operativos ([[Runbook Desplegar]], [[Runbook Bot Caído]]…).
- `21 Risks and Debt/` — 7 riesgos/deuda técnica.
- `22 Glossary/` — términos clave.
- `23 People and Roles/` — [[Roles y Actores]] (actores humanos + el bot; cómo se decide cada permiso).
- `25 Maps/` — 22 MOCs. `26 Canvases/` — 4 lienzos. `27 Templates/` — 13 plantillas.

## Carpetas reservadas (aún sin contenido)

`24 References`, `99 Archive` (algunos MOCs las anticipan con enlaces fantasma; las referencias externas se
indexan por ahora en [[References Map]]). Cola priorizada: [[Undocumented Sources]] + [[Generation Plan]].

## Convenciones (resumen)

Nombres de nota deterministas por tipo, frontmatter YAML obligatorio, tags para grupos del grafo, estados
diferenciados (`implemented/partial/planned/experimental/deprecated/unknown`) y bloque `## Relaciones` al
final. Detalle completo: [[Conventions]].

## Cómo ampliar / regenerar

1. Lee [[Generation Plan]] (tabla de estado por lote) + [[Generation Log]] (última entrada).
2. Toma el primer lote ⏳ o el hueco de mayor prioridad en [[Undocumented Sources]].
3. Usa la plantilla adecuada de `27 Templates/` y respeta [[Conventions]] (cita `source`, marca `unknown`).
4. Tras cada lote: actualiza [[Vault Manifest]], [[Source Coverage]], [[Generation Log]] y [[Vault Health Report]].
5. Para paralelizar con agentes: un agente por dominio, alcance de lectura explícito, carpeta de salida
   propia, y convenciones embebidas (como en la Iteración 1).

## Índice del sistema

[[Repository Inventory]] · [[Conventions]] · [[Generation Plan]] · [[Generation Log]] ·
[[Source Coverage]] · [[Undocumented Sources]] · [[Open Questions]] · [[Vault Health Report]] · [[Modryva Home]]

## Relaciones

- Relacionado con: [[Modryva Home]], [[Repository Inventory]], [[Generation Plan]], [[Vault Health Report]]
