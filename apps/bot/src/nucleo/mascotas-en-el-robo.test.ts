import type { PetRepository, PetState } from "@superbot/data";
import { describe, expect, it } from "vitest";

import {
  modificadoresDeRoboDeLasMascotas,
  salvaElObjetoAlFallar,
} from "./mascotas-en-el-robo.js";

const AHORA = new Date("2026-09-02T12:00:00Z");

const fila = (especie: string, usuario: bigint): PetState =>
  ({
    id: `p${usuario}`,
    tenantId: "t1",
    chatId: "c1",
    userTelegramId: usuario,
    especie,
    rasgos: [],
    nombre: null,
    hambre: 80,
    animo: 80,
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
  }) satisfies PetState;

/** Doble que reparte bichos por persona, y puede romperse a peticion. */
class RepoFalso implements Partial<PetRepository> {
  constructor(
    private readonly porUsuario: Map<bigint, string>,
    private readonly rompeCon?: bigint,
    /** Quien protege a quien: del protegido al dueño del guardaespaldas. */
    private readonly guardaespaldas = new Map<bigint, bigint>(),
  ) {}
  async obtener(
    _tenantId: string,
    _chatId: string,
    usuario: bigint,
  ): Promise<PetState | null> {
    if (this.rompeCon === usuario) {
      throw new Error("base caida");
    }
    const especie = this.porUsuario.get(usuario);
    return especie ? fila(especie, usuario) : null;
  }
  async quienProtegeA(
    _tenantId: string,
    _chatId: string,
    objetivo: bigint,
  ): Promise<PetState | null> {
    const dueño = this.guardaespaldas.get(objetivo);
    if (dueño === undefined) {
      return null;
    }
    const especie = this.porUsuario.get(dueño);
    return especie ? fila(especie, dueño) : null;
  }
}

const AMIGO = 3n;

const LADRON = 1n;
const VICTIMA = 2n;

const modificadores = (repo: RepoFalso) =>
  modificadoresDeRoboDeLasMascotas({
    mascotas: repo as unknown as PetRepository,
    tenantId: "t1",
    chatId: "c1",
    ladron: LADRON,
    victima: VICTIMA,
  });

describe("buscar los bichos de las dos partes", () => {
  it("junta lo que aporta cada uno de los dos lados", async () => {
    const repo = new RepoFalso(
      new Map([
        [LADRON, "zorro"],
        [VICTIMA, "tortuga"],
      ]),
    );
    const m = await modificadores(repo);
    expect(m.lootMultiplier).toBeGreaterThan(1);
    expect(m.victimGuardPct).toBeGreaterThan(0);
  });

  it("sin bichos no cambia nada", async () => {
    expect(await modificadores(new RepoFalso(new Map()))).toEqual({});
  });

  it("si falla la lectura del ladron, la victima conserva su escudo", async () => {
    // Con un solo try alrededor de las dos, una lectura rota le quitaria el
    // escudo a alguien que si lo tiene — y eso es peor que no dar el bono.
    const repo = new RepoFalso(
      new Map([
        [LADRON, "zorro"],
        [VICTIMA, "tortuga"],
      ]),
      LADRON,
    );
    const m = await modificadores(repo);
    expect(m.victimGuardPct).toBeGreaterThan(0);
    expect(m.lootMultiplier).toBeUndefined();
  });
});

describe("el castor, que protege a alguien que no es su dueño", () => {
  it("cubre a la persona que eligio su dueño", async () => {
    const repo = new RepoFalso(
      new Map([[AMIGO, "castor"]]),
      undefined,
      new Map([[VICTIMA, AMIGO]]),
    );
    const m = await modificadores(repo);
    expect(m.victimGuardPct).toBeGreaterThan(0);
  });

  it("su escudo se SUMA al propio de la victima, no lo sustituye", async () => {
    // Es lo que hace que proteger a alguien signifique algo: con tortuga y un
    // amigo con castor se esta mejor que con cualquiera de los dos.
    const soloTortuga = await modificadores(
      new RepoFalso(new Map([[VICTIMA, "tortuga"]])),
    );
    const conAmbos = await modificadores(
      new RepoFalso(
        new Map([
          [VICTIMA, "tortuga"],
          [AMIGO, "castor"],
        ]),
        undefined,
        new Map([[VICTIMA, AMIGO]]),
      ),
    );
    expect(conAmbos.victimGuardPct).toBeGreaterThan(
      soloTortuga.victimGuardPct ?? 0,
    );
  });

  it("protegerse a uno mismo no dobla el escudo", async () => {
    // Su bono propio ya lo cobra la rama de la victima; contarlo dos veces
    // seria un escudo gratis por escribir `/proteger` con tu propio nombre.
    const repo = new RepoFalso(
      new Map([[VICTIMA, "castor"]]),
      undefined,
      new Map([[VICTIMA, VICTIMA]]),
    );
    const m = await modificadores(repo);
    expect(m.victimGuardPct ?? 0).toBe(0);
  });

  it("una especie que no sabe proteger no cubre a nadie", async () => {
    const repo = new RepoFalso(
      new Map([[AMIGO, "gato"]]),
      undefined,
      new Map([[VICTIMA, AMIGO]]),
    );
    expect(await modificadores(repo)).toEqual({});
  });
});

describe("salvar el objeto al fallar el golpe", () => {
  const salva = (repo: RepoFalso, tirada: number) =>
    salvaElObjetoAlFallar({
      mascotas: repo as unknown as PetRepository,
      tenantId: "t1",
      chatId: "c1",
      ladron: LADRON,
      tirada,
    });

  const conSerpiente = new RepoFalso(new Map([[LADRON, "serpiente"]]));

  it("la serpiente lo salva cuando la tirada entra", async () => {
    // Su probabilidad declarada es 0.5.
    expect(await salva(conSerpiente, 0.1)).toBe(true);
  });

  it("y no lo salva cuando no entra", async () => {
    expect(await salva(conSerpiente, 0.9)).toBe(false);
  });

  it("una especie sin el efecto nunca lo salva, ni con la tirada minima", async () => {
    // El error clasico del umbral: con `<=`, probabilidad 0 y tirada 0
    // salvaria el objeto de TODO el mundo, y se veria como "los objetos no se
    // gastan nunca".
    const repo = new RepoFalso(new Map([[LADRON, "gato"]]));
    expect(await salva(repo, 0)).toBe(false);
  });

  it("quien no tiene bicho pierde el objeto, como siempre", async () => {
    expect(await salva(new RepoFalso(new Map()), 0)).toBe(false);
  });

  it("si no se puede leer la mascota, el objeto se gasta", async () => {
    // Ante la duda, el comportamiento de antes: regalar el objeto por un fallo
    // de lectura seria pagar un error de infraestructura con ventaja.
    const repo = new RepoFalso(new Map([[LADRON, "serpiente"]]), LADRON);
    expect(await salva(repo, 0)).toBe(false);
  });
});
