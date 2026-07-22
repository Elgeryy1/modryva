---
id: modryva-job-expiration
title: Job expiration
type: workflow
domain: security
status: implemented
maturity: beta
source:
  - apps/worker/src/expiration-processor.ts
tags:
  - modryva
  - workflow
  - security
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Job expiration

## Qué hace
Expira estados/sanciones temporales (p.ej. mutes/bans con fecha de fin, configuraciones caducas).
Procesador `apps/worker/src/expiration-processor.ts`.

## Secuencia (a confirmar en el código)
Busca registros vencidos ([[Modelo Sanction]] con expiración, u otros con `expiresAt`), aplica la acción
inversa (des-mutear/des-banear) vía [[Package telegram]] y marca el estado como expirado. Escribe
[[Modelo AuditLog]].

## Errores
Bot no admin al revertir → registrar sin fallar (patrón "ver ≠ actuar").

## Tests
`apps/worker/src/expiration-processor.test.ts`.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Depende de: [[App worker]]
- Consume: [[Modelo Sanction]]
- Relacionado con: [[Flujo Mute]], [[Flujo Ban]], [[Security Map]]
