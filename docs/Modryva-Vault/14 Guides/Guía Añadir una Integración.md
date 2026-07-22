---
id: modryva-guia-anadir-integracion
title: Guía Añadir una Integración
type: guide
domain: developer
status: implemented
maturity: stable
source:
  - packages/telegram/src
  - modules/ai/src
tags:
  - modryva
  - guide
  - developer
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Guía — añadir una integración externa

Las integraciones externas (Telegram, proveedor de IA, RSS…) se aíslan detrás de un **adaptador/gateway**
para poder testear la lógica sin llamar al servicio real. Ver [[Integrations Map]].

## Patrón
1. **Adaptador con interfaz**: define una interfaz (p. ej. `TelegramGateway`, o el `buildAiProviderFromEnv`
   de [[Módulo ai]]) y una implementación real. En tests se inyecta un **fake** (`FakeTelegramGateway`,
   `FakeAiProvider`) — así la lógica de dominio no toca la red.
2. **Configuración por entorno**: las claves/URLs van en variables de entorno (ver [[Env Vars]]), nunca
   hardcodeadas. Documenta cada una como `Env <NAME>` y marca las **secretas** (documenta el propósito,
   nunca el valor — como [[Env TELEGRAM_BOT_TOKEN]]).
3. **Inyección**: pasa el adaptador por constructor a quien lo use (el bot recibe `telegramGateway`,
   `aiProvider`, etc.), para poder sustituirlo en tests.
4. **Fallos**: trata timeouts/errores del servicio como esperables (fallback, reintento con backoff). Para
   Telegram, respeta rate limits (429) y el caché de admins (`cachedAdminIds`).

## Checklist
- [ ] Interfaz + implementación real + fake para tests.
- [ ] Variables de entorno documentadas (`Env <NAME>`), secretos marcados.
- [ ] Inyección por constructor.
- [ ] Manejo de errores/reintentos.
- [ ] Nota en el Vault: `Integración <nombre>` (ver [[Conventions]]).

## Preguntas abiertas
- Proveedor(es) de IA concretos y sus claves (`buildAiProviderFromEnv`): ver [[Open Questions]] #5.

## Relaciones
- Pertenece a: [[Developer Onboarding Map]]
- Depende de: [[Integrations Map]], [[Env Vars]]
- Relacionado con: [[Integración Telegram Bot API]], [[Integración Proveedor de IA]], [[Guía Añadir un Módulo]]
