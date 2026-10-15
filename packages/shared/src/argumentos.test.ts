import { describe, expect, it } from "vitest";

import {
  decimalDelArgumento,
  enteroDelArgumento,
  paresClaveValor,
  siONo,
  tresEnteros,
} from "./argumentos.js";

describe("enteroDelArgumento", () => {
  it("convierte lo que es un entero", () => {
    expect(enteroDelArgumento("42")).toBe(42);
    expect(enteroDelArgumento("-7")).toBe(-7);
  });

  it("lo que no lo es da null, no NaN", () => {
    // NaN se propaga en silencio si a alguien se le olvida comprobarlo; null
    // no compila si no lo miras.
    expect(enteroDelArgumento("pepe")).toBeNull();
    expect(enteroDelArgumento("")).toBeNull();
    expect(enteroDelArgumento(undefined)).toBeNull();
  });

  it("el cero es un numero, no una ausencia", () => {
    // El caso que se rompe si alguien escribe `!numero` en vez de `=== null`.
    expect(enteroDelArgumento("0")).toBe(0);
  });
});

describe("decimalDelArgumento", () => {
  it("acepta decimales", () => {
    expect(decimalDelArgumento("0.75")).toBe(0.75);
  });

  it("y tambien el cero", () => {
    expect(decimalDelArgumento("0")).toBe(0);
  });

  it("lo que no es numero da null", () => {
    expect(decimalDelArgumento("mucho")).toBeNull();
    expect(decimalDelArgumento(undefined)).toBeNull();
  });
});

describe("siONo", () => {
  it("entiende si y no", () => {
    expect(siONo("si")).toBe(true);
    expect(siONo("no")).toBe(false);
  });

  it("no le importan las mayusculas", () => {
    expect(siONo("SI")).toBe(true);
    expect(siONo("No")).toBe(false);
  });

  it("lo que no es ninguna de las dos da undefined, NO false", () => {
    // Quien no contesta no esta diciendo que no. Confundirlo convertiria "se
    // me olvido el argumento" en una respuesta valida.
    expect(siONo("quiza")).toBeUndefined();
    expect(siONo("")).toBeUndefined();
    expect(siONo(undefined)).toBeUndefined();
    expect(siONo("yes")).toBeUndefined();
  });
});

describe("tresEnteros", () => {
  it("devuelve los tres como tupla", () => {
    expect(tresEnteros(["1", "2", "3"])).toEqual([1, 2, 3]);
  });

  it("ignora los que sobran", () => {
    expect(tresEnteros(["1", "2", "3", "4"])).toEqual([1, 2, 3]);
  });

  it("si falta alguno, da null", () => {
    // El caso que `args.map` dejaba pasar: una lista corta produce huecos
    // `undefined` que hay que comprobar aparte del NaN.
    expect(tresEnteros(["1", "2"])).toBeNull();
    expect(tresEnteros([])).toBeNull();
  });

  it("si alguno no es numero, da null", () => {
    expect(tresEnteros(["1", "pepe", "3"])).toBeNull();
  });

  it("los ceros son validos", () => {
    expect(tresEnteros(["0", "0", "0"])).toEqual([0, 0, 0]);
  });
});

describe("paresClaveValor", () => {
  it("parsea los pares de un argumento k=v,k=v", () => {
    expect(paresClaveValor("mensajes=100,altas=5")).toEqual({
      mensajes: 100,
      altas: 5,
    });
  });

  it("acepta decimales", () => {
    expect(paresClaveValor("ratio=0.75")).toEqual({ ratio: 0.75 });
  });

  it("descarta el par cuyo valor no es un numero, sin meter NaN", () => {
    // Meter `NaN` en el registro hace que el informe salga con "NaN" impreso.
    expect(paresClaveValor("a=1,b=hola")).toEqual({ a: 1 });
  });

  it("descarta el par sin clave", () => {
    expect(paresClaveValor("=5,a=1")).toEqual({ a: 1 });
  });

  it("recorta los espacios de la clave", () => {
    expect(paresClaveValor(" a =1")).toEqual({ a: 1 });
  });

  it("un argumento ausente da un registro vacio, no revienta", () => {
    expect(paresClaveValor(undefined)).toEqual({});
  });

  it("acepta el cero como valor", () => {
    expect(paresClaveValor("a=0")).toEqual({ a: 0 });
  });
});
