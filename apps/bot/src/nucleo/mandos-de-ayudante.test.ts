import { describe, expect, it } from "vitest";
import {
  atenderEntradaEnElGrupo,
  atenderMandoDeAyudante,
  type DependenciasDeAyudante,
} from "./mandos-de-ayudante.js";
import type { NivelDeAyudante } from "./vincular-ayudante.js";

const PROPIETARIO = 1000000002n;
const AYUDANTE = 9000000007n;
const CUALQUIERA = 12345n;
const CHAT = -1001234567890n;

interface Espia {
  deps: DependenciasDeAyudante;
  readonly enlacesCreados: { chatId: bigint; usos: number; caducaEn: number }[];
  readonly encolado: { tipo: string; payload: unknown }[];
  readonly promociones: {
    chatId: bigint;
    userId: bigint;
    permisos: Record<string, boolean>;
  }[];
  nivel: NivelDeAyudante | null;
}

const crearEspia = (opciones?: {
  readonly enlaceFalla?: boolean;
  readonly promocionFalla?: boolean;
  readonly sinAyudanteConfigurado?: boolean;
  readonly nivelInicial?: NivelDeAyudante | null;
  /** Donde esta ya la cuenta: "member", "administrator"... o null si fuera. */
  readonly estadoEnElGrupo?: string | null;
}): Espia => {
  // Un solo objeto, no una copia: las dependencias mutan ESTE `espia`, y el
  // test lee ESTE `espia`. Devolver un `{...espia}` copiaba `nivel` por valor
  // y las escrituras se perdian.
  const espia: Espia = {
    enlacesCreados: [],
    encolado: [],
    promociones: [],
    nivel: opciones?.nivelInicial ?? null,
    deps: undefined as unknown as DependenciasDeAyudante,
  };

  const deps: DependenciasDeAyudante = {
    esPropietario: (quien) => quien === PROPIETARIO,
    idDelAyudante: opciones?.sinAyudanteConfigurado ? null : AYUDANTE,
    crearEnlace: async (input) => {
      espia.enlacesCreados.push(input);
      return opciones?.enlaceFalla
        ? { ok: false, enlace: null }
        : { ok: true, enlace: "https://t.me/+abc123" };
    },
    encolar: async (input) => {
      espia.encolado.push(input);
    },
    promover: async (input) => {
      espia.promociones.push(input);
      return { ok: !opciones?.promocionFalla };
    },
    estadoEnElGrupo: async () => opciones?.estadoEnElGrupo ?? null,
    guardarNivel: async (nivel) => {
      espia.nivel = nivel;
    },
    leerNivel: async () => espia.nivel,
    ahora: () => new Date("2026-09-03T12:00:00.000Z"),
  };

  (espia as { deps: DependenciasDeAyudante }).deps = deps;
  return espia;
};

describe("atenderMandoDeAyudante -- quien manda", () => {
  it("un moderador cualquiera NO puede meter al ayudante", async () => {
    // Meter una segunda identidad en el grupo no es moderar. Si un moderador
    // pudiera, tendria una escalada de privilegios por la puerta de atras.
    const espia = crearEspia();
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante activar",
      autor: CUALQUIERA,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(r?.texto).toContain("propietario");
    expect(espia.enlacesCreados).toHaveLength(0);
    expect(espia.encolado).toHaveLength(0);
  });

  it("NO crea el enlace antes de comprobar quien manda", async () => {
    // Crear el enlace y rechazar despues dejaria un enlace vivo pedido por
    // alguien sin derecho a pedirlo.
    const espia = crearEspia();
    await atenderMandoDeAyudante({
      texto: "/ayudante auditoria",
      autor: CUALQUIERA,
      chatId: CHAT,
      deps: espia.deps,
    });
    expect(espia.enlacesCreados).toHaveLength(0);
  });

  it("la ayuda la ve cualquiera, que no concede nada", async () => {
    const espia = crearEspia();
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante",
      autor: CUALQUIERA,
      chatId: CHAT,
      deps: espia.deps,
    });
    expect(r?.texto).toContain("/ayudante activar");
  });

  it("devuelve null para lo que no es su mando", async () => {
    const espia = crearEspia();
    expect(
      await atenderMandoDeAyudante({
        texto: "/pet enfermar",
        autor: PROPIETARIO,
        chatId: CHAT,
        deps: espia.deps,
      }),
    ).toBeNull();
  });
});

describe("atenderMandoDeAyudante -- activar", () => {
  it("crea un enlace de UN uso con caducidad y encola la union", async () => {
    const espia = crearEspia();
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante activar",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(espia.enlacesCreados).toHaveLength(1);
    expect(espia.enlacesCreados[0]?.usos).toBe(1);
    // 12:00:00Z + 300s
    expect(espia.enlacesCreados[0]?.caducaEn).toBe(
      Math.floor(new Date("2026-09-03T12:05:00.000Z").getTime() / 1000),
    );
    expect(espia.encolado).toEqual([
      {
        tipo: "vinculacion.unirse_a_grupo",
        payload: { enlace: "https://t.me/+abc123" },
      },
    ]);
    expect(espia.nivel).toBe("miembro");
    expect(r?.texto).toContain("miembro");
  });

  it("no promueve a nadie al activar como miembro", async () => {
    const espia = crearEspia();
    await atenderMandoDeAyudante({
      texto: "/ayudante activar",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });
    expect(espia.promociones).toHaveLength(0);
  });

  it("si el enlace falla, lo dice y NO encola nada", async () => {
    const espia = crearEspia({ enlaceFalla: true });
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante activar",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(r?.texto).toContain("No he podido crear el enlace");
    expect(espia.encolado).toHaveLength(0);
    expect(espia.nivel).toBeNull();
  });

  it("avisa si falta la configuracion en vez de fallar en silencio", async () => {
    const espia = crearEspia({ sinAyudanteConfigurado: true });
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante activar",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });
    expect(r?.texto).toContain("AYUDANTE_TELEGRAM_ID");
  });
});

