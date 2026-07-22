---
id: modryva-pantalla-wizard
title: Pantalla wizard
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/wizard/page.tsx
  - apps/web/lib/api-wizard.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Asistente de configuracion
  - Playbook wizard
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla wizard

## Qué es
**Asistente de configuración** en 4 pasos que aplica un "playbook" de ajustes en un solo paso. Requiere `gid` (`page.tsx:131-140`).

Pasos (state `step`, `page.tsx:200-339`):
1. Tipo de grupo (comunidad, ventas, soporte, anuncios, privado, gaming, cursos), cada uno mapea a un `WizardPlaybookId` (`page.tsx:36-84`).
2. Nivel de seguridad: `soft` / `normal` / `strict` con hints (`page.tsx:86-99`).
3. Chats de destino opcionales: staff, logs, soporte (IDs de Telegram, `page.tsx:239-291`).
4. Resumen y "Aplicar" → `applyWizardPlaybook` (`page.tsx:149-173`, `293-339`).

El botón atrás retrocede de paso o sale (`page.tsx:127-129`). Errores mapeados: `invalid-playbook`, `invalid-body` (`page.tsx:101-104`).

## Ruta y componentes
- Ruta Next real: `/config/wizard` (`apps/web/app/config/wizard/page.tsx`), client component con `<Suspense>` (`page.tsx:346-358`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Field`, `Group`, `Row`, `Section`, `Segmented`, `SkeletonList`, `useBackButton` (`page.tsx:5-17`).

## Datos (API)
- `getWizardPlaybooks(gid)` → `GET /v1/miniapp/groups/{gid}/wizard/playbooks` (`api-wizard.ts:21`).
- `applyWizardPlaybook(gid, ...)` → `POST /v1/miniapp/groups/{gid}/wizard/apply` (`api-wizard.ts:37`).
- Ver `[[Controller wizard]]`, `[[Endpoint POST v1 miniapp groups gid wizard apply]]`.

## Estado
Implementada y cableada. Los `WizardPlaybookId` disponibles: `comunidad_limpia`, `ventas_sin_spam`, `soporte`, `anuncios`, `solo_miembros_verificados` (`page.tsx:44-83`).

## Preguntas abiertas
- Qué ajustes concretos aplica cada playbook (mapeo playbook → secciones) se resuelve en la API; aquí solo se muestran `name`/`description` (`page.tsx:305-308`).

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller wizard]], [[Pantalla onboarding]], [[Pantalla backup]], [[Pantalla config-section]]
