import { describe, expect, it } from "vitest";

import {
  atenderComandoDeMascotas,
  esComandoDeMascotas,
  fichaDeMascota,
  OTRO_SIN_MASCOTA,
  SIN_MASCOTA,
} from "./mascotas.js";
import type {
  EntradaDeCorral,
  MascotaVista,
  PuertoDeMascotas,
  SalidaDeHuevo,
  SalidaDeJuego,
  SalidaDeOperacion,
  SalidaDeProteger,
  SalidaDeRacion,
} from "./puertos.js";

const abeja: MascotaVista = {
  especie: "abeja",
  rasgos: ["dormilon"],
  nombre: null,
  hambre: 80,
  animo: 80,
  nivel: 3,
  xp: 60,
  racionesHoy: 0,
  regalada: false,
  salud: null,
};

const nombreDe = (usuario: bigint): string => `persona-${usuario}`;

class PuertoFalso implements PuertoDeMascotas {
  constructor(
    private readonly datos: {
      mia?: MascotaVista | null;
      otro?: MascotaVista | null;
      corral?: readonly EntradaDeCorral[];
      saldo?: number;
      racion?: SalidaDeRacion;
      huevo?: SalidaDeHuevo;
      juego?: SalidaDeJuego;
      nombrado?: boolean;
      proteccion?: SalidaDeProteger;
      operacion?: SalidaDeOperacion;
    } = {},
  ) {}
  async operar(): Promise<SalidaDeOperacion> {
    return (
      this.datos.operacion ?? {
        ok: false as const,
        motivo: "sanaYa" as const,
        coste: 0,
        saldo: 0,
      }
    );
  }
  async proteger(objetivo: bigint | null) {
    return this.datos.proteccion ?? { ok: true as const, objetivo };
  }
  async mia() {
    return this.datos.mia ?? null;
  }
  async deOtro() {
    return this.datos.otro ?? null;
  }
  async corral() {
    return this.datos.corral ?? [];
  }
  async saldo() {
    return this.datos.saldo ?? 0;
  }
  async alimentar() {
    return (
      this.datos.racion ?? {
        ok: false as const,
        motivo: "sinSaldo" as const,
        coste: 150,
        saldo: 0,
      }
    );
  }
  async nacer() {
    return (
      this.datos.huevo ?? {
        ok: false as const,
        motivo: "sinSaldo" as const,
        precio: 3000,
        saldo: 0,
      }
    );
  }
  nombresPuestos: string[] = [];
  async nombrar(nombre: string) {
    this.nombresPuestos.push(nombre);
    return this.datos.nombrado ?? true;
  }
  async jugar() {
    return (
      this.datos.juego ?? {
        ok: false as const,
        motivo: "sinMascota" as const,
      }
    );
  }
}

const atender = (
  comando: Parameters<typeof atenderComandoDeMascotas>[0]["comando"],
  puerto: PuertoDeMascotas,
  objetivo?: bigint,
  texto?: string,
) =>
  atenderComandoDeMascotas({
    comando,
    puerto,
    nombreDe,
    ...(objetivo === undefined ? {} : { objetivo }),
    ...(texto === undefined ? {} : { texto }),
  });

describe("que comandos son suyos", () => {
  it("reconoce los cinco y rechaza el resto", () => {
    expect(esComandoDeMascotas("mascota")).toBe(true);
    expect(esComandoDeMascotas("alimentar")).toBe(true);
    expect(esComandoDeMascotas("corral")).toBe(true);
    // `/robar` es de economia: contestarlo aqui se lo comeria, porque el
    // primer handler que responde corta la cadena.
    expect(esComandoDeMascotas("robar")).toBe(false);
    expect(esComandoDeMascotas(undefined)).toBe(false);
  });
});

