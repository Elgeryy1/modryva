import { describe, expect, it } from "vitest";

import {
  calculadoraDeAcuerdoDeConvivencia,
  calculadoraDeAgrupacionDeReportes,
  calculadoraDeAutoBeneficio,
  calculadoraDeAvisoDeAprendizaje,
  calculadoraDeCeboDeRespuesta,
  calculadoraDeChecklistDeBan,
  calculadoraDeConfianzaDeDecision,
  calculadoraDeConversionDeSancion,
  calculadoraDeDesescalada,
  calculadoraDeDiagnosticoDeObservacion,
  calculadoraDeDominioNuevo,
  calculadoraDeEfectoDeSancion,
  calculadoraDeEscudoDeMenciones,
  calculadoraDeFiltroDeSpoiler,
  calculadoraDeFirmaDeSancion,
  calculadoraDeGuardiaImpulsivo,
  calculadoraDePatronDeCuarentena,
  calculadoraDePermiso,
  calculadoraDePermisoDeEmergencia,
  calculadoraDeRazonDeSancion,
  calculadoraDeSandboxDeEnlace,
  calculadoraDeSensibilidadDeCaso,
  calculadoraDeSensibilidadDeHilo,
  calculadoraDeSeparacionActiva,
  calculadoraDeSesgoOperativo,
  calculadoraDeSpamSilencioso,
  calculadoraDeUltimaOportunidad,
  calculadoraDeVentanaDeGracia,
} from "./calculadoras-de-moderacion.js";

const AHORA = Date.UTC(2026, 7, 24, 12, 0, 0);

describe("las calculadoras de moderacion, sin argumentos", () => {
  const CON_ARGS = [
    { f: calculadoraDePermiso, uso: "/permiso" },
    { f: calculadoraDeConfianzaDeDecision, uso: "/confianza_decision" },
    { f: calculadoraDeChecklistDeBan, uso: "/checklist_ban" },
    { f: calculadoraDeSensibilidadDeCaso, uso: "/sensibilidad_caso" },
    { f: calculadoraDeAcuerdoDeConvivencia, uso: "/acuerdo_convivencia" },
    { f: calculadoraDeConversionDeSancion, uso: "/convertir_sancion" },
    { f: calculadoraDeDesescalada, uso: "/desescalar" },
    { f: calculadoraDePermisoDeEmergencia, uso: "/permiso_emergencia" },
    { f: calculadoraDeRazonDeSancion, uso: "/razon_sancion" },
    { f: calculadoraDeGuardiaImpulsivo, uso: "/guardia_impulsivo" },
    { f: calculadoraDeUltimaOportunidad, uso: "/ultima_oportunidad" },
    { f: calculadoraDeAvisoDeAprendizaje, uso: "/aviso_aprendizaje" },
    { f: calculadoraDeSandboxDeEnlace, uso: "/sandbox_enlace" },
    { f: calculadoraDeAgrupacionDeReportes, uso: "/agrupar_reportes" },
    { f: calculadoraDeEscudoDeMenciones, uso: "/escudo_menciones" },
    { f: calculadoraDeDominioNuevo, uso: "/dominio_nuevo" },
    {
      f: calculadoraDeDiagnosticoDeObservacion,
      uso: "/diagnostico_observacion",
    },
    { f: calculadoraDeSesgoOperativo, uso: "/sesgo_operativo" },
    { f: calculadoraDePatronDeCuarentena, uso: "/patron_cuarentena" },
    { f: calculadoraDeCeboDeRespuesta, uso: "/cebo_respuesta" },
    { f: calculadoraDeEfectoDeSancion, uso: "/efecto_sancion" },
    { f: calculadoraDeFirmaDeSancion, uso: "/firma_sancion" },
    { f: calculadoraDeAutoBeneficio, uso: "/auto_beneficio" },
    { f: calculadoraDeSensibilidadDeHilo, uso: "/sensibilidad_hilo" },
    { f: calculadoraDeSpamSilencioso, uso: "/spam_silencioso" },
    { f: calculadoraDeFiltroDeSpoiler, uso: "/filtro_spoiler" },
  ] as const;

  it.each(CON_ARGS)("$uso responde con su uso", ({ f, uso }) => {
    const salida = f([]);
    expect(salida).toContain("Uso: ");
    expect(salida).toContain(uso);
    expect(salida).not.toContain("NaN");
  });

  it("/ventana_gracia responde con su uso", () => {
    expect(calculadoraDeVentanaDeGracia([], AHORA)).toContain(
      "/ventana_gracia",
    );
  });

  it("/separacion_activa responde con su uso", () => {
    expect(calculadoraDeSeparacionActiva([], AHORA)).toContain(
      "/separacion_activa",
    );
  });
});

