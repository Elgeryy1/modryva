import { describe, expect, it } from "vitest";

import {
  calculadoraDeAnuncioSensible,
  calculadoraDeAnunciosPorRol,
  calculadoraDeAvisoDeMantenimiento,
  calculadoraDeCaducidadDeAnuncio,
  calculadoraDeCalidadDeDatos,
  calculadoraDeComparacionDeMeses,
  calculadoraDeEnfado,
  calculadoraDeErrorDelBot,
  calculadoraDeEscaladaAHumano,
  calculadoraDeEstadoDeIncidencia,
  calculadoraDeFueraDeTemaDeEstudio,
  calculadoraDeHorario,
  calculadoraDeIncidenciaConocida,
  calculadoraDeInformeDeLanzamiento,
  calculadoraDeMediacion,
  calculadoraDeModoAhorro,
  calculadoraDeNivelDeConocimiento,
  calculadoraDePeticionDeCopia,
  calculadoraDePreguntaCompleta,
  calculadoraDePuntuacionDeDuda,
  calculadoraDeResumenDePublicacion,
  calculadoraDeSeguimientoDeTicket,
  calculadoraDeTratoVip,
  calculadoraDeVistaDeAnuncio,
} from "./calculadoras-de-soporte.js";

const AHORA = Date.UTC(2026, 7, 22, 12, 0, 0);

describe("las calculadoras de soporte, sin argumentos", () => {
  const CON_ARGS = [
    { f: calculadoraDeEnfado, uso: "/enfado" },
    { f: calculadoraDeVistaDeAnuncio, uso: "/vista_anuncio" },
    { f: calculadoraDePeticionDeCopia, uso: "/peticion_copia" },
    { f: calculadoraDeErrorDelBot, uso: "/error_bot" },
    { f: calculadoraDeCalidadDeDatos, uso: "/calidad_datos" },
    { f: calculadoraDeEscaladaAHumano, uso: "/escalar_humano" },
    { f: calculadoraDePreguntaCompleta, uso: "/pregunta_completa" },
    { f: calculadoraDeNivelDeConocimiento, uso: "/nivel_conocimiento" },
    { f: calculadoraDeIncidenciaConocida, uso: "/incidencia_conocida" },
    { f: calculadoraDeMediacion, uso: "/mediacion" },
    { f: calculadoraDeEstadoDeIncidencia, uso: "/estado_incidencia" },
    { f: calculadoraDeComparacionDeMeses, uso: "/comparar_meses" },
    { f: calculadoraDeFueraDeTemaDeEstudio, uso: "/fuera_tema_estudio" },
    { f: calculadoraDeInformeDeLanzamiento, uso: "/informe_lanzamiento" },
    { f: calculadoraDePuntuacionDeDuda, uso: "/puntuar_duda" },
    { f: calculadoraDeResumenDePublicacion, uso: "/resumen_publicacion" },
    { f: calculadoraDeAnunciosPorRol, uso: "/anuncios_por_rol" },
    { f: calculadoraDeModoAhorro, uso: "/modo_ahorro" },
    { f: calculadoraDeAnuncioSensible, uso: "/anuncio_sensible" },
    { f: calculadoraDeTratoVip, uso: "/trato_vip" },
  ] as const;

  it.each(CON_ARGS)("$uso responde con su uso", ({ f, uso }) => {
    const salida = f([]);
    expect(salida).toContain("Uso: ");
    expect(salida).toContain(uso);
    expect(salida).not.toContain("NaN");
  });

  const CON_RELOJ = [
    { f: calculadoraDeCaducidadDeAnuncio, uso: "/caducidad_anuncio" },
    { f: calculadoraDeAvisoDeMantenimiento, uso: "/aviso_mantenimiento" },
    { f: calculadoraDeSeguimientoDeTicket, uso: "/seguimiento_ticket" },
  ] as const;

  it.each(CON_RELOJ)("$uso responde con su uso", ({ f, uso }) => {
    expect(f([], AHORA)).toContain(uso);
  });
});

describe("el copy del uso sale de la misma union que la guarda", () => {
  // Antes el mensaje listaba los valores a mano Y un `new Set([...])` los
  // repetia. Eran dos copias de la union que podian quedarse viejas por
  // separado. Estas tres cadenas son las que respondia el nucleo, letra por
  // letra, y salen ahora de `Record<Union, true>`.
  it("/mediacion", () => {
    expect(calculadoraDeMediacion([])).toBe(
      "Uso: /mediacion <abierta|esperando_a|esperando_b|lista_revision|cerrada> <version_a|version_b|revisar|cerrar>",
    );
  });

  it("/estado_incidencia", () => {
    expect(calculadoraDeEstadoDeIncidencia([])).toBe(
      "Uso: /estado_incidencia <abierto|esperando|resuelto|cerrado> <responder|pedir_info|resolver|cerrar|reabrir>",
    );
  });

  it("/trato_vip", () => {
    expect(calculadoraDeTratoVip([])).toBe(
      "Uso: /trato_vip <free|pro|vip> <minutos_base>",
    );
  });
});

