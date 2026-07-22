# Contribuir a Modryva

¡Gracias por tu interés! Modryva es un monorepo TypeScript con puertas de calidad
estrictas. Cualquier cambio debe pasarlas antes de entrar.

## Entorno

Requisitos: **Node ≥ 24**, **pnpm ≥ 11**, Docker (Postgres + Redis).

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:generate
pnpm db:deploy
pnpm dev
```

## Puertas de calidad (obligatorias)

Antes de abrir un PR, todo esto tiene que pasar en verde:

```bash
pnpm lint         # Biome + lint de copy
pnpm typecheck    # tsc --noEmit (TS estricto: noUncheckedIndexedAccess, exactOptionalPropertyTypes)
pnpm test         # Vitest
pnpm build
```

La CI repite estas puertas y además:

- verifica que las migraciones cubren el schema (sin drift de `db push`),
- reconstruye el esquema desde cero,
- corre los tests de integración contra un Postgres real.

## Convenciones

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org) — `feat(bot): …`, `fix(api): …`, `chore: …`, `docs: …`, `test: …`.
- **Tests**: cada feature de `modules/*` vive en un fichero con su test hermano. Los dobles de test deben ser **fieles** al comportamiento real (misma clave única, mismos invariantes), no más laxos ni más estrictos.
- **Datos**: cualquier cambio de `packages/data/prisma/schema.prisma` requiere su migración correspondiente en el mismo PR (la CI lo exige).
- **Nada de secretos** en el código, en los tests, en los logs ni en los commits.

## Flujo de PR

1. Haz fork y crea una rama descriptiva (`feat/…`, `fix/…`).
2. Mantén el PR enfocado; describe el *qué* y el *porqué*.
3. Asegúrate de que las puertas pasan en local.
4. Enlaza el issue relacionado si lo hay.

## Licencia

Al contribuir, aceptas que tu aportación se licencie bajo [AGPL-3.0](LICENSE).
