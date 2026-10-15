import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaFoundationRepository,
  PrismaGuardianRepository,
} from "@superbot/data";
import type { SubmittedStepResult } from "@superbot/module-guardian";
import {
  type GuardianRequest,
  GuardianSessionGuard,
  getGuardianContext,
  headerValue,
  resolveClientIp,
} from "./guardian-session.guard.js";
import { GuardianVerifyService } from "./guardian-verify.service.js";

interface SubmitAttemptBody {
  readonly attemptId?: string;
  readonly mediaBase64?: string;
  readonly declaredMimeType?: string;
  readonly durationMs?: number;
  readonly width?: number;
  readonly height?: number;
  readonly clientFaceCount?: number;
  readonly clientQualityScore?: number;
  readonly challengeNonce?: string;
  readonly stepResults?: SubmittedStepResult[];
  readonly sessionStartedAtMs?: number;
  readonly declaredAge?: number;
  /** Required (and validated below) when the chat's requiredPhotos is 2. */
  readonly secondMediaBase64?: string;
  readonly secondDeclaredMimeType?: string;
}

/**
 * Funnel ranks for VerificationSession.progressStep. The Mini App runs
 * consent -> declare age -> camera permission -> guide -> capture, and only
 * some of those touch the server, so the gaps are filled by an explicit ping
 * (see the `progress` route below). Ranked so progress can only move forward.
 */
const PROGRESS = {
  opened: 1,
  consent: 2,
  age: 3,
  camera: 4,
  photo: 5,
} as const;

@Controller("v1/guardian")
@UseGuards(GuardianSessionGuard)
export class GuardianVerifyController {
  private readonly guardian = new PrismaGuardianRepository();
  private readonly foundation = new PrismaFoundationRepository();

  // Explicit @Inject: tsx/esbuild does not emit decorator metadata.
  constructor(
    @Inject(GuardianVerifyService)
    private readonly service: GuardianVerifyService,
  ) {}

  @Get("session")
  async getSession(@Req() req: GuardianRequest) {
    const { session } = getGuardianContext(req);
    const settings = await this.guardian.getSettings(
      session.tenantId,
      session.chatId,
    );
    if (!settings) {
      throw new ServiceUnavailableException({ error: "settings-unavailable" });
    }
    // Country requirement (IP-based only — never phone number or GPS): this
    // is the Mini App's very FIRST request, fired on load before any
    // consent/age/photo screen renders, so the country is pinned before the
    // person has any on-screen hint that location matters (see
    // decision-engine.ts's countryCode gate and the repo method's docstring
    // for why a later request can never overwrite this). This header is
    // trustworthy ONLY because docker-compose.yml binds the api/web ports to
    // 127.0.0.1, making the Cloudflare tunnel the sole ingress (Cloudflare
    // strips/overwrites any client-supplied Cf-IpCountry at its edge) — do
    // not read this header if that port binding ever changes.
    const country = headerValue(req.headers, "cf-ipcountry");
    if (country && country !== "XX" && country !== "T1") {
      await this.guardian.setSessionCountryIfUnset(
        session.id,
        country.toUpperCase(),
      );
    }
    // Same first-request pinning as the country, and trustworthy for the same
    // reason (the CF tunnel is the sole ingress). cf-connecting-ip isn't always
    // forwarded by the tunnel, so resolveClientIp falls back through the
    // standard proxy chain (x-forwarded-for, etc.). Shown to STAFF for fraud.
    const ip = resolveClientIp(req.headers);
    if (ip) {
      await this.guardian.setSessionIpIfUnset(session.id, ip);
    }
    // First request the Mini App makes, so it marks "they actually got the app
    // to load" — the difference between ignoring the prompt and trying.
    await this.guardian.advanceProgress(session.id, PROGRESS.opened);
    return this.service.buildSessionView(session, settings);
  }

  @Post("consent")
  async recordConsent(
    @Req() req: GuardianRequest,
    @Body() body: { version?: string },
  ) {
    const { session, telegramUserId } = getGuardianContext(req);
    if (!body?.version) {
      throw new BadRequestException({ error: "missing-version" });
    }
    await this.foundation.recordAudit({
      tenantId: session.tenantId,
      actorType: "user",
      action: "guardian.consent.accepted",
      resourceType: "verification_session",
      resourceId: session.id,
      payload: {
        version: body.version,
        telegramUserId: telegramUserId.toString(),
      },
    });
    await this.guardian.advanceProgress(session.id, PROGRESS.consent);
    return { ok: true };
  }

