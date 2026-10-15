import type {
  AyudanteAvisoPrivadoRepository,
  FilaAvisoPrivado,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import { inicioDeDiaUtc } from "../avisos.js";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import {
  type AvisoSancionExpira,
  manejadoresDeComunicacion,
  partirPorMenciones,
  programarAvisoSancionExpira,
  programarRecordatorioVerificacion,
  type RepositoriosDeComunicacion,
  type ResultadoAvisoPrivado,
  type ResultadoMencionReal,
  sinHtml,
} from "./comunicacion.js";

const logger = createLogger("comunicacion-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeAvisoPrivadoRepository implements AyudanteAvisoPrivadoRepository {
  filas: FilaAvisoPrivado[] = [];
  avisadosHoy = new Set<string>();
  private siguienteId = 1;

  private clave(input: {
    tenantId: string;
    destinatarioTelegramId: bigint;
    tipo: string;
  }): string {
    return `${input.tenantId}::${input.destinatarioTelegramId}::${input.tipo}`;
  }

  async registrarPendiente(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly detalle?: unknown;
  }): Promise<FilaAvisoPrivado> {
    const fila: FilaAvisoPrivado = {
      id: `aviso-${this.siguienteId++}`,
      tenantId: input.tenantId,
      destinatarioTelegramId: input.destinatarioTelegramId,
      tipo: input.tipo,
      estado: "pendiente",
      detalle: input.detalle ?? null,
      creadoEn: new Date(),
      enviadoEn: null,
    };
    this.filas.push(fila);
    return fila;
  }

  async marcarResultado(input: {
    readonly id: string;
    readonly estado: Exclude<FilaAvisoPrivado["estado"], "pendiente">;
  }): Promise<void> {
    const fila = this.filas.find((f) => f.id === input.id);
    if (!fila) throw new Error(`no existe la fila ${input.id}`);
    (fila as { estado: FilaAvisoPrivado["estado"] }).estado = input.estado;
    (fila as { enviadoEn: Date | null }).enviadoEn = new Date();
  }

  /**
   * Se deriva de `filas`, igual que la implementacion Prisma, en vez de leer
   * un conjunto que el test rellena a mano. Un fake que no modela el estado
   * entre invocaciones es exactamente lo que dejo pasar el fallo de los 96
   * privados al dia: contaba `yaSeAviso` como "lo que el test diga" y nunca
   * como "lo que quedo escrito en la llamada anterior".
   *
   * `avisadosHoy` sigue existiendo para forzar el caso desde fuera.
   */
  async yaSeAviso(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly desde: Date;
  }): Promise<boolean> {
    if (this.avisadosHoy.has(this.clave(input))) return true;
    return this.filas.some(
      (fila) =>
        fila.tenantId === input.tenantId &&
        fila.destinatarioTelegramId === input.destinatarioTelegramId &&
        fila.tipo === input.tipo &&
        (fila.estado === "enviado" || fila.estado === "pendiente") &&
        fila.creadoEn >= input.desde,
    );
  }
}

describe("comunicacion.mencion_real", () => {
  it("devuelve ok y el accessHash cuando el userbot resuelve a la persona", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const userbot = new FakeUserbot();
    userbot.accessHashes.set("111", "hash-abc");

    const manejador = unManejador(manejadores, "comunicacion.mencion_real");
    const resultado = (await manejador(
      { chatId: "-1001", userTelegramId: 111, textoAlrededor: "gracias " },
      crearContexto(userbot),
    )) as ResultadoMencionReal;

    expect(resultado).toEqual({
      ok: true,
      accessHash: "hash-abc",
      textoAlrededor: "gracias ",
    });
  });

  it("devuelve ok:false cuando el userbot no alcanza a la persona", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const userbot = new FakeUserbot();

    const manejador = unManejador(manejadores, "comunicacion.mencion_real");
    const resultado = (await manejador(
      { chatId: "-1001", userTelegramId: 999, textoAlrededor: "hola" },
      crearContexto(userbot),
    )) as ResultadoMencionReal;

    expect(resultado).toEqual({
      ok: false,
      motivo: "sin acceso a esa persona",
    });
  });

  it("lanza si falta chatId", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "comunicacion.mencion_real");

    await expect(
      manejador(
        { userTelegramId: 111, textoAlrededor: "hola" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/chatId/);
  });

  it("lanza si falta textoAlrededor", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "comunicacion.mencion_real");

    await expect(
      manejador(
        { chatId: "-1001", userTelegramId: 111 },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/textoAlrededor/);
  });

  it("acepta userTelegramId como texto numerico ademas de como number", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const userbot = new FakeUserbot();
    userbot.accessHashes.set("222", "hash-xyz");

    const manejador = unManejador(manejadores, "comunicacion.mencion_real");
    const resultado = (await manejador(
      { chatId: "-1001", userTelegramId: "222", textoAlrededor: "!" },
      crearContexto(userbot),
    )) as ResultadoMencionReal;

    expect(resultado).toEqual({
      ok: true,
      accessHash: "hash-xyz",
      textoAlrededor: "!",
    });
  });
});

