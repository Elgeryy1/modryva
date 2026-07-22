---
id: modryva-pantalla-ai-pack
title: Pantalla ai-pack
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/ai-pack/page.tsx
  - apps/web/lib/api-ai-pack.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Pack de IA
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla ai-pack

## Qué es
Gestiona la suscripción al **Pack de IA** con Telegram Stars. Tiene **doble alcance** según haya `gid` en la query (`page.tsx:47-48`):
- **Grupo** (`gid` presente): activa la IA real para todo el grupo (30 ⭐/mes).
- **Personal** (sin `gid`): activa la IA para el usuario en cualquier chat.

Acciones:
- Comprar: `handleBuy` crea la factura y la abre con `openInvoice`; al pagar, refresca a los 3 s (`page.tsx:72-96`).
- Cancelar renovación: `handleCancel`, sigue activo hasta fin de periodo (`page.tsx:117-141`).
- Canjear código (solo alcance grupo y sin suscripción activa): `handleRedeem` (`page.tsx:98-115`, `218-237`).
- Estado (activo/renovación/precio) y "Cómo funciona" (`page.tsx:163-263`).

Errores mapeados: `not-admin`, `chat-not-found`, `invoice-link-failed`, `invalid-code`, `not-found`, `already-used`, `no-subscription`, `cancel-failed` (`page.tsx:29-39`).

## Ruta y componentes
- Ruta Next real: `/config/ai-pack` (`apps/web/app/config/ai-pack/page.tsx`), client component con `<Suspense>` (`page.tsx:270-282`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton` (`page.tsx:5-16`).
- `openInvoice` del helper de Telegram (`page.tsx:27`).

## Datos (API)
- Grupo: `getChatAiPackStatus` → `GET /v1/miniapp/groups/{gid}/ai-pack` (`api-ai-pack.ts:16`); `createChatAiPackInvoice` → `POST .../ai-pack/invoice` (`api-ai-pack.ts:19`); `redeemChatAiPackCode` → `POST .../ai-pack/redeem-code` (`api-ai-pack.ts:24`); `cancelChatAiPack` → `POST .../ai-pack/cancel` (`api-ai-pack.ts:30`).
- Personal: `getPersonalAiPackStatus` → `GET /v1/miniapp/ai-pack/me` (`api-ai-pack.ts:35`); `createPersonalAiPackInvoice` → `POST /v1/miniapp/ai-pack/me/invoice` (`api-ai-pack.ts:38`); `cancelPersonalAiPack` → `POST /v1/miniapp/ai-pack/me/cancel` (`api-ai-pack.ts:43`).
- Ver `[[Controller ai-pack]]`, `[[Endpoint GET v1 miniapp groups gid ai-pack]]`, `[[Endpoint POST v1 miniapp groups gid ai-pack invoice]]`.

## Estado
Implementada y cableada, con las dos superficies (grupo y personal). El acceso personal redimido en un DM sigue al usuario en cualquier chat (coherente con memoria del proyecto).

## Preguntas abiertas
- La activación tras el pago depende del webhook de Telegram Stars hacia la API (el front solo reintenta a los 3 s, `page.tsx:88`); el flujo exacto es `unknown` desde aquí.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Integración Telegram Mini Apps]], [[Guard InitData]]
- Relacionado con: [[Controller ai-pack]], [[Pantalla platform]], [[Pantalla premium]], [[Pantalla Mini App]]