/**
 * Estas dos uniones deciden QUIEN PUEDE HACER QUE, asi que se prueban con mas
 * cuidado que las demas. El nucleo las comprobaba contra un `Set` estatico y un
 * array literal, y despues hacia `as`: tres sitios donde la lista podia
 * quedarse vieja por separado.
 */
describe("las guardas de rol", () => {
  it("/permiso: el mensaje de uso lista los roles de la union", () => {
    expect(calculadoraDePermiso([])).toBe(
      "Uso: /permiso <junior|mod|senior|owner> <acción>",
    );
  });

  it("/permiso_emergencia: igual", () => {
    expect(calculadoraDePermisoDeEmergencia([])).toBe(
      "Uso: /permiso_emergencia <helper|mod|admin> <raid_activo si|no>",
    );
  });

  it("/permiso rechaza un rol inventado", () => {
    expect(calculadoraDePermiso(["superadmin", "banear"])).toContain("Uso: ");
  });

  it("/permiso rechaza un rol de la OTRA union", () => {
    // `helper` es de emergencia, no de la escala de acciones. Con dos listas
    // escritas a mano es facil que una acabe aceptando valores de la otra.
    expect(calculadoraDePermiso(["helper", "banear"])).toContain("Uso: ");
  });

  it("/permiso_emergencia rechaza un rol de la OTRA union", () => {
    expect(calculadoraDePermisoDeEmergencia(["senior", "si"])).toContain(
      "Uso: ",
    );
  });

  it("/permiso resuelve un rol real", () => {
    expect(calculadoraDePermiso(["owner", "banear"])).not.toContain("Uso: ");
  });

  it("/permiso_emergencia resuelve un rol real", () => {
    expect(calculadoraDePermisoDeEmergencia(["mod", "si"])).not.toContain(
      "Uso: ",
    );
  });

  it("una clave heredada de Object no cuela como rol", () => {
    expect(calculadoraDePermiso(["toString", "banear"])).toContain("Uso: ");
    expect(calculadoraDePermisoDeEmergencia(["constructor", "si"])).toContain(
      "Uso: ",
    );
  });

  it("/permiso pide el uso si falta la accion", () => {
    expect(calculadoraDePermiso(["mod"])).toContain("Uso: ");
  });
});

describe("los relojes entran por parametro", () => {
  it("un mensaje recien enviado esta dentro de la gracia", () => {
    expect(calculadoraDeVentanaDeGracia(["0"], AHORA)).toContain(
      "dentro de la ventana",
    );
  });

  it("uno de hace una hora ya no", () => {
    expect(calculadoraDeVentanaDeGracia(["3600"], AHORA)).toContain("expiró");
  });

  it("una separacion recien puesta sigue activa", () => {
    expect(calculadoraDeSeparacionActiva(["0"], AHORA)).toContain(
      "todavía activa",
    );
  });

  it("una de hace semanas ya no", () => {
    expect(calculadoraDeSeparacionActiva(["1000"], AHORA)).toContain(
      "ya terminó",
    );
  });
});

describe("el si/no que falta no vale por un no", () => {
  // `siONo` devuelve `undefined` y no `false`. En estos tres importa de verdad:
  // suponer "no" convertiria "no me lo has dicho" en "no hay menor implicado",
  // "no hay amenaza legal" y "no es reincidente".
  it("/sensibilidad_caso pide el uso si falta un si/no", () => {
    expect(calculadoraDeSensibilidadDeCaso(["si", "no"])).toContain("Uso: ");
  });

  it("/checklist_ban pide el uso si falta el cuarto", () => {
    expect(calculadoraDeChecklistDeBan(["si", "si", "si"])).toContain("Uso: ");
  });

  it("/patron_cuarentena pide el uso si uno no se entiende", () => {
    expect(calculadoraDePatronDeCuarentena(["si", "quiza", "no"])).toContain(
      "Uso: ",
    );
  });

  it("/checklist_ban con los cuatro calcula", () => {
    expect(calculadoraDeChecklistDeBan(["si", "no", "si", "si"])).not.toContain(
      "Uso: ",
    );
  });
});

describe("el cero como argumento legitimo", () => {
  it("/confianza_decision admite cero pruebas", () => {
    expect(calculadoraDeConfianzaDeDecision(["0", "no", "0"])).toContain(
      "/100",
    );
  });

  it("/escudo_menciones admite cero menciones", () => {
    expect(calculadoraDeEscudoDeMenciones(["0"])).not.toContain("Uso: ");
  });

  it("/ultima_oportunidad admite cero avisos", () => {
    expect(calculadoraDeUltimaOportunidad(["0", "3"])).not.toContain("Uso: ");
  });
});

