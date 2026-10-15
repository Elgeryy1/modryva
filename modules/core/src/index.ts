/**
 * La API publica de `modules/core`.
 *
 * Se nombra lo que sale, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 9 simbolos; desde fuera se
 * usan 4. El resto era superficie publica sin consumidor: mientras lo
 * fuera, mover o renombrar un detalle interno era un cambio incompatible en
 * potencia, y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-core/src/...`), asi que esta lista **es** la
 * frontera: lo que no este aqui no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo. Lo
 * que se recorta es lo que sale por aqui, que es lo que ve el resto.
 *
 * Al anadir algo, la pregunta es quien lo consume desde fuera. Si no hay nadie,
 * no entra.
 */

export { coreManifest } from "./manifest.js";
export type { ManagedBotTemplateName, PlatformRoleName } from "./platform.js";
export { parsePlatformCommand } from "./platform.js";
