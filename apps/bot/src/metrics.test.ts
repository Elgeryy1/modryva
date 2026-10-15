import { describe, expect, it } from "vitest";

import {
  botMetrics,
  observarProcesoDeUpdate,
  observarRetrasoDeEntrega,
} from "./metrics.js";

/**
 * El histograma de retraso de entrega es LA metrica de la incidencia de
 * Guardian: el bot respondia en menos de medio segundo mientras el update
 * tardaba entre 10 y 100 en llegarle, y para entonces la solicitud ya habia
 * caducado. Si los cubos no son acumulativos, `histogram_quantile` devuelve
 * percentiles falsos y la metrica miente justo cuando hace falta.
 */
describe("observarRetrasoDeEntrega", () => {
  const cubo = (le: string): number =>
    botMetrics.get(`superbot_bot_update_delay_seconds_bucket{le="${le}"}`);

  it("cuenta una observacion en todos los cubos por encima de ella", () => {
    const antes1 = cubo("1");
    const antes5 = cubo("5");
    const antes30 = cubo("30");

    observarRetrasoDeEntrega(3);

    // 3 s no cabe en le=1, si en le=5 y en todos los mayores. Los cubos de
    // Prometheus son acumulativos: cada uno cuenta "cuantas <= le".
    expect(cubo("1")).toBe(antes1);
    expect(cubo("5")).toBe(antes5 + 1);
    expect(cubo("30")).toBe(antes30 + 1);
  });

  it("cuenta siempre en +Inf, tambien lo que se sale de todos los cortes", () => {
    const antes = cubo("+Inf");
    observarRetrasoDeEntrega(500);
    expect(cubo("+Inf")).toBe(antes + 1);
    // Y no se cuela en ningun corte finito.
    const antes60 = cubo("60");
    observarRetrasoDeEntrega(500);
    expect(cubo("60")).toBe(antes60);
  });

  it("mantiene _sum y _count coherentes", () => {
    const sumaAntes = botMetrics.get("superbot_bot_update_delay_seconds_sum");
    const cuentaAntes = botMetrics.get(
      "superbot_bot_update_delay_seconds_count",
    );

    observarRetrasoDeEntrega(2);
    observarRetrasoDeEntrega(8);

    expect(botMetrics.get("superbot_bot_update_delay_seconds_sum")).toBe(
      sumaAntes + 10,
    );
    expect(botMetrics.get("superbot_bot_update_delay_seconds_count")).toBe(
      cuentaAntes + 2,
    );
  });

  it("ignora valores imposibles en vez de ensuciar el histograma", () => {
    const cuentaAntes = botMetrics.get(
      "superbot_bot_update_delay_seconds_count",
    );
    // Un reloj desincronizado entre Telegram y el contenedor puede dar un
    // retraso negativo. Contarlo estropearia la media para siempre.
    observarRetrasoDeEntrega(-5);
    observarRetrasoDeEntrega(Number.NaN);
    expect(botMetrics.get("superbot_bot_update_delay_seconds_count")).toBe(
      cuentaAntes,
    );
  });
});

describe("observarProcesoDeUpdate", () => {
  it("mide en su propia familia, separada del retraso de entrega", () => {
    const antes = botMetrics.get("superbot_bot_update_process_seconds_count");
    const retrasoAntes = botMetrics.get(
      "superbot_bot_update_delay_seconds_count",
    );

    observarProcesoDeUpdate(0.4);

    expect(botMetrics.get("superbot_bot_update_process_seconds_count")).toBe(
      antes + 1,
    );
    // Separar las dos es el punto: una dice cuanto tardo en llegarnos y la otra
    // cuanto tardamos nosotros. Mezclarlas fue lo que hizo dificil de ver la
    // incidencia de Guardian.
    expect(botMetrics.get("superbot_bot_update_delay_seconds_count")).toBe(
      retrasoAntes,
    );
  });
});
