---
id: modryva-integration-ai-provider
title: Integración Proveedor de IA
type: integration
domain: ai
status: unknown
maturity: unknown
source:
  - modules/ai/src/provider.ts
tags:
  - modryva
  - integration
  - ai
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Integración Proveedor de IA

## Qué es
El/los proveedor(es) de LLM que usa [[Módulo ai]] para chat y resúmenes. Abstraído tras
`buildAiProviderFromEnv` (`modules/ai/src/provider.ts`) con **modo degradado** (`degraded-mode.ts`) si no
está disponible.

## Estado
`unknown`: **falta confirmar el proveedor concreto** y las variables de entorno/credenciales que usa. →
Leer `modules/ai/src/provider.ts` y resolver [[Open Questions]] #5. No suponer el proveedor.

## Diseño relevante
Al proveedor se le pasan **datos agregados** (p.ej. stats de la semana en [[Recap Semanal]]), no volcados
de mensajes crudos innecesarios.

## Relaciones
- Pertenece a: [[Integrations Map]]
- Utilizado por: [[Módulo ai]]
- Relacionado con: [[Recap Semanal]], [[Comando aipack]]
