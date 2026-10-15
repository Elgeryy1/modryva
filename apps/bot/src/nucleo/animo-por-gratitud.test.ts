import type { EstadoGuardable, PetRepository, PetState } from "@superbot/data";
import { describe, expect, it } from "vitest";

import { animarPorGratitud } from "./animo-por-gratitud.js";

const AHORA = new Date("2026-09-02T12:00:00Z");
const HORA = 3_600_000;

const fila = (parcial: Partial<PetState> = {}): PetState =>
  ({
    id: "p1",
    tenantId: "t1",
    chatId: "c1",
    userTelegramId: 1n,
    // El perro es quien declara `animoPorGratitud`.
    especie: "perro",
    rasgos: [],
    nombre: null,
    hambre: 80,
    animo: 50,
    nivel: 1,
    xp: 0,
    vistaEn: AHORA,
    racionesHoy: 0,
    racionesDia: null,
    hambreMax: 0,
    hambreMaxDia: null,
    xpDia: null,
    animoDia: null,
    juguetesHoy: 0,
    juguetesDia: null,
    racha: 0,
    protegeA: null,
    robadoPendiente: 0,
    nonce: 0,
    huevosSinRara: 0,
    regalada: false,
    nacidaEn: AHORA,
    enfermaDesde: null,
    enfermaMotivo: null,
    curaCoste: null,
    curaResto: null,
    curaVence: null,
    curaAvisos: 0,
    fallecidaEn: null,
    ...parcial,
  }) satisfies PetState;

class RepoFalso implements Partial<PetRepository> {
  guardado: EstadoGuardable | undefined;
  constructor(
    private readonly bicho: PetState | null,
    private readonly rompeAlGuardar = false,
  ) {}
  async obtener(): Promise<PetState | null> {
    return this.bicho;
  }
  async guardarEstado(_id: string, estado: EstadoGuardable): Promise<void> {
    if (this.rompeAlGuardar) {
      throw new Error("base caida");
    }
    this.guardado = estado;
  }
}

const animar = async (repo: RepoFalso, ahora = AHORA) =>
  animarPorGratitud({
    mascotas: repo as unknown as PetRepository,
    tenantId: "t1",
    chatId: "c1",
    usuario: 1n,
    ahora,
  });

describe("el animo por las gracias", () => {
  it("al perro le sube el animo cuando dan las gracias a su dueño", () => {
    const repo = new RepoFalso(fila());
    return animar(repo).then(() => {
      expect(repo.guardado?.animo).toBeGreaterThan(50);
    });
  });

  it("no se pasa del tope por muy agradecido que sea el grupo", async () => {
    const repo = new RepoFalso(fila({ animo: 98 }));
    await animar(repo);
    expect(repo.guardado?.animo).toBeLessThanOrEqual(100);
  });

  it("una especie sin ese efecto no gana nada, y no se escribe nada", async () => {
    // No basta con que no suba: si escribiera igual, cada `/gracias` seria una
    // escritura de mas por cada mascota del grupo.
    const repo = new RepoFalso(fila({ especie: "gato" }));
    await animar(repo);
    expect(repo.guardado).toBeUndefined();
  });

  it("quien no tiene bicho no da problema", async () => {
    const repo = new RepoFalso(null);
    await animar(repo);
    expect(repo.guardado).toBeUndefined();
  });

  it("sube sobre el animo YA envejecido, no sobre el guardado", async () => {
    // Sumarle al guardado le regalaria las horas que lleva sin mirarse. Diez
    // horas bajan el animo diez puntos, asi que 50 son 40 antes de sumar.
    const repo = new RepoFalso(
      fila({ vistaEn: new Date(AHORA.getTime() - 10 * HORA) }),
    );
    await animar(repo);
    expect(repo.guardado?.animo).toBe(45);
    expect(repo.guardado?.vistaEn).toEqual(AHORA);
  });

  it("si falla al guardar, las gracias se registran igual", async () => {
    // Lo que la persona pidio fue agradecer, y eso ya esta hecho cuando se
    // llega aqui. Que no se alegre el bicho no puede tumbar el comando.
    const repo = new RepoFalso(fila(), true);
    await expect(animar(repo)).resolves.toBeUndefined();
  });
});
