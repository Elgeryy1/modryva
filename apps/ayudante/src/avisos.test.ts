import type {
  AyudanteAvisoPrivadoRepository,
  EstadoAvisoPrivado,
  FilaAvisoPrivado,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import { enviarAvisoPrivado, inicioDeDiaUtc } from "./avisos.js";
import { FakeUserbot } from "./fake-userbot.js";

/** En memoria, fiel a la implementacion Prisma: `yaSeAviso` sale de `filas`. */
class FakeAvisoPrivadoRepository implements AyudanteAvisoPrivadoRepository {
  filas: FilaAvisoPrivado[] = [];
  /**
   * El reloj con el que se sella `creadoEn`. En Prisma lo pone la base de
   * datos (`@default(now())`) y coincide con el reloj real; aqui se puede
   * fijar para probar el borde de la medianoche UTC.
   */
  ahora = new Date();
  private siguienteId = 1;

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
      creadoEn: this.ahora,
      enviadoEn: null,
    };
    this.filas.push(fila);
    return fila;
  }

  async marcarResultado(input: {
    readonly id: string;
    readonly estado: Exclude<EstadoAvisoPrivado, "pendiente">;
  }): Promise<void> {
    const fila = this.filas.find((f) => f.id === input.id);
    if (!fila) throw new Error(`no existe aviso con id ${input.id}`);
    (fila as { estado: EstadoAvisoPrivado }).estado = input.estado;
  }

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

const base = {
  tenantId: "t1",
  destinatarioTelegramId: 111n,
  tipo: "prueba",
  texto: "hola",
};

describe("inicioDeDiaUtc", () => {
  it("devuelve la medianoche UTC del dia que contiene la fecha", () => {
    expect(
      inicioDeDiaUtc(new Date("2026-09-02T23:59:59.999Z")).toISOString(),
    ).toBe("2026-09-02T00:00:00.000Z");
    expect(
      inicioDeDiaUtc(new Date("2026-09-03T00:00:00.000Z")).toISOString(),
    ).toBe("2026-09-03T00:00:00.000Z");
  });
});

describe("enviarAvisoPrivado", () => {
  it("manda el aviso la primera vez", async () => {
    const repo = new FakeAvisoPrivadoRepository();
    const userbot = new FakeUserbot();

    const resultado = await enviarAvisoPrivado(repo, userbot, base);

    expect(resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "enviado" },
    });
    expect(userbot.enviados).toHaveLength(1);
    expect(repo.filas[0]?.estado).toBe("enviado");
  });

  it("no lo repite el mismo dia, y no registra fila nueva", async () => {
    const repo = new FakeAvisoPrivadoRepository();
    const userbot = new FakeUserbot();

    await enviarAvisoPrivado(repo, userbot, base);
    const segunda = await enviarAvisoPrivado(repo, userbot, base);

    expect(segunda).toEqual({ yaAvisado: true, envio: null });
    expect(userbot.enviados).toHaveLength(1);
    expect(repo.filas).toHaveLength(1);
  });

  it("distingue por tipo y por destinatario", async () => {
    const repo = new FakeAvisoPrivadoRepository();
    const userbot = new FakeUserbot();

    await enviarAvisoPrivado(repo, userbot, base);
    await enviarAvisoPrivado(repo, userbot, { ...base, tipo: "otro" });
    await enviarAvisoPrivado(repo, userbot, {
      ...base,
      destinatarioTelegramId: 222n,
    });

    expect(userbot.enviados).toHaveLength(3);
  });

  it("vuelve a avisar al dia siguiente", async () => {
    const repo = new FakeAvisoPrivadoRepository();
    const userbot = new FakeUserbot();

    repo.ahora = new Date("2026-09-02T20:00:00.000Z");
    await enviarAvisoPrivado(repo, userbot, {
      ...base,
      ahora: new Date("2026-09-02T20:00:00.000Z"),
    });
    repo.ahora = new Date("2026-09-03T09:00:00.000Z");
    // La fila de ayer queda fuera de la ventana de hoy.
    const hoy = await enviarAvisoPrivado(repo, userbot, {
      ...base,
      ahora: new Date("2026-09-03T09:00:00.000Z"),
    });

    expect(hoy.yaAvisado).toBe(false);
    expect(userbot.enviados).toHaveLength(2);
  });

  it("una fila PENDIENTE bloquea el reenvio: es un envio en curso", async () => {
    // El caso que duplicaba mensajes: el privado sale, `marcarResultado`
    // falla, la fila se queda `pendiente` y el despachador reintenta.
    const repo = new FakeAvisoPrivadoRepository();
    const userbot = new FakeUserbot();
    await repo.registrarPendiente(base);

    const resultado = await enviarAvisoPrivado(repo, userbot, base);

    expect(resultado).toEqual({ yaAvisado: true, envio: null });
    expect(userbot.enviados).toHaveLength(0);
  });

  it("si el envio lanza, marca rebotado y deja reintentar hoy", async () => {
    const repo = new FakeAvisoPrivadoRepository();
    const userbot = new FakeUserbot();
    userbot.enviarPrivado = async () => {
      throw new Error("flood wait");
    };

    await expect(enviarAvisoPrivado(repo, userbot, base)).rejects.toThrow(
      /flood wait/,
    );
    expect(repo.filas[0]?.estado).toBe("rebotado");

    // Un fallo de envio SI merece otra oportunidad hoy; dejar la fila en
    // `pendiente` la habria bloqueado hasta mañana.
    const userbotSano = new FakeUserbot();
    const reintento = await enviarAvisoPrivado(repo, userbotSano, base);
    expect(reintento.yaAvisado).toBe(false);
    expect(userbotSano.enviados).toHaveLength(1);
  });

  it("un rebote normal del userbot queda registrado y no bloquea el dia", async () => {
    const repo = new FakeAvisoPrivadoRepository();
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "bloqueado" };

    const resultado = await enviarAvisoPrivado(repo, userbot, base);

    expect(resultado.envio).toEqual({ estado: "bloqueado" });
    expect(repo.filas[0]?.estado).toBe("bloqueado");
  });
});