describe("atenderEntradaEnElGrupo", () => {
  it("promueve con el permiso minimo cuando se pidio auditoria", async () => {
    const espia = crearEspia({ nivelInicial: "auditoria" });
    const r = await atenderEntradaEnElGrupo({
      quienEntro: AYUDANTE,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(espia.promociones).toHaveLength(1);
    const permisos = espia.promociones[0]?.permisos ?? {};
    expect(permisos.can_invite_users).toBe(true);
    expect(permisos.can_delete_messages).toBe(false);
    expect(permisos.can_restrict_members).toBe(false);
    expect(permisos.can_promote_members).toBe(false);
    expect(r?.texto).toContain("auditoría");
  });

  it("NO promueve si solo se pidio meterlo de miembro", async () => {
    const espia = crearEspia({ nivelInicial: "miembro" });
    const r = await atenderEntradaEnElGrupo({
      quienEntro: AYUDANTE,
      chatId: CHAT,
      deps: espia.deps,
    });
    expect(espia.promociones).toHaveLength(0);
    expect(r?.texto).toContain("no tiene ningún permiso");
  });

  it("ignora a cualquier otra persona que entre", async () => {
    const espia = crearEspia({ nivelInicial: "auditoria" });
    const r = await atenderEntradaEnElGrupo({
      quienEntro: CUALQUIERA,
      chatId: CHAT,
      deps: espia.deps,
    });
    expect(r).toBeNull();
    expect(espia.promociones).toHaveLength(0);
  });

  it("dice la verdad si no ha podido dar el cargo", async () => {
    const espia = crearEspia({
      nivelInicial: "auditoria",
      promocionFalla: true,
    });
    const r = await atenderEntradaEnElGrupo({
      quienEntro: AYUDANTE,
      chatId: CHAT,
      deps: espia.deps,
    });
    expect(r?.texto).toContain("no he podido darle el cargo");
  });
});

describe("atenderMandoDeAyudante -- quitar", () => {
  it("degrada, le pide salir y olvida el nivel", async () => {
    const espia = crearEspia({ nivelInicial: "auditoria" });
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante quitar",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(espia.promociones).toHaveLength(1);
    expect(
      Object.values(espia.promociones[0]?.permisos ?? {}).every(
        (v) => v === false,
      ),
    ).toBe(true);
    expect(espia.encolado[0]?.tipo).toBe("vinculacion.salir_del_grupo");
    expect(espia.nivel).toBeNull();
    expect(r?.texto).toContain("Quitado");
  });
});

describe("atenderMandoDeAyudante -- estado", () => {
  it("distingue los tres estados", async () => {
    const sin = crearEspia();
    expect(
      (
        await atenderMandoDeAyudante({
          texto: "/ayudante estado",
          autor: PROPIETARIO,
          chatId: CHAT,
          deps: sin.deps,
        })
      )?.texto,
    ).toContain("no está activado");

    const miembro = crearEspia({ nivelInicial: "miembro" });
    expect(
      (
        await atenderMandoDeAyudante({
          texto: "/ayudante estado",
          autor: PROPIETARIO,
          chatId: CHAT,
          deps: miembro.deps,
        })
      )?.texto,
    ).toContain("como miembro");

    const auditoria = crearEspia({ nivelInicial: "auditoria" });
    expect(
      (
        await atenderMandoDeAyudante({
          texto: "/ayudante estado",
          autor: PROPIETARIO,
          chatId: CHAT,
          deps: auditoria.deps,
        })
      )?.texto,
    ).toContain("auditoría");
  });
});

describe("atenderMandoDeAyudante -- cuando la cuenta YA esta dentro", () => {
  it("auditoria sobre una cuenta que ya es miembro la promueve YA, sin esperar evento", async () => {
    // Esto es lo que fallaba en produccion: contestaba "tarda unos segundos"
    // a una promocion que no iba a pasar nunca.
    const espia = crearEspia({ estadoEnElGrupo: "member" });
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante auditoria",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(espia.promociones).toHaveLength(1);
    expect(espia.promociones[0]?.permisos.can_invite_users).toBe(true);
    expect(espia.promociones[0]?.permisos.can_delete_messages).toBe(false);
    expect(espia.enlacesCreados).toHaveLength(0);
    expect(espia.encolado).toHaveLength(0);
    expect(espia.nivel).toBe("auditoria");
    expect(r?.texto).toContain("Ya estaba dentro");
  });

  it("no crea otro enlace ni pide entrar otra vez si ya es admin", async () => {
    const espia = crearEspia({ estadoEnElGrupo: "administrator" });
    const r = await atenderMandoDeAyudante({
      texto: "/ayudante auditoria",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(espia.enlacesCreados).toHaveLength(0);
    expect(espia.encolado).toHaveLength(0);
    expect(espia.promociones).toHaveLength(0);
    expect(r?.texto).toContain("ya estaba dentro");
  });

  it("si no esta dentro, sigue creando enlace y encolando como siempre", async () => {
    const espia = crearEspia({ estadoEnElGrupo: null });
    await atenderMandoDeAyudante({
      texto: "/ayudante auditoria",
      autor: PROPIETARIO,
      chatId: CHAT,
      deps: espia.deps,
    });

    expect(espia.enlacesCreados).toHaveLength(1);
    expect(espia.encolado[0]?.tipo).toBe("vinculacion.unirse_a_grupo");
    expect(espia.promociones).toHaveLength(0);
  });
});
