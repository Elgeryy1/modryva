---
id: modryva-pantalla-config-section
title: Pantalla config-section
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/[section]/page.tsx
  - apps/web/components/config-sections.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Pantalla seccion dinamica
  - Pantalla config id
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla config-section

## Qué es
Ruta **dinámica** `/config/[section]` que renderiza el formulario de una sección de configuración del grupo cargando su valor actual, mostrándolo en un `SectionForm` y guardándolo al enviar. Cubre las secciones "simples" del grupo (sin ruta estática propia).

Flujo (`[section]/page.tsx:35-68`):
- Valida que `section` sea un `SectionName` conocido y que exista `gid`; si no, estado `bad` (`[section]/page.tsx:37-39`, `70-81`).
- `getSection(gid, section)` carga el valor; al guardar, `putSection(gid, section, next)` persiste y lanza `haptic.notify("success")` (`[section]/page.tsx:52-68`).
- Botón atrás nativo de Telegram → `router.back()` (`[section]/page.tsx:33`).

Las secciones válidas están en `lib/config-meta.ts:7-17` (`SECTION_NAMES`): `welcome`, `rules`, `flood`, `captcha`, `locks`, `warns`, `hygiene`, `membershipGate`, `raid`. El render concreto de cada una lo hace `SectionForm` en `components/config-sections.tsx` (bloques `section === "welcome"` … `"raid"`, `config-sections.tsx:192-623`).

## Ruta y componentes
- Ruta Next real: `/config/[section]` (`apps/web/app/config/[section]/page.tsx`), client component (`[section]/page.tsx:1`).
- `SectionForm` (`components/config-sections.tsx:148`) es el componente clave; usa toggles/segmented/campos del kit UI.
- Constantes de dominio (acciones flood, modos warn/captcha, tipos de lock…) en `lib/config-meta.ts:22-50`.

## Datos (API)
- `getSection` → `GET /v1/miniapp/groups/{gid}/config/{section}` (`lib/api.ts:151`).
- `putSection` → `PUT /v1/miniapp/groups/{gid}/config/{section}` (`lib/api.ts:154`).
- Ver `[[Controller config]]`, `[[Endpoint GET v1 miniapp groups gid config section]]`, `[[Endpoint PUT v1 miniapp groups gid config section]]`.

## Estado
Implementada y cableada. Las 9 secciones de `SECTION_NAMES` se resuelven aquí; el menú `[[Pantalla config]]` enruta a `/config/<id>` para las secciones sin `href` propio.

## Preguntas abiertas
- El esquema exacto de cada `Value` (forma del objeto por sección) se define en la API/`@superbot/shared`; aquí se maneja como `Record<string, unknown>` (`[section]/page.tsx:17`).

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller config]], [[Endpoint GET v1 miniapp groups gid config section]], [[Endpoint PUT v1 miniapp groups gid config section]], [[Pantalla listas]]
