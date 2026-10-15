import { createLogger } from "./logger.js";
import { redactDeep } from "./redaction.js";

const logger = createLogger("error-tracking");

export interface ErrorTrackingOptions {
  /** Empty/undefined disables reporting entirely — the default everywhere
   * except production, so local runs and tests never emit. */
  readonly dsn: string | undefined;
  /** Which service this is, so one project can still be filtered per app. */
  readonly service: string;
  readonly release?: string | undefined;
  readonly environment?: string | undefined;
}

/**
 * Scrubs an outbound event. Exported separately from init so the rule that
 * matters — nothing sensitive leaves the process — is testable without a live
 * tracker, which is the only way to be sure of it before it is too late.
 *
 * Returning null drops the event; that is reserved for events we cannot clean
 * rather than used as a filter, since a dropped error is an error nobody sees.
 */
export const scrubEvent = <T extends Record<string, unknown>>(
  event: T,
): T | null => {
  try {
    const scrubbed = redactDeep(event) as T;
    // sendDefaultPii is off, but be explicit: these three are the ones that
    // carry a person rather than a fault, and a future SDK default should not
    // be able to reintroduce them quietly.
    const user = scrubbed.user as Record<string, unknown> | undefined;
    if (user) {
      user.ip_address = undefined;
      user.email = undefined;
      user.username = undefined;
    }
    const request = scrubbed.request as Record<string, unknown> | undefined;
    if (request) {
      request.cookies = undefined;
      request.headers = undefined;
      request.query_string = undefined;
      request.data = undefined;
      // `url` es el único campo de `request` que el SDK rellena SIEMPRE (su
      // propio código lo documenta: "no dataCollection equivalent"), y trae la
      // query pegada. Borrar `query_string` y dejar `url` es borrar el dato de
      // un sitio y publicarlo en el de al lado: se comprobó con el scrubber
      // real, y el token de sesión salía en `url` con `query_string` ya vacío.
      request.url = undefined;
    }
    return scrubbed;
  } catch (error) {
    // Never let the scrubber's own failure ship an unscrubbed event.
    logger.warn({ err: error }, "could not scrub event — dropped");
    return null;
  }
};

/**
 * Starts error reporting, if a DSN is configured. Resolves to whether it is on,
 * so a caller can say so at boot rather than leaving it ambiguous.
 *
 * The SDK is imported dynamically: with no DSN (local, CI, every test) it is
 * never loaded at all, so nothing here can slow down or destabilise a run that
 * was not going to report anyway.
 */
export const initErrorTracking = async (
  options: ErrorTrackingOptions,
): Promise<boolean> => {
  if (!options.dsn) {
    return false;
  }
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn: options.dsn,
      environment: options.environment ?? "production",
      ...(options.release ? { release: options.release } : {}),
      // Errors only. Tracing would sample every request through a Mini App that
      // handles face photos, for a signal nobody has asked for yet.
      tracesSampleRate: 0,
      // No IPs, headers or cookies attached automatically — see scrubEvent.
      sendDefaultPii: false,
      // Defensa en profundidad: dejar de RECOGER el dato, no solo de enviarlo.
      //
      // El SDK añade `httpIntegration` y `nativeNodeFetchIntegration` por
      // defecto, y ambas dejan una miga por cada petición saliente con la URL
      // completa — incluida la ruta, que es donde vive el token de Telegram.
      // Esas migas NO dependen de `tracesSampleRate`: son justamente la rama de
      // "sin trazas". El patrón de redacción ya está arreglado, pero un patrón
      // que debe acertar siempre es peor control que no tener el dato: la
      // próxima URL con un secreto en la ruta no avisará de que existe.
      integrations: (porDefecto) => [
        ...porDefecto,
        Sentry.httpIntegration({ breadcrumbs: false }),
        Sentry.nativeNodeFetchIntegration({ breadcrumbs: false }),
      ],
      beforeSend: (event) =>
        scrubEvent(event as unknown as Record<string, unknown>) as never,
      beforeSendTransaction: () => null,
      beforeBreadcrumb: (crumb) =>
        redactDeep(crumb) as typeof crumb satisfies typeof crumb,
      initialScope: { tags: { service: options.service } },
    });
    return true;
  } catch (error) {
    // A tracker that cannot start must never take the service down with it.
    logger.error(
      { err: error, service: options.service },
      "error tracking failed to start — continuing without it",
    );
    return false;
  }
};