describe("las guardas de estado rechazan lo que no es de la union", () => {
  it("/mediacion no acepta un estado inventado", () => {
    expect(calculadoraDeMediacion(["archivada", "cerrar"])).toContain("Uso: ");
  });

  it("/mediacion no acepta un evento de incidencia", () => {
    expect(calculadoraDeMediacion(["abierta", "reabrir"])).toContain("Uso: ");
  });

  it("/mediacion avanza con un par valido", () => {
    expect(calculadoraDeMediacion(["abierta", "version_a"])).toContain(
      "Siguiente estado:",
    );
  });

  it("/estado_incidencia avanza con un par valido", () => {
    expect(calculadoraDeEstadoDeIncidencia(["abierto", "resolver"])).toContain(
      "Siguiente estado:",
    );
  });

  it("/trato_vip no acepta un plan inventado", () => {
    expect(calculadoraDeTratoVip(["premium", "30"])).toContain("Uso: ");
  });

  it("/trato_vip resuelve el SLA de un plan real", () => {
    expect(calculadoraDeTratoVip(["vip", "30"])).toContain("SLA");
  });

  it("una clave heredada de Object no cuela como estado", () => {
    // `Object.hasOwn` y no `in`: con `in`, "toString" y "constructor" pasarian
    // la guarda y llegarian al detector como si fueran estados.
    expect(calculadoraDeMediacion(["toString", "cerrar"])).toContain("Uso: ");
    expect(calculadoraDeTratoVip(["constructor", "30"])).toContain("Uso: ");
  });
});

describe("los relojes entran por parametro", () => {
  it("un anuncio recien fijado no se desfija", () => {
    expect(calculadoraDeCaducidadDeAnuncio(["0"], AHORA)).toContain(
      "sigue dentro de su ventana",
    );
  });

  it("un anuncio de hace dias si", () => {
    expect(calculadoraDeCaducidadDeAnuncio(["200"], AHORA)).toContain(
      "debería desfijarse",
    );
  });

  it("un ticket recien resuelto no toca seguimiento", () => {
    expect(calculadoraDeSeguimientoDeTicket(["0"], AHORA)).toContain(
      "Todavía no toca",
    );
  });

  it("el aviso de mantenimiento se compone con el instante dado", () => {
    const salida = calculadoraDeAvisoDeMantenimiento(["30", "15"], AHORA);
    expect(salida).not.toContain("Uso: ");
    expect(salida).not.toContain("NaN");
  });

  it("el horario recibe la hora, no la lee del proceso", () => {
    expect(calculadoraDeHorario(3)).not.toBe(calculadoraDeHorario(12));
  });
});

describe("calculadoraDeComparacionDeMeses", () => {
  it("pide el uso si un lado no trae ningun par legible", () => {
    expect(
      calculadoraDeComparacionDeMeses(["mensajes=10", "basura"]),
    ).toContain("Uso: ");
  });

  it("compara los pares que si vienen", () => {
    const salida = calculadoraDeComparacionDeMeses([
      "mensajes=100,altas=5",
      "mensajes=80,altas=9",
    ]);
    expect(salida).toContain("mensajes");
    expect(salida).toContain("altas");
    expect(salida).not.toContain("NaN");
  });

  it("descarta el par que no da numero en vez de meter NaN", () => {
    expect(
      calculadoraDeComparacionDeMeses(["a=1,b=hola", "a=2,b=3"]),
    ).not.toContain("NaN");
  });
});

describe("calculadoraDeAnunciosPorRol", () => {
  it("pide el uso si no hay roles tras la barra", () => {
    expect(calculadoraDeAnunciosPorRol(["hola", "a", "todos"])).toContain(
      "Uso: ",
    );
  });

  it("escribe una variante por rol", () => {
    const salida = calculadoraDeAnunciosPorRol(["aviso|admin,miembro"]);
    expect(salida).toContain("[admin]");
    expect(salida).toContain("[miembro]");
  });
});

describe("calculadoraDeFueraDeTemaDeEstudio", () => {
  it("pide el uso si falta el texto", () => {
    expect(calculadoraDeFueraDeTemaDeEstudio(["9"])).toContain("Uso: ");
  });

  it("la hora 0 es una hora, no un argumento ausente", () => {
    expect(
      calculadoraDeFueraDeTemaDeEstudio(["0", "hablemos de futbol"]),
    ).not.toContain("Uso: ");
  });
});

describe("calculadoraDePuntuacionDeDuda", () => {
  it("pide el uso si el urgente no se entiende", () => {
    expect(calculadoraDePuntuacionDeDuda(["puede", "1000", "3"])).toContain(
      "Uso: ",
    );
  });

  it("puntua una duda con datos completos", () => {
    expect(calculadoraDePuntuacionDeDuda(["si", "1000", "3"])).toContain(
      "Prioridad:",
    );
  });
});