describe("la ficha", () => {
  it("enseña la especie, las barras y el nivel", async () => {
    const texto = await atender("mascota", new PuertoFalso({ mia: abeja }));
    expect(texto).toContain("Abeja");
    expect(texto).toContain("Hambre");
    expect(texto).toContain("Ánimo");
    expect(texto).toContain("Nivel 3");
  });

  it("nombra los rasgos, que es lo que hace unico a cada bicho", async () => {
    const texto = await atender("mascota", new PuertoFalso({ mia: abeja }));
    expect(texto?.toLowerCase()).toContain("dormilón");
  });

  it("usa el mote cuando lo tiene", async () => {
    const texto = await atender(
      "mascota",
      new PuertoFalso({ mia: { ...abeja, nombre: "Pepita" } }),
    );
    expect(texto).toContain("Pepita");
  });

  it("una dormida lo dice y explica como despertarla", async () => {
    const texto = await atender(
      "mascota",
      new PuertoFalso({ mia: { ...abeja, hambre: 0 } }),
    );
    expect(texto).toContain("dormido");
    expect(texto).toContain("/alimentar");
  });

  it("marca las que regalo el creador", async () => {
    // Si el regalo fuera invisible, cualquier bicho del corral podria serlo y
    // todos perderian su valor a la vez.
    const texto = await atender(
      "mascota",
      new PuertoFalso({ mia: { ...abeja, regalada: true } }),
    );
    expect(texto).toContain("✦");
  });

  it("sin bicho, ofrece el primero gratis", async () => {
    expect(await atender("mascota", new PuertoFalso({ mia: null }))).toBe(
      SIN_MASCOTA,
    );
  });

  it("la de otro se nombra en tercera persona", async () => {
    const texto = await atender(
      "mascota",
      new PuertoFalso({ otro: abeja }),
      42n,
    );
    expect(texto).toContain("persona-42");
    expect(texto).not.toContain("Tu bicho");
  });

  it("preguntar por quien no tiene lo dice y ya", async () => {
    expect(await atender("mascota", new PuertoFalso({ otro: null }), 42n)).toBe(
      OTRO_SIN_MASCOTA,
    );
  });
});

/** Ganar XP sin cruzar nivel: el caso normal, y el que no debe anunciar nada. */
const SIN_SUBIR = {
  xpGanada: 3,
  nivel: 2,
  haSubido: false,
  evoluciona: false,
} as const;

describe("dar de comer", () => {
  it("dice lo que costo y como queda", async () => {
    const texto = await atender(
      "alimentar",
      new PuertoFalso({
        mia: abeja,
        racion: { ok: true, coste: 150, hambre: 100, progreso: SIN_SUBIR },
      }),
    );
    expect(texto).toContain("150");
    expect(texto).toContain("miga");
  });

  it("sin saldo dice cuanto falta, no solo que no puede", async () => {
    const texto = await atender(
      "alimentar",
      new PuertoFalso({
        mia: abeja,
        racion: { ok: false, motivo: "sinSaldo", coste: 150, saldo: 40 },
      }),
    );
    expect(texto).toContain("110");
  });

  it("con el tope gastado manda a mañana", async () => {
    const texto = await atender(
      "alimentar",
      new PuertoFalso({
        mia: abeja,
        racion: { ok: false, motivo: "topeDiario", coste: 150, saldo: 999 },
      }),
    );
    expect(texto).toContain("Mañana");
  });

  it("con la barra llena no manda a ganar monedas que no hacen falta", async () => {
    const texto = await atender(
      "alimentar",
      new PuertoFalso({
        mia: abeja,
        racion: { ok: false, motivo: "yaLlena", coste: 150, saldo: 0 },
      }),
    );
    expect(texto).toContain("lleno");
    expect(texto).not.toContain("Habla un rato");
  });

  it("sin bicho no intenta alimentar nada", async () => {
    expect(await atender("alimentar", new PuertoFalso({ mia: null }))).toBe(
      SIN_MASCOTA,
    );
  });
});

describe("el huevo", () => {
  it("anuncia la especie que ha salido", async () => {
    const texto = await atender(
      "huevo",
      new PuertoFalso({ huevo: { ok: true, especie: "zorro", gratis: true } }),
    );
    expect(texto).toContain("zorro");
    expect(texto).toContain("cuenta de la casa");
  });

  it("el segundo huevo no dice que es gratis", async () => {
    const texto = await atender(
      "huevo",
      new PuertoFalso({ huevo: { ok: true, especie: "buho", gratis: false } }),
    );
    expect(texto).not.toContain("cuenta de la casa");
  });

  it("con bicho ya, no vende otro", async () => {
    const texto = await atender(
      "huevo",
      new PuertoFalso({
        huevo: { ok: false, motivo: "yaTiene", precio: 3000, saldo: 9999 },
      }),
    );
    expect(texto).toContain("Ya tienes");
  });

  it("sin saldo dice el precio y lo que tiene", async () => {
    const texto = await atender(
      "huevo",
      new PuertoFalso({
        huevo: { ok: false, motivo: "sinSaldo", precio: 3000, saldo: 120 },
      }),
    );
    expect(texto).toContain("3000");
    expect(texto).toContain("120");
  });
});

describe("el corral", () => {
  it("vacio, invita al primero", async () => {
    const texto = await atender("corral", new PuertoFalso({ corral: [] }));
    expect(texto).toContain("/huevo");
    expect(texto).toContain("gratis");
  });

  it("lista con puesto, especie, nivel y dueño", async () => {
    const texto = await atender(
      "corral",
      new PuertoFalso({
        corral: [
          {
            usuario: 7n,
            especie: "zorro",
            nombre: null,
            nivel: 5,
            hambre: 90,
            regalada: false,
          },
          {
            usuario: 8n,
            especie: "abeja",
            nombre: "Pepita",
            nivel: 2,
            hambre: 10,
            regalada: true,
          },
        ],
      }),
    );
    expect(texto).toContain("1.");
    expect(texto).toContain("Zorro");
    expect(texto).toContain("Pepita");
    expect(texto).toContain("persona-7");
    expect(texto).toContain("nivel 5");
    // La marca de regalo tambien se ve en la lista.
    expect(texto).toContain("✦");
  });
});

