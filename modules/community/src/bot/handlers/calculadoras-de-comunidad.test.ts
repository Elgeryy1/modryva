import { describe, expect, it } from "vitest";

import {
  calculadoraDeAvisoEducativo,
  calculadoraDeAyudaDiscreta,
  calculadoraDeCelebracionSilenciosa,
  calculadoraDeComparacionDeGemelos,
  calculadoraDeConsejosDeCrecimiento,
  calculadoraDeDesbloqueoDeEnlaces,
  calculadoraDeEfectoDeRegla,
  calculadoraDeEstabilidadSocial,
  calculadoraDeExcesoDeConfig,
  calculadoraDeExplicacionDePermiso,
  calculadoraDeGrupoAbandonado,
  calculadoraDeIntencionDeConfig,
  calculadoraDeMedidorDeHype,
  calculadoraDeObjetivoDeMiembro,
  calculadoraDePeriodoDePrueba,
  calculadoraDeRecomendacionPorTamano,
  calculadoraDeReglaNatural,
  calculadoraDeRelecturaObligatoria,
  calculadoraDeRetencionDeJuegos,
  calculadoraDeRompehielo,
  calculadoraDeSancionSuavizada,
  calculadoraDeSeveridadDeRegla,
  calculadoraDeStatsHumanizadas,
  calculadoraDeUsoIndebidoDeTopic,
} from "./calculadoras-de-comunidad.js";

const AHORA = Date.UTC(2026, 7, 22, 12, 0, 0);

describe("las calculadoras de comunidad, sin argumentos", () => {
  const CON_ARGS = [
    { f: calculadoraDeAyudaDiscreta, uso: "/ayuda_discreta" },
    { f: calculadoraDeAvisoEducativo, uso: "/aviso_educativo" },
    { f: calculadoraDeRetencionDeJuegos, uso: "/retencion_juegos" },
    { f: calculadoraDeConsejosDeCrecimiento, uso: "/consejos_crecimiento" },
    { f: calculadoraDeStatsHumanizadas, uso: "/stats_humanizadas" },
    { f: calculadoraDeMedidorDeHype, uso: "/medidor_hype" },
    { f: calculadoraDeIntencionDeConfig, uso: "/config_intencion" },
    { f: calculadoraDeDesbloqueoDeEnlaces, uso: "/desbloquear_enlaces" },
    { f: calculadoraDeRelecturaObligatoria, uso: "/relectura_obligatoria" },
    { f: calculadoraDeObjetivoDeMiembro, uso: "/objetivo_miembro" },
    { f: calculadoraDeExcesoDeConfig, uso: "/exceso_config" },
    { f: calculadoraDeExplicacionDePermiso, uso: "/explicar_permiso" },
    { f: calculadoraDeEfectoDeRegla, uso: "/efecto_regla" },
    { f: calculadoraDeSeveridadDeRegla, uso: "/severidad_regla" },
    { f: calculadoraDeCelebracionSilenciosa, uso: "/celebracion_silenciosa" },
    { f: calculadoraDeRecomendacionPorTamano, uso: "/recomendacion_tamano" },
    { f: calculadoraDeEstabilidadSocial, uso: "/estabilidad_social" },
    { f: calculadoraDeSancionSuavizada, uso: "/suavizar_sancion" },
    { f: calculadoraDeUsoIndebidoDeTopic, uso: "/uso_indebido_topic" },
    { f: calculadoraDeComparacionDeGemelos, uso: "/comparar_grupos_gemelos" },
  ] as const;

  it.each(CON_ARGS)("$uso responde con su uso", ({ f, uso }) => {
    const salida = f([]);
    expect(salida).toContain("Uso: ");
    expect(salida).toContain(uso);
    expect(salida).not.toContain("NaN");
  });

  it("/grupo_abandonado responde con su uso", () => {
    expect(calculadoraDeGrupoAbandonado([], AHORA)).toContain(
      "/grupo_abandonado",
    );
  });

  it("/periodo_prueba responde con su uso", () => {
    expect(calculadoraDePeriodoDePrueba([], AHORA)).toContain(
      "/periodo_prueba",
    );
  });

  it("/regla_natural no entiende una regla vacia", () => {
    expect(calculadoraDeReglaNatural([])).toContain("No entendí la regla");
  });

  it("/rompehielo lista los temas cuando no le das ninguno", () => {
    expect(calculadoraDeRompehielo([], 1)).toContain("Temas:");
  });
});

describe("el copy del uso sale de la misma union que la guarda", () => {
  // Las tres cadenas son las que respondia el nucleo, letra por letra, cuando
  // el valor no estaba en su `new Set([...])` escrito a mano.
  it("/config_intencion", () => {
    expect(calculadoraDeIntencionDeConfig([])).toBe(
      "Uso: /config_intencion <anti_spam|ordenar|chill|crecer>",
    );
  });

  it("/objetivo_miembro", () => {
    expect(calculadoraDeObjetivoDeMiembro([])).toBe(
      "Uso: /objetivo_miembro <aprender|socializar|vender|soporte|otro>",
    );
  });

  it("/severidad_regla", () => {
    expect(calculadoraDeSeveridadDeRegla([])).toBe(
      "Uso: /severidad_regla <leve|media|grave|expulsion>",
    );
  });
});

