---
id: home-modryva
title: Modryva Home
type: moc
domain: system
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - home
aliases:
  - Home
  - Inicio
created: 2026-07-12
updated: 2026-07-12
---

# 🧠 Modryva Home

Centro de mando del **cerebro externo** de Modryva — un bot de Telegram modular de gran escala
(monorepo `superbot`: 4 apps, 5 paquetes, 10 módulos, 127 modelos de datos). Empieza aquí para navegar
todo el conocimiento del proyecto.

> Punto de entrada rápido: [[Repository Inventory]] (inventario verificado) · [[Developer Onboarding Map]]
> (para empezar a desarrollar) · [[Conventions]] (cómo está escrito este Vault).

## 🗺️ Mapas de contenido (MOCs)

Cada mapa es el índice navegable de su dominio y forma un clúster en el Graph View.

| Dominio | Mapa | Dominio | Mapa |
|---|---|---|---|
| Producto | [[Product Map]] | Datos | [[Database Map]] |
| Arquitectura | [[Architecture Map]] | API | [[API Map]] |
| Bot Core | [[Bot Core Map]] | Modryva Hub | [[Modryva Hub Map]] |
| Módulos | [[Modules Map]] | Seguridad | [[Security Map]] |
| Comandos | [[Commands Map]] | Casino | [[Casino Map]] |
| Eventos | [[Events Map]] | Infraestructura | [[Infrastructure Map]] |
| Workflows | [[Workflows Map]] | Operaciones | [[Operations Map]] |
| Testing | [[Testing Map]] | Integraciones | [[Integrations Map]] |
| Roadmap | [[Roadmap Map]] | Riesgos y deuda | [[Risks and Technical Debt Map]] |
| Onboarding | [[Developer Onboarding Map]] | Observabilidad | [[Observability Map]] |

## 📊 Estado del proyecto (verificado 2026-07-12)

| Métrica | Valor |
|---|---|
| Apps / Paquetes / Módulos | 4 / 5 / 10 |
| Modelos Prisma / Enums | 127 / 11 |
| Controllers API / Endpoints | ~24 / muchos (ver [[API Map]]) |
| Handlers de comando | 82 símbolos `handle*Command` |
| Procesadores worker | 5 |
| Pantallas web | 28 |
| Tests | 497 ficheros |

Detalle y evidencia: [[Repository Inventory]]. Salud del Vault: [[Vault Health Report]].

## 🚦 Leyenda de estados

Todas las notas declaran su `status` en el frontmatter (ver [[Conventions]]):

- **implemented** — código presente (con evidencia en `source`).
- **partial** — lógica existente pero sin cablear del todo / sin UI / sin tests.
- **planned** — en roadmap/docs, sin implementar.
- **experimental** — presente pero no estable / tras flag.
- **deprecated** — obsoleto / sustituido.
- **unknown** — sin verificar (ver [[Open Questions]]).

## 🧩 Dominios principales

- [[Product Map]] — qué hace Modryva para el usuario final: moderación, comunidad, juegos, IA, panel.
- [[Architecture Map]] — monorepo, apps, paquetes y cómo encajan.
- [[Modules Map]] — los 10 módulos de dominio ([[Módulo security]], [[Módulo community]], [[Módulo games]]…).
- [[Security Map]] — moderación: warn/mute/ban, antiflood, antiraid, captcha, blocklists.
- [[Casino Map]] — casino social provably-fair (13+ juegos, economía de fichas).
- [[Modryva Hub Map]] — plataforma multi-bot (bot padre + managed bots + entitlements).
- [[Database Map]] — los 127 modelos por dominio.

## 🛠️ Operar y desarrollar

- [[Developer Onboarding Map]] — poner el entorno en marcha.
- [[Operations Map]] · [[Runbook Desplegar]] · despliegue con Docker Compose.
- [[Risks and Technical Debt Map]] — qué vigilar. [[Open Questions]] — qué falta por verificar.

## 🧭 Sistema del Vault

[[Repository Inventory]] · [[Vault Manifest]] · [[Source Coverage]] · [[Undocumented Sources]] ·
[[Generation Plan]] · [[Generation Log]] · [[Vault Health Report]] · [[Conventions]].

> Consultas Dataview opcionales en [[Dashboards]] (funcionan solo si instalas el plugin Dataview; el
> Vault es 100% navegable sin plugins).

## Relaciones

- Pertenece a: [[Vault Manifest]]
- Relacionado con: [[Repository Inventory]], [[Product Map]], [[Architecture Map]], [[Developer Onboarding Map]]