describe("/jugar", () => {
  const bicho: MascotaVista = {
    especie: "perro",
    rasgos: [],
    nombre: null,
    hambre: 80,
    animo: 40,
    nivel: 2,
    xp: 25,
    racionesHoy: 0,
    regalada: false,
    salud: null,
  };

  it("dice cuanto ha subido y en cuanto se queda", async () => {
    const texto = await atender(
      "jugar",
      new PuertoFalso({
        mia: bicho,
        juego: { ok: true, animo: 55, subida: 15, progreso: SIN_SUBIR },
      }),
    );
    expect(texto).toContain("+15");
    expect(texto).toContain("55");
  });

  it("anuncia la subida de nivel, que antes no la contaba nadie", async () => {
    // `haSubido` se calculaba desde el primer dia y no lo leia nadie: el tick
    // lo contaba en su log y ahi moria. Subir de nivel en silencio no es subir
    // de nivel.
    const texto = await atender(
      "jugar",
      new PuertoFalso({
        mia: bicho,
        juego: {
          ok: true,
          animo: 55,
          subida: 15,
          progreso: { ...SIN_SUBIR, haSubido: true, nivel: 4 },
        },
      }),
    );
    expect(texto).toContain("nivel 4");
  });

  it("no dice nada de niveles cuando no ha subido", async () => {
    // La XP suelta no se enseña: un "+5 XP" en cada juego tapa lo unico que
    // importa del mensaje, que es como ha quedado el bicho.
    const texto = await atender(
      "jugar",
      new PuertoFalso({
        mia: bicho,
        juego: { ok: true, animo: 55, subida: 15, progreso: SIN_SUBIR },
      }),
    );
    expect(texto).not.toContain("nivel");
    expect(texto).not.toContain("XP");
  });

  it("al segundo intento del dia no finge que ha funcionado", async () => {
    const texto = await atender(
      "jugar",
      new PuertoFalso({ mia: bicho, juego: { ok: false, motivo: "yaHoy" } }),
    );
    expect(texto).toContain("Ya has jugado hoy");
    expect(texto).not.toContain("+15");
  });

  it("sin bicho responde lo mismo que el resto de comandos", async () => {
    const texto = await atender("jugar", new PuertoFalso({ mia: null }));
    expect(texto).toBe(SIN_MASCOTA);
  });

  it("recuerda que es gratis, porque es lo que nadie se espera", async () => {
    const texto = await atender(
      "jugar",
      new PuertoFalso({
        mia: bicho,
        juego: { ok: true, animo: 55, subida: 15, progreso: SIN_SUBIR },
      }),
    );
    expect(texto).toContain("gratis");
  });
});

