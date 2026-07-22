---
id: controller-ai-pack
title: Controller ai-pack
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/ai-pack.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [AiPackController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller ai-pack

`AiPackController` (`apps/api/src/miniapp/ai-pack.controller.ts:38`). Gestiona la suscripción al **Pack de IA** (Groq/Gemini/OpenRouter) pagada con **Telegram Stars (XTR)**, en dos ámbitos: por **chat** (grupo) y por **usuario** (personal). Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:37`).

Instancia `PrismaAiAccessRepository` y `HttpTelegramGateway` (`:39`–`:40`); inyecta [[Servicio admin]] (`:42`). Precio fijo `AI_PACK_STARS_PRICE`, periodo `AI_PACK_SUBSCRIPTION_PERIOD_SECONDS` (30 días, `:13`–`:14`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/ai-pack` | Estado de la suscripción del chat (`scope: chat`). | InitDataGuard + admin | `:46` |
| POST | `groups/:gid/ai-pack/invoice` | Crea link de factura Stars para el chat (`createInvoiceLink`). | InitDataGuard + admin | `:63` |
| POST | `groups/:gid/ai-pack/redeem-code` | Canjea un código de acceso IA (`{ code }`) para el chat. | InitDataGuard + admin | `:77` |
| POST | `groups/:gid/ai-pack/cancel` | Cancela la suscripción del chat (marca en BD + `editUserStarSubscription`). | InitDataGuard + admin | `:109` |
| GET | `ai-pack/me` | Estado de la suscripción personal del usuario (`scope: user`). | InitDataGuard | `:122` |
| POST | `ai-pack/me/invoice` | Crea link de factura Stars personal. | InitDataGuard | `:133` |
| POST | `ai-pack/me/cancel` | Cancela la suscripción personal. | InitDataGuard | `:144` |

Las rutas `groups/:gid/...` exigen `assertGroupAdmin` + `resolveChat`; las `ai-pack/me/...` sólo necesitan el usuario del initData (`ctx.userId`). El canje del código llama `aiAccess.redeemCode` y, si falla, lanza `BadRequestException` con el `reason` del repo (`:95`).

## Modelos que toca

[[Modelo AiSubscription]] (via `getSubscription`/`cancelSubscription`), [[Modelo AiAccessCode]] (via `redeemCode`).

## Consumido desde apps/web

`getChatAiPackStatus` (`apps/web/lib/api-ai-pack.ts:15`), `createChatAiPackInvoice` (`:18`), `redeemChatAiPackCode` (`:23`), `cancelChatAiPack` (`:29`), `getPersonalAiPackStatus` (`:34`), `createPersonalAiPackInvoice` (`:37`), `cancelPersonalAiPack` (`:42`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`, `@superbot/telegram` (`HttpTelegramGateway`).
- **Utilizado por**: [[Pantalla ai-pack]] vía `apps/web/lib/api-ai-pack.ts`.
- **Consume**: [[Modelo AiSubscription]], [[Modelo AiAccessCode]].
- **Relacionado con**: [[Controller platform]] (genera códigos IA), [[Endpoint GET v1 miniapp groups gid ai-pack]], [[Endpoint POST v1 miniapp groups gid ai-pack invoice]], [[API Map]].