describe("comunicacion.aviso_privado", () => {
  it("registra pendiente, envia por privado y marca el resultado cuando no se habia avisado hoy", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const repos: RepositoriosDeComunicacion = { avisos };
    const manejadores = manejadoresDeComunicacion(repos);
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "enviado" };

    const manejador = unManejador(manejadores, "comunicacion.aviso_privado");
    const resultado = (await manejador(
      {
        tenantId: "t1",
        destinatarioTelegramId: 555,
        tipo: "verificacion_pendiente",
        texto: "no olvides verificarte",
      },
      crearContexto(userbot),
    )) as ResultadoAvisoPrivado;

    expect(resultado).toEqual({
      ok: true,
      yaAvisado: false,
      estado: "enviado",
    });
    expect(userbot.enviados).toEqual([
      { userTelegramId: 555n, texto: "no olvides verificarte" },
    ]);
    expect(avisos.filas).toHaveLength(1);
    expect(avisos.filas[0]?.estado).toBe("enviado");
    expect(avisos.filas[0]?.destinatarioTelegramId).toBe(555n);
    expect(avisos.filas[0]?.tipo).toBe("verificacion_pendiente");
    expect(avisos.filas[0]?.enviadoEn).not.toBeNull();
  });

  it("propaga el estado rebotado o bloqueado tal cual lo diga el userbot", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = manejadoresDeComunicacion({ avisos });
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "bloqueado" };

    const manejador = unManejador(manejadores, "comunicacion.aviso_privado");
    const resultado = (await manejador(
      {
        tenantId: "t1",
        destinatarioTelegramId: 555,
        tipo: "verificacion_pendiente",
        texto: "hola",
      },
      crearContexto(userbot),
    )) as ResultadoAvisoPrivado;

    expect(resultado).toEqual({
      ok: true,
      yaAvisado: false,
      estado: "bloqueado",
    });
    expect(avisos.filas[0]?.estado).toBe("bloqueado");
  });

  it("si ya se aviso hoy, no registra fila ni llama al userbot", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    avisos.avisadosHoy.add("t1::555::verificacion_pendiente");
    const manejadores = manejadoresDeComunicacion({ avisos });
    const userbot = new FakeUserbot();

    const manejador = unManejador(manejadores, "comunicacion.aviso_privado");
    const resultado = (await manejador(
      {
        tenantId: "t1",
        destinatarioTelegramId: 555,
        tipo: "verificacion_pendiente",
        texto: "hola de nuevo",
      },
      crearContexto(userbot),
    )) as ResultadoAvisoPrivado;

    expect(resultado).toEqual({ ok: true, yaAvisado: true });
    expect(userbot.enviados).toEqual([]);
    expect(avisos.filas).toEqual([]);
  });

  it("el mismo tipo a otro destinatario no cuenta como ya avisado", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    avisos.avisadosHoy.add("t1::555::verificacion_pendiente");
    const manejadores = manejadoresDeComunicacion({ avisos });
    const userbot = new FakeUserbot();

    const manejador = unManejador(manejadores, "comunicacion.aviso_privado");
    const resultado = (await manejador(
      {
        tenantId: "t1",
        destinatarioTelegramId: 777,
        tipo: "verificacion_pendiente",
        texto: "hola",
      },
      crearContexto(userbot),
    )) as ResultadoAvisoPrivado;

    expect(resultado.yaAvisado).toBe(false);
    expect(userbot.enviados).toHaveLength(1);
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "comunicacion.aviso_privado");

    await expect(
      manejador(
        { destinatarioTelegramId: 555, tipo: "x", texto: "hola" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/tenantId/);
  });

  it("lanza si falta texto", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "comunicacion.aviso_privado");

    await expect(
      manejador(
        { tenantId: "t1", destinatarioTelegramId: 555, tipo: "x" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/texto/);
  });

  it("lanza si destinatarioTelegramId no es un entero valido", async () => {
    const manejadores = manejadoresDeComunicacion({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "comunicacion.aviso_privado");

    await expect(
      manejador(
        {
          tenantId: "t1",
          destinatarioTelegramId: "no-es-un-id",
          tipo: "x",
          texto: "hola",
        },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/destinatarioTelegramId/);
  });
});

