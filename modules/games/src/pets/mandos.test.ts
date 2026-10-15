import { describe, expect, it } from "vitest";

import {
  cuentaParaElBalance,
  esCampoDeMascota,
  leerMando,
  marcaComoRegalada,
  pideSerPropietario,
  resumirParaAuditoria,
  TOPE_DE_MANDOS_DIARIOS,
} from "./mandos.js";

const A = 12345n;

// Ojo con el default: en JS se activa tambien al pasar `undefined` a proposito,
// asi que el caso "sin objetivo" hay que pedirlo con una bandera y no pasando
// undefined. Ese descuido hizo pasar el test que probaba justo eso.
const leer = (linea: string, sinObjetivo = false) =>
  leerMando(linea.split(" ").filter(Boolean), sinObjetivo ? undefined : A);

describe("entender el mando", () => {
  it("sin subcomando no hace nada", () => {
    const salida = leer("");
    expect(salida.ok).toBe(false);
    expect(salida.ok === false && salida.error).toBe("sinSubcomando");
  });

  it("sin objetivo tampoco: hay que responder a alguien", () => {
    const salida = leer("ver", true);
    expect(salida.ok === false && salida.error).toBe("sinObjetivo");
  });

  it("un subcomando inventado se rechaza en vez de adivinarse", () => {
    expect(leer("regalar").ok).toBe(false);
  });

  it("ver no pide nada mas", () => {
    const salida = leer("ver");
    expect(salida.ok && salida.mando.tipo).toBe("ver");
  });
});

describe("dar un huevo", () => {
  it("sin familia vale: es el caso normal", () => {
    const salida = leer("huevo");
    expect(salida.ok && salida.mando.tipo).toBe("huevo");
  });

  it("con familia, si existe", () => {
    const salida = leer("huevo sombra");
    if (!salida.ok || salida.mando.tipo !== "huevo") {
      throw new Error("deberia ser un huevo");
    }
    expect(salida.mando.familia).toBe("sombra");
  });

  it("una familia inventada se rechaza", () => {
    expect(leer("huevo pokemon").ok).toBe(false);
  });

  it("NO pide motivo: no hay nada que justificar", () => {
    // Un huevo sale por el mismo commit-reveal que el de cualquiera. Pedir
    // motivo para regalar una tirada seria burocracia sin nada detras.
    expect(leer("huevo").ok).toBe(true);
  });
});

describe("dar un bicho concreto", () => {
  it("pide especie del catalogo y motivo", () => {
    const salida = leer("dar dragon compensacion por el fallo del martes");
    if (!salida.ok || salida.mando.tipo !== "dar") {
      throw new Error("deberia ser un dar");
    }
    expect(salida.mando.especie).toBe("dragon");
    expect(salida.mando.razon).toContain("martes");
  });

  it("sin motivo NO corre", () => {
    // Es la salvaguarda que permite contestar dentro de seis meses a "¿y ese
    // por que tiene un dragon?".
    expect(leer("dar dragon").ok === false).toBe(true);
    const salida = leer("dar dragon");
    expect(salida.ok === false && salida.error).toBe("sinRazon");
  });

  it("una especie que no existe se rechaza", () => {
    expect(leer("dar unicornio porque si").ok).toBe(false);
  });
});

describe("tocar los numeros", () => {
  it("acepta los cuatro campos", () => {
    for (const campo of ["hambre", "animo", "nivel", "xp"]) {
      expect(esCampoDeMascota(campo)).toBe(true);
      expect(leer(`set ${campo} 50 pruebas`).ok).toBe(true);
    }
  });

  it("rechaza un campo inventado", () => {
    expect(esCampoDeMascota("suerte")).toBe(false);
    expect(leer("set suerte 50 pruebas").ok).toBe(false);
  });

  it("el valor tiene que ser entero y no negativo", () => {
    expect(leer("set hambre -5 pruebas").ok).toBe(false);
    expect(leer("set hambre 3.5 pruebas").ok).toBe(false);
    expect(leer("set hambre mucho pruebas").ok).toBe(false);
  });

  it("sin motivo tampoco corre", () => {
    const salida = leer("set hambre 50");
    expect(salida.ok === false && salida.error).toBe("sinRazon");
  });
});

describe("quitar", () => {
  it("pide motivo, que borrar es lo mas serio de todo", () => {
    expect(leer("quitar").ok).toBe(false);
    expect(leer("quitar duplicado por el fallo").ok).toBe(true);
  });
});

