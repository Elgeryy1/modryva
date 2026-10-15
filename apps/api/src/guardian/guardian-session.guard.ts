import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  type GuardianSessionStatusValue,
  PrismaGuardianRepository,
  type VerificationSessionRecord,
} from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import {
  createLogger,
  createRateLimiter,
  getRuntimeEnv,
} from "@superbot/shared";
import { verifyTelegramInitData } from "../telegram-init-data.js";
import { describeLlegadaTarde } from "./late-open.js";
import { describirDesenlace } from "./session-outcome.js";

const logger = createLogger("guardian-session");

/**
 * Un portazo del guard, con su rastro. Devuelve la excepción para poder
 * escribir `throw rechazar(...)` y que el registro no se pueda olvidar en
 * ninguna de las once salidas.
 *
 * De esas once solo dos se registraban. Las otras nueve salían sin dejar nada,
 * y eso tiene una consecuencia concreta: `progressStep` solo avanza DESPUÉS de
 * pasar por aquí (ver guardian-verify.controller.ts), así que alguien que abre
 * la Mini App y se estrella contra el guard queda en el escalón 0, exactamente
 * igual que alguien que nunca tocó el botón. Los dos casos se arreglan de
 * formas opuestas y no había forma de separarlos.
 *
 * Medido el 2026-08-10 cruzando `guardian.page.served` con `progressStep`: de
 * 544 sesiones en el escalón 0, 29 SÍ habían llegado a servir la página. Son
 * pocas, pero hasta ahora eran invisibles y se contaban como "no abrió".
 *
 * `info` y no `warn`: casi ninguno es un fallo nuestro (un enlace viejo, una
 * pestaña fuera de Telegram), y un nivel que alarma por lo normal es un nivel
 * que se acaba ignorando.
 */
const rechazar = <E extends HttpException>(
  rechazo: string,
  excepcion: E,
  detalle?: Record<string, unknown>,
): E => {
  logger.info(
    { rechazo, ...detalle },
    "guardian: el guard no dejó pasar la petición",
  );
  return excepcion;
};

/**
 * Qué hacer con cada estado posible de una sesión. Y por qué es un `Record` y
 * no la lista de estados vivos que había antes.
 *
 * Una lista falla en silencio: si el enum de Prisma gana mañana un estado nuevo
 * que SÍ debería dejar pasar, la lista no lo tiene, nadie se entera al compilar,
 * y a esa gente se le enseña "esta verificación ya se completó o fue cancelada"
 * con la sesión viva delante. Es la misma forma exacta del fallo que costó una
 * tarde entera el 2026-08-10.
 *
 * Con `Record<GuardianSessionStatusValue, …>` eso deja de poder pasar: añadir un
 * estado al enum sin decir aquí qué significa no compila.
 *
 * - `viva`: la persona puede seguir.
 * - `caducada`: el plazo se la llevó. Se le dice que vuelva a solicitar entrar,
 *   que es lo único que lo arregla.
 * - `cerrada`: se resolvió o se canceló. Volver a pedir entrar no arregla nada,
 *   así que no se le sugiere.
 */
const CLASIFICACION: Record<
  GuardianSessionStatusValue,
  "viva" | "caducada" | "cerrada"
> = {
  pending: "viva",
  miniapp_opened: "viva",
  capturing: "viva",
  analyzing: "viva",
  awaiting_retry: "viva",
  expired: "caducada",
  resolved: "cerrada",
  cancelled: "cerrada",
};

// Same rationale as InitDataGuard: the api only ever sees the proxy's IP, so
// server.ts's global limiter can't isolate one Telegram user's Guardian
// attempts from another's. Key on the session's DB-verified telegramUserId —
// reachable only once a session lookup has already succeeded, so an attacker
// without the raw session token never reaches this check at all.
const USER_RATE_CAPACITY = 20;
const USER_RATE_REFILL_PER_SEC = 5;

export interface GuardianVerifiedContext {
  readonly session: VerificationSessionRecord;
  /** True when initData's user matches the session's Telegram user — a
   * mismatch is recorded as a session-integrity violation upstream, never
   * silently ignored. */
  readonly userMatches: boolean;
  readonly telegramUserId: bigint;
}

export interface GuardianRequest {
  headers: Record<string, string | string[] | undefined>;
  guardian?: GuardianVerifiedContext;
}

export const headerValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined => {
  const raw = headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
};

/**
 * Best-effort client IP behind the Cloudflare tunnel. Our tunnel does NOT
 * forward the standard IP headers to the origin, and Cloudflare reserves them
 * (x-real-ip, x-forwarded-for, cf-connecting-ip, true-client-ip) so a Transform
 * Rule can't set them either — so a custom `x-modryva-ip` header (added by a
 * Cloudflare Request Header Transform Rule with value `ip.src`) is checked
 * first. The standard headers stay as fallbacks for any other deployment. All
 * trustworthy here because the tunnel is the sole ingress (api on 127.0.0.1).
 * x-forwarded-for may be "client, proxy1, …" so the first hop is the client.
 */
