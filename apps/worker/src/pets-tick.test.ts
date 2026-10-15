import type {
  EstadoGuardable,
  NuevaMascota,
  PetRepository,
  PetState,
} from "@superbot/data";
import {
  AJUSTES_POR_DEFECTO,
  HAMBRE_POR_HORA,
  XP_POR_DIA_CUIDADO,
} from "@superbot/module-games";
import { describe, expect, it } from "vitest";

import {
  diaUtcDe,
  esDeNoche,
  factorDelVecinoEnElCorral,
  MINUTOS_ENTRE_REVISIONES,
  procesarTickDeMascotas,
  tiradaDelDia,
} from "./pets-tick.js";

const HORA = 3_600_000;
const AHORA = new Date("2026-08-28T12:00:00Z");

const mascota = (parcial: Partial<PetState> = {}): PetState => ({
  id: "p1",
  tenantId: "t1",
  chatId: "c1",
  userTelegramId: 1n,
  especie: "abeja",
  rasgos: [],
  nombre: null,
  hambre: 100,
  animo: 100,
  nivel: 3,
  xp: 0,
  vistaEn: new Date(AHORA.getTime() - 24 * HORA),
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
  nacidaEn: new Date("2026-08-01T00:00:00Z"),
  enfermaDesde: null,
  enfermaMotivo: null,
  curaCoste: null,
  curaResto: null,
  curaVence: null,
  curaAvisos: 0,
  fallecidaEn: null,
  ...parcial,
});

/**
 * Doble del repositorio. Guarda lo que se le pide y recuerda a quien se le
 * pago, que es lo unico que este test necesita comprobar.
 */
class RepoFalso implements PetRepository {
  guardados = new Map<string, EstadoGuardable>();
  pagos: { id: string; monedas: number; dia: string }[] = [];
  pagadosPorDia = new Set<string>();
  devueltosPorDia = new Set<string>();
  devoluciones: { id: string; monedas: number }[] = [];
  muertas: string[] = [];
  fallaAl?: string;

  constructor(private readonly filas: PetState[]) {}

