<div align="center">

# 🤝 Contribuir a Modryva

**Toda ayuda cuenta** — desde arreglar una coma en la documentación hasta diseñar un módulo entero.

</div>

¡Gracias por querer aportar! Modryva es un proyecto abierto y cuidado, y nos tomamos en serio
tanto la **calidad del código** como el **buen trato**. Esta guía te deja listo en minutos.

> 📜 Al participar aceptas nuestro [Código de Conducta](CODE_OF_CONDUCT.md).

---

## 🌱 Formas de contribuir

No hace falta escribir código para ayudar:

| Quiero... | Cómo |
|---|---|
| 🐛 **Reportar un bug** | Abre un [issue de bug](https://github.com/Elgeryy1/modryva/issues/new/choose) |
| 💡 **Proponer una idea** | Abre un [issue de propuesta](https://github.com/Elgeryy1/modryva/issues/new/choose) o pásate por [Discusiones](https://github.com/Elgeryy1/modryva/discussions) |
| 📚 **Mejorar la documentación** | Los PRs de docs son bienvenidísimos (y un gran primer paso) |
| 🌍 **Traducir** | Ayuda a llevar Modryva a más idiomas |
| 💻 **Escribir código** | Coge un issue con la etiqueta [`good first issue`](https://github.com/Elgeryy1/modryva/labels/good%20first%20issue) |
| 🔐 **Reportar una vulnerabilidad** | En privado, por favor — ver [SECURITY.md](SECURITY.md) |

---

## 🚀 Prepara tu entorno

Requisitos: **Node ≥ 24**, **pnpm ≥ 11** y Docker (para Postgres + Redis).

```bash
# 1. Haz fork y clónalo
git clone https://github.com/<tu-usuario>/modryva.git
cd modryva

# 2. Instala y arranca dependencias
pnpm install
cp .env.example .env
docker compose up -d postgres redis

# 3. Prepara la base de datos
pnpm db:generate
pnpm db:deploy

# 4. ¡A desarrollar!
pnpm dev
```

---

## ✅ Puertas de calidad

Antes de abrir un PR, **todo esto tiene que pasar en verde**:

```bash
pnpm lint         # Biome + lint de copy
pnpm typecheck    # tsc --noEmit (TS estricto: noUncheckedIndexedAccess, exactOptionalPropertyTypes)
pnpm test         # Vitest
pnpm build
```

La CI repite estas puertas y, además:

- 🧱 **reconstruye el esquema desde cero** (garantía de recuperación ante desastre),
- 🔍 **verifica que las migraciones cubren el schema** (sin drift de `db push`),
- 🧪 corre los **tests de integración contra un Postgres real**.

Si la CI falla, el PR no entra — pero tranquilidad, te ayudamos a arreglarlo.

---

## 🗺️ Cómo está organizado el proyecto

Monorepo **pnpm + Turborepo** con tres tipos de workspace:

| Carpeta | Qué contiene |
|---|---|
| `apps/` | Procesos desplegables: `bot`, `api`, `web`, `worker` |
| `packages/` | Librerías transversales: `domain`, `data` (Prisma), `telegram`, `auth`, `shared` |
| `modules/` | Features de dominio: `ai`, `community`, `games`, `guardian`*, `security`, `support`… |
| `services/` | Microservicios independientes (p. ej. `guardian-vision-analyzer`, Python) |

<sub>*la lógica de guardian vive repartida entre `apps` y `modules`; ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).</sub>

---

## 🎨 Convenciones

<details>
<summary><b>📝 Commits — Conventional Commits</b></summary>

Usamos [Conventional Commits](https://www.conventionalcommits.org):

```
feat(bot): añade comando /rituales
fix(api): corrige el 503 de /health/ready
docs: aclara el arranque en Windows
test(games): cubre el reparto del blackjack
chore: sube la versión de biome
```

</details>

<details>
<summary><b>🧪 Tests — dobles fieles, no laxos</b></summary>

Cada feature de `modules/*` vive en un fichero con **su test hermano**.

La regla de oro: los dobles de test (fakes/mocks) deben ser **fieles al comportamiento real**
—misma clave única, mismos invariantes— **nunca más laxos ni más estrictos**. Un fake que
"perdona" de más esconde bugs; uno que "castiga" de más inventa fallos que no existen.

</details>

<details>
<summary><b>🗄️ Datos — el schema viaja con su migración</b></summary>

Cualquier cambio en `packages/data/prisma/schema.prisma` **requiere su migración** en el mismo PR.
La CI lo exige (falla si detecta drift), así que no hay atajos con `db push`.

</details>

<details>
<summary><b>🔒 Secretos — cero, en ningún sitio</b></summary>

Nada de secretos, tokens ni PII en el código, los tests, los logs o los commits.
Parte siempre de `.env.example` y mantén tu `.env` real fuera de git.

</details>

---

## 🔁 Flujo de un Pull Request

1. **Haz fork** y crea una rama descriptiva: `feat/…`, `fix/…`, `docs/…`.
2. Mantén el PR **enfocado**: un cambio, una intención.
3. Asegúrate de que **todas las puertas pasan** en local.
4. Rellena la [plantilla de PR](.github/pull_request_template.md) — describe el *qué* y el *porqué*.
5. Enlaza el issue relacionado (`Closes #123`).
6. Responde a la revisión con cariño; aquí se revisa el código, no a las personas. 💛

---

## 📄 Licencia

Al contribuir, aceptas que tu aportación se licencie bajo [**AGPL-3.0**](LICENSE).

<div align="center">

**¿Dudas?** Abre una [discusión](https://github.com/Elgeryy1/modryva/discussions) — estamos encantados de ayudar.

</div>
