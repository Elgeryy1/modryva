---
id: modryva-integration-redis
title: Integración Redis
type: integration
domain: integration
status: implemented
maturity: beta
source:
  - docker-compose.yml
tags:
  - modryva
  - integration
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Integración Redis

## Qué es
Almacén en memoria para colas/cache. Servicio `redis` en [[Docker Compose Stack]].

## Uso (a confirmar alcance exacto)
Probable soporte de colas del [[App worker]] (jobs) y cache. Confirmar en el código qué cliente/uso concreto
(marcar detalles `unknown` hasta verificar). Ver [[Open Questions]].

## Relaciones
- Pertenece a: [[Integrations Map]]
- Utilizado por: [[App worker]]
- Relacionado con: [[Infrastructure Map]], [[Workflows Map]]
