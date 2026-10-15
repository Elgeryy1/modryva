import { describe, expect, it } from "vitest";
import type { ModerationAction } from "./moderation-command.js";
import {
  ACCIONES_QUE_DEGRADAN,
  cargoDelObjetivo,
  decidirSobreAdmin,
  textoAdminNoSancionable,
} from "./sanciones-a-admins.js";

describe("cargoDelObjetivo", () => {
  it("el creador del grupo es su propia clase", () => {
    expect(cargoDelObjetivo("creator", true)).toBe("creador");
    // Ni siquiera diciendo que se le puede editar: al creador no lo toca nadie.
    expect(cargoDelObjetivo("creator", false)).toBe("creador");
  });

  it("distingue al admin que nombro el bot del que nombro una persona", () => {
    expect(cargoDelObjetivo("administrator", true)).toBe("adminPropio");
    expect(cargoDelObjetivo("administrator", false)).toBe("adminAjeno");
  });

  it("sin respuesta de Telegram lo trata como ajeno, no como propio", () => {
    // El caso que importa: `undefined` es "no lo se". Darlo por propio seria
    // exactamente como se degrada a alguien sin querer.
    expect(cargoDelObjetivo("administrator", undefined)).toBe("adminAjeno");
  });

  it("quien no tiene cargo no tiene nada que proteger", () => {
    for (const status of ["member", "restricted", "left", "kicked"]) {
      expect(cargoDelObjetivo(status, undefined)).toBe("nadie");
    }
    expect(cargoDelObjetivo(undefined, undefined)).toBe("nadie");
  });
});

describe("decidirSobreAdmin", () => {
  it("a quien no es admin no le pasa nada nuevo", () => {
    for (const accion of [...ACCIONES_QUE_DEGRADAN]) {
      expect(decidirSobreAdmin(accion, "nadie")).toEqual({
        permitir: true,
        guardarCargo: false,
      });
    }
  });

  it("al creador se le dice que no, haga lo que haga", () => {
    const acciones: ModerationAction[] = [
      "warn",
      "ban",
      "mute",
      "kick",
      "unban",
      "unmute",
    ];
    for (const accion of acciones) {
      expect(decidirSobreAdmin(accion, "creador")).toEqual({
        permitir: false,
        motivo: "creador",
      });
    }
  });

  it("avisar a un admin se permite: no llama a Telegram y no degrada", () => {
    for (const cargo of ["adminPropio", "adminAjeno"] as const) {
      expect(decidirSobreAdmin("warn", cargo)).toEqual({
        permitir: true,
        guardarCargo: false,
      });
    }
  });

  it("la marcha atras nunca se bloquea, ni sobre un admin ajeno", () => {
    // Si se bloqueara, un admin al que se mordaza siendo `member` y que luego
    // recibe el cargo se quedaria sin forma de que se la quiten.
    for (const accion of ["unban", "unmute"] as const) {
      expect(decidirSobreAdmin(accion, "adminAjeno")).toEqual({
        permitir: true,
        guardarCargo: false,
      });
    }
  });

  it("sobre un admin propio se permite Y se guarda el cargo", () => {
    for (const accion of [...ACCIONES_QUE_DEGRADAN]) {
      expect(decidirSobreAdmin(accion, "adminPropio")).toEqual({
        permitir: true,
        guardarCargo: true,
      });
    }
  });

  it("sobre un admin ajeno se rechaza lo que degrada", () => {
    for (const accion of [...ACCIONES_QUE_DEGRADAN]) {
      expect(decidirSobreAdmin(accion, "adminAjeno")).toEqual({
        permitir: false,
        motivo: "adminAjeno",
      });
    }
  });

  it("guardarCargo solo sale cuando de verdad se pierde algo", () => {
    // Un cargo guardado de mas escribiria encima del bueno la proxima vez.
    const acciones: ModerationAction[] = [
      "warn",
      "ban",
      "mute",
      "kick",
      "unban",
      "unmute",
    ];
    const cargos = ["nadie", "adminPropio", "adminAjeno", "creador"] as const;
    const conGuardado = acciones.flatMap((accion) =>
      cargos
        .map((cargo) => ({
          accion,
          decision: decidirSobreAdmin(accion, cargo),
        }))
        .filter(({ decision }) => decision.permitir && decision.guardarCargo),
    );
    expect(conGuardado.map(({ accion }) => accion).sort()).toEqual([
      "ban",
      "kick",
      "mute",
    ]);
  });
});

describe("textoAdminNoSancionable", () => {
  it("al creador se le nombra como lo que es", () => {
    const texto = textoAdminNoSancionable("ban", "Ana", "creador");
    expect(texto).toBe("No puedo banear a Ana: es quien creó el grupo.");
  });

  it("con un admin ajeno explica que es cosa de Telegram y da la salida", () => {
    const texto = textoAdminNoSancionable("mute", "Ana", "adminAjeno");
    expect(texto).toContain("silenciar a Ana");
    expect(texto).toContain("Telegram");
    // Sin salida, la negativa se lee como que el bot esta roto.
    expect(texto).toContain("Quítale el cargo");
  });

  it("conjuga cada accion con el mismo verbo que las otras negativas", () => {
    expect(textoAdminNoSancionable("kick", "Ana", "adminAjeno")).toContain(
      "expulsar a Ana",
    );
  });
});