  /**
   * Marks a screen the Mini App reached that involves no other server call —
   * declaring an age, and being granted the camera. Without these the funnel
   * has one opaque gap between consent and capture, which is exactly where
   * most people are lost, so "they abandoned" could never be narrowed down to
   * a refused camera versus a screen nobody read.
   *
   * Telemetry only: it can never move a session backwards, grants nothing, and
   * a bad value is ignored rather than rejected — losing a data point must
   * never cost somebody their verification.
   */
  @Post("progress")
  async recordProgress(
    @Req() req: GuardianRequest,
    @Body() body: { step?: string },
  ) {
    const { session } = getGuardianContext(req);
    const step =
      body?.step === "age"
        ? PROGRESS.age
        : body?.step === "camera"
          ? PROGRESS.camera
          : null;
    if (step !== null) {
      await this.guardian.advanceProgress(session.id, step);
    }
    return { ok: true };
  }

  @Post("attempt/start")
  async startAttempt(@Req() req: GuardianRequest) {
    const { session } = getGuardianContext(req);
    const settings = await this.guardian.getSettings(
      session.tenantId,
      session.chatId,
    );
    if (!settings) {
      throw new ServiceUnavailableException({ error: "settings-unavailable" });
    }
    // Reaching capture means consent, age and the camera all went through.
    await this.guardian.advanceProgress(session.id, PROGRESS.camera);
    const result = await this.service.beginAttempt(session, settings);
    if ("error" in result) {
      throw new BadRequestException({ error: result.error });
    }
    return result;
  }

  @Post("attempt/submit")
  async submitAttempt(
    @Req() req: GuardianRequest,
    @Body() body: SubmitAttemptBody,
  ) {
    const { session } = getGuardianContext(req);
    const settings = await this.guardian.getSettings(
      session.tenantId,
      session.chatId,
    );
    if (!settings) {
      throw new ServiceUnavailableException({ error: "settings-unavailable" });
    }
    if (
      !body?.attemptId ||
      !body.mediaBase64 ||
      !body.declaredMimeType ||
      !body.challengeNonce ||
      !Array.isArray(body.stepResults) ||
      body.sessionStartedAtMs === undefined
    ) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    // Self-declared age is optional at the API boundary (the Mini App makes it
    // required in the UX); when present it must be a sane integer. It is only
    // ever shown to STAFF — never a decision signal — so a bad value is a
    // 400, not a silent pass into the pipeline.
    if (
      body.declaredAge !== undefined &&
      (!Number.isInteger(body.declaredAge) ||
        body.declaredAge < 1 ||
        body.declaredAge > 120)
    ) {
      throw new BadRequestException({ error: "invalid-declared-age" });
    }
    // Double verification: never silently degrade to a single-photo decision
    // when the chat asked for two — reject the submission outright rather
    // than let the second photo quietly go missing.
    if (
      settings.requiredPhotos === 2 &&
      (!body.secondMediaBase64 || !body.secondDeclaredMimeType)
    ) {
      throw new BadRequestException({ error: "second-photo-required" });
    }
    await this.guardian.advanceProgress(session.id, PROGRESS.photo);
    return this.service.submitAttempt(session, settings, {
      attemptId: body.attemptId,
      mediaBase64: body.mediaBase64,
      declaredMimeType: body.declaredMimeType,
      challengeNonce: body.challengeNonce,
      stepResults: body.stepResults,
      sessionStartedAtMs: body.sessionStartedAtMs,
      ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {}),
      ...(body.width !== undefined ? { width: body.width } : {}),
      ...(body.height !== undefined ? { height: body.height } : {}),
      ...(body.clientFaceCount !== undefined
        ? { clientFaceCount: body.clientFaceCount }
        : {}),
      ...(body.clientQualityScore !== undefined
        ? { clientQualityScore: body.clientQualityScore }
        : {}),
      ...(body.declaredAge !== undefined
        ? { declaredAge: body.declaredAge }
        : {}),
      ...(body.secondMediaBase64 !== undefined
        ? { secondMediaBase64: body.secondMediaBase64 }
        : {}),
      ...(body.secondDeclaredMimeType !== undefined
        ? { secondDeclaredMimeType: body.secondDeclaredMimeType }
        : {}),
    });
  }
}