describe("/nombrar", () => {
  const bicho: MascotaVista = {
    especie: "perro",
    rasgos: [],
    nombre: null,
    hambre: 80,
    animo: 70,
    nivel: 2,
    xp: 25,
    racionesHoy: 0,
    regalada: false,
    salud: null,
  };

  it("le pone el nombre y lo dice", async () => {
    const puerto = new PuertoFalso({ mia: bicho });
    const texto = await atender("nombrar", puerto, undefined, "Pelusa");
    expect(puerto.nombresPuestos).toEqual(["Pelusa"]);
    expect(texto).toContain("Pelusa");
  });

  it("limpia el nombre antes de guardarlo", async () => {
    const puerto = new PuertoFalso({ mia: bicho });
    await atender("nombrar", puerto, undefined, "  Don   Pepe ");
    expect(puerto.nombresPuestos).toEqual(["Don Pepe"]);
  });

  it("sin texto explica como se usa y NO toca la mascota", async () => {
    const puerto = new PuertoFalso({ mia: bicho });
    const texto = await atender("nombrar", puerto, undefined, "");
    expect(texto).toContain("/nombrar");
    expect(puerto.nombresPuestos).toEqual([]);
  });

  it("un nombre que rompe el HTML se rechaza sin guardarse", async () => {
    // Es la propiedad que importa: lo que llega a la base ya no puede romper
    // el mensaje de nadie.
    const puerto = new PuertoFalso({ mia: bicho });
    const texto = await atender("nombrar", puerto, undefined, "<b>Pelusa");
    expect(puerto.nombresPuestos).toEqual([]);
    expect(texto).not.toContain("<b>Pelusa");
  });

  it("sin bicho contesta lo mismo que el resto de comandos", async () => {
    const texto = await atender(
      "nombrar",
      new PuertoFalso({ mia: null }),
      undefined,
      "Pelusa",
    );
    expect(texto).toBe(SIN_MASCOTA);
  });

  it("si la base no lo guarda, no se miente diciendo que si", async () => {
    const texto = await atender(
      "nombrar",
      new PuertoFalso({ mia: bicho, nombrado: false }),
      undefined,
      "Pelusa",
    );
    expect(texto).toContain("No he podido");
  });

  it("el nombre puesto manda sobre el de la especie en la ficha", async () => {
    const ficha = fichaDeMascota({ ...bicho, nombre: "Pelusa" }, null);
    expect(ficha).toContain("Pelusa");
    expect(ficha).not.toContain("<b>Perro</b>");
  });
});
describe("la enfermedad grave", () => {
  const grave: MascotaVista = {
    especie: "caballo",
    rasgos: [],
    nombre: null,
    hambre: 80,
    animo: 70,
    nivel: 4,
    xp: 0,
    racionesHoy: 0,
    regalada: false,
    salud: {
      estado: "enferma",
      motivo: "colico",
      coste: 499_997_500,
      resto: 2_500,
      msQueQuedan: 50 * 3_600_000,
      msDeDuelo: 0,
    },
  };

  it("la ficha pone la dolencia DELANTE de las barras", async () => {
    // Lo primero que hay que leer es lo que hay que hacer. Una ficha que
    // empieza por barras y menciona de pasada que quedan horas cuenta otra
    // cosa.
    const texto = await atender("mascota", new PuertoFalso({ mia: grave }));
    const dondeLaFactura = texto?.indexOf("499.997.500") ?? -1;
    const dondeElHambre = texto?.indexOf("Hambre") ?? -1;
    expect(dondeLaFactura).toBeGreaterThan(-1);
    expect(dondeLaFactura).toBeLessThan(dondeElHambre);
  });

  it("la factura va con puntos de millar y dice como se paga", async () => {
    // Con nueve cifras, `499997500` y `49999750` se distinguen contando
    // digitos, y quien decide si paga no deberia tener que hacer eso.
    const texto = await atender("mascota", new PuertoFalso({ mia: grave }));
    expect(texto).toContain("499.997.500");
    expect(texto).toContain("/operar");
  });

  it("una muerta enseña la lapida y no las barras", async () => {
    const texto = await atender(
      "mascota",
      new PuertoFalso({
        mia: {
          ...grave,
          salud: {
            estado: "muerta",
            motivo: "colico",
            coste: 0,
            resto: 0,
            msQueQuedan: 0,
            msDeDuelo: 40 * 3_600_000,
          },
        },
      }),
    );
    expect(texto).toContain("🪦");
    expect(texto).not.toContain("Hambre");
    expect(texto).toContain("40 h");
  });

  it("el corral marca a la enferma y a la muerta", async () => {
    // Que se vea desde fuera es la mitad de la mecanica: una enfermedad que
    // solo conoce su dueño es una multa privada.
    const texto = await atender(
      "corral",
      new PuertoFalso({
        corral: [
          {
            usuario: 1n,
            especie: "caballo",
            nombre: null,
            nivel: 4,
            hambre: 90,
            regalada: false,
            estadoDeSalud: "enferma",
          },
          {
            usuario: 2n,
            especie: "abeja",
            nombre: null,
            nivel: 2,
            hambre: 90,
            regalada: false,
            estadoDeSalud: "muerta",
          },
        ],
      }),
    );
    expect(texto).toContain("🩺");
    expect(texto).toContain("🪦");
  });

  it("/operar dice lo que se ha ido y lo que queda", async () => {
    const texto = await atender(
      "operar",
      new PuertoFalso({
        mia: grave,
        operacion: { ok: true, pagado: 499_997_500, saldo: 2_500 },
      }),
    );
    expect(texto).toContain("499.997.500");
    expect(texto).toContain("2.500");
  });

  it("pagar dos veces no dice que no te llega", async () => {
    // Es la respuesta al segundo /operar de dos seguidos. Decir "no te llega"
    // mandaria a alguien a buscar dinero que ya ha pagado.
    const texto = await atender(
      "operar",
      new PuertoFalso({
        mia: grave,
        operacion: {
          ok: false,
          motivo: "yaCurada",
          coste: 100,
          saldo: 50,
        },
      }),
    );
    expect(texto).toContain("No se cobra dos veces");
  });

  it("fuera de plazo lo dice claro y no habla de dinero", async () => {
    const texto = await atender(
      "operar",
      new PuertoFalso({
        mia: grave,
        operacion: {
          ok: false,
          motivo: "fueraDePlazo",
          coste: 100,
          saldo: 50,
        },
      }),
    );
    expect(texto).toContain("plazo");
  });
});