describe("inicioDeDiaUtc", () => {
  it("trunca a medianoche UTC del mismo dia", () => {
    expect(inicioDeDiaUtc(new Date("2026-09-02T15:42:07.123Z"))).toEqual(
      new Date("2026-09-02T00:00:00.000Z"),
    );
  });

  it("justo antes de medianoche sigue siendo el dia de hoy", () => {
    expect(inicioDeDiaUtc(new Date("2026-09-02T23:59:59.999Z"))).toEqual(
      new Date("2026-09-02T00:00:00.000Z"),
    );
  });

  it("justo despues de medianoche ya es el dia siguiente", () => {
    expect(inicioDeDiaUtc(new Date("2026-09-03T00:00:00.001Z"))).toEqual(
      new Date("2026-09-03T00:00:00.000Z"),
    );
  });
});

describe("programarRecordatorioVerificacion", () => {
  const plazo = new Date("2026-09-02T12:00:00.000Z");

  it("no avisa si faltan mas de 6 horas", () => {
    const ahora = new Date("2026-09-02T05:00:00.000Z");
    expect(programarRecordatorioVerificacion(plazo, ahora)).toBe(false);
  });

  it("avisa justo al entrar en la ventana de 6 horas", () => {
    const ahora = new Date("2026-09-02T06:00:00.000Z");
    expect(programarRecordatorioVerificacion(plazo, ahora)).toBe(true);
  });

  it("avisa con menos de 6 horas por delante", () => {
    const ahora = new Date("2026-09-02T11:00:00.000Z");
    expect(programarRecordatorioVerificacion(plazo, ahora)).toBe(true);
  });

  it("no avisa una vez pasado el plazo", () => {
    const ahora = new Date("2026-09-02T12:00:00.001Z");
    expect(programarRecordatorioVerificacion(plazo, ahora)).toBe(false);
  });

  it("no avisa justo en el instante del plazo", () => {
    expect(programarRecordatorioVerificacion(plazo, plazo)).toBe(false);
  });
});

describe("programarAvisoSancionExpira", () => {
  const plazo = new Date("2026-09-02T12:00:00.000Z");

  it("no avisa si faltan mas de 3 horas, y da las horas restantes", () => {
    const ahora = new Date("2026-09-02T08:00:00.000Z");
    const resultado: AvisoSancionExpira = programarAvisoSancionExpira(
      plazo,
      ahora,
    );
    expect(resultado.debeAvisar).toBe(false);
    expect(resultado.horasRestantes).toBeCloseTo(4, 6);
  });

  it("avisa justo al entrar en la ventana de 3 horas", () => {
    const ahora = new Date("2026-09-02T09:00:00.000Z");
    const resultado = programarAvisoSancionExpira(plazo, ahora);
    expect(resultado.debeAvisar).toBe(true);
    expect(resultado.horasRestantes).toBeCloseTo(3, 6);
  });

  it("avisa con menos de 3 horas por delante", () => {
    const ahora = new Date("2026-09-02T11:30:00.000Z");
    const resultado = programarAvisoSancionExpira(plazo, ahora);
    expect(resultado.debeAvisar).toBe(true);
    expect(resultado.horasRestantes).toBeCloseTo(0.5, 6);
  });

  it("no avisa una vez pasado el plazo, y las horas restantes son cero", () => {
    const ahora = new Date("2026-09-02T13:00:00.000Z");
    const resultado = programarAvisoSancionExpira(plazo, ahora);
    expect(resultado.debeAvisar).toBe(false);
    expect(resultado.horasRestantes).toBe(0);
  });
});

