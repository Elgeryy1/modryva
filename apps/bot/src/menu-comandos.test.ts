import { describe, expect, it } from "vitest";

import {
  BOT_COMMANDS,
  COMANDOS_DE_ADMIN,
  COMANDOS_DE_TODOS,
  TOPE_MENU_TELEGRAM,
} from "./poller.js";

/**
 * El menu de `/` de Telegram, en dos ambitos.
 *
 * Antes era una sola lista de 194 entradas y estaba **al reves**: llevaba 189
 * calculadoras de staff y ni uno de los comandos que la gente usa a diario. De
 * los ~59 de uso real solo habia 5. Y como Telegram corta en 100 por ambito,
 * 94 de aquellas 194 no llegaban nunca.
 *
 * Estos tests fijan lo que no puede volver a torcerse.
 */

const nombres = (lista: readonly { readonly command: string }[]) =>
  lista.map((c) => c.command);

describe("los dos menus caben y no se pisan", () => {
  it("ninguno pasa del tope de Telegram", () => {
    // Pasarse no da error: Telegram corta por su cuenta y los ultimos
    // desaparecen sin que nada avise. Es como se perdieron 94.
    expect(COMANDOS_DE_TODOS.length).toBeLessThanOrEqual(TOPE_MENU_TELEGRAM);
    expect(COMANDOS_DE_ADMIN.length).toBeLessThanOrEqual(TOPE_MENU_TELEGRAM);
  });

  it("no hay comandos repetidos dentro de una misma lista", () => {
    for (const lista of [COMANDOS_DE_TODOS, COMANDOS_DE_ADMIN]) {
      const n = nombres(lista);
      expect(new Set(n).size).toBe(n.length);
    }
  });

  it("el de admins INCLUYE el de todos", () => {
    // No es redundancia: Telegram resuelve el ambito mas especifico, asi que un
    // admin ve la lista de admins y NO la general. Si faltaran, un admin
    // perderia del menu /saldo y /ruleta, que usa como cualquier otro.
    const admin = new Set(nombres(COMANDOS_DE_ADMIN));
    expect(nombres(COMANDOS_DE_TODOS).filter((c) => !admin.has(c))).toEqual([]);
  });

  it("todos tienen descripcion, y no vacia", () => {
    // Telegram rechaza la llamada entera si una descripcion esta vacia.
    for (const lista of [COMANDOS_DE_TODOS, COMANDOS_DE_ADMIN]) {
      for (const entrada of lista) {
        expect(entrada.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("los nombres son validos para Telegram", () => {
    // Minusculas, numeros y guion bajo, de 1 a 32. Un nombre invalido tumba
    // setMyCommands para toda la lista, no solo para esa entrada.
    for (const lista of [COMANDOS_DE_TODOS, COMANDOS_DE_ADMIN]) {
      for (const entrada of lista) {
        expect(entrada.command).toMatch(/^[a-z0-9_]{1,32}$/u);
      }
    }
  });
});

describe("lo que la gente usa esta en el menu", () => {
  it("los basicos, y de los primeros", () => {
    expect(nombres(COMANDOS_DE_TODOS).slice(0, 3)).toEqual([
      "start",
      "help",
      "menu",
    ]);
  });

  it("economia, casino y juegos, que es el uso diario", () => {
    // Ninguno de estos estaba antes. El menu llevaba /proporcionalidad y
    // /medidor_hype en su lugar.
    const enMenu = new Set(nombres(COMANDOS_DE_TODOS));
    for (const c of [
      "saldo",
      "daily",
      "top",
      "donar",
      "robar",
      "tienda",
      "casino",
      "ruleta",
      "trivia",
      "pole",
    ]) {
      expect(enMenu.has(c)).toBe(true);
    }
  });

  it("y NO lleva calculadoras de staff", () => {
    // Son ~189 comandos que existen y siguen funcionando escritos a mano, pero
    // que nadie busca en el menu. Ocupaban el sitio de lo de arriba.
    const enMenu = new Set(nombres(COMANDOS_DE_TODOS));
    for (const c of [
      "proporcionalidad",
      "medidor_hype",
      "nivel_conocimiento",
      "sesgo_operativo",
      "confianza_decision",
    ]) {
      expect(enMenu.has(c)).toBe(false);
    }
  });
});

describe("la moderacion es de admins, y solo de admins", () => {
  const MODERACION = [
    "ban",
    "unban",
    "mute",
    "unmute",
    "warn",
    "warnings",
    "kick",
    "purge",
  ];

  it("esta en el menu de admins", () => {
    // Antes NO estaba en ningun menu: existian los nueve y no se ofrecia ni
    // uno, asi que solo los usaba quien ya se los sabia.
    const admin = new Set(nombres(COMANDOS_DE_ADMIN));
    for (const c of MODERACION) {
      expect(admin.has(c)).toBe(true);
    }
  });

  it("y NO en el de todo el mundo", () => {
    // Que un miembro raso vea /ban en el desplegable es ofrecerle una puerta
    // que no puede abrir: el backend le dira que no, pero la habra intentado.
    const todos = new Set(nombres(COMANDOS_DE_TODOS));
    for (const c of MODERACION) {
      expect(todos.has(c)).toBe(false);
    }
  });

  it("y lo mismo con los ajustes y la federacion", () => {
    const todos = new Set(nombres(COMANDOS_DE_TODOS));
    for (const c of ["settings", "antiflood", "captcha", "fban", "admin"]) {
      expect(todos.has(c)).toBe(false);
    }
  });
});

describe("BOT_COMMANDS sigue existiendo", () => {
  it("y es el menu de todo el mundo", () => {
    // Hay codigo y tests que la miran por su nombre historico.
    expect(BOT_COMMANDS).toBe(COMANDOS_DE_TODOS);
  });
});
