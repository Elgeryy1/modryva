import { Controller, Get, Header } from "@nestjs/common";
import { coreManifest } from "@superbot/module-core";
import { guardianManifest } from "@superbot/module-guardian";
import { securityManifest } from "@superbot/module-security";
import { socialManifest } from "@superbot/module-social";
import { renderBotMetrics } from "./metrics.js";

const moduleManifests = [
  coreManifest,
  securityManifest,
  guardianManifest,
  socialManifest,
];

@Controller()
export class HealthController {
  @Get("health")
  getHealth() {
    return {
      ok: true,
      service: "bot",
      runtime: "nestjs-fastify",
      modules: moduleManifests.map((manifest) => manifest.name),
    };
  }

  /**
   * Contadores de este proceso, en formato de texto de Prometheus.
   *
   * El bot no tenía `/metrics`; la API sí. Los contadores sociales viven aquí
   * porque los handlers sociales corren en ESTE proceso, y unos contadores en
   * memoria no cruzan de un contenedor a otro.
   *
   * Nada de lo que sale por aquí lleva id de chat, id de usuario ni texto: las
   * etiquetas son uniones cerradas comprobadas por un test.
   */
  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4")
  metrics(): string {
    return renderBotMetrics();
  }
}
