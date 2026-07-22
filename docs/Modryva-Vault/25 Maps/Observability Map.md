---
id: moc-observability
title: Observability Map
type: moc
domain: observability
status: partial
maturity: alpha
tags:
  - modryva
  - moc
  - observability
created: 2026-07-12
updated: 2026-07-12
---

# Observability Map

Cómo se observa el sistema (logs, salud, auditoría, alertas). Notas en `16 Observability/`.

## Superficie

- [[Controller health]] — endpoint de salud (api).
- [[Controller observability]] — métricas/observabilidad (verificar alcance real).
- Logs por servicio (`docker logs ultrabot-<svc>-1`) → [[Runbook Ver Logs]].

## Persistencia de señales

- [[Modelo AuditLog]] — auditoría de acciones (append-only).
- [[Modelo SecurityAlert]] — alertas de seguridad.
- [[Modelo Incident]] — incidentes.
- [[Modelo WebhookDelivery]] — entregas de webhook (éxito/fallo).

## Huecos / por verificar

- ¿Métricas Prometheus / tracing? Marcar `unknown` hasta confirmar en `observability.controller.ts`.

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Operations Map]], [[Infrastructure Map]], [[Risks and Technical Debt Map]]
