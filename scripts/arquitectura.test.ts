import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Las fronteras de arquitectura, comprobadas por una herramienta y no por la
 * memoria de quien escribe.
 *
 * El objetivo del saneamiento es que romper un modulo no rompa el bot entero.
 * Eso no lo da repartir ficheros: lo da que un modulo **no pueda** alcanzar la
 * base de datos, ni las tripas de otro modulo, ni una app. Mientras esa
 * restriccion sea una recomendacion escrita en un documento, se incumple sola
 * en el primer momento de prisa.
 *
 * LINEA BASE: hay deuda ya existente y esta declarada abajo, fichero a fichero.
 * La regla es que **solo puede bajar**. Anadir una violacion nueva rompe el
 * test; quitar una que estaba en la lista tambien lo rompe, para obligar a
 * borrarla de la lista y que la deuda no se quede declarada para siempre.
 */

const RAIZ = join(__dirname, "..");
const MODULOS = join(RAIZ, "modules");

/** Todos los .ts de produccion de un modulo (los tests no cuentan). */
const ficherosDe = (directorio: string): string[] => {
  const salida: string[] = [];
  const recorrer = (ruta: string): void => {
    for (const entrada of readdirSync(ruta)) {
      const completa = join(ruta, entrada);
      if (statSync(completa).isDirectory()) {
        if (entrada !== "node_modules") recorrer(completa);
        continue;
      }
      if (!entrada.endsWith(".ts")) continue;
      if (entrada.endsWith(".test.ts")) continue;
      salida.push(completa);
    }
  };
  recorrer(directorio);
  return salida;
};

/** Los `from "..."` de un fichero. Solo imports reales: los comentarios no. */
const importesDe = (fichero: string): readonly string[] => {
  const fuente = readFileSync(fichero, "utf8");
  const encajes = fuente.matchAll(
    /^\s*(?:import|export)[\s\S]*?from\s+"([^"]+)"/gm,
  );
  return [...encajes].map((e) => e[1] ?? "");
};

/** Ruta relativa a la raiz, con barras normales para que sea igual en Windows. */
const relativa = (fichero: string): string =>
  fichero
    .slice(RAIZ.length + 1)
    .split("\\")
    .join("/");

const modulos = readdirSync(MODULOS).filter((entrada) =>
  statSync(join(MODULOS, entrada)).isDirectory(),
);

/**
 * Los imports de cada fichero de modulo, leidos UNA vez.
 *
 * Son 1.024 ficheros y el arbol de trabajo esta montado por SMB: releerlos en
 * cada test costaba mas de los 5 s por defecto de vitest y el primero moria por
 * timeout. Escanear una vez y afirmar muchas es ademas lo correcto — lo que se
 * comprueba es un unico retrato del arbol.
 */
const IMPORTES_POR_FICHERO: readonly {
  readonly modulo: string;
  readonly ruta: string;
  readonly importes: readonly string[];
}[] = modulos.flatMap((modulo) =>
  ficherosDe(join(MODULOS, modulo, "src")).map((fichero) => ({
    modulo,
    ruta: relativa(fichero),
    importes: importesDe(fichero),
  })),
);

/**
 * Deuda declarada: modulos que hoy alcanzan la capa de datos.
 *
 * Los dos importan SOLO tipos (`import type`) de Guardian, asi que no arrastran
 * Prisma en tiempo de ejecucion. Aun asi cuentan como frontera rota: esos tipos
 * pertenecen al dominio y su sitio es `packages/domain`, no `packages/data`. Se
 * resuelven al mover los contratos de Guardian al dominio, en la fase de
 * puertos.
 */
const DEUDA_DATOS: readonly string[] = [
  "modules/guardian/src/decision-engine.ts",
  "modules/guardian/src/providers.ts",
];

describe("arquitectura: los modulos no alcanzan la capa de datos", () => {
  it("nadie importa @superbot/data ni @prisma/client fuera de la deuda declarada", () => {
    const infractores = IMPORTES_POR_FICHERO.filter((f) =>
      f.importes.some(
        (importe) =>
          importe === "@superbot/data" || importe === "@prisma/client",
      ),
    )
      .map((f) => f.ruta)
      .sort();

    // Si esto falla con un fichero de mas, has acoplado un modulo a la base de
    // datos: consumelo por un puerto. Si falla con uno de menos, has arreglado
    // uno — quitalo de DEUDA_DATOS en este mismo commit.
    expect(infractores).toEqual([...DEUDA_DATOS].sort());
  });
});

describe("arquitectura: los modulos no se conocen entre si", () => {
  it("ningun modulo importa otro modulo", () => {
    const cruces = IMPORTES_POR_FICHERO.flatMap((f) =>
      f.importes
        .filter(
          (importe) =>
            importe.startsWith("@superbot/module-") &&
            importe !== `@superbot/module-${f.modulo}`,
        )
        .map((importe) => `${f.ruta} -> ${importe}`),
    );

    // Que hoy sea cero es la mejor noticia del inventario: la frontera entre
    // modulos ya se respeta. Esto la deja clavada.
    expect(cruces).toEqual([]);
  });
});

