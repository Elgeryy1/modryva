---
id: system-generation-plan
title: Generation Plan
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

# Generation Plan

Plan por lotes para construir el Vault. El Vault es su propia memoria: este plan + [[Generation Log]] +
[[Vault Manifest]] permiten continuar sin rehacer trabajo. Marca cada dominio al completarlo.

## Método

1. **Columna vertebral (humano, control total)** — scaffold, `.obsidian`, notas de sistema, [[Modryva Home]],
   todos los MOC, plantillas ([[27 Templates]]), glosario semilla, config de grafo, canvases.
2. **Profundidad atómica (agentes en paralelo, uno por dominio)** — cada agente lee código real y escribe
   notas atómicas en su carpeta siguiendo [[Conventions]], citando `source`, marcando `unknown`.
3. **Consolidación** — actualizar [[Vault Manifest]], [[Source Coverage]], [[Undocumented Sources]],
   [[Vault Health Report]] tras cada lote.

## Estado por lote

| Lote | Dominio | Carpeta | Estado |
|---|---|---|---|
| B0 | Sistema + convenciones + config grafo | `00 System`, `.obsidian` | ✅ hecho |
| B0 | Home + plantillas + MOC shells | `01 Home`, `25 Maps`, `27 Templates` | 🔄 en curso |
| B1 | Arquitectura (apps + packages) | `03 Architecture` | ⏳ pendiente |
| B1 | Bot Core (pipeline, update lifecycle) | `04 Bot Core` | ⏳ pendiente |
| B2 | Módulos (10 hubs) | `05 Modules` | ⏳ pendiente |
| B2 | Datos (127 modelos por dominio) | `09 Data` | ⏳ pendiente |
| B3 | Comandos (82 handlers) | `06 Commands` | ⏳ pendiente |
| B3 | API (24 controllers + endpoints) | `10 API` | ⏳ pendiente |
| B4 | Seguridad/Moderación | `12 Security` | ⏳ pendiente |
| B4 | Modryva Hub / Plataforma multi-bot | `11 Modryva Hub` | ⏳ pendiente |
| B5 | Casino + Juegos | `05 Modules`, `26 Canvases` | ⏳ pendiente (base ya en memoria del proyecto) |
| B5 | IA (module ai + ai-pack) | dentro de `05 Modules` | ⏳ pendiente |
| B6 | Eventos + Workflows/Flujos | `07 Events`, `08 Workflows` | ⏳ pendiente |
| B6 | Infra + Operaciones + Runbooks | `13/14/20` | ⏳ pendiente |
| B7 | Testing + Observabilidad + Integraciones | `15/16/17` | ⏳ pendiente |
| B7 | Decisiones (ADR) + Roadmap | `18`, `19` | ⏳ pendiente |
| B8 | Riesgos y deuda técnica | `21` | ⏳ pendiente |
| B8 | Glosario + Personas + Canvases + Health | `22/23/26`, `00 System` | ⏳ pendiente |

## Prioridad de agentes (primera ola)

Los dominios más grandes / centrales primero, para densidad temprana del grafo:
`security`, `community`, `data (modelos)`, `commands`, `api`, `casino/games`, `platform/hub`, `ai`,
`automation`, `support`.

## Relaciones

- Pertenece a: [[Vault Manifest]]
- Depende de: [[Repository Inventory]], [[Conventions]]
- Relacionado con: [[Generation Log]], [[Vault Health Report]]