  async obtener(): Promise<PetState | null> {
    return this.filas[0] ?? null;
  }
  async crear(_nueva: NuevaMascota): Promise<PetState> {
    throw new Error("no se usa");
  }
  async guardarEstado(id: string, estado: EstadoGuardable): Promise<void> {
    if (this.fallaAl === id) {
      throw new Error("fila rota");
    }
    this.guardados.set(id, estado);
  }
  async servirRacion(): Promise<never> {
    throw new Error("no se usa");
  }
  async pagarRendimiento(input: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    monedas: number;
    diaUtc: string;
  }) {
    const clave = `${input.userTelegramId}:${input.diaUtc}`;
    if (this.pagadosPorDia.has(clave)) {
      return { ok: false as const, motivo: "yaPagadoHoy" as const };
    }
    this.pagadosPorDia.add(clave);
    this.pagos.push({
      id: String(input.userTelegramId),
      monedas: input.monedas,
      dia: input.diaUtc,
    });
    return { ok: true as const, saldo: input.monedas };
  }
  async jugar(): Promise<{ ok: boolean; animo: number; nivel: number }> {
    throw new Error("no se usa");
  }
  async usarJuguete(): Promise<{
    ok: boolean;
    animo: number;
    juguetesHoy: number;
  }> {
    throw new Error("no se usa");
  }
  async nombrar(): Promise<boolean> {
    throw new Error("no se usa");
  }
  async corral(): Promise<readonly PetState[]> {
    return this.filas;
  }
  async paraElTick(
    antesDe: Date,
    limite: number,
  ): Promise<readonly PetState[]> {
    return this.filas.filter((fila) => fila.vistaEn < antesDe).slice(0, limite);
  }
  async mejorDelUsuario(): Promise<PetState | null> {
    throw new Error("no se usa");
  }
  async protegerA(): Promise<boolean> {
    throw new Error("no se usa");
  }
  async quienProtegeA(): Promise<PetState | null> {
    throw new Error("no se usa");
  }
  async apuntarRobado(): Promise<void> {
    throw new Error("no se usa");
  }
  async devolverRobado(input: {
    id: string;
    monedas: number;
    diaUtc: string;
  }): Promise<{ ok: boolean }> {
    const clave = `${input.id}:${input.diaUtc}`;
    if (this.devueltosPorDia.has(clave)) {
      return { ok: false };
    }
    this.devueltosPorDia.add(clave);
    this.devoluciones.push({ id: input.id, monedas: input.monedas });
    return { ok: true };
  }
  async enfermar(): Promise<boolean> {
    throw new Error("no se usa");
  }
  async operar(): Promise<{ ok: false; motivo: "sinMascota"; saldo: number }> {
    throw new Error("no se usa");
  }
  // Estos dos SI funcionan: son los que usa el barrido, y un doble que lance
  // no probaria nada de lo que este fichero existe para probar.
  async fallecer(id: string, cuando: Date): Promise<boolean> {
    const i = this.filas.findIndex(
      (fila) =>
        fila.id === id &&
        fila.enfermaDesde !== null &&
        fila.fallecidaEn === null,
    );
    if (i < 0) {
      return false;
    }
    const fila = this.filas[i];
    if (!fila) {
      return false;
    }
    this.filas[i] = { ...fila, fallecidaEn: cuando };
    this.muertas.push(id);
    return true;
  }
  async sanar(): Promise<boolean> {
    throw new Error("no se usa");
  }
  async revivir(): Promise<boolean> {
    throw new Error("no se usa");
  }
  async marcarAvisos(
    id: string,
    deQue: number,
    aQue: number,
  ): Promise<boolean> {
    const i = this.filas.findIndex(
      (fila) =>
        fila.id === id &&
        fila.curaAvisos === deQue &&
        fila.enfermaDesde !== null,
    );
    if (i < 0) {
      return false;
    }
    const fila = this.filas[i];
    if (!fila) {
      return false;
    }
    this.filas[i] = { ...fila, curaAvisos: aQue };
    return true;
  }
  async enfermasDelGrupo(): Promise<readonly PetState[]> {
    throw new Error("no se usa");
  }
}

const encendido = async () => ({ ...AJUSTES_POR_DEFECTO, activo: true });
const apagado = async () => ({ ...AJUSTES_POR_DEFECTO, activo: false });

describe("el dia UTC", () => {
  it("es la fecha sin la hora: lo que va al refId del libro mayor", () => {
    expect(diaUtcDe(AHORA)).toBe("2026-08-28");
  });

  it("no cambia dentro del mismo dia", () => {
    expect(diaUtcDe(new Date("2026-08-28T00:00:01Z"))).toBe(
      diaUtcDe(new Date("2026-08-28T23:59:59Z")),
    );
  });
});

describe("la tirada del dia", () => {
  it("es la misma para la misma mascota y el mismo dia", () => {
    // Si cambiara entre reintentos, un pago idempotente podria anotar una
    // cantidad y recomputar otra.
    expect(tiradaDelDia("p1", "2026-08-28")).toBe(
      tiradaDelDia("p1", "2026-08-28"),
    );
  });

  it("cambia de un dia a otro y de una mascota a otra", () => {
    expect(tiradaDelDia("p1", "2026-08-28")).not.toBe(
      tiradaDelDia("p1", "2026-08-29"),
    );
    expect(tiradaDelDia("p1", "2026-08-28")).not.toBe(
      tiradaDelDia("p2", "2026-08-28"),
    );
  });

  it("cae siempre dentro de [0,1)", () => {
    for (let i = 0; i < 200; i += 1) {
      const t = tiradaDelDia(`p${i}`, "2026-08-28");
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
    }
  });
});

