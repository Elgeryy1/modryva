---
id: servicio-admin
title: Servicio admin
type: service
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/admin.service.ts]
tags: [modryva, service, api]
aliases: [MiniappAdminService]
created: 2026-07-12
updated: 2026-07-12
---

# Servicio admin

`MiniappAdminService` (`apps/api/src/miniapp/admin.service.ts:49`) es el provider de **autorización viva** de la Mini App: la lista de administradores de Telegram es la **única fuente de verdad** para permitir escrituras (fail-closed ante cualquier error). No existe un índice de admins; la api nunca llama `getUpdates`, solo lookups sin estado.

## Responsabilidad

Segunda barrera después de [[Guard InitData]]: el guard prueba *quién* eres; este servicio prueba que *eres admin del grupo concreto* justo antes de mutar su config.

## Métodos clave

- **`assertGroupAdmin(telegramChatId, userId, bot?)`** (`:197`): autoriza escrituras. El owner de plataforma (`SUPERBOT_OWNER_TELEGRAM_ID`) pasa siempre. Si el usuario no está en la caché de admins, re-verifica contra Telegram **una vez** (throttle de 15 s por grupo, `ADMIN_REVERIFY_THROTTLE_MS`) por si acaba de ser promovido. Si sigue sin estar → `403 { error: "not-admin" }`.
- **`resolveChat(telegramChatId, bot?)`** (`:179`): mapea el chat de Telegram al chat interno **dentro del tenant de ese bot** (`telegram-<username>`). Devuelve `{ tenantId, chatId, telegramChatId, title }`. Tenant o chat inexistente → `404 { error: "chat-not-found" }`.
- **`isBotAdmin(telegramChatId, bot?)`** (`:95`): ¿el propio bot es admin en el grupo? Advisory, **fail-OPEN** (ante duda asume admin) — solo guía el onboarding (deshabilita propósitos de moderación si el bot es mero miembro). Usa el id del bot extraído del prefijo del token, sin llamada de red.
- **`botDisplayName(bot?)`** (`:123`): `getMe.first_name` cacheado 1 h por bot, para brandear la cabecera de la Mini App.
- **`botIdentity(bot?)`** (`:153`): `{ template, isPrimary }` del bot que sirve; lee `managedBot` para saber si es un bot hijo `community/creator/support/business/custom`. Guía la pregunta de propósito del onboarding.

## Cachés (con cap FIFO)

- Admins por `(bot,chat)`: TTL 5 min (`ADMIN_CACHE_TTL_MS`), cap 10.000 (`MAX_ADMIN_CACHE_ENTRIES`).
- Nombre de bot: TTL 1 h (`BOT_NAME_TTL_MS`).
- `cachedAdminIds` hace **fail-closed**: si Telegram no confirma la lista de admins, lanza `403 not-admin` (nunca autoriza a ciegas) (`:262-265`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `HttpTelegramGateway` (`@superbot/telegram`), `PrismaFoundationRepository` (`@superbot/data`), `getRuntimeEnv` (`@superbot/shared`).
- **Utilizado por**: [[Controller config]], [[Controller lists]], [[Controller federation]], [[Controller owner-network]], [[Controller moderation-inbox]], [[Controller wizard]], [[Controller backup]], [[Controller ai-pack]], [[Controller gamification]], [[Controller user-panel]], [[Controller automation]], [[Controller entitlement]], [[Controller network-risk]], [[Controller network-analytics]].
- **Consume**: [[Modelo Tenant]], [[Modelo Chat]], [[Modelo ManagedBot]].
- **Relacionado con**: [[Guard InitData]].
