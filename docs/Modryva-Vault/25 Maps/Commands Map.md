---
id: moc-commands
title: Commands Map
type: moc
domain: command
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - command
created: 2026-07-12
updated: 2026-07-12
---

# Commands Map

Todos los comandos del bot. Se despachan desde `apps/bot/src/bot-update.service.ts` (82 símbolos
`handle*Command`). Índice detallado y notas por comando en `06 Commands/` → [[Commands Overview]].
Doc del equipo: `docs/COMMANDS.md`.

## Por dominio

- **Moderación** → [[Comando ban]], [[Comando mute]], [[Comando warn]], [[Comando kick]]… (ver [[Security Map]])
- **Comunidad** → [[Comando poll]], [[Comando welcome]], [[Comando filtro]], [[Comando recordar]], [[Comando afk]]…
- **Casino/Juegos** → [[Comando casino]], [[Comando cartera]], [[Comando bono]], [[Comando dado]], [[Comando apostar]], [[Comando duelo]] (ver [[Casino Map]])
- **IA** → [[Comando ai]]
- **Admin/Config** → [[Comando settings]], [[Comando schedulerule]]
- **Utilidades** → [[Comando help]], [[Comando verificar]]

## Cómo se documenta un comando

Cada nota `Comando <name>` enlaza a su handler, módulo, servicio, permisos, modelos que toca, eventos que
produce y tests. Ver plantilla [[Command Template]].

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Bot Core Map]], [[Modules Map]], [[Security Map]], [[Casino Map]], [[Events Map]]
