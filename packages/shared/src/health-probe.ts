/**
 * Sondas de salud con tiempo límite — Fase 1.4 de docs/PLAN-ENDURECIMIENTO-2026-07-20.md
 *
 * PROBLEMA QUE RESUELVE. Hasta 2026-07-20 `GET health/ready` comprobaba
 * `Boolean(env.DATABASE_URL)`: si la VARIABLE no estaba vacía, respondía listo.
 * Con Postgres caído seguía devolviendo `ready: true` y HTTP 200, así que
 * `restart: unless-stopped` y cualquier monitor externo veían el servicio sano.
 * Un health check que no puede fallar no es un health check.
 *
 * POR QUÉ RECIBE UNA FUNCIÓN Y NO UN CLIENTE. `packages/shared` no depende de
 * Prisma ni de Redis y así debe seguir: la auditoría del repo ya detectó una
 * inversión de capa (`packages/data` importando `module-games`) a un import de
 * cerrar ciclo. Pasando `() => Promise<unknown>` esta lógica se prueba entera
 * sin levantar nada, y cada app decide qué sondear.
 *
 * POR QUÉ EL TIEMPO LÍMITE ES OBLIGATORIO. Una base de datos *colgada* es peor
 * que una caída: no rechaza la conexión, simplemente nunca responde. Sin límite
 * el health check se cuelga con ella, el orquestador se queda sin veredicto y el
 * fallo se manifiesta como un timeout confuso en otra capa.
 */

export type ProbeResult = {
  readonly name: string;
  readonly ok: boolean;
  readonly latencyMs: number;
  /** Sólo presente cuando `ok` es false. Mensaje ya saneado, nunca la excepción cruda. */
  readonly error?: string;
};

export const PROBE_TIMEOUT_MS = 2_000;

/** Marca interna para distinguir "se agotó el tiempo" de "falló de verdad". */
const TIMED_OUT = Symbol("probe-timeout");

/**
 * Nunca lanza: un fallo de la sonda ES el resultado. Si esto pudiera lanzar,
 * una dependencia caída tumbaría el endpoint que existe justo para informar de
 * que esa dependencia está caída.
 */
export const runProbe = async (
  name: string,
  check: () => Promise<unknown>,
  timeoutMs: number = PROBE_TIMEOUT_MS,
  now: () => number = () => Date.now(),
): Promise<ProbeResult> => {
  const startedAt = now();
  // Se declara fuera del try para poder limpiarlo pase lo que pase. Sin este
  // clearTimeout cada petición dejaría un timer vivo: el proceso acumula handles
  // y, en tests, vitest no termina jamás.
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const outcome = await Promise.race([
      check(),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
      }),
    ]);

    if (outcome === TIMED_OUT) {
      return {
        name,
        ok: false,
        latencyMs: now() - startedAt,
        error: `timeout tras ${timeoutMs}ms`,
      };
    }
    return { name, ok: true, latencyMs: now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      latencyMs: now() - startedAt,
      error: describeProbeError(error),
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/**
 * Los errores de conexión suelen llevar dentro la cadena de conexión completa,
 * contraseña incluida. Este endpoint puede estar expuesto a un monitor externo,
 * así que se recorta y se limpia: mejor un mensaje pobre que una fuga.
 */
export const describeProbeError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = raw.split("\n")[0] ?? "error desconocido";
  return redactConnectionStrings(firstLine).slice(0, 200);
};

/** Sustituye las credenciales de cualquier URL con userinfo por `***`. */
export const redactConnectionStrings = (text: string): string =>
  text.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^\s/@]+@/g, "$1***@");

/** `true` sólo si TODAS las sondas pasaron. Vacío = no listo: no hay evidencia de salud. */
export const allProbesHealthy = (probes: readonly ProbeResult[]): boolean =>
  probes.length > 0 && probes.every((probe) => probe.ok);
