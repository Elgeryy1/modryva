---
id: modryva-guia-depurar-error
title: Guía Depurar un Error
type: guide
domain: developer
status: implemented
maturity: stable
source:
  - apps/bot/src
  - tsconfig.base.json
tags:
  - modryva
  - guide
  - developer
  - operations
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Guía — depurar un error

## 1) Reproduce con un test, no con el bot en vivo
La lógica es pura y testeable ([[Testing Strategy]]): escribe/ejecuta el test de la feature antes de tocar
producción.
```bash
node node_modules/vitest/vitest.mjs run apps/bot/src/bot-update.service.test.ts -t "nombre del caso"
```
> `pnpm` no está en PATH: invoca los binarios desde `node_modules` (ver [[Local Development Setup]]).

## 2) Mira los logs del servicio
[[Runbook Ver Logs]]: `docker logs -n 200 -f ultrabot-bot-1` (o `-api-1`, `-web-1`, `-worker-1`). Señal de
salud del bot: `polling Telegram as @ModryvaBot`.

## Trampas conocidas (te ahorran horas)
- **El typecheck local pasa pero `next build` falla**: `tsc` incremental reusa `.tsbuildinfo` obsoleto y es
  menos estricto que `next build` con `exactOptionalPropertyTypes`. Typecheck real:
  `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false`. Ver
  [[Riesgo Build web más estricto que typecheck local]].
- **Un build/deploy "verde" que en realidad falló**: `... | tail` devuelve el exit de `tail`, no del
  comando. Captura el exit real aparte: `cmd > log 2>&1; ec=$?; tail log; echo "EXIT:$ec"`. Ver
  [[Deploy tail enmascara fallo]].
- **`npx tsc` resuelve el paquete equivocado** ("not the tsc command"): usa la ruta explícita
  `node node_modules/typescript/bin/tsc`. Igual para biome.
- **"table does not exist" tras arrancar**: esquema no aplicado en un Postgres nuevo → [[Runbook Migraciones Prisma]].
- **El bot no consume updates / error 409**: dos instancias con el mismo token → [[Runbook Bot Caído]].
- **Suite con fallos que cambian entre ejecuciones**: hay tests con estado compartido/orden; aísla el caso
  con `-t` antes de culpar a tu cambio.

## 3) Escala
Si es de producción: [[Runbook Bot Caído]] · [[Runbook Ver Logs]] · [[Operations Map]].

## Relaciones
- Pertenece a: [[Developer Onboarding Map]]
- Depende de: [[Testing Strategy]], [[Runbook Ver Logs]]
- Relacionado con: [[Riesgo Build web más estricto que typecheck local]], [[Deploy tail enmascara fallo]], [[Runbook Bot Caído]]
