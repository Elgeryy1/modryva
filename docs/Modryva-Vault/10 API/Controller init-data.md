---
id: controller-init-data
title: Controller init-data
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/init-data.controller.ts, apps/api/src/telegram-init-data.ts]
tags: [modryva, controller, api]
aliases: [InitDataController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller init-data

`InitDataController` (`apps/api/src/init-data.controller.ts:13`). Verifica un `initData` de Telegram bajo demanda. Prefijo `@Controller("v1/init-data")`. **No usa** `InitDataGuard`: hace la verificación manual contra el token del **bot primario**.

## Endpoints

| Método | Ruta | Propósito | Auth |
|---|---|---|---|
| POST | `/v1/init-data/verify` | Verificar initData (HMAC) | verificación manual |

`verify(@Body { initData })` (`:16`, `@HttpCode(200)`):
- Sin `initData` → `400 { ok: false, error: "missing-init-data" }`.
- Sin `TELEGRAM_BOT_TOKEN` → `503 { ok: false, error: "missing-bot-token" }`.
- Devuelve `verifyTelegramInitData(initData, TELEGRAM_BOT_TOKEN)` → `TelegramInitDataVerification` `{ ok, authDate, user, queryId, raw, error }`.

> A diferencia de [[Guard InitData]], aquí **no** hay resolución multi-tenant ni `maxAgeSeconds`: verifica solo contra el token primario. Ver [[Endpoint POST v1 init-data verify]].

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `verifyTelegramInitData` (`apps/api/src/telegram-init-data.ts`), `getRuntimeEnv` (`@superbot/shared`).
- **Relacionado con**: [[Guard InitData]], [[Endpoint POST v1 init-data verify]].
