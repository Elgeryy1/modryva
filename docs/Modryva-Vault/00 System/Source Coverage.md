---
id: system-source-coverage
title: Source Coverage
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

# Source Coverage

Trazabilidad de los archivos/áreas importantes del repo → notas del Vault que los documentan. Complemento:
[[Undocumented Sources]] (lo que aún falta). Objetivo: minimizar el contenido importante sin documentar.

| Área / archivo del repo | Nota(s) del Vault | Estado |
|---|---|---|
| `apps/bot/src/{poller,pipeline,delivery}.ts` | [[Bot Pipeline]], [[Poller]], [[Delivery]] | ✅ |
| `apps/bot/src/bot-update.service.ts` | [[Bot Update Service]] + ~50 [[Commands Overview\|Comando ...]] | ✅ |
| `apps/bot/src/core-handlers.ts` | [[Core Handlers]] | ✅ (11 módulos activos confirmado) |
| `apps/api/src/**/*.controller.ts` (24) + endpoints | [[API Overview]], [[Guard InitData]], 18 `Controller <x>` + 16 `Endpoint <x>` | ✅ |
| `apps/api/src/casino/*` | [[Servicio casino]], [[Casino Bet Lifecycle]] | ✅ |
| `apps/web/*` (28 pantallas) | [[Product Map]] + `16 Web UI/` `Pantalla <x>` | 🟡 (generación en curso) |
| `apps/web/components/casino/*` | [[Casino Bug Audit 2026-07]] | 🟡 (sin `Componente Casino <x>` atómico) |
| `apps/worker/src/*` | [[App worker]] + 5 [[Job recap.weekly\|Job ...]] | ✅ |
| `packages/{domain,telegram,data,shared,auth}` | [[Package domain]], [[Package telegram]], [[Package data]], [[Package shared]], [[Package auth]] | ✅ |
| `packages/data/prisma/schema.prisma` (127 modelos) | [[Data Model Overview]] + 11 [[Enum ...]] + ~110 [[Owner Network Models\|Modelo ...]] | ✅ (~100%, 17 agrupados) |
| `modules/community/src` (139) | [[Módulo community]] + ~36 features (Iter 3: +22) | 🟡→🟢 (mayoría wired documentada; no exhaustivo) |
| `modules/security/src` (124) | [[Módulo security]] + ~33 sistemas/features (Iter 3: +24) | 🟡→🟢 (12 wired + 12 `partial`; asesoría-vs-enforcement en [[Open Questions]]) |
| `modules/games/src` (71) | [[Módulo games]] + ~33 (Iter 4: +22 nativos/infra; casino aparte) | 🟢 (nativos + infra; 8 juegos `partial`) |
| `modules/support/src` (78) | [[Módulo support]] + 27 features (Iter 4) | 🟢 (25 wired; ~35 símbolos sin cablear → [[Open Questions]] #38) |
| `modules/automation/src` (32) | [[Módulo automation]] + 20 features (Iter 4) | 🟢 (⚠️ motor ECA sin cablear; real = Webhooks/RSS → #35) |
| `modules/ai/src` (8) | [[Módulo ai]] + 10 features (Iter 4) | 🟢 (6 wired / 4 `partial`) |
| `modules/{payments,files,core}` (1-2 c/u) | [[Módulo payments]], [[Módulo files]], [[Módulo core]] (hubs) | ✅ (triviales) |
| Plataforma (`platform.controller.ts`, `platform-repository.ts`) | [[Modryva Hub Overview]], [[Managed Bots]], [[Platform Roles y RBAC]], [[Promo Codes y Entitlements]], [[Bot Scoping]], [[Webhook de Bots Hijos]] | ✅ |
| `docker-compose.yml`, `Dockerfile` | [[Docker Compose Stack]], [[Env Vars]], [[Runbook Desplegar]] | ✅ |
| `docs/*` | [[References Map]] | ✅ (indexado) |

> Regla de mantenimiento: al crear/editar una nota que documenta un archivo, añade su ruta al `source:` del
> frontmatter y actualiza esta tabla. Ver [[Conventions]].

## Relaciones

- Pertenece a: [[Vault Manifest]]
- Relacionado con: [[Undocumented Sources]], [[Repository Inventory]], [[Vault Health Report]]
