import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@superbot/shared": fileURLToPath(
        new URL("./packages/shared/src/index.ts", import.meta.url),
      ),
      "@superbot/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url),
      ),
      "@superbot/telegram": fileURLToPath(
        new URL("./packages/telegram/src/index.ts", import.meta.url),
      ),
      "@superbot/auth": fileURLToPath(
        new URL("./packages/auth/src/index.ts", import.meta.url),
      ),
      "@superbot/data": fileURLToPath(
        new URL("./packages/data/src/index.ts", import.meta.url),
      ),
      "@superbot/module-core": fileURLToPath(
        new URL("./modules/core/src/index.ts", import.meta.url),
      ),
      "@superbot/module-security": fileURLToPath(
        new URL("./modules/security/src/index.ts", import.meta.url),
      ),
      "@superbot/module-guardian": fileURLToPath(
        new URL("./modules/guardian/src/index.ts", import.meta.url),
      ),
      "@superbot/module-community": fileURLToPath(
        new URL("./modules/community/src/index.ts", import.meta.url),
      ),
      "@superbot/module-support": fileURLToPath(
        new URL("./modules/support/src/index.ts", import.meta.url),
      ),
      "@superbot/module-automation": fileURLToPath(
        new URL("./modules/automation/src/index.ts", import.meta.url),
      ),
      "@superbot/module-files": fileURLToPath(
        new URL("./modules/files/src/index.ts", import.meta.url),
      ),
      "@superbot/module-games": fileURLToPath(
        new URL("./modules/games/src/index.ts", import.meta.url),
      ),
      "@superbot/module-social": fileURLToPath(
        new URL("./modules/social/src/index.ts", import.meta.url),
      ),
      "@superbot/module-ai": fileURLToPath(
        new URL("./modules/ai/src/index.ts", import.meta.url),
      ),
      "@superbot/module-payments": fileURLToPath(
        new URL("./modules/payments/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    // Ids inventados para los mandos del creador: el nucleo los lee del entorno.
    env: {
      CREADOR_TELEGRAM_ID: "1000000001",
      CREADOR_IA_TELEGRAM_ID: "1000000002",
    },
    include: ["**/*.test.ts"],
    // El defecto de vitest son 5 s, y en esta maquina no llega.
    //
    // El repo vive en una unidad de red y la suite entera la satura. Hay
    // ficheros que arrancan una app Nest completa: apps/api/src/no-store.test.ts
    // tarda 11,6 s **en seco**, y bajo carga se fue a 23,2 s y se paso del tope.
    // La suite salio en rojo por eso dos veces, con tests que en seco pasan.
    //
    // Un timeout no es un assert: que la maquina vaya lenta no es un fallo del
    // codigo. El tope solo tiene que cazar un cuelgue de verdad, que es
    // infinito, no una tarde con el disco cargado.
    //
    // **2026-08-25: de 30 s a 60 s.** El margen se habia comido el crecimiento
    // del repo. Ese mismo fichero pasa hoy de 11,6 s a 14-17 s en seco, asi que
    // 30 s dejaba un factor 1,8 contra una contencion medida de x2 — o sea
    // ninguno. Volvio a salir rojo con la suite entera dos veces el mismo dia.
    //
    // El numero sale de multiplicar: el fichero mas lento en seco (17 s) por el
    // factor de contencion observado (x3 en el peor caso). Cuando el mas lento
    // vuelva a subir, esto habra que revisarlo otra vez — y conviene saber que
    // la senal de que se ha quedado corto es un rojo que en seco pasa.
    //
    // Un tope por fichero **no** es la solucion: ya lo intento
    // `no-store.test.ts` con su `timeout: 20_000` propio, y al subir el global
    // se quedo por debajo y paso de margen a recorte sin que nadie lo mirara.
    testTimeout: 60_000,
    // Los `beforeAll` que levantan la app son justo donde se va el tiempo.
    hookTimeout: 60_000,
  },
});
