---
id: moc-modules
title: Modules Map
type: moc
domain: module
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - module
created: 2026-07-12
updated: 2026-07-12
---

# Modules Map

Los 10 módulos de dominio (`modules/`). Cada uno es un paquete `@superbot/module-*` con lógica
mayormente **pura y testeada** (patrón: una feature por fichero + su test). No todo está cableado a un
comando/controller — ver [[Riesgo Features de lógica pura sin cablear]] y `docs/WIRING-HANDOFF.md`.

| Módulo | Ficheros src | Estado global | Hub |
|---|---|---|---|
| community | 139 | implemented/partial | [[Módulo community]] |
| security | 124 | implemented/partial | [[Módulo security]] |
| support | 79 | partial | [[Módulo support]] |
| games | 72 | implemented | [[Módulo games]] |
| automation | 33 | partial | [[Módulo automation]] |
| ai | 9 | implemented | [[Módulo ai]] |
| core | 3 | implemented | [[Módulo core]] |
| files | 2 | partial | [[Módulo files]] |
| payments | 2 | partial | [[Módulo payments]] |

## Por dominio

- Moderación → [[Módulo security]] · [[Security Map]]
- Comunidad → [[Módulo community]]
- Juegos/casino → [[Módulo games]] · [[Casino Map]]
- IA → [[Módulo ai]]
- Automatizaciones → [[Módulo automation]] · [[Workflows Map]]
- Soporte/tickets → [[Módulo support]]
- Pagos → [[Módulo payments]]
- Ficheros → [[Módulo files]]
- Núcleo → [[Módulo core]]

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Architecture Map]], [[Commands Map]], [[Database Map]], [[Security Map]], [[Casino Map]]
