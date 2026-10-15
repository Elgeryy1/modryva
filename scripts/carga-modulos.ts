/**
 * Carga los once modulos **en ejecucion real**, como hace el bot al arrancar.
 *
 * Existe porque el typecheck y los tests no cazan esto: si el `index.ts` de un
 * modulo re-exporta un TIPO con `export { X }` en vez de `export type { X }`,
 * TypeScript lo acepta —sabe que es un tipo— y vitest tampoco falla, porque
 * vite elimina los tipos al transpilar.
 *
 * Pero produccion corre con `tsx`, que transpila fichero a fichero y **no puede
 * saber** que `X` era un tipo, asi que deja la re-exportacion viva y Node
 * revienta al arrancar:
 *
 *     SyntaxError: The requested module './baccarat.js' does not provide an
 *     export named 'BaccaratBet'
 *
 * Paso de verdad: al recortar las APIs publicas quedaron **117 tipos** saliendo
 * como valor en 10 modulos. Los cuatro portones estaban en verde y el worker no
 * arrancaba. Se descubrio al desplegar, que es el peor sitio.
 */

const MODULOS = [
  "core",
  "security",
  "guardian",
  "community",
  "support",
  "automation",
  "files",
  "games",
  "social",
  "ai",
  "payments",
] as const;

const rotos: string[] = [];

for (const modulo of MODULOS) {
  try {
    await import(`../modules/${modulo}/src/index.ts`);
    console.log(`  ok   ${modulo}`);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.log(`  ROTO ${modulo}: ${mensaje.split("\n")[0]}`);
    rotos.push(modulo);
  }
}

if (rotos.length > 0) {
  console.error(`\n${rotos.length} modulo(s) no cargan: ${rotos.join(", ")}`);
  process.exit(1);
}

console.log(`\nLos ${MODULOS.length} modulos cargan.`);
