---
id: modryva-adr-006
title: ADR-006 Mini App con initData firmado en vez de sesión propia
type: decision
domain: decision
status: inferred
maturity: stable
source:
  - apps/api/src/telegram-init-data.ts
  - apps/api/src/miniapp/init-data.guard.ts
tags:
  - modryva
  - decision
  - api
created: 2026-07-12
updated: 2026-07-12
---

# ADR-006 — Autenticar la Mini App con initData firmado (sin sesión propia)

## Estado
**inferred**.

## Contexto
La Mini App (panel web) necesita saber quién es el usuario sin montar login/gestión de sesiones propia.

## Decisión
Usar el **`initData` firmado por Telegram** en cada petición (`Authorization: tma <initData>`), verificado
por HMAC en el backend ([[Guard InitData]], `apps/api/src/telegram-init-data.ts`), con antigüedad máxima
(`INITDATA_MAX_AGE_SECONDS`). Sin cookies/JWT propios.

## Evidencia
`apps/api/src/telegram-init-data.ts`, `init-data.guard.ts`, `apps/web/lib/api.ts`. Ver
[[Integración Telegram Mini Apps]].

## Alternativas
Sesión propia con JWT/cookies (más superficie de auth que mantener y asegurar).

## Consecuencias positivas
Menos superficie de seguridad propia; identidad garantizada por Telegram.

## Consecuencias negativas
initData caduca → 401 "cierra y reabre"; toda la API depende del guard; para bots hijos hay que pasar el
grupo por `?sp=` (no viaja en initData firmado).

## Componentes afectados
[[Guard InitData]] · [[API Overview]] · [[Package auth]].

## Relaciones
- Pertenece a: [[Decisions Map]]
- Relacionado con: [[Integración Telegram Mini Apps]], [[API Map]]
