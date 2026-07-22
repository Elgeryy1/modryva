---
id: system-conventions
title: Conventions
type: moc
domain: system
status: implemented
maturity: stable
tags:
  - modryva
  - system
  - conventions
  - moc
created: 2026-07-12
updated: 2026-07-12
---

# Conventions

Reglas de nombres, enlaces y estados del Vault. **Todo autor (humano o agente) debe seguirlas** para que
los enlaces `[[...]]` resuelvan entre notas escritas por manos distintas y el Graph View forme clústeres
limpios.

## Nombres de nota (títulos = nombre de fichero)

Obsidian resuelve `[[Nombre]]` por el nombre del fichero. Usamos títulos deterministas por tipo:

| Tipo | Título / fichero | Ejemplo |
|---|---|---|
| Módulo | `Módulo <name>` | `Módulo security` |
| App | `App <name>` | `App bot` |
| Paquete | `Package <name>` | `Package data` |
| Comando | `Comando /<name>` | `Comando /ban` |
| Servicio | `Servicio <name>` | `Servicio casino` |
| Controller | `Controller <name>` | `Controller casino` |
| Guard | `Guard <name>` | `Guard InitData` |
| Evento/handler | `Evento <name>` | `Evento message` |
| Job/worker | `Job <name>` | `Job recap.weekly` |
| Modelo Prisma | `Modelo <Name>` | `Modelo Sanction` |
| Enum | `Enum <Name>` | `Enum SanctionKind` |
| Endpoint | `Endpoint <METHOD path>` | `Endpoint POST v1/casino/bet` |
| Pantalla web | `Pantalla <name>` | `Pantalla config/moderation` |
| Componente | `Componente <Name>` | `Componente Casino Crash` |
| Workflow/flujo | `Flujo <name>` | `Flujo Update de Telegram` |
| Integración | `Integración <name>` | `Integración Telegram Bot API` |
| Variable de entorno | `Env <NAME>` | `Env TELEGRAM_BOT_TOKEN` |
| Riesgo | `Riesgo <frase corta>` | `Riesgo God Object bot-update` |
| ADR | `ADR-NNN <título>` | `ADR-001 Monorepo pnpm` |
| Runbook | `Runbook <acción>` | `Runbook Desplegar` |
| Roadmap item | `Roadmap <item>` | `Roadmap Jackpot progresivo` |
| Glosario | `<Término>` | `Tenant` |
| MOC / mapa | `<Dominio> Map` | `Security Map` |

Reglas: sin barras `/` en nombres de fichero salvo las notas de comando (Obsidian las admite en el
título si se escribe el fichero con ese nombre; para comandos usamos `Comando -<name>.md` a nivel de
fichero y alias `/<name>`). Cuando dudes, prioriza que el `[[enlace]]` que otros usarán sea el título.

## Frontmatter obligatorio (YAML)

```yaml
---
id: <kebab-unico>
title: <título exacto de la nota>
type: <ver lista abajo>
domain: <product|architecture|botcore|module|command|event|workflow|data|api|hub|security|
         infrastructure|operations|testing|observability|integration|decision|risk|glossary|
         ai|games|casino|automation|community|support|platform|system>
status: <implemented|partial|planned|experimental|deprecated|unknown>
maturity: <stable|beta|alpha|prototype|unknown>
source:
  - <ruta/relativa/al/repo.ts>   # SIEMPRE que exista evidencia
tags:
  - modryva
  - <type>
  - <domain>
aliases: []
created: 2026-07-12
updated: 2026-07-12
---
```

Valores de `type`: `product, feature, architecture, module, command, event, service, controller, guard,
workflow, model, table, endpoint, screen, component, integration, infrastructure, test, decision, risk,
runbook, roadmap, glossary, moc, system`.

## Tags para el Graph View

Cada nota lleva `modryva` + su `type` + su `domain`. Los grupos de color del grafo se basan en tags
(`#security`, `#command`, `#event`, `#data`/`#model`, `#api`/`#endpoint`, `#infrastructure`,
`#hub`/`#platform`, `#ai`, `#games`/`#casino`, `#automation`, `#roadmap`, `#risk`, `#testing`,
`#product`/`#feature`, `#workflow`, `#moc`). Ver `.obsidian/graph.json`.

## Estados (diferenciar SIEMPRE)

- `implemented` — código presente y (idealmente) con test. Cítalo en `source`.
- `partial` — existe lógica pero falta cableado/UI/tests, o solo cubre parte del caso.
- `planned` — aparece en roadmap/docs/TODO pero no hay implementación.
- `experimental` — presente pero marcado como experimental/flag/no estable.
- `deprecated` — sustituido o marcado obsoleto.
- `unknown` — no se pudo verificar. Añádelo a [[Open Questions]].

## Bloque de relaciones (al final de cada nota)

```markdown
## Relaciones

- Pertenece a: [[...]]
- Depende de: [[...]]
- Utilizado por: [[...]]
- Produce: [[...]]
- Consume: [[...]]
- Relacionado con: [[...]]
- Sustituye a: [[...]]
- Sustituido por: [[...]]
```

Incluye solo las líneas aplicables. **Cada enlace debe ser una relación real**, no relleno para inflar
el grafo.

## Reglas de contenido

- Español; conserva nombres de código en su idioma original.
- No inventes. Cada afirmación técnica cita `source`. Lo no verificable = `unknown` + [[Open Questions]].
- No copies ficheros enteros de código; cita rutas y símbolos (`archivo.ts:línea` cuando ayude).
- Cada nota aporta información propia; no dupliques — enlaza.
- Usa Mermaid para flujos/relaciones complejas y bloques de código para ejemplos.

## Relaciones

- Pertenece a: [[Vault Manifest]]
- Relacionado con: [[Repository Inventory]], [[Generation Plan]], [[Module Template]], [[Command Template]]
