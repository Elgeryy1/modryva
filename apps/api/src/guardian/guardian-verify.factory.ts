import {
  PrismaFoundationRepository,
  PrismaGuardianRepository,
} from "@superbot/data";
import { createStorageDriverFromEnv } from "@superbot/module-files";
import {
  createDefaultProviders,
  GeminiGroqGestureVisionProvider,
  type GestureVisionProvider,
  NotConfiguredGestureVisionProvider,
  type ProvenanceScanner,
} from "@superbot/module-guardian";
import { collectApiKeys, getRuntimeEnv } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import { GuardianVerifyService } from "./guardian-verify.service.js";

/** Builds a fully-wired GuardianVerifyService from runtime env — the single
 * composition root so the service itself stays dependency-injected/testable. */
export const createGuardianVerifyService = (): GuardianVerifyService => {
  const env = getRuntimeEnv();
  const repo = new PrismaGuardianRepository();
  const foundation = new PrismaFoundationRepository();
  const storage = createStorageDriverFromEnv(env);

  // The provenance byte-scanner reads back the exact bytes just written by
  // this same storage driver — see the module docstring in providers.ts for
  // why a temp file isn't needed.
  const scanner: ProvenanceScanner = {
    readFile: async (key) => {
      const data = await storage.get(key);
      if (!data) {
        throw new Error("media-not-found");
      }
      return data;
    },
  };

  // Photo-mode gesture + face + age check. Gemini (multimodal) is primary and
  // Groq (Llama-vision) is the free fallback; both reuse the same API keys as
  // the chat AI layer, so GUARDIAN_VISION_JUDGE_ENABLED is required in
  // addition to the keys — see its definition in packages/shared/src/env.ts.
  // Without the flag on (or with no keys configured) the not-configured
  // provider returns "unavailable", so AUTO can never approve without a real
  // judgment (routes to STAFF) — never a fabricated score.
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
  const gestureVision: GestureVisionProvider =
    env.GUARDIAN_VISION_JUDGE_ENABLED &&
    (geminiKeys.length > 0 || groqKeys.length > 0)
      ? new GeminiGroqGestureVisionProvider({
          readMedia: scanner.readFile,
          ...(geminiKeys.length > 0
            ? { geminiApiKeys: geminiKeys, geminiModel: env.AI_GEMINI_MODEL }
            : {}),
          ...(groqKeys.length > 0
            ? {
                groqApiKeys: groqKeys,
                groqModel: env.GUARDIAN_GROQ_VISION_MODEL,
              }
            : {}),
        })
      : new NotConfiguredGestureVisionProvider();

  // Deliberately NOT thrown here: this factory runs once at API bootstrap,
  // and Guardian being unconfigured must never crash the whole process. A
  // missing secret instead makes GuardianVerifyService fail closed (503) the
  // moment a request actually needs it — see its sessionSecret checks.
  return new GuardianVerifyService({
    repo,
    foundation,
    storage,
    providers: createDefaultProviders(scanner, {
      // AI_SERVICE_URL is the real visual-analyzer service (Python/FastAPI/
      // OpenCV/MediaPipe — services/guardian-vision-analyzer). Wiring it
      // here is what turns `livenessStatus` from an always-not_evaluated
      // stub into a real, independently-verified signal AUTO/STRICT can
      // actually reach — see decision-engine.ts and providers.ts.
      ...(env.AI_SERVICE_URL
        ? {
            visualAnalyzer: {
              baseUrl: env.AI_SERVICE_URL,
              ...(env.AI_SERVICE_API_KEY
                ? { apiKey: env.AI_SERVICE_API_KEY }
                : {}),
              readMedia: scanner.readFile,
            },
          }
        : {}),
    }),
    gestureVision,
    gateway: new HttpTelegramGateway(),
    sessionSecret: env.GUARDIAN_SESSION_SECRET,
    sessionSecretPrevious: env.GUARDIAN_SESSION_SECRET_PREVIOUS,
    maxUploadBytes: env.GUARDIAN_MAX_UPLOAD_MB * 1024 * 1024,
    primaryToken: env.TELEGRAM_BOT_TOKEN,
    managedBotTokenKey: env.MANAGED_BOT_TOKEN_KEY,
  });
};