describe("las salvaguardas", () => {
  it("dar marca el bicho como regalado; un huevo no", () => {
    // La distincion es lo que salva el sistema: lo que hay que marcar es la
    // especie elegida a dedo, no una tirada de suerte regalada.
    const dado = leer("dar dragon por el fallo");
    const huevo = leer("huevo");
    if (!dado.ok || !huevo.ok) {
      throw new Error("los dos deberian leerse");
    }
    expect(marcaComoRegalada(dado.mando)).toBe(true);
    expect(marcaComoRegalada(huevo.mando)).toBe(false);
  });

  it("nada de lo que da el creador cuenta para el balance", () => {
    // Si contara, las curvas de quemado y acuñado mentirian y ajustar los
    // precios con ellas seria adivinar con pasos extra.
    expect(cuentaParaElBalance()).toBe(false);
  });

  it("crear y borrar son del propietario; el resto le vale a un admin", () => {
    const dado = leer("dar lobo por lo del sabado");
    const quitado = leer("quitar duplicado");
    const huevo = leer("huevo");
    const set = leer("set hambre 80 se quedo sin comer por el fallo");
    if (!dado.ok || !quitado.ok || !huevo.ok || !set.ok) {
      throw new Error("todos deberian leerse");
    }
    expect(pideSerPropietario(dado.mando)).toBe(true);
    expect(pideSerPropietario(quitado.mando)).toBe(true);
    expect(pideSerPropietario(huevo.mando)).toBe(false);
    expect(pideSerPropietario(set.mando)).toBe(false);
  });

  it("hay tope diario, por si se pierde la cuenta o la sesion", () => {
    expect(TOPE_DE_MANDOS_DIARIOS).toBeGreaterThan(0);
    expect(TOPE_DE_MANDOS_DIARIOS).toBeLessThan(100);
  });

  it("el resumen para el registro lleva a quien y por que", () => {
    const salida = leer("dar cisne compensacion del 3 de septiembre");
    if (!salida.ok) {
      throw new Error("deberia leerse");
    }
    const linea = resumirParaAuditoria(salida.mando);
    expect(linea).toContain("cisne");
    expect(linea).toContain("12345");
    expect(linea).toContain("septiembre");
  });
});

describe("la enfermedad grave", () => {
  it("sin cifras usa las del grupo y se queda con el motivo entero", () => {
    const salida = leer("enfermar colico por listo");
    if (!salida.ok || salida.mando.tipo !== "enfermar") {
      throw new Error("deberia leerse como enfermar");
    }
    expect(salida.mando.resto).toBeUndefined();
    expect(salida.mando.horas).toBeUndefined();
    expect(salida.mando.razon).toBe("colico por listo");
  });

  it("lee el resto y el plazo cuando van delante", () => {
    const salida = leer("enfermar 2500 72h colico por listo");
    if (!salida.ok || salida.mando.tipo !== "enfermar") {
      throw new Error("deberia leerse como enfermar");
    }
    expect(salida.mando.resto).toBe(2500);
    expect(salida.mando.horas).toBe(72);
    expect(salida.mando.razon).toBe("colico por listo");
  });

  it("el orden de las dos cifras da igual", () => {
    const salida = leer("enfermar 24h 0 se lo ha buscado");
    if (!salida.ok || salida.mando.tipo !== "enfermar") {
      throw new Error("deberia leerse como enfermar");
    }
    expect(salida.mando.horas).toBe(24);
    // Cero es una cifra valida: "que no le quede nada".
    expect(salida.mando.resto).toBe(0);
  });

  it("la h separa el plazo del dinero", () => {
    // Sin la unidad, `enfermar 72 lo que sea` tiene dos lecturas plausibles y
    // hay que adivinar cual. Con ella, no.
    const dinero = leer("enfermar 72 lo que sea");
    if (!dinero.ok || dinero.mando.tipo !== "enfermar") {
      throw new Error("deberia leerse como enfermar");
    }
    expect(dinero.mando.resto).toBe(72);
    expect(dinero.mando.horas).toBeUndefined();
  });

  it("exige motivo, como todo lo que cambia algo", () => {
    expect(leer("enfermar").ok).toBe(false);
    expect(leer("enfermar 2500 72h").ok).toBe(false);
    const salida = leer("enfermar 2500 72h");
    expect(salida.ok === false && salida.error).toBe("sinRazon");
  });

  it("rechaza una cifra que no cabe en la columna", () => {
    const salida = leer("enfermar 99999999999 se lo ha buscado");
    expect(salida.ok === false && salida.error).toBe("cifraInvalida");
  });

  it("sanar y revivir tambien piden motivo", () => {
    // Dos llamadas distintas no estrechan el tipo, asi que se guarda una vez.
    // Vitest no typechequea: esto solo lo caza `tsc`.
    const sinMotivo = leer("sanar");
    expect(sinMotivo.ok === false && sinMotivo.error).toBe("sinRazon");
    const revivirSinMotivo = leer("revivir");
    expect(revivirSinMotivo.ok === false && revivirSinMotivo.error).toBe(
      "sinRazon",
    );
    const sanar = leer("sanar era broma");
    expect(sanar.ok && sanar.mando.tipo).toBe("sanar");
    const revivir = leer("revivir me he pasado");
    expect(revivir.ok && revivir.mando.tipo).toBe("revivir");
  });

  it("los tres son solo del propietario", () => {
    // Un admin de grupo modera. Firmar una factura que vacia una cartera y
    // puede acabar en una mascota muerta no es moderar.
    for (const linea of [
      "enfermar colico",
      "sanar era broma",
      "revivir me he pasado",
    ]) {
      const salida = leer(linea);
      if (!salida.ok) {
        throw new Error(`deberia leerse: ${linea}`);
      }
      expect(pideSerPropietario(salida.mando)).toBe(true);
    }
  });

  it("el registro deja escrito el plazo y el suelo", () => {
    const salida = leer("enfermar 2500 72h colico por listo");
    if (!salida.ok) {
      throw new Error("deberia leerse");
    }
    const linea = resumirParaAuditoria(salida.mando);
    expect(linea).toContain("12345");
    expect(linea).toContain("2500");
    expect(linea).toContain("72h");
    expect(linea).toContain("colico por listo");
  });

  it("no cuenta para el balance de la economia", () => {
    // Lo que quema una operacion SI cuenta —lo paga su dueño— pero declarar la
    // enfermedad no mueve una sola moneda.
    expect(cuentaParaElBalance()).toBe(false);
  });
});
