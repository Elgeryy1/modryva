import { describe, expect, it } from "vitest";
import { detectDoxxing } from "./doxxing-detector.js";

describe("detectDoxxing", () => {
  it("flags a 9-digit phone run as telefono", () => {
    expect(detectDoxxing("Llamame al 600123456")).toEqual({
      matched: true,
      kinds: ["telefono"],
    });
  });

  // Este caso estaba fijado al reves: el test anterior afirmaba que un movil
  // separado por espacios NO se marca. No era una decision, era el agujero
  // mas grande del detector escrito como si fuera intencionado -- y "600 123
  // 456" es justo la forma normal de escribir un movil.
  it("flags a phone number broken up by spaces or dashes", () => {
    for (const text of [
      "Llamame al 600 123 456",
      "Llamame al 600-123-456",
      "Llamame al +34 600 123 456",
    ]) {
      expect(detectDoxxing(text)).toEqual({
        matched: true,
        kinds: ["telefono"],
      });
    }
  });

  it("flags emails, IBAN and URLs carrying credentials", () => {
    expect(detectDoxxing("escribeme a juan.perez@gmail.com")).toEqual({
      matched: true,
      kinds: ["email"],
    });
    expect(detectDoxxing("mi iban es ES9121000418450200051332")).toEqual({
      matched: true,
      kinds: ["iban"],
    });
    // Una URL con credenciales lleva dentro algo con forma de correo
    // ("clave@panel.com"), asi que salen las dos etiquetas. Da igual para la
    // accion -- el mensaje se retira igual -- y las etiquetas no se le
    // ensenan a nadie.
    expect(detectDoxxing("entra en https://user:clave@panel.com")).toEqual({
      matched: true,
      kinds: ["email", "credenciales"],
    });
  });

  // Regresiones. Cada una de estas frases se borraba en produccion.
  it("does not flag long digit runs that are not phone numbers", () => {
    for (const text of [
      "el id de telegram de ese tio es 9000000012",
      "mi record en el juego es 1234567890 puntos",
      "el video tiene 1234567890 visitas",
    ]) {
      expect(detectDoxxing(text)).toEqual({ matched: false, kinds: [] });
    }
  });

  it("does not read a month abbreviation as a plate", () => {
    // Las matriculas espanolas no llevan vocales, justamente para no formar
    // palabras. "2026 jul" la tiene, asi que no es una matricula.
    for (const text of [
      "nos vemos en 2026 jul",
      "fue en 1999 abr",
      "2026 sep",
    ]) {
      expect(detectDoxxing(text)).toEqual({ matched: false, kinds: [] });
    }
  });

  it("does not read a number later in the sentence as a street number", () => {
    for (const text of [
      "en la calle habia como 20 personas",
      "en la avenida se juntaron 40 tios",
    ]) {
      expect(detectDoxxing(text)).toEqual({ matched: false, kinds: [] });
    }
  });

  it("flags a DNI of 8 digits plus a letter", () => {
    expect(detectDoxxing("Mi DNI es 12345678Z")).toEqual({
      matched: true,
      kinds: ["dni"],
    });
  });

  it("flags a plate written without a space", () => {
    expect(detectDoxxing("Coche 1234BCD aparcado")).toEqual({
      matched: true,
      kinds: ["matricula"],
    });
  });

  it("flags a plate written with a space", () => {
    expect(detectDoxxing("Matricula 1234 BCD")).toEqual({
      matched: true,
      kinds: ["matricula"],
    });
  });

  it("flags a street name with a number as direccion", () => {
    expect(detectDoxxing("Vivo en Calle Mayor 5")).toEqual({
      matched: true,
      kinds: ["direccion"],
    });
  });

  it("flags the abbreviated c/ street form", () => {
    expect(detectDoxxing("Direccion: c/ Sol 12")).toEqual({
      matched: true,
      kinds: ["direccion"],
    });
  });

  it("flags a street number followed by a floor token", () => {
    expect(detectDoxxing("Vivo en calle Sol 12 bajo")).toEqual({
      matched: true,
      kinds: ["direccion"],
    });
  });

  it("does not flag a street word without a number", () => {
    expect(detectDoxxing("Vivo en la calle de siempre")).toEqual({
      matched: false,
      kinds: [],
    });
  });

  it("returns all kinds in curated order", () => {
    const text =
      "Telefono 600123456, DNI 12345678Z, matricula 1234BCD, vivo en Calle Mayor 5";
    expect(detectDoxxing(text)).toEqual({
      matched: true,
      kinds: ["telefono", "dni", "matricula", "direccion"],
    });
  });

  it("handles undefined", () => {
    expect(detectDoxxing(undefined)).toEqual({ matched: false, kinds: [] });
  });

  it("returns no match for empty or clean text", () => {
    expect(detectDoxxing("")).toEqual({ matched: false, kinds: [] });
    expect(detectDoxxing("hola que tal")).toEqual({
      matched: false,
      kinds: [],
    });
    expect(detectDoxxing("son 1500 pavos")).toEqual({
      matched: false,
      kinds: [],
    });
    expect(detectDoxxing("mira esto https://youtube.com/watch?v=abc")).toEqual({
      matched: false,
      kinds: [],
    });
  });

  it("is deterministic across repeated calls", () => {
    const text = "DNI 12345678Z y matricula 1234BCD";
    const first = detectDoxxing(text);
    const second = detectDoxxing(text);
    expect(first).toEqual(second);
    expect(first).toEqual({ matched: true, kinds: ["dni", "matricula"] });
  });
});