describe("partirPorMenciones", () => {
  it("parte texto y menciones en orden", () => {
    expect(partirPorMenciones("hola {{MENCION:111}} que tal")).toEqual([
      { tipo: "texto", valor: "hola " },
      { tipo: "mencion", userTelegramId: 111n },
      { tipo: "texto", valor: " que tal" },
    ]);
  });

  it("aguanta varias menciones y una al principio y otra al final", () => {
    expect(partirPorMenciones("{{MENCION:1}}y{{MENCION:2}}")).toEqual([
      { tipo: "mencion", userTelegramId: 1n },
      { tipo: "texto", valor: "y" },
      { tipo: "mencion", userTelegramId: 2n },
    ]);
  });

  it("un texto sin marcadores sale entero como texto", () => {
    expect(partirPorMenciones("nada que enlazar")).toEqual([
      { tipo: "texto", valor: "nada que enlazar" },
    ]);
  });

  it("un marcador mal escrito se queda como texto, no rompe el mensaje", () => {
    // Romper el mensaje entero por una marca mal puesta es peor que enseñarla.
    const texto = "roto {{MENCION:abc}} y {{MENCION}} fin";
    expect(partirPorMenciones(texto)).toEqual([
      { tipo: "texto", valor: texto },
    ]);
  });

  it("no se lia si lo llaman dos veces seguidas", () => {
    // El regex es global y con estado: sin reiniciar `lastIndex`, la segunda
    // llamada empieza donde acabo la primera y se salta menciones.
    const t = "a {{MENCION:7}} b";
    expect(partirPorMenciones(t)).toEqual(partirPorMenciones(t));
  });
});