export const resolveClientIp = (
  headers: Record<string, string | string[] | undefined>,
): string | undefined => {
  const forwardedFor = headerValue(headers, "x-forwarded-for");
  const firstHop = forwardedFor
    ? forwardedFor.split(",")[0]?.trim() || undefined
    : undefined;
  return (
    headerValue(headers, "x-modryva-ip") ??
    headerValue(headers, "cf-connecting-ip") ??
    headerValue(headers, "true-client-ip") ??
    firstHop ??
    headerValue(headers, "x-real-ip")
  );
};

/** Both must independently be true for the dev-only initData bypass below to
 * activate at all — an env flag alone is not enough, so a test-mode-enabled
 * production deployment still can't be tricked by just adding a header. */
const testBypassAllowed = (): boolean =>
  getRuntimeEnv().GUARDIAN_TEST_MODE && process.env.NODE_ENV !== "production";

/**
 * Authenticates Guardian Verification Mini App requests. Two independent
 * proofs are required, matching rule 6 of the spec:
 *   1. `X-Guardian-Session: <opaque token>` — resolves to a live session by
 *      its SHA-256 hash (the raw token is never persisted or logged).
 *   2. `Authorization: tma <initData>` — the standard Telegram Mini App HMAC
 *      proof, verified against the TOKEN OF THE BOT THAT ACTUALLY OWNS this
 *      session's tenant (resolved server-side, never trusted from a header).
 * The two are then cross-checked: initData's user.id must equal the
 * session's telegramUserId, or the request is flagged (not silently trusted)
 * so the decision engine can route it as an integrity violation.
 *
 * DEV-ONLY TEST BYPASS (Playwright/E2E, never usable in production): when
 * GUARDIAN_TEST_MODE=1 AND NODE_ENV!=="production" AND the request sends
 * `X-Guardian-Test-Bypass: 1` (an explicit third signal — ambient env state
 * alone is never enough), proof #2 becomes "send
 * `X-Guardian-Test-User: <telegramUserId>` matching the session's real
 * user" instead of a real signed initData blob, since fabricating one
 * requires the real bot token this project must never touch in this phase.
 * `scripts/guardian-doctor.mjs` and this same env check both independently
 * fail hard if GUARDIAN_TEST_MODE is ever 1 in production.
 */
