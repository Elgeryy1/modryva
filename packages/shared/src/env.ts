import { z } from "zod";

const telegramIdListSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return value;
}, z.array(z.coerce.bigint()).default([]));

const csvStringListSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return value;
}, z.array(z.string()).default([]));

const booleanFlagSchema = z.preprocess(
  (value) => value === true || value === "1" || value === "true",
  z.boolean(),
);

const optionalNonEmptyString = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );

const runtimeEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PORT: z.coerce.number().int().positive().default(3001),
    BOT_PORT: z.coerce.number().int().positive().default(3002),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
    // Build provenance — injected at image build time (docker ARG → ENV). The
    // /build-info endpoint exposes these so a running container's exact source
    // is provable, instead of being inferred from image age (which does NOT
    // prove the commit). Default "unknown" when built without the arg.
    APP_BUILD_SHA: z.string().default("unknown"),
    APP_BUILD_TIME: z.string().default("unknown"),
    // Error tracking (self-hosted GlitchTip, which speaks the Sentry protocol).
    // Optional and empty by default: no DSN means no reporting at all, so local
    // runs and tests never emit, and a missing value can never fail a boot.
    SENTRY_DSN: z.string().default(""),
    DATABASE_URL: z
      .string()
      .url()
      .or(z.string().startsWith("postgresql://"))
      .optional(),
    REDIS_URL: z
      .string()
      .url()
      .or(z.string().startsWith("redis://"))
      .optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
    TELEGRAM_BOT_USERNAME: z.string().min(1).default("superbot_bot"),
    TELEGRAM_APP_URL: z
      .string()
      .url()
      .or(z.string().startsWith("http://"))
      .default("http://localhost:3003"),
    TELEGRAM_WEBHOOK_BASE_URL: optionalNonEmptyString(
      z.string().url().or(z.string().startsWith("http://")),
    ),
    // Mini App: max age of a signed initData before it is rejected as stale.
    INITDATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(3600),
    // Mini App short-name registered in BotFather (t.me/<bot>/<name>).
    TELEGRAM_MINIAPP_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_]{1,64}$/u)
      .default("config"),
    // In-container base URL the Next.js proxy forwards /api/* to.
    API_INTERNAL_URL: z.string().url().default("http://api:3001"),
    SUPERBOT_OWNER_TELEGRAM_ID: z.coerce.bigint().optional(),
    /**
     * El id de Telegram de la cuenta del Ayudante (`apps/ayudante`).
     *
     * El bot lo necesita para dos cosas y ninguna es hablar con el: reconocer
     * su entrada en un grupo, y saber a quien promover. Se compara el ID y no
     * el alias, que se cambia — sin esto, cualquiera que entrase justo despues
     * de `/ayudante auditoria` podria llevarse el cargo.
     *
     * Opcional: sin el, `/ayudante` lo dice en vez de fallar en silencio.
     */
    AYUDANTE_TELEGRAM_ID: z.coerce.bigint().optional(),
    SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS: telegramIdListSchema,
    /**
     * A quien el bot no sanciona NUNCA, ni a mano ni por su cuenta, y a quien
     * no le pide verificarse ni presentarse.
     *
     * Va por entorno y NO por base de datos a proposito: si se pudiera tocar
     * desde la Mini App, cualquiera con acceso al panel podria hacerse inmune
     * y despues hacer lo que quisiera. Es la misma escalada que impide separar
     * `puedeModerar` de `puedeConfigurar`, entrando por la puerta de al lado.
     * Cambiarla cuesta entrar al servidor y reiniciar, y ese coste es la
     * funcion.
     *
     * Distinto de `SUPERBOT_OWNER_TELEGRAM_ID` y de los admin de plataforma,
     * que dicen lo que alguien PUEDE hacer. Esta dice lo que no se le puede
     * hacer A EL, que no es lo mismo y no tiene por que ser la misma gente.
     *
     * La regla vive en `esIntocable` (`modules/security`). Ojo: quien este
     * aqui deja de generar avisos y sanciones por completo, asi que tampoco
     * quedara rastro de por que no se le sanciono.
     */
    SUPERBOT_INTOCABLES_TELEGRAM_IDS: telegramIdListSchema,
    /**
     * Quien tiene la caja fuerte sin tope.
     *
     * Va por entorno y no en el codigo por la regla del repo: los ids de
     * Telegram son datos personales y no entran en git. Ademas asi se anade o
     * se quita a alguien sin desplegar.
     *
     * Solo levanta el tope de lo que cabe DENTRO de la caja: no crea monedas,
     * no cambia el saldo y no toca a nadie mas. Lo que hace es que a esas
     * personas no se les pueda robar lo que guarden.
     */
    ECONOMIA_CAJA_ILIMITADA_IDS: telegramIdListSchema,
    SESSION_SECRET: z.string().min(1).optional(),
    MANAGED_BOT_TOKEN_KEY: optionalNonEmptyString(z.string().min(16)),
    AI_ENABLED: booleanFlagSchema.default(false),
    AI_GROQ_ENABLED: booleanFlagSchema.default(false),
    AI_GROQ_API_KEY_1: optionalNonEmptyString(z.string().min(1)),
    AI_GROQ_API_KEY_2: optionalNonEmptyString(z.string().min(1)),
    AI_GROQ_API_KEY_3: optionalNonEmptyString(z.string().min(1)),
    AI_GROQ_API_KEY_4: optionalNonEmptyString(z.string().min(1)),
    AI_GROQ_API_KEY_5: optionalNonEmptyString(z.string().min(1)),
    AI_GROQ_API_KEYS: optionalNonEmptyString(z.string().min(1)),
    // llama-3.1-8b-instant hasta el 2026-08-13: Groq lo retira el 16-ago-2026
    // (aviso por correo) y recomienda gpt-oss-20b como sustituto.
    AI_GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
    AI_GROQ_KEY_COOLDOWN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    AI_GEMINI_ENABLED: booleanFlagSchema.default(false),
    AI_GEMINI_PROJECT_1_API_KEY: optionalNonEmptyString(z.string().min(1)),
    AI_GEMINI_PROJECT_2_API_KEY: optionalNonEmptyString(z.string().min(1)),
    AI_GEMINI_PROJECT_3_API_KEY: optionalNonEmptyString(z.string().min(1)),
    AI_GEMINI_PROJECT_4_API_KEY: optionalNonEmptyString(z.string().min(1)),
    AI_GEMINI_PROJECT_5_API_KEY: optionalNonEmptyString(z.string().min(1)),
    AI_GEMINI_API_KEYS: optionalNonEmptyString(z.string().min(1)),
    AI_GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash-lite"),
    AI_GEMINI_KEY_COOLDOWN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(90),
    AI_OPENROUTER_ENABLED: booleanFlagSchema.default(false),
    AI_OPENROUTER_API_KEY: optionalNonEmptyString(z.string().min(1)),
    AI_OPENROUTER_MODEL: z.string().min(1).default("openrouter/free"),
    AI_OPENROUTER_ALLOW_PAID_MODELS: booleanFlagSchema.default(false),
    AI_PROVIDER_ORDER: csvStringListSchema.default([
      "groq",
      "gemini",
      "openrouter",
    ]),
    AI_MAX_REQUESTS_PER_USER_DAY: z.coerce
      .number()
      .int()
      .positive()
      .default(20),
    AI_MAX_REQUESTS_PER_GROUP_DAY: z.coerce
      .number()
      .int()
      .positive()
      .default(200),
    AI_MAX_TOKENS_PER_REQUEST: z.coerce.number().int().positive().default(1200),
    AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(8000),
    AI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    AI_PRIVACY_MODE: z.enum(["safe", "normal", "full"]).default("normal"),
    TELEGRAM_AI_GUEST_MODE_EXPECTED: booleanFlagSchema.default(false),
    TELEGRAM_AI_INLINE_MODE_EXPECTED: booleanFlagSchema.default(false),
    TELEGRAM_AI_STREAM_DRAFTS: booleanFlagSchema.default(false),
    TELEGRAM_AI_USE_SEND_CHAT_ACTION: booleanFlagSchema.default(true),
    // Inline Mode must stay free: no AI call may run per keystroke. This flag is
    // reserved for a future, explicitly-opt-in "answer inline with AI" mode and
    // must NOT be wired to any AI call yet — see modryva_claude_guest_inline_ai_prompt.
    AI_INLINE_USE_AI_DIRECTLY: booleanFlagSchema.default(false),
    AI_INLINE_CACHE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(300),
    AI_INLINE_MIN_QUERY_CHARS: z.coerce.number().int().min(0).default(1),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),

    // --- Social Core (pole, ruleta, Paulo, gatos y perros) ---
    // Interruptor MAESTRO, apagado por defecto. Con él en false el módulo es
    // invisible: los comandos no responden nada (ni siquiera "está apagado"),
    // la pole automática no mira los mensajes, la sección Social no aparece en
    // el panel y /help no la menciona.
    //
    // Es distinto de los ajustes por grupo, que también nacen apagados: aquello
    // permite que UN grupo lo encienda, esto decide si la función existe. Que
    // sean dos interruptores y no uno es lo que permite tener el código
    // desplegado y dormido — sin ramas vivas ni código a medio quitar.
    //
    // Las tablas se crean igual con la migración: están vacías y ninguna ruta
    // las lee mientras esto sea false.
    SOCIAL_CORE_ENABLED: booleanFlagSchema.default(false),

    // --- Guardian Verification (join-request camera verification) ---
    // Reuses TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_APP_URL,
    // DATABASE_URL and REDIS_URL above rather than duplicating them.
    GUARDIAN_ENABLED: booleanFlagSchema.default(false),
    // The photo-mode gesture/face/age judge reuses the SAME AI_GEMINI_*/
    // AI_GROQ_* keys as the general chat AI (no separate credentials exist)
    // — so simply having those keys configured is not enough to decide
    // whether Guardian should auto-judge photos. This flag is the explicit,
    // independent on/off switch for that judge; default false means
    // enabling chat AI never silently re-enables Guardian's vision judge.
    // See createGuardianVerifyService() in apps/api.
    GUARDIAN_VISION_JUDGE_ENABLED: booleanFlagSchema.default(false),
    // Opt-in VPN/proxy lookup for the verifier's IP (proxycheck.io), shown in
    // the STAFF report. Off by default: it sends the IP to a third party.
    GUARDIAN_IP_INTEL_ENABLED: booleanFlagSchema.default(false),
    // Optional proxycheck.io API key — keyless works at a lower daily rate.
    PROXYCHECK_API_KEY: optionalNonEmptyString(z.string()),
    // Defaults to `${TELEGRAM_APP_URL}/guardian/verify` when unset — see
    // resolveGuardianMiniAppUrl().
    GUARDIAN_MINIAPP_URL: optionalNonEmptyString(
      z.string().url().or(z.string().startsWith("http://")),
    ),
    GUARDIAN_SESSION_SECRET: optionalNonEmptyString(z.string().min(16)),
    // Decrypt-only fallback for a GUARDIAN_SESSION_SECRET rotation window (see
    // docs/INCIDENT-ROTATION-AND-DEPLOY-2026-07-17.md). Optional; must differ
    // from GUARDIAN_SESSION_SECRET and only makes sense alongside it.
    GUARDIAN_SESSION_SECRET_PREVIOUS: optionalNonEmptyString(
      z.string().min(16),
    ),
    // At-rest encryption key for captured media (applied via storage-factory's
    // EncryptingObjectStorageDriver — media is never written unprotected).
    GUARDIAN_MEDIA_ENCRYPTION_KEY: optionalNonEmptyString(z.string().min(16)),
    // Decrypt-only fallback for a GUARDIAN_MEDIA_ENCRYPTION_KEY rotation window.
    // Optional; must differ from the primary and only makes sense alongside it.
    GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS: optionalNonEmptyString(
      z.string().min(16),
    ),
    GUARDIAN_DEFAULT_STAFF_CHAT_ID: z.coerce.bigint().optional(),
    GUARDIAN_DEFAULT_STAFF_THREAD_ID: z.coerce.number().int().optional(),
    GUARDIAN_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    GUARDIAN_STORAGE_PATH: z.string().min(1).default("./data/guardian-media"),
    S3_ENDPOINT: optionalNonEmptyString(z.string().url()),
    S3_BUCKET: optionalNonEmptyString(z.string().min(1)),
    S3_ACCESS_KEY: optionalNonEmptyString(z.string().min(1)),
    S3_SECRET_KEY: optionalNonEmptyString(z.string().min(1)),
    S3_REGION: optionalNonEmptyString(z.string().min(1)),
    // Reserved for a future external analysis microservice; the bundled
    // providers (liveness/age/synthetic) do not call out to this yet.
    AI_SERVICE_URL: optionalNonEmptyString(z.string().url()),
    AI_SERVICE_API_KEY: optionalNonEmptyString(z.string().min(1)),
    GUARDIAN_RETENTION_HOURS: z.coerce.number().int().positive().default(72),
    // Días que se conserva `update_inbox`, el registro de de-duplicación de
    // updates de Telegram. Funcionalmente basta con horas (solo cubre la
    // ventana de reenvío); 14 días deja margen de sobra y valor forense. El
    // job aplica además un suelo propio que este ajuste no puede saltarse —
    // ver MIN_UPDATE_INBOX_DAYS en apps/worker/src/retention.ts.
    UPDATE_INBOX_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
    // La traza de evidencia: lo que permite reconstruir un incidente meses
    // después (es lo que salvó la investigación de las 13 expulsiones del 3 de
    // agosto). 180 días elegidos por Gerard el 5 ago 2026. Suelo de 30 días en
    // el job, que este ajuste NO puede saltarse.
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
    // Señales de actividad (rachas, estadísticas). Suelo de 7 días en el job.
    CHAT_ACTIVITY_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .default(90),
    GUARDIAN_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
    // Groq vision model for the photo-mode gesture/face/age check (Gemini is
    // primary via AI_GEMINI_MODEL; Groq is the free fallback). Configurable
    // because Groq rotates/deprecates model IDs.
    GUARDIAN_GROQ_VISION_MODEL: z
      .string()
      .min(1)
      .default("meta-llama/llama-4-scout-17b-16e-instruct"),
    // Gates the dev-only fixture harness (fake camera, simulated initData) —
    // must never be true in production. See modules/guardian dev-harness.
    GUARDIAN_TEST_MODE: booleanFlagSchema.default(false),
    // Test-only: pins the FIRST requested gesture instead of picking one at
    // random, so a tester can prepare one matching photo (e.g. from a
    // spoof/gesture-pack image) and reliably re-test spoof detection against
    // it. Only has any effect when GUARDIAN_TEST_MODE is also on — see the
    // superRefine below and modules/guardian/src/challenge.ts.
    GUARDIAN_TEST_FORCED_GESTURE: optionalNonEmptyString(
      z.enum([
        "thumbs_up",
        "victory",
        "open_palm",
        "closed_fist",
        "show_one_finger",
        "show_three_fingers",
      ]),
    ),
    // Test-only: pins the SECOND gesture (double verification) the same way
    // GUARDIAN_TEST_FORCED_GESTURE pins the first — lets a tester prepare a
    // second matching photo instead of getting a random second gesture.
    GUARDIAN_TEST_FORCED_GESTURE_2: optionalNonEmptyString(
      z.enum([
        "thumbs_up",
        "victory",
        "open_palm",
        "closed_fist",
        "show_one_finger",
        "show_three_fingers",
      ]),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.GUARDIAN_STORAGE_DRIVER === "s3") {
      const required: Array<[string, unknown]> = [
        ["S3_ENDPOINT", env.S3_ENDPOINT],
        ["S3_BUCKET", env.S3_BUCKET],
        ["S3_ACCESS_KEY", env.S3_ACCESS_KEY],
        ["S3_SECRET_KEY", env.S3_SECRET_KEY],
        ["S3_REGION", env.S3_REGION],
      ];
      for (const [key, value] of required) {
        if (value === undefined) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when GUARDIAN_STORAGE_DRIVER=s3`,
          });
        }
      }
    }
    if (
      env.NODE_ENV === "production" &&
      env.GUARDIAN_ENABLED &&
      env.GUARDIAN_TEST_MODE
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["GUARDIAN_TEST_MODE"],
        message: "GUARDIAN_TEST_MODE must never be true in production",
      });
    }
    // Fail closed: with Guardian on in production, the media key is mandatory.
    // Without it, createStorageDriverFromEnv silently returns the RAW driver and
    // captured face/gesture selfies are written unencrypted (a biometric-PII
    // leak on disk/backup/bucket theft). Requiring it here stops the misconfig
    // at startup instead of discovering it after images are already in the clear.
    if (
      env.NODE_ENV === "production" &&
      env.GUARDIAN_ENABLED &&
      env.GUARDIAN_MEDIA_ENCRYPTION_KEY === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["GUARDIAN_MEDIA_ENCRYPTION_KEY"],
        message:
          "GUARDIAN_MEDIA_ENCRYPTION_KEY is required when GUARDIAN_ENABLED is true in production (captured media would otherwise be stored unencrypted)",
      });
    }
    if (env.AI_GROQ_MODEL.toLowerCase().includes("70b")) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_GROQ_MODEL"],
        message:
          "Groq 70B disabled: Modryva only uses small Groq models (openai/gpt-oss-20b)",
      });
    }
    if (
      !env.AI_OPENROUTER_ALLOW_PAID_MODELS &&
      env.AI_OPENROUTER_MODEL !== "openrouter/free" &&
      !env.AI_OPENROUTER_MODEL.endsWith(":free")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_OPENROUTER_MODEL"],
        message: "OpenRouter paid models disabled",
      });
    }
    // Rotation fallbacks: an optional PREVIOUS key enables decrypt-only fallback
    // during a key-rotation window. It must never equal its primary (that would
    // be a silent no-op masking a botched rotation) and is meaningless — and
    // dangerous — without the primary set. See
    // docs/INCIDENT-ROTATION-AND-DEPLOY-2026-07-17.md.
    const rotationPairs = [
      {
        primaryName: "GUARDIAN_SESSION_SECRET",
        primary: env.GUARDIAN_SESSION_SECRET,
        previousName: "GUARDIAN_SESSION_SECRET_PREVIOUS",
        previous: env.GUARDIAN_SESSION_SECRET_PREVIOUS,
      },
      {
        primaryName: "GUARDIAN_MEDIA_ENCRYPTION_KEY",
        primary: env.GUARDIAN_MEDIA_ENCRYPTION_KEY,
        previousName: "GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS",
        previous: env.GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS,
      },
    ] as const;
    for (const pair of rotationPairs) {
      if (pair.previous === undefined) {
        continue;
      }
      if (pair.primary === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [pair.previousName],
          message: `${pair.previousName} requires ${pair.primaryName} to be set`,
        });
      } else if (pair.previous === pair.primary) {
        ctx.addIssue({
          code: "custom",
          path: [pair.previousName],
          message: `${pair.previousName} must differ from ${pair.primaryName}`,
        });
      }
    }
  });

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export const getRuntimeEnv = (
  input: NodeJS.ProcessEnv = process.env,
): RuntimeEnv => {
  const parsed = runtimeEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  return parsed.data;
};

/** GUARDIAN_MINIAPP_URL, defaulting to `${TELEGRAM_APP_URL}/guardian/verify`. */
export const resolveGuardianMiniAppUrl = (env: RuntimeEnv): string =>
  env.GUARDIAN_MINIAPP_URL ??
  `${env.TELEGRAM_APP_URL.replace(/\/$/u, "")}/guardian/verify`;

/** Collects configured API keys from the per-project vars + optional CSV var,
 * de-duplicated. Shared by the Groq/Gemini pools in modules/ai/src/provider.ts
 * and guardian-verify.factory.ts so both agree on what "configured" means. */
export const collectApiKeys = (
  individual: readonly (string | undefined)[],
  csv: string | undefined,
): string[] => {
  const keys = individual.filter((k): k is string => Boolean(k));
  if (csv) {
    keys.push(
      ...csv
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    );
  }
  return [...new Set(keys)];
};

export interface GestureVisionJudgeStatus {
  readonly flagEnabled: boolean;
  readonly keysConfigured: boolean;
  readonly configured: boolean;
}

/** The REAL signal for whether Guardian can auto-judge a photo (face/age/
 * gesture): both GUARDIAN_VISION_JUDGE_ENABLED and at least one Gemini/Groq
 * key. AI_SERVICE_URL is a different, optional CV microservice — it must
 * never be read as a proxy for this. See guardian-verify.factory.ts. */
export const resolveGestureVisionJudgeStatus = (
  env: RuntimeEnv,
): GestureVisionJudgeStatus => {
  const geminiKeys = collectApiKeys(
    [
      env.AI_GEMINI_PROJECT_1_API_KEY,
      env.AI_GEMINI_PROJECT_2_API_KEY,
      env.AI_GEMINI_PROJECT_3_API_KEY,
      env.AI_GEMINI_PROJECT_4_API_KEY,
      env.AI_GEMINI_PROJECT_5_API_KEY,
    ],
    env.AI_GEMINI_API_KEYS,
  );
  const groqKeys = collectApiKeys(
    [
      env.AI_GROQ_API_KEY_1,
      env.AI_GROQ_API_KEY_2,
      env.AI_GROQ_API_KEY_3,
      env.AI_GROQ_API_KEY_4,
      env.AI_GROQ_API_KEY_5,
    ],
    env.AI_GROQ_API_KEYS,
  );
  const keysConfigured = geminiKeys.length > 0 || groqKeys.length > 0;
  return {
    flagEnabled: env.GUARDIAN_VISION_JUDGE_ENABLED,
    keysConfigured,
    configured: env.GUARDIAN_VISION_JUDGE_ENABLED && keysConfigured,
  };
};