describe("comunicacion.publicar_con_menciones", () => {
  const manejadores = () =>
    manejadoresDeComunicacion({ avisos: new FakeAvisoPrivadoRepository() });

  it("publica y cuenta cuantas menciones resolvio", async () => {
    const userbot = new FakeUserbot();
    userbot.mencionablesResolubles.add("111");

    const r = (await unManejador(
      manejadores(),
      "comunicacion.publicar_con_menciones",
    )(
      { chatId: "-1001", texto: "hola {{MENCION:111}} y {{MENCION:222}}" },
      crearContexto(userbot),
    )) as { ok: boolean; mencionesResueltas: number; mencionesPedidas: number };

    expect(r.ok).toBe(true);
    expect(r.mencionesPedidas).toBe(2);
    // 222 no se resuelve: sale su nombre sin enlace, no se pierde el mensaje.
    expect(r.mencionesResueltas).toBe(1);
    expect(userbot.publicadosConMenciones).toHaveLength(1);
  });

  it("lanza si el texto falta, en vez de publicar un mensaje vacio", async () => {
    await expect(
      unManejador(manejadores(), "comunicacion.publicar_con_menciones")(
        { chatId: "-1001" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/texto/);
  });
});

describe("partirPorMenciones", () => {
  it("parte texto y menciones en el orden correcto", () => {
    expect(partirPorMenciones("Hola {{MENCION:111}}, sube tu bicho")).toEqual([
      { tipo: "texto", valor: "Hola " },
      { tipo: "mencion", userTelegramId: 111n },
      { tipo: "texto", valor: ", sube tu bicho" },
    ]);
  });

  it("aguanta varias menciones seguidas sin texto en medio", () => {
    expect(partirPorMenciones("{{MENCION:1}}{{MENCION:2}}")).toEqual([
      { tipo: "mencion", userTelegramId: 1n },
      { tipo: "mencion", userTelegramId: 2n },
    ]);
  });

  it("un texto sin marcadores sale de una pieza", () => {
    expect(partirPorMenciones("sin nadie a quien nombrar")).toEqual([
      { tipo: "texto", valor: "sin nadie a quien nombrar" },
    ]);
  });

  it("una marca mal escrita se queda como texto y no rompe el mensaje", () => {
    // Romper el mensaje entero por una marca mala es mucho peor que enseñarla.
    const texto = "roto {{MENCION:abc}} y {{MENCION}} pero {{MENCION:9}} vale";
    const partes = partirPorMenciones(texto);
    expect(partes.filter((p) => p.tipo === "mencion")).toEqual([
      { tipo: "mencion", userTelegramId: 9n },
    ]);
    expect(
      partes.map((p) => (p.tipo === "texto" ? p.valor : "")).join(""),
    ).toContain("{{MENCION:abc}}");
  });

  it("el texto reconstruido conserva todo lo que no era marca", () => {
    const partes = partirPorMenciones("a{{MENCION:5}}b{{MENCION:6}}c");
    const soloTexto = partes
      .map((p) => (p.tipo === "texto" ? p.valor : ""))
      .join("");
    expect(soloTexto).toBe("abc");
  });

  it("es reentrante: dos llamadas seguidas dan lo mismo", () => {
    // El regex es global y lleva `lastIndex`. Si no se reinicia, la segunda
    // llamada empieza por donde acabo la primera y se come menciones.
    const texto = "x {{MENCION:7}} y";
    expect(partirPorMenciones(texto)).toEqual(partirPorMenciones(texto));
  });
});

describe("comunicacion.publicar_con_menciones", () => {
  const manejador = (userbot: FakeUserbot) =>
    unManejador(
      manejadoresDeComunicacion({ avisos: new FakeAvisoPrivadoRepository() }),
      "comunicacion.publicar_con_menciones",
    )(
      {
        chatId: "-1001",
        texto: "Enhorabuena {{MENCION:111}} y {{MENCION:222}}",
      },
      crearContexto(userbot),
    );

  it("publica y cuenta cuantas menciones se resolvieron", async () => {
    const userbot = new FakeUserbot();
    userbot.mencionablesResolubles.add("111");

    const r = (await manejador(userbot)) as {
      ok: boolean;
      mencionesResueltas: number;
      mencionesPedidas: number;
    };

    expect(r.ok).toBe(true);
    expect(r.mencionesPedidas).toBe(2);
    expect(r.mencionesResueltas).toBe(1);
    expect(userbot.publicadosConMenciones).toHaveLength(1);
    expect(userbot.publicadosConMenciones[0]?.chatId).toBe(-1001n);
  });

  it("no publica nada si falta el texto", async () => {
    const userbot = new FakeUserbot();
    await expect(
      unManejador(
        manejadoresDeComunicacion({ avisos: new FakeAvisoPrivadoRepository() }),
        "comunicacion.publicar_con_menciones",
      )({ chatId: "-1001" }, crearContexto(userbot)),
    ).rejects.toThrow(/texto/);
    expect(userbot.publicadosConMenciones).toHaveLength(0);
  });
});

describe("sinHtml", () => {
  it("quita las etiquetas y deja el texto", () => {
    expect(sinHtml("<b>Aviso</b>: tu <code>bicho</code> enferma")).toBe(
      "Aviso: tu bicho enferma",
    );
  });

  it("no toca un texto sin etiquetas", () => {
    expect(sinHtml("sin nada que quitar")).toBe("sin nada que quitar");
  });

  it("no se come los marcadores de mencion", () => {
    // Lo importante: la mencion tiene que sobrevivir al limpiado.
    expect(sinHtml("<b>{{MENCION:111}}</b> mira esto")).toBe(
      "{{MENCION:111}} mira esto",
    );
  });

  it("deshace las entidades escapadas", () => {
    expect(sinHtml("3 &lt; 5 &amp;&amp; 5 &gt; 3")).toBe("3 < 5 && 5 > 3");
  });
});