describe("las guardas rechazan lo que no es de la union", () => {
  it("/config_intencion no acepta una intencion inventada", () => {
    expect(calculadoraDeIntencionDeConfig(["moderar"])).toContain("Uso: ");
  });

  it("/config_intencion resuelve una intencion real", () => {
    expect(calculadoraDeIntencionDeConfig(["anti_spam"])).not.toContain(
      "Uso: ",
    );
  });

  it("/objetivo_miembro resuelve un objetivo real", () => {
    expect(calculadoraDeObjetivoDeMiembro(["aprender"])).toContain("🎯");
  });

  it("/severidad_regla resuelve un nivel real", () => {
    expect(calculadoraDeSeveridadDeRegla(["grave"])).toContain("Rango");
  });

  it("una clave heredada de Object no cuela", () => {
    expect(calculadoraDeIntencionDeConfig(["toString"])).toContain("Uso: ");
    expect(calculadoraDeObjetivoDeMiembro(["constructor"])).toContain("Uso: ");
    expect(calculadoraDeSeveridadDeRegla(["valueOf"])).toContain("Uso: ");
  });
});

describe("los relojes entran por parametro", () => {
  it("un grupo con actividad de hace un rato no esta abandonado", () => {
    expect(calculadoraDeGrupoAbandonado(["0", "50"], AHORA)).toContain(
      "Grupo activo",
    );
  });

  it("un grupo parado meses si lo esta", () => {
    expect(calculadoraDeGrupoAbandonado(["120", "50"], AHORA)).toContain(
      "Grupo abandonado",
    );
  });

  it("quien acaba de entrar sigue en prueba", () => {
    expect(calculadoraDePeriodoDePrueba(["0"], AHORA)).toContain(
      "Todavía en periodo de prueba",
    );
  });

  it("quien entro hace semanas ya no", () => {
    expect(calculadoraDePeriodoDePrueba(["1000"], AHORA)).toContain(
      "Periodo de prueba terminado",
    );
  });
});

describe("calculadoraDeRompehielo", () => {
  // La semilla es el `updateId`. Es lo que hace que reintentar un update
  // devuelva la MISMA pregunta en vez de una distinta cada vez.
  it("la misma semilla da la misma pregunta", () => {
    const tema = ["gustos"];
    expect(calculadoraDeRompehielo(tema, 42)).toBe(
      calculadoraDeRompehielo(tema, 42),
    );
  });

  it("rechaza un tema que no existe y ofrece los que si", () => {
    const salida = calculadoraDeRompehielo(["politica_local"], 1);
    expect(salida).toContain("Tema desconocido");
    expect(salida).toContain("Usa uno de:");
  });
});

describe("los enteros de cuatro en cuatro", () => {
  it("/retencion_juegos pide el uso con solo tres", () => {
    expect(calculadoraDeRetencionDeJuegos(["1", "2", "3"])).toContain("Uso: ");
  });

  it("/retencion_juegos calcula con los cuatro", () => {
    expect(
      calculadoraDeRetencionDeJuegos(["8", "10", "3", "10"]),
    ).not.toContain("Uso: ");
  });

  it("/stats_humanizadas pide el uso con solo tres", () => {
    expect(calculadoraDeStatsHumanizadas(["1", "2", "3"])).toContain("Uso: ");
  });

  it("/stats_humanizadas acepta cuatro ceros, que es un dia sin nada", () => {
    expect(calculadoraDeStatsHumanizadas(["0", "0", "0", "0"])).not.toContain(
      "Uso: ",
    );
  });
});

describe("calculadoraDeUsoIndebidoDeTopic", () => {
  it("pide el uso si no hay texto", () => {
    expect(calculadoraDeUsoIndebidoDeTopic(["|a,b|c,d"])).toContain("Uso: ");
  });

  it("funciona sin listas de palabras, que son opcionales", () => {
    expect(calculadoraDeUsoIndebidoDeTopic(["hola que tal"])).not.toContain(
      "Uso: ",
    );
  });

  it("marca el mensaje fuera de tema", () => {
    expect(
      calculadoraDeUsoIndebidoDeTopic(["vendo coche|deberes,examen|vendo"]),
    ).toContain("Uso indebido");
  });
});

describe("calculadoraDeSancionSuavizada", () => {
  it("pide el uso si el publico si/no no se entiende", () => {
    expect(calculadoraDeSancionSuavizada(["mute", "quiza"])).toContain("Uso: ");
  });

  it("suaviza con datos completos", () => {
    expect(calculadoraDeSancionSuavizada(["mute", "no"])).not.toContain(
      "Uso: ",
    );
  });
});

describe("calculadoraDeAvisoEducativo", () => {
  it("pide el uso si falta el motivo tras la barra", () => {
    expect(calculadoraDeAvisoEducativo(["no", "spam"])).toContain("Uso: ");
  });

  it("compone con regla y motivo", () => {
    expect(
      calculadoraDeAvisoEducativo(["nada de enlaces|atraen spam"]),
    ).not.toContain("Uso: ");
  });
});

describe("calculadoraDeComparacionDeGemelos", () => {
  it("compara los pares de los dos grupos", () => {
    const salida = calculadoraDeComparacionDeGemelos([
      "mensajes=100",
      "mensajes=80",
    ]);
    expect(salida).toContain("mensajes");
    expect(salida).toContain("líder:");
  });
});

describe("el cero como argumento legitimo", () => {
  it("/exceso_config con cero reglas calcula, no pide el uso", () => {
    expect(calculadoraDeExcesoDeConfig(["0", "100"])).not.toContain("Uso: ");
  });

  it("/celebracion_silenciosa con cero conflictos calcula", () => {
    expect(calculadoraDeCelebracionSilenciosa(["si", "0"])).not.toContain(
      "Uso: ",
    );
  });

  it("/efecto_regla admite un antes de cero", () => {
    expect(calculadoraDeEfectoDeRegla(["0", "10"])).not.toContain("Uso: ");
  });
});