describe("los que parten por barra", () => {
  it("/razon_sancion pide el uso si falta un campo", () => {
    expect(calculadoraDeRazonDeSancion(["regla|banear|2"])).toContain("Uso: ");
  });

  it("/razon_sancion compone con los cuatro", () => {
    expect(calculadoraDeRazonDeSancion(["no spam|banear|2|0.9"])).not.toContain(
      "Uso: ",
    );
  });

  it("/firma_sancion pide el uso si falta el caso", () => {
    expect(calculadoraDeFirmaDeSancion(["ana|spam"])).toContain("Uso: ");
  });

  it("/aviso_aprendizaje pide el uso sin ejemplo", () => {
    expect(calculadoraDeAvisoDeAprendizaje(["nada de enlaces"])).toContain(
      "Uso: ",
    );
  });

  it("/filtro_spoiler funciona sin lista de palabras", () => {
    expect(calculadoraDeFiltroDeSpoiler(["muere el prota"])).not.toContain(
      "Uso: ",
    );
  });
});

describe("las listas separadas por coma", () => {
  it("/agrupar_reportes descarta las entradas sin motivo", () => {
    // "3" no trae motivo: se cae. Antes se caia igual, pero sin test.
    const salida = calculadoraDeAgrupacionDeReportes(["1:spam,2:spam,3"]);
    expect(salida).toContain("spam (2)");
  });

  it("/agrupar_reportes pide el uso si no queda ninguna entrada valida", () => {
    expect(calculadoraDeAgrupacionDeReportes(["1,2,3"])).toContain("Uso: ");
  });

  it("/auto_beneficio descarta los ids ilegibles", () => {
    expect(calculadoraDeAutoBeneficio(["42", "7,hola,9"])).not.toContain(
      "Uso: ",
    );
  });

  it("/auto_beneficio pide el uso si ningun id es legible", () => {
    expect(calculadoraDeAutoBeneficio(["42", "hola,adios"])).toContain("Uso: ");
  });

  it("/dominio_nuevo funciona sin lista de conocidos", () => {
    expect(calculadoraDeDominioNuevo(["ejemplo.com"])).toContain(
      "Dominio nuevo",
    );
  });

  it("/dominio_nuevo reconoce uno ya visto", () => {
    expect(
      calculadoraDeDominioNuevo(["ejemplo.com", "ejemplo.com,otro.com"]),
    ).toContain("ya conocido");
  });
});

describe("los que piden tres o cuatro enteros", () => {
  it("/diagnostico_observacion pide el uso con solo dos", () => {
    expect(calculadoraDeDiagnosticoDeObservacion(["1", "2"])).toContain(
      "Uso: ",
    );
  });

  it("/spam_silencioso calcula con tres ceros", () => {
    expect(calculadoraDeSpamSilencioso(["0", "0", "0"])).not.toContain("Uso: ");
  });

  it("/sesgo_operativo pide el uso con solo tres", () => {
    expect(calculadoraDeSesgoOperativo(["1", "2", "3"])).toContain("Uso: ");
  });

  it("/sesgo_operativo calcula con los cuatro", () => {
    expect(calculadoraDeSesgoOperativo(["10", "20", "2", "50"])).not.toContain(
      "Uso: ",
    );
  });
});

describe("calculadoraDeCeboDeRespuesta", () => {
  it("pide el uso si falta el ultimo si/no", () => {
    expect(calculadoraDeCeboDeRespuesta(["si", "10", "2", "si"])).toContain(
      "Uso: ",
    );
  });

  it("calcula con los cinco", () => {
    expect(
      calculadoraDeCeboDeRespuesta(["si", "100", "0.5", "si", "si"]),
    ).not.toContain("Uso: ");
  });
});

describe("calculadoraDeSensibilidadDeHilo", () => {
  it("da el score en las dos ramas", () => {
    expect(calculadoraDeSensibilidadDeHilo(["0", "0"])).toContain("score");
    expect(calculadoraDeSensibilidadDeHilo(["50", "50"])).toContain("score");
  });
});

describe("calculadoraDeEfectoDeSancion", () => {
  it("pide el uso si el apoyo no se entiende", () => {
    expect(calculadoraDeEfectoDeSancion(["0.5", "30", "quiza"])).toContain(
      "Uso: ",
    );
  });
});
