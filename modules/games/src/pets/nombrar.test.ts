import { describe, expect, it } from "vitest";
import {
  type FalloAlNombrar,
  LARGO_MAXIMO_DE_NOMBRE,
  LARGO_MINIMO_DE_NOMBRE,
  textoDeFalloAlNombrar,
  validarNombre,
} from "./nombrar.js";

const bien = (bruto: string): string => {
  const salida = validarNombre(bruto);
  if (!salida.ok) {
    throw new Error(`esperaba que valiera, y dijo ${salida.motivo}`);
  }
  return salida.nombre;
};

const mal = (bruto: string): FalloAlNombrar => {
  const salida = validarNombre(bruto);
  if (salida.ok) {
    throw new Error(`esperaba que fallara, y acepto "${salida.nombre}"`);
  }
  return salida.motivo;
};

describe("validarNombre", () => {
  it("acepta un nombre normal", () => {
    expect(bien("Pelusa")).toBe("Pelusa");
  });

  it("recorta los extremos y colapsa los espacios de dentro", () => {
    // Guardar "  Don   Pepe " haria que el corral pareciera desalineado sin
    // que nadie supiera por que.
    expect(bien("  Don   Pepe ")).toBe("Don Pepe");
  });

  it("deja pasar tildes, eñes y emojis", () => {
    expect(bien("Ñoño")).toBe("Ñoño");
    expect(bien("Coco 🐾")).toBe("Coco 🐾");
  });

  it("cuenta emojis como UN caracter, no como dos", () => {
    // Seis emojis son doce en `.length` y siguen siendo cortos en pantalla.
    expect(bien("🐶🐱🐭🐹🐰🦊")).toBe("🐶🐱🐭🐹🐰🦊");
  });

  it("rechaza lo que rompe el formato del mensaje", () => {
    // Sin esto, un `<b>` deja el resto del mensaje en negrita o hace que la
    // Bot API rechace la respuesta entera.
    for (const roto of ["<b>Pelusa", "Tom & Jerry", 'Di "hola"', "O'Malley"]) {
      expect(mal(roto)).toBe("caracteres");
    }
  });

  it("rechaza los que parecen una mencion", () => {
    expect(mal("@admin")).toBe("mencion");
  });

  it("rechaza el vacio y lo que solo son espacios", () => {
    expect(mal("")).toBe("vacio");
    expect(mal("     ")).toBe("vacio");
  });

  it("respeta los dos limites de largo", () => {
    expect(mal("a")).toBe("corto");
    expect(mal("x".repeat(LARGO_MAXIMO_DE_NOMBRE + 1))).toBe("largo");
    expect(bien("x".repeat(LARGO_MAXIMO_DE_NOMBRE))).toHaveLength(
      LARGO_MAXIMO_DE_NOMBRE,
    );
    expect(bien("x".repeat(LARGO_MINIMO_DE_NOMBRE))).toHaveLength(
      LARGO_MINIMO_DE_NOMBRE,
    );
  });

  it("el largo se mide DESPUES de limpiar", () => {
    // "  Pi  " son seis brutos y dos limpios: debe valer.
    expect(bien("  Pi  ")).toBe("Pi");
  });

  it("nada de lo que acepta puede romper un mensaje HTML", () => {
    // La propiedad de verdad, y por eso se prueba sobre la salida y no sobre
    // la entrada: lo que se guarda es lo que acaba en el corral de todos.
    const candidatos = ["Pelusa", "Don Pepe", "Ñoño", "Coco 🐾", "R2-D2"];
    for (const candidato of candidatos) {
      expect(bien(candidato)).not.toMatch(/[<>&"']/u);
    }
  });
});

describe("los textos de fallo", () => {
  it("cada motivo dice algo distinto y util", () => {
    const motivos: FalloAlNombrar[] = [
      "vacio",
      "corto",
      "largo",
      "caracteres",
      "mencion",
    ];
    const textos = motivos.map((motivo) => textoDeFalloAlNombrar(motivo));
    // Ninguno vacio, y ninguno repetido: un mismo texto para dos motivos
    // distintos deja a la gente sin saber que corregir.
    for (const texto of textos) {
      expect(texto.length).toBeGreaterThan(0);
    }
    expect(new Set(textos).size).toBe(motivos.length);
  });

  it("el del vacio enseña como se usa", () => {
    expect(textoDeFalloAlNombrar("vacio")).toContain("/nombrar");
  });
});