@Injectable()
export class GuardianSessionGuard implements CanActivate {
  private readonly guardian = new PrismaGuardianRepository();
  private readonly perUser = createRateLimiter({
    capacity: USER_RATE_CAPACITY,
    refillPerSec: USER_RATE_REFILL_PER_SEC,
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardianRequest>();

    const sessionToken = headerValue(request.headers, "x-guardian-session");
    if (!sessionToken) {
      throw rechazar(
        "missing-session-token",
        new UnauthorizedException({ error: "missing-session-token" }),
      );
    }

    const session = await this.guardian.findSessionByTokenHash(
      hashSessionToken(sessionToken),
    );
    if (!session) {
      // Sin sessionId que dar: el token no resuelve a nada. El propio hecho de
      // que alguien traiga un token muerto ya es el dato.
      throw rechazar(
        "session-not-found",
        new NotFoundException({ error: "session-not-found" }),
      );
    }
    // Los dos portazos de abajo son la única prueba que existe de que alguien
    // SÍ abrió el enlace, aunque tarde. `describeLlegadaTarde` es lo que separa
    // "llegó fuera de plazo" (se arregla con el TTL) de "llegó a una sesión ya
    // cerrada" (no se arregla con el TTL). Se registra, no se cambia lo que se
    // responde.
    //
    // El orden importa, y estaba al revés. Caducar deja DOS rastros distintos:
    // el plazo vencido y, un minuto después, el `status = "expired"` que le
    // sella el barrido del worker. Mirando primero el estado, todo lo que el
    // barrido ya había tocado salía por `session-not-active` — "esta
    // verificación ya se completó o fue cancelada" en pantalla, a alguien que
    // ni completó ni canceló nada, y sin el «vuelve a solicitar entrar» que era
    // justo lo que tenía que hacer. La rama de caducidad solo era alcanzable en
    // los segundos que van del vencimiento al siguiente barrido, y por eso
    // parecía que casi nadie llegaba tarde.
    //
    // Ahora `session-expired` cubre las dos formas de haber caducado, y
    // `session-not-active` queda para lo que de verdad se cerró: resuelta o
    // cancelada.
    const clase = CLASIFICACION[session.status];
    const caducada =
      clase === "caducada" ||
      (clase === "viva" && session.expiresAt.getTime() <= Date.now());
    if (caducada) {
      throw rechazar(
        "session-expired",
        new GoneException({ error: "session-expired" }),
        {
          sessionId: session.id,
          ...describeLlegadaTarde(session, new Date(), "caducada"),
        },
      );
    }
    if (clase !== "viva") {
      // La puerta sigue cerrada; lo que cambia es que ahora se dice CUÁL de las
      // tres formas de estar cerrada es (ver session-outcome.ts). Una consulta
      // más, y solo en esta rama: el veredicto del staff es lo único que separa
      // "ya estás dentro" de "sigues esperando", y sin mirarlo la pantalla
      // vuelve a mentirle a quien ya está en el grupo.
      //
      // Si esa consulta falla se sigue adelante sin ella: la lectura sin staff
      // es "en revisión", que es la respuesta prudente —no promete un sí ni
      // cierra la puerta— y en ningún caso vale perder el 410 por un error de
      // base de datos en una consulta que solo elige un texto.
      const accionesDeStaff = await this.guardian
        .listStaffDecisions(session.id)
        .then((decisiones) => decisiones.map((decision) => decision.action))
        .catch(() => [] as string[]);
      const desenlace = describirDesenlace(session, accionesDeStaff);
      throw rechazar(
        "session-not-active",
        new GoneException({
          error: "session-not-active",
          status: session.status,
          desenlace,
        }),
        {
          sessionId: session.id,
          desenlace,
          ...describeLlegadaTarde(session, new Date(), "cerrada"),
        },
      );
    }
    if (!this.perUser.tryConsume(`user:${session.telegramUserId}`)) {
      throw rechazar(
        "rate-limited",
        new HttpException(
          { error: "rate-limited" },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
        { sessionId: session.id },
      );
    }

    const testBypass =
      headerValue(request.headers, "x-guardian-test-bypass") === "1" &&
      testBypassAllowed();
    if (testBypass) {
      const testUser = headerValue(request.headers, "x-guardian-test-user");
      if (!testUser) {
        throw rechazar(
          "missing-test-user",
          new UnauthorizedException({ error: "missing-test-user" }),
          { sessionId: session.id },
        );
      }
      const telegramUserId = BigInt(testUser);
      if (telegramUserId !== session.telegramUserId) {
        throw rechazar(
          "session-user-mismatch",
          new ForbiddenException({ error: "session-user-mismatch" }),
          { sessionId: session.id },
        );
      }
      request.guardian = { session, userMatches: true, telegramUserId };
      return true;
    }

    const rawAuth = headerValue(request.headers, "authorization");
    const spaceIndex = rawAuth?.indexOf(" ") ?? -1;
    const scheme = spaceIndex >= 0 ? rawAuth?.slice(0, spaceIndex) : rawAuth;
    const initData = spaceIndex >= 0 ? rawAuth?.slice(spaceIndex + 1) : "";
    if (!rawAuth || scheme?.toLowerCase() !== "tma" || !initData) {
      throw rechazar(
        "missing-auth",
        new UnauthorizedException({ error: "missing-auth" }),
        { sessionId: session.id },
      );
    }

    const env = getRuntimeEnv();
    let botToken: string | undefined;
    try {
      botToken = await this.guardian.resolveBotTokenForTenant(
        session.tenantId,
        env.TELEGRAM_BOT_TOKEN,
        env.MANAGED_BOT_TOKEN_KEY,
      );
    } catch {
      throw rechazar(
        "bot-token-unavailable",
        new ServiceUnavailableException({ error: "bot-token-unavailable" }),
        { sessionId: session.id, tenantId: session.tenantId },
      );
    }
    if (!botToken) {
      throw rechazar(
        "bot-token-unavailable",
        new ServiceUnavailableException({ error: "bot-token-unavailable" }),
        { sessionId: session.id, tenantId: session.tenantId },
      );
    }

    const verification = verifyTelegramInitData(initData, botToken, {
      maxAgeSeconds: env.INITDATA_MAX_AGE_SECONDS,
      now: Math.floor(Date.now() / 1000),
    });
    if (!verification.ok) {
      throw rechazar(
        verification.error ?? "invalid-initdata",
        new UnauthorizedException({ error: verification.error }),
        { sessionId: session.id },
      );
    }
    const initDataUserId = verification.user?.id;
    if (initDataUserId == null) {
      throw rechazar(
        "missing-user",
        new UnauthorizedException({ error: "missing-user" }),
        { sessionId: session.id },
      );
    }

    const telegramUserId = BigInt(String(initDataUserId));
    const userMatches = telegramUserId === session.telegramUserId;
    if (!userMatches) {
      // Never silently trust a mismatched user — but don't leak WHICH part
      // mismatched to the client either. En el registro sí queda la pareja,
      // porque un enlace reenviado a otra persona es justo lo que hay que
      // poder ver desde fuera.
      throw rechazar(
        "session-user-mismatch",
        new ForbiddenException({ error: "session-user-mismatch" }),
        {
          sessionId: session.id,
          esperado: session.telegramUserId.toString(),
          recibido: telegramUserId.toString(),
        },
      );
    }

    request.guardian = { session, userMatches, telegramUserId };
    return true;
  }
}

export const getGuardianContext = (
  request: GuardianRequest,
): GuardianVerifiedContext => {
  if (!request.guardian) {
    throw new UnauthorizedException({ error: "missing-auth" });
  }
  return request.guardian;
};
