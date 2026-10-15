import type {
  AyudanteAvisoPrivadoRepository,
  EstadoAvisoPrivado,
  FilaAvisoPrivado,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import {
  componerResumenNocturno,
  crearManejadoresDeMascotas,
  debeAvisarPorHambre,
  type MascotaParaResumen,
  manejadoresDeMascotas,
  type RepositoriosDeMascotas,
  type ResultadoAvisoHambre,
  type ResultadoResumenNocturno,
} from "./mascotas.js";

const logger = createLogger("mascotas-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeAvisoPrivadoRepository implements AyudanteAvisoPrivadoRepository {
  filas: FilaAvisoPrivado[] = [];
  private contador = 0;

  async registrarPendiente(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly detalle?: unknown;
  }): Promise<FilaAvisoPrivado> {
    this.contador += 1;
    const fila: FilaAvisoPrivado = {
      id: `aviso-${this.contador}`,
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
    readonly estado: Exclude<EstadoAvisoPrivado, "pendiente">;
  }): Promise<void> {
    const indice = this.filas.findIndex((fila) => fila.id === input.id);
    if (indice === -1) throw new Error("fila no encontrada");
    const fila = this.filas[indice];
    if (!fila) throw new Error("fila no encontrada");
    this.filas[indice] = {
      ...fila,
      estado: input.estado,
      enviadoEn: new Date(),
    };
  }

  /**
   * Fiel a la implementacion Prisma: se deriva de `filas` y cuenta `enviado`
   * y `pendiente`. Un fake que devolviera siempre `false` volveria a dejar
   * pasar el fallo de los avisos repetidos en cada barrido.
   */
  async yaSeAviso(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly desde: Date;
  }): Promise<boolean> {
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

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

const mascotaDeEjemplo = (
  extra: Partial<MascotaParaResumen> = {},
): MascotaParaResumen => ({
  dueñoTelegramId: 111n,
  nombre: "Rex",
  especie: "zorro",
  nivel: 3,
  hambre: 42,
  ...extra,
});

describe("componerResumenNocturno", () => {
  it("da un mensaje dedicado cuando no hay mascotas en el grupo", () => {
    expect(componerResumenNocturno([])).toBe(
      "Esta noche no hay mascotas en el grupo.",
    );
  });

  it("compone un unico mensaje con un marcador de mencion por mascota", () => {
    const texto = componerResumenNocturno([
      mascotaDeEjemplo({ dueñoTelegramId: 111n, nombre: "Rex" }),
      mascotaDeEjemplo({
        dueñoTelegramId: 222n,
        nombre: "Tofu",
        especie: "tortuga",
        nivel: 1,
        hambre: 8,
      }),
    ]);

    expect(texto).toContain("{{MENCION:111}}");
    expect(texto).toContain("{{MENCION:222}}");
    expect(texto).toContain("Rex");
    expect(texto).toContain("Tofu");
    expect(texto).toContain("nivel 3");
    expect(texto).toContain("nivel 1");
    // Un solo mensaje, nunca uno por mascota: las dos lineas viven en el mismo texto.
    expect(texto.split("\n").filter((l) => l.startsWith("•"))).toHaveLength(2);
  });

  it("usa un texto por defecto para una mascota sin nombre", () => {
    const texto = componerResumenNocturno([mascotaDeEjemplo({ nombre: null })]);

    expect(texto).toContain("sin nombre");
  });

  it("redondea el hambre al componer el texto", () => {
    const texto = componerResumenNocturno([mascotaDeEjemplo({ hambre: 41.7 })]);

    expect(texto).toContain("hambre 42");
  });
});

describe("debeAvisarPorHambre", () => {
  it("avisa cuando quedan 2 horas o menos", () => {
    expect(debeAvisarPorHambre(2)).toBe(true);
    expect(debeAvisarPorHambre(1)).toBe(true);
    expect(debeAvisarPorHambre(0)).toBe(true);
  });

  it("no avisa cuando quedan mas de 2 horas", () => {
    expect(debeAvisarPorHambre(2.01)).toBe(false);
    expect(debeAvisarPorHambre(10)).toBe(false);
  });

  it("NO avisa si la mascota ya se durmio -- horas negativas", () => {
    // Este aviso es de anticipacion. Con una cota superior sola, una mascota
    // dormida hace dos dias (-50) seguia cumpliendo `<= 2` y recibia un
    // "se va a dormir en cualquier momento" absurdo, en cada barrido.
    expect(debeAvisarPorHambre(-0.5)).toBe(false);
    expect(debeAvisarPorHambre(-50)).toBe(false);
  });
});

describe("mascotas.resumen_nocturno", () => {
  it("compone el texto a partir del payload y lo devuelve sin enviar nada", async () => {
    const manejadores = crearManejadoresDeMascotas({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "mascotas.resumen_nocturno");
    const userbot = new FakeUserbot();

    const resultado = (await manejador(
      {
        tenantId: "t1",
        chatId: 999,
        mascotas: [
          {
            dueñoTelegramId: 111,
            nombre: "Rex",
            especie: "zorro",
            nivel: 3,
            hambre: 42,
          },
        ],
      },
      crearContexto(userbot),
    )) as ResultadoResumenNocturno;

    expect(resultado.texto).toContain("{{MENCION:111}}");
    expect(resultado.texto).toContain("Rex");
    // Es de solo lectura: compone, no envia.
    expect(userbot.enviados).toHaveLength(0);
  });

  it("acepta ids como texto numerico ademas de como number", async () => {
    const manejadores = crearManejadoresDeMascotas({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "mascotas.resumen_nocturno");

    const resultado = (await manejador(
      {
        tenantId: "t1",
        chatId: "999",
        mascotas: [
          {
            dueñoTelegramId: "111",
            nombre: null,
            especie: "zorro",
            nivel: "3",
            hambre: "42.4",
          },
        ],
      },
      crearContexto(new FakeUserbot()),
    )) as ResultadoResumenNocturno;

    expect(resultado.texto).toContain("{{MENCION:111}}");
    expect(resultado.texto).toContain("hambre 42");
  });

  it("da un mensaje vacio de mascotas cuando el array esta vacio", async () => {
    const manejadores = crearManejadoresDeMascotas({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "mascotas.resumen_nocturno");

    const resultado = (await manejador(
      { tenantId: "t1", chatId: 999, mascotas: [] },
      crearContexto(new FakeUserbot()),
    )) as ResultadoResumenNocturno;

    expect(resultado.texto).toBe("Esta noche no hay mascotas en el grupo.");
  });

  it("lanza si mascotas no es un array", async () => {
    const manejadores = crearManejadoresDeMascotas({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "mascotas.resumen_nocturno");

    await expect(
      manejador(
        { tenantId: "t1", chatId: 999, mascotas: "no es un array" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/mascotas/);
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = crearManejadoresDeMascotas({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "mascotas.resumen_nocturno");

    await expect(
      manejador(
        { chatId: 999, mascotas: [] },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/tenantId/);
  });
});

describe("mascotas.aviso_hambre", () => {
  it("no avisa, ni registra fila, ni llama al userbot cuando quedan mas de 2 horas", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = crearManejadoresDeMascotas({ avisos });
    const manejador = unManejador(manejadores, "mascotas.aviso_hambre");
    const userbot = new FakeUserbot();

    const resultado = (await manejador(
      {
        tenantId: "t1",
        dueñoTelegramId: 111,
        nombreMascota: "Rex",
        horasHastaDormir: 5,
      },
      crearContexto(userbot),
    )) as ResultadoAvisoHambre;

    expect(resultado).toEqual({ avisado: false });
    expect(avisos.filas).toHaveLength(0);
    expect(userbot.enviados).toHaveLength(0);
  });

  it("avisa por privado cuando quedan 2 horas o menos, y deja rastro en el repositorio", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const repos: RepositoriosDeMascotas = { avisos };
    const manejadores = crearManejadoresDeMascotas(repos);
    const manejador = unManejador(manejadores, "mascotas.aviso_hambre");
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "enviado" };

    const resultado = (await manejador(
      {
        tenantId: "t1",
        dueñoTelegramId: 111,
        nombreMascota: "Rex",
        horasHastaDormir: 1,
      },
      crearContexto(userbot),
    )) as ResultadoAvisoHambre;

    expect(resultado.avisado).toBe(true);
    expect(resultado.resultadoEnvio).toEqual({
      yaAvisado: false,
      envio: { estado: "enviado" },
    });

    expect(userbot.enviados).toHaveLength(1);
    expect(userbot.enviados[0]?.userTelegramId).toBe(111n);
    expect(userbot.enviados[0]?.texto).toContain("Rex");

    expect(avisos.filas).toHaveLength(1);
    expect(avisos.filas[0]?.tenantId).toBe("t1");
    expect(avisos.filas[0]?.destinatarioTelegramId).toBe(111n);
    expect(avisos.filas[0]?.tipo).toBe("mascotas.aviso_hambre");
    expect(avisos.filas[0]?.estado).toBe("enviado");
  });

  it("registra el aviso como bloqueado cuando el userbot no consigue entregarlo", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = crearManejadoresDeMascotas({ avisos });
    const manejador = unManejador(manejadores, "mascotas.aviso_hambre");
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "bloqueado" };

    const resultado = (await manejador(
      {
        tenantId: "t1",
        dueñoTelegramId: 111,
        nombreMascota: null,
        horasHastaDormir: 0,
      },
      crearContexto(userbot),
    )) as ResultadoAvisoHambre;

    expect(resultado.avisado).toBe(true);
    expect(resultado.resultadoEnvio).toEqual({
      yaAvisado: false,
      envio: { estado: "bloqueado" },
    });
    expect(avisos.filas[0]?.estado).toBe("bloqueado");
    // Sin nombre, el texto tiene que seguir siendo legible.
    expect(userbot.enviados[0]?.texto).toContain("Tu mascota");
  });

  it("lanza si falta dueñoTelegramId", async () => {
    const manejadores = crearManejadoresDeMascotas({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "mascotas.aviso_hambre");

    await expect(
      manejador(
        { tenantId: "t1", nombreMascota: "Rex", horasHastaDormir: 1 },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/dueñoTelegramId/);
  });
});

describe("manejadoresDeMascotas", () => {
  it("es el mismo alias que crearManejadoresDeMascotas", () => {
    expect(manejadoresDeMascotas).toBe(crearManejadoresDeMascotas);
  });

  it("produce un catalogo con los dos tipos del bloque", () => {
    const catalogo = manejadoresDeMascotas({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    expect(Object.keys(catalogo).sort()).toEqual([
      "mascotas.aviso_hambre",
      "mascotas.resumen_nocturno",
    ]);
  });
});

describe("mascotas.aviso_hambre -- no se repite en cada barrido", () => {
  it("solo manda UN privado aunque el barrido lo encole muchas veces el mismo dia", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = crearManejadoresDeMascotas({ avisos });
    const manejador = unManejador(manejadores, "mascotas.aviso_hambre");
    const userbot = new FakeUserbot();
    const payload = {
      tenantId: "t1",
      dueñoTelegramId: "111",
      nombreMascota: "Noxel",
      horasHastaDormir: 1,
    };

    // El barrido de mascotas revisa cada quince minutos: en un dia son 96
    // pasadas. Antes cada una mandaba su propio privado.
    for (let i = 0; i < 96; i += 1) {
      await manejador(payload, crearContexto(userbot));
    }

    expect(userbot.enviados).toHaveLength(1);
    expect(avisos.filas).toHaveLength(1);
  });
});
