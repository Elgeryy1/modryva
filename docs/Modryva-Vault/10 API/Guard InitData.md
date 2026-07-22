---
id: guard-initdata
title: Guard InitData
type: guard
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/init-data.guard.ts, apps/api/src/telegram-init-data.ts]
tags: [modryva, guard, api]
aliases: [InitDataGuard, Guard initData]
created: 2026-07-12
updated: 2026-07-12
---

# Guard InitData

`InitDataGuard` (`apps/api/src/miniapp/init-data.guard.ts:74`) es el **guard de autenticación** de la Mini App. Implementa `CanActivate` y se aplica con `@UseGuards(InitDataGuard)` en todos los controllers de negocio. Es provider del `ApiAppModule` (`app.module.ts:54`).

## Qué valida (flujo de `canActivate`)

1. **Cabecera** `Authorization: tma <initData>` (`init-data.guard.ts:96-108`). Sin cabecera o esquema distinto de `tma` → `401 { error: "missing-auth" }`.
2. Exige `TELEGRAM_BOT_TOKEN` en el entorno; si falta → `503 { error: "missing-bot-token" }` (`:111-113`).
3. **Resuelve el bot** al que pertenece la petición (`resolveVerificationBot`, `:162`) y obtiene su token.
4. **Verifica el HMAC** con `verifyTelegramInitData(initData, botToken, { maxAgeSeconds: INITDATA_MAX_AGE_SECONDS, now })` (`:117`). Si falla → `401 { error: <motivo> }` (motivos: `missing-hash`, `invalid-hash`, `missing-auth-date`, `auth-date-expired`, `invalid-user`).
5. Exige `user.id` presente; si no → `401 { error: "missing-user" }` (`:127-129`).
6. **Ban de plataforma**: `assertNotPlatformBanned` (`:251`). Si el usuario tiene un ban activo → `403` con `{ error: "platform-user-banned", reason, bannedAt, expiresAt }`. El owner (`SUPERBOT_OWNER_TELEGRAM_ID`) está exento.
7. Adjunta `request.miniapp` = `{ userId, user, startParam, botUsername, botToken, platformActAs? }` (`:146-153`) y devuelve `true`.

`getMiniappContext(request)` (`:346`) es el helper que los controllers usan para leer ese contexto; lanza `401 missing-auth` si no está.

## Cómo verifica el HMAC

La verificación real está en `verifyTelegramInitData` (`apps/api/src/telegram-init-data.ts:42`), no en un paquete externo:
- Extrae `hash`, ordena el resto de pares `key=value` y construye el `data_check_string`.
- `secretKey = HMAC_SHA256("WebAppData", botToken)`; `calculatedHash = HMAC_SHA256(secretKey, dataCheckString)`.
- Compara en **tiempo constante** (`crypto.timingSafeEqual`) con guarda de longitud previa (`telegram-init-data.ts:73-80`).
- Aplica `maxAgeSeconds` sobre `auth_date` para rechazar initData caducado.

Un HMAC válido **es** la prueba de identidad: solo el token de ese bot puede generar un hash que cuadre, así que la cabecera no confiable `X-Bot-Username` no se puede falsificar.

## Multi-tenant: para qué bot/tenant resuelve

`resolveVerificationBot` (`:162`) decide el token contra el que se valida:
- **Sin hint o hint = bot primario** → token primario `TELEGRAM_BOT_TOKEN`, `botUsername = TELEGRAM_BOT_USERNAME` (compatibilidad total).
- **`X-Bot-Username: <childbot>`** (lo pone la web desde `?tgbot=`) → resuelve el token descifrado del bot hijo con `PrismaPlatformRepository.getManagedBotToken` y valida el initData contra él. Username inválido → `401 invalid-bot`; bot inexistente → `401 unknown-bot`.
- **`X-Platform-Act-As-Bot-Username`** (owner de plataforma actuando como otro bot) → exige `canPlatformActAs` (owner o rol `platform_owner`), resuelve el bot destino y marca `platformActAs.sourceBotUsername`. Requiere sesión del bot primario (`act-as-requires-primary-session`).

El `botUsername`/`botToken` resultantes se propagan a los servicios para elegir el **tenant** correcto (`telegram-<username>`) y para hacer llamadas a Telegram en nombre de ese bot. El `botToken` **nunca** debe aparecer en respuestas ni logs (`init-data.guard.ts:30-32`).

## Defensas anti-abuso (resolución de bots gestionados)

- **Caché de tokens** con TTL corto: 5 s para aciertos (`TOKEN_CACHE_TTL_MS`), 10 s para "no existe" (`TOKEN_MISS_TTL_MS`); un bot suspendido pierde acceso pronto (`:44-50`).
- **Cap FIFO** de 5.000 entradas para que un atacante rotando `X-Bot-Username` no haga crecer el Map sin límite (`:52-54`, `cacheSet`).
- **Token bucket para fallos de caché** que van a BD (`MISS_BUCKET_CAPACITY=60`, `MISS_REFILL_PER_SEC=30`); sobre presupuesto → se trata como bot desconocido sin tocar BD (fail-closed) (`consumeMissBudget`, `:329`).
- Fallo transitorio de BD → `503 bot-token-unavailable` (no se cachea un bot real como "desconocido").

## Errores emitidos

`401`: `missing-auth`, `missing-user`, `invalid-hash`, `auth-date-expired`, `invalid-bot`, `unknown-bot`, `act-as-requires-primary-session`. `403`: `platform-user-banned`, `platform-owner-required`. `503`: `missing-bot-token`, `bot-token-unavailable`, `platform-unavailable`, `platform-ban-check-unavailable`.

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `verifyTelegramInitData` (`apps/api/src/telegram-init-data.ts`), `PrismaPlatformRepository` (`@superbot/data`), `getRuntimeEnv` (`@superbot/shared`), [[Package auth]].
- **Utilizado por**: todos los controllers con `@UseGuards(InitDataGuard)` (dashboard, platform, games, casino y todos los `v1/miniapp`).
- **Consume**: [[Modelo ManagedBot]], [[Modelo PlatformUserBan]].
- **Relacionado con**: [[Servicio admin]] (segunda barrera de autorización viva por grupo).
