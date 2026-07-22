---
id: modryva-flujo-warn
title: Flujo Warn
type: flow
domain: security
status: implemented
maturity: stable
source:
  - modules/security
tags:
  - modryva
  - flow
  - security
aliases:
  - Flujo de advertencias
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — advertir (warn) y escalar

## Disparador
Un admin advierte a un usuario, o una regla automática suma un warn por infracción.

## Precondiciones
Config de política de warns del grupo ([[Modelo WarnPolicyConfig]]): cuántos warns y qué acción al alcanzar
el umbral.

## Pasos
1. **Registro del warn**: se crea/incrementa [[Modelo Warning]] para el usuario en ese chat, con motivo.
2. **Cálculo de umbral**: se compara el total contra la política ([[Modelo WarnPolicyConfig]]).
3. **Escalado**: si se alcanza el umbral, se dispara la acción configurada:
   - mute → [[Flujo Mute]]
   - kick → expulsión
   - ban → [[Flujo Ban]]
4. **Feedback**: se informa el número de warn actual y qué pasará al llegar al límite.
5. **Persistencia**: `activity-log` del warn y del escalado.

## Ramas y fallos
- **Warn retirado** (unwarn): decrementa el contador.
- **Caducidad de warns**: si la política caduca warns viejos, un job puede limpiarlos ([[Job expiration]] —
  confirmar alcance).
- **Bot sin permiso para la acción de escalado** → avisa en vez de fingir (moderación honesta).

## Estado observable
Contador de warns por usuario; `activity-log`.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Depende de: [[Modelo Warning]], [[Modelo WarnPolicyConfig]], [[Módulo security]]
- Relacionado con: [[Flujo Mute]], [[Flujo Ban]], [[Flujo Apelación]]
