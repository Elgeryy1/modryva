---
id: controller-network-analytics
title: Controller network-analytics
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/network-analytics.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappNetworkAnalyticsController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller network-analytics

`MiniappNetworkAnalyticsController` (`apps/api/src/miniapp/network-analytics.controller.ts:66`). Analítica agregada de la red + un **"doctor"** que detecta chats sin configurar y aplica arreglos por defecto. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:65`).

Instancia analytics, antiflood, captcha, d1, federation y welcome (`:67`–`:72`); recibe [[Servicio admin]] por constructor implícito (`:74`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/network/analytics` | Payload agregado de la red: totales, usuarios activos, días recientes, top posters, eventos raid/spam por hora, chats sin configurar, `healthScore` y recomendaciones. | InitDataGuard + **network-admin** | `:76` |
| POST | `groups/:gid/network/doctor/fix` | Aplica una recomendación (`{ recommendationId }`) — `enable-captcha` o `enable-antiflood` con valores por defecto. | InitDataGuard + **network-admin** | `:83` |

`buildAnalytics` (`:112`) mezcla métricas de todos los chats de la red. `healthScore` (`computeHealthScore`, `:393`) pondera captcha 0.3 / antiflood 0.3 / d1 0.2 / welcome 0.2. Las recomendaciones (`buildRecommendations`, `:412`) son `enable-captcha`, `enable-antiflood`, `configure-welcome` (esta última sin auto-fix → 400 `no-auto-fix`).

## Autorización

`requireNetworkAdmin` (`:331`): si el chat no está en red devuelve el propio chat como red de uno; si lo está exige owner/fed-admin (403 `not-network-admin`). `resolveNetworkChatIds` (`:302`) resuelve la lista de chats.

## Modelos que toca

[[Modelo Analytics]] (activity windows, totales, top posters), [[Modelo CaptchaConfig]], [[Modelo AntifloodConfig]], [[Modelo WelcomeConfig]], [[Modelo D1LogConfig]], [[Modelo Federation]].

## Consumido desde apps/web

`getNetworkAnalytics` (`apps/web/lib/api-analytics.ts:41`), `applyDoctorFix` (`:44`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla analytics]] vía `apps/web/lib/api-analytics.ts`.
- **Consume**: [[Modelo Analytics]], [[Modelo Federation]].
- **Relacionado con**: [[Controller network-risk]], [[Controller owner-network]], [[Endpoint GET v1 miniapp groups gid network analytics]], [[API Map]].
