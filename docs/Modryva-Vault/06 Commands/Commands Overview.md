---
id: commands-overview
title: Commands Overview
type: moc
domain: command
status: partial
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/core-handlers.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - moc
created: 2026-07-12
updated: 2026-07-12
---

# Commands Overview

Hub de comandos del bot. **82 handlers `handle*Command`** despachan desde
`apps/bot/src/bot-update.service.ts`. La referencia autoritativa y completa (agrupada por fase) es
`docs/COMMANDS.md` — esta nota la indexa y enlaza a las notas atómicas por comando. Ver [[Commands Map]].

> Estado `partial`: en la Iteración 1 el agente de comandos se cortó por límite de sesión; aquí quedan
> indexados todos los grupos y creadas las notas de los comandos clave. Los `[[Comando ...]]` sin nota aún
> son enlaces pendientes (ver [[Undocumented Sources]]).

## Grupos (según `docs/COMMANDS.md`)

| Grupo | Comandos representativos (verificados en `apps/bot/src`) |
|---|---|
| Core | `/start`, `/help`, `/config`, [[Comando settings]] (`/settings`), `/id`, `/q` |
| Plataforma owner | `/admins`, `/export`, comandos de red de dueño |
| Moderación | [[Comando ban]] (`/ban`), `/skick`, `/dkick`, `/pin`, `/reglas` `/rules`, `/confianza` |
| Antiflood / CAPTCHA / Content locks / Antiraid | `/antiflood_on`, `/copia_pega`, `/spam_firma`, `/spam_saludo` → [[Security Map]] |
| Notas / Filtros / Custom commands | `/historial`, filtros y comandos personalizados → [[Filters]], [[Custom Commands]] |
| Bienvenida / Reputación / Invitaciones / Analítica | `/reglas`, `/invites`, `/participacion`, `/stats`, `/top`, `/topposters`, `/salonfama` → [[Módulo community]] |
| Quizzes / Encuestas / Sorteos / Programadas | `/trivia`, encuestas ([[Polls]]), sorteos ([[Giveaways]]) |
| Soporte y tickets | `/tickets` → [[Módulo support]] |
| Recordatorios y tareas | recordatorios ([[Reminders]]) |
| Automatizaciones RSS / Webhooks | → [[Módulo automation]], [[Job rss]], [[Job webhook]] |
| Juegos arcade / Trivia | `/jugar`, `/rps`, `/dice`, `/coin` → [[Módulo games]] |
| Casino | [[Comando casino]] (`/casino`) + cartera/bono/dado/apostar/duelo/comprar/regalar → [[Casino Map]] |
| IA | [[Comando aipack]] (`/aipack`), `/aistatus` → [[Módulo ai]] |
| Pagos (Stars) | `/comprar` `/tienda` → [[Chip Economy]] |
| Analítica social avanzada | `/mapa_calor`, `/temas_emergentes`, `/reglas_rotas`, `/tipos_conflicto`, `/fantasmas`, `/miembros_inactivos`, `/densidad`, `/dock`, `/fase_dia` (muchos son features de `community` recién cableadas) |

## Notas atómicas creadas

- [[Comando ban]] · [[Comando casino]] · [[Comando help]] · [[Comando config]] (alias `/settings`) · [[Comando aipack]]

## Cómo documentar el resto

Usa [[Command Template]]. Extrae cada comando de la cadena de dispatch en
`apps/bot/src/bot-update.service.ts` (buscar el literal `/<name>` y su `handle*Command`), confirma permisos
y si requiere que el bot sea admin, y enlaza a su módulo/servicio/modelos. Cola: [[Undocumented Sources]].

## Relaciones

- Pertenece a: [[Commands Map]]
- Depende de: [[Bot Update Service]], [[Core Handlers]]
- Relacionado con: [[Security Map]], [[Casino Map]], [[Módulo community]], [[Módulo ai]]
