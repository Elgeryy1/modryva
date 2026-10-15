import { describe, expect, it } from "vitest";

import { informeDeHistorialDeCliente } from "./informe-de-cliente.js";

describe("informeDeHistorialDeCliente", () => {
  it("sin tickets, cuenta cero", () => {
    expect(informeDeHistorialDeCliente([])).toContain("Total: 0");
  });

  it("un ticket ASIGNADO sigue contando como abierto", () => {
    // Asignarle un ticket a alguien no lo resuelve, solo le pone dueño.
    // Contarlo como cerrado haria que un equipo con mucho trabajo repartido
    // pareciera un equipo al dia.
    const texto = informeDeHistorialDeCliente([{ estado: "assigned" }]);

    expect(texto).toContain("Abiertos: 1");
    expect(texto).toContain("Cerrados: 0");
  });

  it("los cerrados se cuentan como cerrados", () => {
    expect(informeDeHistorialDeCliente([{ estado: "closed" }])).toContain(
      "Cerrados: 1",
    );
  });

  it("un estado desconocido cuenta como abierto, no desaparece", () => {
    // El lado prudente: mejor que un ticket raro aparezca como pendiente y
    // alguien lo mire, a que se caiga del recuento sin que nadie se entere.
    const texto = informeDeHistorialDeCliente([
      { estado: "un_estado_que_no_existe" },
    ]);

    expect(texto).toContain("Total: 1");
    expect(texto).toContain("Abiertos: 1");
  });

  it("suma los tres estados en el total", () => {
    const texto = informeDeHistorialDeCliente([
      { estado: "open" },
      { estado: "assigned" },
      { estado: "closed" },
    ]);

    expect(texto).toContain("Total: 3");
    expect(texto).toContain("Abiertos: 2");
  });
});
