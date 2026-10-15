import { describe, expect, it } from "vitest";
import {
  decidirAlta,
  decidirTrasLaEntrada,
  leerMandoDeAyudante,
  nivelDelMando,
  PERMISOS_DE_AUDITORIA,
  PERMISOS_PARA_DEGRADAR,
  USOS_DEL_ENLACE,
} from "./vincular-ayudante.js";

describe("leerMandoDeAyudante", () => {
  it("lee los cuatro mandos", () => {
    expect(leerMandoDeAyudante("/ayudante activar")).toEqual({
      que: "activar",
    });
    expect(leerMandoDeAyudante("/ayudante auditoria")).toEqual({
      que: "auditoria",
    });
    expect(leerMandoDeAyudante("/ayudante quitar")).toEqual({ que: "quitar" });
    expect(leerMandoDeAyudante("/ayudante estado")).toEqual({ que: "estado" });
  });

  it("acepta la tilde de auditoría, que es como se escribe de verdad", () => {
    expect(leerMandoDeAyudante("/ayudante auditoría")).toEqual({
      que: "auditoria",
    });
  });

  it("sin argumento, o con uno que no existe, contesta la ayuda", () => {
    expect(leerMandoDeAyudante("/ayudante")).toEqual({ que: "ayuda" });
    expect(leerMandoDeAyudante("/ayudante loquesea")).toEqual({ que: "ayuda" });
  });

  it("acepta el sufijo del bot en los grupos", () => {
    expect(leerMandoDeAyudante("/ayudante@ModryvaBot activar")).toEqual({
      que: "activar",
    });
  });

  it("devuelve null para lo que no es este mando", () => {
    // Si se comiera comandos ajenos, cortaria la cadena de handlers y dejaria
    // sin respuesta a quien escribio otra cosa.
    expect(leerMandoDeAyudante("/ayudantes activar")).toBeNull();
    expect(leerMandoDeAyudante("hola /ayudante activar")).toBeNull();
    expect(leerMandoDeAyudante("/pet enfermar")).toBeNull();
    expect(leerMandoDeAyudante("")).toBeNull();
  });
});

describe("nivelDelMando", () => {
  it("activar mete como miembro y auditoria como admin", () => {
    expect(nivelDelMando({ que: "activar" })).toBe("miembro");
    expect(nivelDelMando({ que: "auditoria" })).toBe("auditoria");
  });

  it("los mandos que no meten a nadie no piden nivel", () => {
    expect(nivelDelMando({ que: "quitar" })).toBeNull();
    expect(nivelDelMando({ que: "estado" })).toBeNull();
    expect(nivelDelMando({ que: "ayuda" })).toBeNull();
  });
});

describe("los permisos que se conceden", () => {
  it("auditoria concede SOLO invitar, y niega el resto explicitamente", () => {
    // Lo importante no es que `can_invite_users` sea true: es que todo lo
    // demas este escrito como false. El defecto de `promoteChatMember` en el
    // gateway trae `can_delete_messages` y `can_restrict_members` en true, y
    // omitirlos aqui le daria al ayudante justo lo que tiene prohibido.
    expect(PERMISOS_DE_AUDITORIA.can_invite_users).toBe(true);
    expect(PERMISOS_DE_AUDITORIA.can_delete_messages).toBe(false);
    expect(PERMISOS_DE_AUDITORIA.can_restrict_members).toBe(false);
    expect(PERMISOS_DE_AUDITORIA.can_promote_members).toBe(false);
    expect(PERMISOS_DE_AUDITORIA.can_change_info).toBe(false);
    expect(PERMISOS_DE_AUDITORIA.can_pin_messages).toBe(false);
  });

  it("ningun permiso de moderacion es true en ningun nivel", () => {
    const prohibidos = [
      "can_delete_messages",
      "can_restrict_members",
      "can_promote_members",
    ] as const;
    for (const permiso of prohibidos) {
      expect(PERMISOS_DE_AUDITORIA[permiso]).toBe(false);
      expect(PERMISOS_PARA_DEGRADAR[permiso]).toBe(false);
    }
  });

  it("degradar lo pone todo en false, que es como Telegram quita el cargo", () => {
    expect(
      Object.values(PERMISOS_PARA_DEGRADAR).every((v) => v === false),
    ).toBe(true);
  });
});

describe("el enlace de invitacion", () => {
  it("es de un solo uso", () => {
    // Un enlace ilimitado creado por una accion automatica es un agujero
    // abierto en el grupo que nadie se acuerda de cerrar.
    expect(USOS_DEL_ENLACE).toBe(1);
  });
});

describe("decidirTrasLaEntrada", () => {
  const AYUDANTE = 9000000007n;

  it("promueve al ayudante cuando se pidio auditoria", () => {
    expect(
      decidirTrasLaEntrada({
        quienEntro: AYUDANTE,
        idDelAyudante: AYUDANTE,
        nivelPedido: "auditoria",
      }),
    ).toEqual({ promover: true });
  });

  it("NO promueve si solo se pidio meterlo como miembro", () => {
    expect(
      decidirTrasLaEntrada({
        quienEntro: AYUDANTE,
        idDelAyudante: AYUDANTE,
        nivelPedido: "miembro",
      }),
    ).toEqual({ promover: false });
  });

  it("NO promueve a otra persona que entre justo despues", () => {
    // El caso que importa: alguien entra en el grupo en la misma ventana en
    // que se pidio la vinculacion. Se compara el ID, no el nombre ni el alias.
    expect(
      decidirTrasLaEntrada({
        quienEntro: 12345n,
        idDelAyudante: AYUDANTE,
        nivelPedido: "auditoria",
      }),
    ).toEqual({ promover: false });
  });

  it("NO promueve si no se habia pedido nada para este grupo", () => {
    expect(
      decidirTrasLaEntrada({
        quienEntro: AYUDANTE,
        idDelAyudante: AYUDANTE,
        nivelPedido: null,
      }),
    ).toEqual({ promover: false });
  });
});

describe("decidirAlta", () => {
  it("si no esta en el grupo, hay que meterlo", () => {
    expect(decidirAlta(null, "miembro")).toBe("entrar");
    expect(decidirAlta(null, "auditoria")).toBe("entrar");
    expect(decidirAlta("left", "auditoria")).toBe("entrar");
    expect(decidirAlta("kicked", "auditoria")).toBe("entrar");
  });

  it("si YA es miembro y se pide auditoria, hay que promover", () => {
    // El fallo real: la promocion colgaba solo del evento de entrada, y ese
    // evento no vuelve a ocurrir si la cuenta ya esta dentro. `/ayudante
    // activar` y luego `auditoria` la dejaba de miembro raso para siempre.
    expect(decidirAlta("member", "auditoria")).toBe("promover");
  });

  it("si ya es admin, no hay nada que hacer", () => {
    expect(decidirAlta("administrator", "auditoria")).toBe("ya-esta");
    expect(decidirAlta("creator", "auditoria")).toBe("ya-esta");
  });

  it("si ya esta dentro y solo se pide miembro, no hay nada que hacer", () => {
    expect(decidirAlta("member", "miembro")).toBe("ya-esta");
    expect(decidirAlta("administrator", "miembro")).toBe("ya-esta");
  });
});
