import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from "@nestjs/common";
import { type PrismaClient, prisma } from "@superbot/data";
import {
  allProbesHealthy,
  formatPrometheusMetrics,
  getRuntimeEnv,
  type ProbeResult,
  runProbe,
} from "@superbot/shared";

/**
 * Sólo se necesita `$queryRaw` para sondear la base de datos. Depender del
 * `PrismaClient` entero obligaría a los tests a fabricar un cliente completo o a
 * castear con `as unknown as PrismaClient` — justo el tipo de escape que este
 * repo mantiene a cero.
 */
type DatabaseProbeClient = Pick<PrismaClient, "$queryRaw">;

export type ReadinessResponse = {
  readonly ready: boolean;
  /** Dependencias sondeadas de verdad, con su latencia. */
  readonly probes: readonly ProbeResult[];
  /** Configuración obligatoria: presencia de variables, no alcanzabilidad. */
  readonly config: readonly { readonly name: string; readonly ok: boolean }[];
};

@Controller()
export class ObservabilityController {
  constructor(private readonly client: DatabaseProbeClient = prisma) {}

  @Get("health/live")
  live(): { ok: true; status: "alive" } {
    return { ok: true, status: "alive" };
  }

  /**
   * Antes esto comprobaba `Boolean(env.DATABASE_URL)` — si la VARIABLE tenía
   * contenido, respondía listo. Con Postgres caído devolvía `ready: true` y un
   * 200, de modo que `restart: unless-stopped` y cualquier monitor externo veían
   * el servicio sano. Ahora ejecuta un `SELECT 1` real con tiempo límite.
   *
   * Devuelve **503** cuando no está listo. El código de estado es lo único que
   * miran los healthchecks de Docker y los monitores; un 200 con `ready:false`
   * dentro del cuerpo es indistinguible de estar sano para casi todos ellos.
   */
  @Get("health/ready")
  async ready(): Promise<ReadinessResponse> {
    const env = getRuntimeEnv();

    const probes = await Promise.all([
      runProbe("database", () => this.client.$queryRaw`SELECT 1`),
    ]);

    // La configuración se comprueba aparte a propósito: que un token esté
    // presente no dice nada sobre si el servicio del que depende responde. Antes
    // se mezclaban ambas cosas y por eso el endpoint no podía fallar nunca.
    const config = [
      { name: "bot-token", ok: Boolean(env.TELEGRAM_BOT_TOKEN) },
    ] as const;

    const response: ReadinessResponse = {
      ready: allProbesHealthy(probes) && config.every((check) => check.ok),
      probes,
      config,
    };

    if (!response.ready) throw new ServiceUnavailableException(response);
    return response;
  }

  /**
   * Build provenance for the running container. `sha`/`builtAt` come from the
   * image ARGs injected at build time, so the exact source is PROVABLE — image
   * age alone does not prove which commit is running. "unknown" when built
   * without the args.
   */
  @Get("build-info")
  buildInfo(): {
    service: string;
    sha: string;
    builtAt: string;
    node: string;
    uptimeSeconds: number;
  } {
    const env = getRuntimeEnv();
    return {
      service: "api",
      sha: env.APP_BUILD_SHA,
      builtAt: env.APP_BUILD_TIME,
      node: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4")
  metrics(): string {
    // Process-uptime gauge plus a build-info style counter; per-instance counters
    // live in the in-memory registry wired by each long-running service.
    return formatPrometheusMetrics([
      {
        name: "superbot_api_up",
        help: "1 when the API process is serving requests",
        value: 1,
      },
      {
        name: "superbot_api_uptime_seconds",
        help: "Process uptime in seconds",
        value: Math.floor(process.uptime()),
      },
    ]);
  }
}
