import { describe, expect, it } from "vitest";
import { detectDoxxing } from "./doxxing-detector.js";

describe("detectDoxxing", () => {
  it("flags a 9-digit phone run as telefono", () => {
    expect(detectDoxxing("Llamame al 600123456")).toEqual({
      matched: true,
      kinds: ["telefono"],
    });
  });

  it("does not flag a phone number broken up by spaces", () => {
    expect(detectDoxxing("Llamame al 600 123 456")).toEqual({
      matched: false,
      kinds: [],
    });
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
  });

  it("is deterministic across repeated calls", () => {
    const text = "DNI 12345678Z y matricula 1234BCD";
    const first = detectDoxxing(text);
    const second = detectDoxxing(text);
    expect(first).toEqual(second);
    expect(first).toEqual({ matched: true, kinds: ["dni", "matricula"] });
  });
});