describe("arquitectura: se entra por la API publica, no por las tripas", () => {
  it("nadie importa un subcamino de un modulo o de un paquete", () => {
    const profundos = IMPORTES_POR_FICHERO.flatMap((f) =>
      f.importes
        .filter((importe) => /^@superbot\/[a-z-]+\//.test(importe))
        .map((importe) => `${f.ruta} -> ${importe}`),
    );

    // Un import como `@superbot/module-games/src/internal/motor.js` se salta el
    // index del modulo y ata al consumidor a su implementacion: a partir de ahi
    // mover un fichero dentro del modulo rompe a otro. Hoy es cero —todo entra
    // por el index— y esto lo deja clavado antes de que aparezca el primero.
    expect(profundos).toEqual([]);
  });
});

describe("arquitectura: el dominio es puro", () => {
  it("packages/domain no importa nada de fuera de si mismo", () => {
    const externos = ficherosDe(join(RAIZ, "packages/domain/src")).flatMap(
      (fichero) =>
        importesDe(fichero)
          .filter((importe) => !importe.startsWith("./"))
          .map((importe) => `${relativa(fichero)} -> ${importe}`),
    );

    // Hoy es cero, y es la mejor base posible para la modularizacion: el
    // dominio define los contratos y los puertos que todos consumen, asi que en
    // cuanto arrastre Prisma, un gateway o una app, se lo arrastra a todo el
    // que dependa de el — que es literalmente todo el monorepo.
    expect(externos).toEqual([]);
  });

  it("publica el contrato de puertos que consumiran los modulos", () => {
    const puertos = readFileSync(
      join(RAIZ, "packages/domain/src/puertos.ts"),
      "utf8",
    );
    for (const contrato of [
      "PuertosDeModulo",
      "TelegramPort",
      "PermisosPort",
      "IdempotenciaPort",
      "ModuloDeBot",
    ]) {
      expect(puertos).toContain(`export interface ${contrato}`);
    }

    // El puerto de Telegram NO acepta token en ninguna firma, y esa ausencia es
    // la propiedad: el nucleo lo construye ya atado al bot de ESTE update, asi
    // que un modulo no puede elegir bot porque no tiene con que. Sin esto vuelve
    // a ser posible que un bot hijo conteste como el bot padre.
    const inicio = puertos.indexOf("export interface TelegramPort");
    const fin = puertos.indexOf("export interface", inicio + 10);
    expect(puertos.slice(inicio, fin)).not.toContain("token");
  });
});

describe("arquitectura: los modulos no dependen de una app", () => {
  it("ningun modulo importa de apps/", () => {
    const haciaApps = IMPORTES_POR_FICHERO.flatMap((f) =>
      f.importes
        .filter((importe) => importe.includes("apps/"))
        .map((importe) => `${f.ruta} -> ${importe}`),
    );

    // Ojo al leer un grep suelto sobre esto: hay varios comentarios que
    // mencionan `apps/bot/...` para explicar quien consume que. Aqui solo
    // cuentan los `from "..."` reales, que es lo que crea la dependencia.
    expect(haciaApps).toEqual([]);
  });
});

describe("arquitectura: la API publica de un modulo es una lista, no una estrella", () => {
  it("ningun index.ts de modulo usa `export * from`", () => {
    // `export * from "./x.js"` publica el fichero entero, tripas incluidas.
    // Con eso, mover o renombrar cualquier detalle interno es un cambio
    // incompatible en potencia y no hay forma de saber cual sin buscar por todo
    // el repo. Los once modulos publicaban asi 2.933 simbolos; desde fuera se
    // usan 870.
    //
    // Hay dos motivos mas, y los dos son silenciosos:
    //
    // - Un nombre exportado por DOS ficheros no sale por la estrella:
    //   TypeScript lo omite sin decir nada. En `modules/games` habia 13 asi, y
    //   solo se vieron al nombrarlos.
    // - Codigo muerto se publica igual que el vivo. `summarizeFight` y `tagLog`
    //   llevaban tiempo sin consumidor y parecian API.
    //
    // `export * as nombre from "..."` SI vale: da apellido y no aplana nada. Es
    // lo que usan los cinco juegos cuyos `MIN_PLAYERS` y `Board` chocan.
    const conEstrella: string[] = [];

    for (const modulo of modulos) {
      const indice = join(MODULOS, modulo, "src", "index.ts");
      let fuente: string;
      try {
        fuente = readFileSync(indice, "utf8");
      } catch {
        continue;
      }
      for (const linea of fuente.split("\n")) {
        const limpia = linea.trim();
        if (limpia.startsWith("export * from")) {
          conEstrella.push(`${modulo}: ${limpia}`);
        }
      }
    }

    expect(conEstrella).toEqual([]);
  });

  it("y los index siguen exportando algo", () => {
    // Si alguien vaciara un index, el test de arriba pasaria en vacio.
    const vacios = modulos.filter((modulo) => {
      const indice = join(MODULOS, modulo, "src", "index.ts");
      try {
        return !/export\s*[{*]/u.test(readFileSync(indice, "utf8"));
      } catch {
        return false;
      }
    });

    expect(vacios).toEqual([]);
  });
});
