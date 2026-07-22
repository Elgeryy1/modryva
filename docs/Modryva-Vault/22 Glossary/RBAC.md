---
id: modryva-glossary-rbac
title: RBAC
type: glossary
domain: glossary
status: implemented
maturity: stable
source:
  - packages/auth/src/rbac.ts
tags:
  - modryva
  - glossary
  - security
aliases:
  - Role-Based Access Control
created: 2026-07-12
updated: 2026-07-12
---

# RBAC

Control de acceso basado en roles. En Modryva vive en [[Package auth]] (`rbac.ts` + `policy.ts`) y se apoya
en los modelos [[Modelo Role]], [[Modelo Permission]], [[Modelo RoleBinding]]. Determina qué usuario puede
ejecutar qué comando/acción (p.ej. moderación → [[Comando ban]]). A nivel de plataforma existe un RBAC
propio ([[Platform Roles y RBAC]], [[Enum PlatformRole]]).

## Relaciones
- Relacionado con: [[Package auth]], [[Modelo Role]], [[Platform Roles y RBAC]], [[Security Map]]
