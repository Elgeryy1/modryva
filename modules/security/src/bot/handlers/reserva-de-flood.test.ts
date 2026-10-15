import { describe, expect, it } from "vitest";

import {
  crearReservaDeFlood,
  HORIZONTE_DE_PURGA_MS,
  horizonteDePurga,
} from "./reserva-de-flood.js";

const CLAVE = "chat:1:persona:7";

describe("reservar", () => {
  it("la primera entrega gana y las de la misma rafaga pierden", () => {
    // Es el incidente de produccion: tres silencios en dos segundos.
    const reserva = crearReservaDeFlood();

    expect(reserva.reservar(CLAVE, 1_000, 10_000)).toBe(true);
    expect(reserva.reservar(CLAVE, 1_400, 10_000)).toBe(false);
    expect(reserva.reservar(CLAVE, 1_900, 10_000)).toBe(false);
  });

  it("pasado el cooldown se vuelve a poder sancionar", () => {
    const reserva = crearReservaDeFlood();

    expect(reserva.reservar(CLAVE, 1_000, 10_000)).toBe(true);
    expect(reserva.reservar(CLAVE, 11_001, 10_000)).toBe(true);
  });

  it("cada persona y cada chat van por su cuenta", () => {
    const reserva = crearReservaDeFlood();

    expect(reserva.reservar("chat:1:persona:7", 1_000, 10_000)).toBe(true);
    expect(reserva.reservar("chat:1:persona:8", 1_000, 10_000)).toBe(true);
    expect(reserva.reservar("chat:2:persona:7", 1_000, 10_000)).toBe(true);
  });
});

describe("horizonte de purga", () => {
  it("con ventanas normales es el fijo de siempre", () => {
    // La ventana por defecto son 10 s: aqui no cambia nada respecto a antes.
    expect(horizonteDePurga(10_000)).toBe(HORIZONTE_DE_PURGA_MS);
    expect(horizonteDePurga(600_000)).toBe(HORIZONTE_DE_PURGA_MS);
  });

  it("una ventana mas larga que el horizonte manda ella", () => {
    expect(horizonteDePurga(3_600_000)).toBe(3_600_000);
  });

  it("la higiene no se come una reserva todavia viva", () => {
    // EL FALLO. `/antiflood_limit 5 3600` es un ajuste valido —la validacion no
    // pone tope a la ventana— y antes la reserva se borraba a los 10 minutos.
    // A partir de ahi volvia a sancionar a la misma persona por el mismo flood.
    const reserva = crearReservaDeFlood();
    const UNA_HORA = 3_600_000;

    expect(reserva.reservar(CLAVE, 0, UNA_HORA)).toBe(true);

    // Quince minutos despues: pasado el horizonte fijo, pero MUY dentro del
    // cooldown. Se pide otra reserva con otra clave, que es lo que dispara la
    // purga.
    expect(reserva.reservar("otra", 900_000, UNA_HORA)).toBe(true);

    // Y la de la persona sigue en pie.
    expect(reserva.reservar(CLAVE, 900_001, UNA_HORA)).toBe(false);
  });

  it("lo caducado si se barre: el mapa no crece sin fin", () => {
    const reserva = crearReservaDeFlood();

    reserva.reservar("vieja", 0, 10_000);
    expect(reserva.tamano).toBe(1);

    // Muy pasado el horizonte: al reservar otra cosa, la vieja se va.
    reserva.reservar("nueva", HORIZONTE_DE_PURGA_MS + 1, 10_000);
    expect(reserva.tamano).toBe(1);
  });
});
