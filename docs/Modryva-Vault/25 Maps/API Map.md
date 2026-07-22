---
id: moc-api
title: API Map
type: moc
domain: api
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - api
created: 2026-07-12
updated: 2026-07-12
---

# API Map

API NestJS + Fastify (`apps/api`). Todas las rutas cuelgan de `v1/...`; la mayoría tras el
[[Guard InitData]] (verificación de `initData` de Telegram). Índice detallado en `10 API/` → [[API Overview]].

## Controllers

- Núcleo: [[Controller bootstrap]] (`v1`), [[Controller dashboard]] (`v1/dashboard`), [[Controller init-data]] (`v1/init-data`), [[Controller health]], [[Controller observability]].
- Casino/juegos: [[Controller casino]] (`v1/casino`), [[Controller games]] (`v1/games`).
- Plataforma: [[Controller platform]] (`v1/platform`).
- Mini App (`v1/miniapp/*`): [[Controller config]], [[Controller automation]], [[Controller backup]], [[Controller ai-pack]], [[Controller entitlement]], [[Controller federation]], [[Controller gamification]], [[Controller lists]], [[Controller moderation-inbox]], [[Controller network-analytics]], [[Controller network-risk]], [[Controller owner-network]], [[Controller user-panel]], [[Controller wizard]].

## Cliente

El frontend llama a la API vía `apps/web/lib/api.ts` (proxy same-origin `/api` → contenedor api). Ver
[[Package auth]] (initData) y [[Product Map]] (pantallas que consumen cada endpoint).

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Architecture Map]], [[Database Map]], [[Product Map]], [[Modryva Hub Map]]