describe("el tick", () => {
  it("le pasa el tiempo y guarda el reloj", async () => {
    const repo = new RepoFalso([mascota()]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.miradas).toBe(1);
    const guardado = repo.guardados.get("p1");
    // 24 h al ritmo de desgaste que este puesto.
    expect(guardado?.hambre).toBe(100 - 24 * HAMBRE_POR_HORA);
    expect(guardado?.vistaEn).toEqual(AHORA);
  });

  it("paga el rendimiento del dia", async () => {
    const repo = new RepoFalso([mascota()]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.pagadas).toBe(1);
    expect(resumen.monedas).toBeGreaterThan(0);
  });

  it("no paga dos veces el mismo dia aunque el tick se repita", async () => {
    // LA propiedad: sin ella, reiniciar el worker imprime dinero.
    const repo = new RepoFalso([mascota()]);
    const contexto = {
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    };
    await procesarTickDeMascotas(contexto);
    const segunda = await procesarTickDeMascotas(contexto);
    expect(segunda.pagadas).toBe(0);
    expect(repo.pagos).toHaveLength(1);
  });

  it("no reparte XP dos veces el mismo dia aunque el tick se repita", async () => {
    // LA propiedad, y costo un fallo en produccion descubrirla: este barrido
    // corre cada quince minutos, asi que sin la marca `xpDia` la XP se
    // repartia 96 veces al dia. El 2026-08-28 hubo mascotas a nivel 3 con 110
    // XP tres horas despues de nacer, cuando les tocaba 0.
    const bienCuidada = { xp: 0, vistaEn: new Date(AHORA.getTime() - HORA) };
    const repo = new RepoFalso([mascota(bienCuidada)]);
    const contexto = { mascotas: repo, ajustesDeChat: encendido, ahora: AHORA };

    await procesarTickDeMascotas(contexto);
    const primera = repo.guardados.get("p1");
    // Se afirma la PROPIEDAD, no la cifra: cuanto suma un dia es cosa de
    // `nivel.ts` y de sus tests, y clavarlo aqui obligaria a ampliar la API
    // publica del modulo solo para este fichero.
    const ganado = primera?.xp ?? 0;
    expect(ganado).toBeGreaterThan(0);
    expect(primera?.xpDia).toBe(diaUtcDe(AHORA));

    // La segunda pasada del MISMO dia no suma. Se le devuelve la fila ya
    // marcada, que es lo que haria la base de datos.
    const repoSegundo = new RepoFalso([
      mascota({ ...bienCuidada, xp: ganado, xpDia: diaUtcDe(AHORA) }),
    ]);
    await procesarTickDeMascotas({ ...contexto, mascotas: repoSegundo });
    expect(repoSegundo.guardados.get("p1")?.xp).toBe(ganado);
  });

  it("al dia siguiente si vuelve a sumar", async () => {
    // El arreglo no puede pasarse de frenada y congelar la progresion.
    const ayer = new Date(AHORA.getTime() - 24 * HORA);
    const YA_TENIA = 10;
    const repo = new RepoFalso([
      mascota({
        xp: YA_TENIA,
        xpDia: diaUtcDe(ayer),
        vistaEn: new Date(AHORA.getTime() - HORA),
      }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.xp ?? 0).toBeGreaterThan(YA_TENIA);
    expect(repo.guardados.get("p1")?.xpDia).toBe(diaUtcDe(AHORA));
  });

  it("una mascota con hambre no gana XP, pero el dia se le cierra igual", async () => {
    // Si no se marcara, volveria a intentarlo cada quince minutos y bastaria
    // con darle de comer a media tarde para cobrar el dia entero.
    const repo = new RepoFalso([mascota({ xp: 0, hambre: 10 })]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.xp).toBe(0);
    expect(repo.guardados.get("p1")?.xpDia).toBe(diaUtcDe(AHORA));
  });

  it("una dormida no cobra nada", async () => {
    const repo = new RepoFalso([
      mascota({ hambre: 5, vistaEn: new Date(AHORA.getTime() - 48 * HORA) }),
    ]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.dormidas).toBe(1);
    expect(resumen.pagadas).toBe(0);
  });

  it("con el grupo apagado le pasa el tiempo pero no le paga", async () => {
    // El hambre no se congela porque un admin toque un interruptor: si al
    // volver a encenderlo el bicho siguiera como estaba, apagar seria una forma
    // de guardar la mascota en el congelador.
    const repo = new RepoFalso([mascota()]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: apagado,
      ahora: AHORA,
    });
    expect(resumen.miradas).toBe(1);
    expect(resumen.pagadas).toBe(0);
    expect(repo.guardados.get("p1")?.hambre).toBe(100 - 24 * HAMBRE_POR_HORA);
  });

  it("solo mira las que llevan sin revisarse el rato declarado", async () => {
    const reciente = mascota({
      id: "reciente",
      vistaEn: new Date(AHORA.getTime() - 60_000),
    });
    const olvidada = mascota({
      id: "olvidada",
      userTelegramId: 2n,
      vistaEn: new Date(AHORA.getTime() - 10 * HORA),
    });
    const repo = new RepoFalso([reciente, olvidada]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.miradas).toBe(1);
    expect(repo.guardados.has("olvidada")).toBe(true);
    expect(repo.guardados.has("reciente")).toBe(false);
    expect(MINUTOS_ENTRE_REVISIONES).toBeGreaterThan(1);
  });

  it("respeta el tamaño del lote", async () => {
    const muchas = Array.from({ length: 10 }, (_, i) =>
      mascota({ id: `p${i}`, userTelegramId: BigInt(i + 1) }),
    );
    const resumen = await procesarTickDeMascotas({
      mascotas: new RepoFalso(muchas),
      ajustesDeChat: encendido,
      ahora: AHORA,
      limite: 3,
    });
    expect(resumen.miradas).toBe(3);
  });

  it("una mascota rota no deja sin comer a las demas", async () => {
    const rota = mascota({ id: "rota" });
    const sana = mascota({ id: "sana", userTelegramId: 2n });
    const repo = new RepoFalso([rota, sana]);
    repo.fallaAl = "rota";
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.miradas).toBe(1);
    expect(repo.guardados.has("sana")).toBe(true);
  });

  it("una especie que ya no existe en el catalogo no tumba el barrido", async () => {
    const repo = new RepoFalso([mascota({ especie: "grifo-que-no-existe" })]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.miradas).toBe(1);
    expect(resumen.pagadas).toBe(0);
    // Y se le sigue pasando el tiempo: no se queda congelada.
    expect(repo.guardados.get("p1")?.vistaEn).toEqual(AHORA);
  });

  it("el dormilon aguanta mas que uno normal en el mismo barrido", async () => {
    const normal = mascota({ id: "normal" });
    const dormilon = mascota({
      id: "dormilon",
      userTelegramId: 2n,
      rasgos: ["dormilon"],
    });
    const repo = new RepoFalso([normal, dormilon]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    const a = repo.guardados.get("normal")?.hambre ?? 0;
    const b = repo.guardados.get("dormilon")?.hambre ?? 0;
    expect(b).toBeGreaterThan(a);
  });
});

describe("es de noche", () => {
  it("de madrugada si, a mediodia no", () => {
    // La franja va en hora peninsular, que es donde vive el grupo.
    expect(esDeNoche(new Date("2026-08-29T01:00:00Z"))).toBe(true); // 03:00
    expect(esDeNoche(new Date("2026-08-29T10:00:00Z"))).toBe(false); // 12:00
  });

  it("los bordes caen donde deben", () => {
    expect(esDeNoche(new Date("2026-08-29T21:00:00Z"))).toBe(true); // 23:00
    expect(esDeNoche(new Date("2026-08-29T20:59:00Z"))).toBe(false); // 22:59
    expect(esDeNoche(new Date("2026-08-29T04:59:00Z"))).toBe(true); // 06:59
    expect(esDeNoche(new Date("2026-08-29T05:00:00Z"))).toBe(false); // 07:00
  });
});

describe("el contexto del grupo", () => {
  it("se pide UNA vez por grupo aunque haya varias mascotas", async () => {
    // Sin la cache serian dos consultas por mascota en vez de dos por grupo.
    let vecesEspecies = 0;
    let vecesLimpios = 0;
    const repo = new RepoFalso([
      mascota({ id: "p1", vistaEn: new Date(AHORA.getTime() - HORA) }),
      mascota({ id: "p2", vistaEn: new Date(AHORA.getTime() - HORA) }),
      mascota({ id: "p3", vistaEn: new Date(AHORA.getTime() - HORA) }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
      especiesDelGrupo: async () => {
        vecesEspecies += 1;
        return { abeja: 3 };
      },
      diasLimpiosDelGrupo: async () => {
        vecesLimpios += 1;
        return 5;
      },
    });
    expect(vecesEspecies).toBe(1);
    expect(vecesLimpios).toBe(1);
  });

  it("un proveedor que falla no deja al bicho sin comer", async () => {
    // Un bonus que no se puede calcular no vale una mascota sin procesar.
    const repo = new RepoFalso([mascota()]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
      especiesDelGrupo: async () => {
        throw new Error("la base se cayo");
      },
      diasLimpiosDelGrupo: async () => {
        throw new Error("la base se cayo");
      },
    });
    expect(resumen.miradas).toBe(1);
    expect(repo.guardados.get("p1")).toBeDefined();
  });

  it("sin proveedores el barrido sigue funcionando igual que antes", async () => {
    // Son opcionales a proposito: quien no los pase deja a esas especies en su
    // caso base, que es lo que hacian TODAS hasta hoy.
    const repo = new RepoFalso([mascota()]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.miradas).toBe(1);
  });
});

describe("el cierre mira lo mejor del dia, no la hora del barrido", () => {
  const hoy = diaUtcDe(AHORA);

  it("un bicho cuidado por la tarde cobra aunque llegue con hambre al cierre", async () => {
    // ESTE es el arreglo del 2026-09-02. El cierre corre en el primer barrido
    // pasada la medianoche UTC —las dos de la madrugada en España—, y hasta
    // hoy preguntaba por el hambre de ESE instante. Quien le daba de comer
    // toda la tarde llegaba a las dos con la barra ya baja y se quedaba sin
    // XP: se pagaba el horario y no el cuidado.
    const repo = new RepoFalso([
      mascota({
        hambre: 20,
        xp: 0,
        hambreMax: 95,
        hambreMaxDia: hoy,
        vistaEn: new Date(AHORA.getTime() - HORA),
      }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.xp).toBe(XP_POR_DIA_CUIDADO);
  });

  it("un maximo de OTRO dia no cuela: el de ayer no paga el de hoy", async () => {
    // Sin la fecha al lado, un maximo viejo regalaria un dia cuidado a quien
    // lleva la mascota dormida desde ayer. Es el mismo motivo por el que
    // `racionesHoy` va con `racionesDia`.
    const repo = new RepoFalso([
      mascota({
        hambre: 20,
        xp: 0,
        hambreMax: 95,
        hambreMaxDia: "2026-08-27",
        vistaEn: new Date(AHORA.getTime() - HORA),
      }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.xp).toBe(0);
  });

  it("el maximo se refresca en cada revision, tambien sin cerrar dia", async () => {
    const repo = new RepoFalso([
      mascota({
        hambre: 80,
        xpDia: hoy,
        hambreMax: 0,
        hambreMaxDia: null,
        vistaEn: new Date(AHORA.getTime() - HORA),
      }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    const guardado = repo.guardados.get("p1");
    expect(guardado?.hambreMaxDia).toBe(hoy);
    expect(guardado?.hambreMax).toBe(78);
  });

  it("una revision posterior no baja el maximo que ya habia", async () => {
    // El barrido solo BAJA la barra, asi que si el maximo dependiera de el
    // nunca veria el pico que dejo una racion.
    const repo = new RepoFalso([
      mascota({
        hambre: 30,
        xpDia: hoy,
        hambreMax: 90,
        hambreMaxDia: hoy,
        vistaEn: new Date(AHORA.getTime() - HORA),
      }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.hambreMax).toBe(90);
  });
});

describe("el camaleon, que copia al vecino del corral", () => {
  it("copia el bono del siguiente de la lista", () => {
    // La abeja declara `renta` con factor 1.3.
    expect(
      factorDelVecinoEnElCorral(["camaleon", "abeja"], "camaleon", 0.5),
    ).toBe(1.3);
  });

  it("si es el ultimo, mira al anterior", () => {
    expect(
      factorDelVecinoEnElCorral(["abeja", "camaleon"], "camaleon", 0.5),
    ).toBe(1.3);
  });

  it("en un corral de uno no hay a quien copiar", () => {
    expect(
      factorDelVecinoEnElCorral(["camaleon"], "camaleon", 0.5),
    ).toBeUndefined();
  });

  it("un camaleon NUNCA copia a otro camaleon", () => {
    // Sin este corte, dos seguidos se copiarian el uno al otro para siempre y
    // con tres podria montarse un ciclo.
    expect(
      factorDelVecinoEnElCorral(["camaleon", "camaleon"], "camaleon", 0.5),
    ).toBeUndefined();
  });

  it("una especie retirada del catalogo no rompe el barrido", () => {
    expect(
      factorDelVecinoEnElCorral(["camaleon", "bicho-viejo"], "camaleon", 0.5),
    ).toBeUndefined();
  });

  it("copia el bono propio del vecino, no su situacion", () => {
    // La hormiga rinde mas cuantas mas hormigas haya. Copiarle su contexto
    // seria heredar unas compañeras que no son del camaleon: lo que se copia
    // es su caso base.
    const conCompaneras = factorDelVecinoEnElCorral(
      ["camaleon", "hormiga"],
      "camaleon",
      0.5,
    );
    expect(conCompaneras).toBe(0.6);
  });
});

describe("lo robado que vuelve solo", () => {
  // El caracol es quien declara `recuperaRobado`, un 20% al dia.
  const conDeuda = (robadoPendiente: number) =>
    mascota({
      especie: "caracol",
      robadoPendiente,
      vistaEn: new Date(AHORA.getTime() - HORA),
    });

  it("le devuelve una parte de lo que le robaron", async () => {
    const repo = new RepoFalso([conDeuda(1000)]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.recuperadas).toBe(1);
    expect(repo.devoluciones[0]?.monedas).toBe(200);
  });

  it("no devuelve dos veces el mismo dia aunque el tick se repita", async () => {
    // Misma propiedad que el rendimiento, y por el mismo motivo: el barrido
    // corre cada quince minutos.
    const repo = new RepoFalso([conDeuda(1000)]);
    const contexto = { mascotas: repo, ajustesDeChat: encendido, ahora: AHORA };
    await procesarTickDeMascotas(contexto);
    const segunda = await procesarTickDeMascotas(contexto);
    expect(segunda.recuperadas).toBe(0);
    expect(repo.devoluciones).toHaveLength(1);
  });

  it("una deuda pequeña acaba en cero en vez de quedarse encallada", async () => {
    // Con `floor`, un pendiente de 4 y un 20% devolverian 0 para siempre y la
    // deuda no bajaria nunca.
    const repo = new RepoFalso([conDeuda(4)]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.devoluciones[0]?.monedas).toBeGreaterThan(0);
  });

  it("nunca devuelve mas de lo que le deben", async () => {
    const repo = new RepoFalso([conDeuda(2)]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.devoluciones[0]?.monedas).toBeLessThanOrEqual(2);
  });

  it("una especie sin ese efecto no recupera nada", async () => {
    const repo = new RepoFalso([
      mascota({
        especie: "gato",
        robadoPendiente: 1000,
        vistaEn: new Date(AHORA.getTime() - HORA),
      }),
    ]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.recuperadas).toBe(0);
    expect(repo.devoluciones).toEqual([]);
  });

  it("sin deuda no se llama al repositorio siquiera", async () => {
    const repo = new RepoFalso([conDeuda(0)]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.devoluciones).toEqual([]);
  });
});

describe("el parte de las subidas de anoche", () => {
  const casiNivel2 = {
    xp: 10,
    vistaEn: new Date(AHORA.getTime() - HORA),
  };

  it("va en UN mensaje por grupo, no en uno por mascota", async () => {
    // El cierre corre a las dos de la madrugada: un mensaje por mascota en un
    // grupo con cuarenta bichos es la misma forma de incidente que los cuatro
    // `@all` sin cooldown del 21 de agosto.
    const repo = new RepoFalso([
      mascota({ ...casiNivel2, id: "p1" }),
      mascota({ ...casiNivel2, id: "p2", userTelegramId: 2n }),
      mascota({ ...casiNivel2, id: "p3", userTelegramId: 3n }),
    ]);
    const avisos: unknown[] = [];
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: async () => ({ activo: true, avisos: true }),
      ahora: AHORA,
      anunciar: async (aviso) => {
        avisos.push(aviso);
      },
    });
    expect(avisos).toHaveLength(1);
  });

  it("no dice nada si el grupo no ha pedido avisos", async () => {
    const repo = new RepoFalso([mascota(casiNivel2)]);
    const avisos: unknown[] = [];
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
      anunciar: async (aviso) => {
        avisos.push(aviso);
      },
    });
    expect(avisos).toEqual([]);
    // Pero la metrica SI cuenta la subida: mide lo que pasa, no lo que se
    // cuenta.
    expect(resumen.subidas).toBe(1);
  });

  it("un fallo al anunciar no tumba el barrido ni deshace la XP", async () => {
    // La XP ya esta guardada y volver a pasar por aqui no la daria otra vez,
    // asi que lanzar solo conseguiria que BullMQ reintentara lo ya hecho.
    const repo = new RepoFalso([mascota(casiNivel2)]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: async () => ({ activo: true, avisos: true }),
      ahora: AHORA,
      anunciar: async () => {
        throw new Error("Telegram no contesta");
      },
    });
    expect(resumen.subidas).toBe(1);
    expect(repo.guardados.get("p1")?.xp).toBe(10 + XP_POR_DIA_CUIDADO);
  });
});

describe("la racha en el barrido", () => {
  const bienCuidada = { vistaEn: new Date(AHORA.getTime() - HORA), xp: 0 };

  it("el primer dia cerrado la pone a uno", async () => {
    const repo = new RepoFalso([mascota(bienCuidada)]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.racha).toBe(1);
  });

  it("un dia seguido del anterior suma", async () => {
    const ayer = diaUtcDe(new Date(AHORA.getTime() - 24 * HORA));
    const repo = new RepoFalso([
      mascota({ ...bienCuidada, racha: 4, xpDia: ayer }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.racha).toBe(5);
  });

  it("un hueco la reinicia", async () => {
    const repo = new RepoFalso([
      mascota({ ...bienCuidada, racha: 12, xpDia: "2026-08-01" }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.racha).toBe(1);
  });

  it("un bicho con hambre la rompe del todo", async () => {
    // 40 h sin comer dejan el hambre en 20, por debajo del minimo para XP.
    // Eran 24 h hasta que el desgaste bajo de 3 a 2 por hora: con el nuevo
    // ritmo, un dia entero sin comer todavia deja la barra por encima de la
    // mitad, que es justo el punto de la calibracion.
    const repo = new RepoFalso([
      mascota({
        racha: 9,
        vistaEn: new Date(AHORA.getTime() - 40 * HORA),
      }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.guardados.get("p1")?.racha).toBe(0);
  });

  it("no se toca en las revisiones que no cierran dia", async () => {
    const hoy = diaUtcDe(AHORA);
    const repo = new RepoFalso([
      mascota({ ...bienCuidada, racha: 7, xpDia: hoy }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    // Sin `racha` en lo guardado, el repositorio no escribe la columna.
    expect(repo.guardados.get("p1")?.racha).toBeUndefined();
  });
});
describe("la enfermedad grave", () => {
  const enferma = (parcial: Partial<PetState> = {}): PetState =>
    mascota({
      enfermaDesde: new Date(AHORA.getTime() - 70 * HORA),
      enfermaMotivo: "colico",
      curaCoste: 499_997_500,
      curaResto: 2_500,
      curaVence: new Date(AHORA.getTime() + 2 * HORA),
      curaAvisos: 0,
      ...parcial,
    });

  it("la mata cuando se le pasa el plazo", async () => {
    const repo = new RepoFalso([
      enferma({ curaVence: new Date(AHORA.getTime() - 1) }),
    ]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.muertas).toEqual(["p1"]);
    expect(resumen.fallecidas).toBe(1);
  });

  it("una muerta no cobra el dia ni gana XP", async () => {
    // Es el motivo de que la salud vaya ANTES que nada en el bucle: pagarle el
    // rendimiento a un bicho que ya no esta seria imprimir dinero por una fila
    // muerta.
    const repo = new RepoFalso([
      enferma({ curaVence: new Date(AHORA.getTime() - 1) }),
    ]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(resumen.pagadas).toBe(0);
    expect(resumen.monedas).toBe(0);
    expect(repo.guardados.get("p1")).toBeUndefined();
  });

  it("dentro de plazo no la mata", async () => {
    const repo = new RepoFalso([enferma()]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
    });
    expect(repo.muertas).toEqual([]);
    expect(resumen.fallecidas).toBe(0);
  });

  it("apagar la feature congela la ejecucion de la sentencia", async () => {
    // Que un interruptor de grupo siga matando mascotas es lo unico peor que
    // no tener interruptor.
    const repo = new RepoFalso([
      enferma({ curaVence: new Date(AHORA.getTime() - 1) }),
    ]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: apagado,
      ahora: AHORA,
    });
    expect(repo.muertas).toEqual([]);
    expect(resumen.fallecidas).toBe(0);
  });

  it("avisa una vez por umbral y no noventa y seis", async () => {
    // El barrido corre cada quince minutos. Sin la marca `curaAvisos`, el mismo
    // recordatorio saldria en cada revision: es el fallo que tuvo la XP el
    // 2026-08-28, aqui evitado antes de llegar a produccion.
    const avisos: string[] = [];
    const repo = new RepoFalso([enferma()]);
    const contexto = {
      mascotas: repo,
      ajustesDeChat: encendido,
      avisarDeSalud: async (aviso: { clase: string }) => {
        avisos.push(aviso.clase);
      },
    };
    await procesarTickDeMascotas({ ...contexto, ahora: AHORA });
    // Los dos umbrales han pasado ya (quedan 2 h), asi que sale UN aviso que
    // deja el contador en 2.
    expect(avisos).toEqual(["recordatorio"]);

    // La segunda revision, quince minutos despues, no vuelve a avisar.
    await procesarTickDeMascotas({
      ...contexto,
      ahora: new Date(AHORA.getTime() + 15 * 60_000),
    });
    expect(avisos).toEqual(["recordatorio"]);
  });

  it("el aviso de la muerte sale con quien era su dueño", async () => {
    const avisos: { clase: string; usuario: bigint }[] = [];
    const repo = new RepoFalso([
      enferma({ curaVence: new Date(AHORA.getTime() - 1) }),
    ]);
    await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
      avisarDeSalud: async (aviso) => {
        avisos.push({ clase: aviso.clase, usuario: aviso.usuario });
      },
    });
    expect(avisos).toEqual([{ clase: "muerte", usuario: 1n }]);
  });

  it("que falle el aviso no para el barrido", async () => {
    // Telegram se cae, o el chat ya no existe. Las demas mascotas tienen que
    // comer igual.
    const repo = new RepoFalso([
      enferma({ curaVence: new Date(AHORA.getTime() - 1) }),
    ]);
    const resumen = await procesarTickDeMascotas({
      mascotas: repo,
      ajustesDeChat: encendido,
      ahora: AHORA,
      avisarDeSalud: async () => {
        throw new Error("Telegram no contesta");
      },
    });
    expect(repo.muertas).toEqual(["p1"]);
    expect(resumen.fallecidas).toBe(1);
  });
});
