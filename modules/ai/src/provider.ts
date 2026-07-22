import { createHash } from "node:crypto";
import type { RuntimeEnv } from "@superbot/shared";

export type AiRole = "system" | "user" | "assistant";

export type AiTask =
  // -- In active use: dispatched by a real caller as of 2026-07-15 --
  | "fast_chat" // apps/bot/src/bot-update.service.ts (AI "chat" command)
  | "summarize_short" // apps/bot/src/bot-update.service.ts ("summarize" command) + apps/worker/src/recap-processor.ts (weekly recap narration)
  | "translate" // apps/bot/src/bot-update.service.ts ("translate" command)
  // -- Reserved for future features. These exist so cacheableTasks and
  //    providersForTask (below) can encode provider-routing/caching
  //    decisions ahead of time, but as of the 2026-07-15 audit NO handler
  //    dispatches them. Do not assume the branches that reference these
  //    values are exercised by any test or production traffic — verify with
  //    a grep for the literal task name before relying on that behavior. --
  | "smart_chat" // planned: higher-effort/deliberate chat mode (vs fast_chat); currently unreferenced anywhere else in this file
  | "summarize_long" // planned: long-form summarization; see providersForTask ordering
  | "moderation_hint" // planned: AI-assisted moderation suggestions (Guardian/staff review); see cacheableTasks
  | "ticket_triage" // planned: support-ticket categorization; see cacheableTasks
  | "template_generate" // planned: template/message generation; see providersForTask ordering
  | "owner_copilot"; // planned: bot-owner assistant; see providersForTask ordering

export interface AiMessageInput {
  readonly role: AiRole;
  readonly content: string;
}

export interface AiResult {
  readonly text: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly provider: string;
  readonly model?: string;
  readonly keyId?: string;
  readonly degraded?: boolean;
}

export interface AiCompleteOptions {
  readonly maxTokens?: number;
  readonly task?: AiTask;
  readonly temperature?: number;
  readonly userId?: string;
  readonly chatId?: string;
  readonly tenantId?: string;
  readonly cacheKeyParts?: readonly string[];
  readonly jsonMode?: boolean;
}

export interface AiProvider {
  readonly name: string;
  complete(
    messages: readonly AiMessageInput[],
    options?: AiCompleteOptions,
  ): Promise<AiResult>;
}

/** Rough token estimate (~4 chars/token) used for usage accounting and quotas. */
export const estimateTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / 4));

type ProviderKind = "groq" | "gemini" | "openrouter";

type AiKeyState = {
  provider: ProviderKind;
  keyId: string;
  key: string;
  enabled: boolean;
  cooldownUntilMs: number;
  usedRequestsToday: number;
  usedTokensToday: number;
  lastError?: string;
};

type PoolFailureKind = "rate-limit" | "auth" | "server" | "other";

class AiProviderError extends Error {
  constructor(
    message: string,
    readonly kind: PoolFailureKind = "other",
  ) {
    super(message);
  }
}

const shortHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 6);

const parseKeyPool = (
  provider: ProviderKind,
  numberedKeys: readonly (string | undefined)[],
  csv: string | undefined,
): AiKeyState[] => {
  const keys = [
    ...numberedKeys,
    ...(csv ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  ].filter((key): key is string => Boolean(key?.trim()));
  const seen = new Set<string>();
  return keys.flatMap((key, index) => {
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [
      {
        provider,
        keyId: `${provider}_${index + 1}:${shortHash(key)}`,
        key,
        enabled: true,
        cooldownUntilMs: 0,
        usedRequestsToday: 0,
        usedTokensToday: 0,
      },
    ];
  });
};

class AiKeyPool {
  constructor(
    private readonly keys: AiKeyState[],
    private readonly cooldownMs: number,
  ) {}

  get size(): number {
    return this.keys.length;
  }

  snapshot(): readonly Omit<AiKeyState, "key">[] {
    return this.keys.map(({ key: _key, ...state }) => state);
  }

  select(): AiKeyState | undefined {
    const now = Date.now();
    return this.keys
      .filter((key) => key.enabled && key.cooldownUntilMs <= now)
      .sort((left, right) => {
        const requestDelta = left.usedRequestsToday - right.usedRequestsToday;
        return requestDelta || left.usedTokensToday - right.usedTokensToday;
      })[0];
  }

  recordSuccess(key: AiKeyState, tokens: number): void {
    key.usedRequestsToday += 1;
    key.usedTokensToday += tokens;
    delete key.lastError;
  }

  recordFailure(key: AiKeyState, error: AiProviderError): void {
    key.lastError = error.message;
    if (error.kind === "rate-limit" || error.kind === "server") {
      key.cooldownUntilMs = Date.now() + this.cooldownMs;
    }
    if (error.kind === "auth") {
      key.enabled = false;
    }
  }
}

const assertGroqModelAllowed = (model: string): void => {
  if (model.toLowerCase().includes("70b")) {
    throw new Error(
      "Groq 70B disabled: Modryva only uses llama-3.1-8b-instant",
    );
  }
};

const assertOpenRouterModelAllowed = (
  model: string,
  allowPaidModels: boolean,
): void => {
  if (
    !allowPaidModels &&
    model !== "openrouter/free" &&
    !model.endsWith(":free")
  ) {
    throw new Error("OpenRouter paid models disabled");
  }
};

const classifyHttpError = (
  status: number,
  provider: string,
): AiProviderError => {
  if (status === 429) {
    return new AiProviderError(`${provider} rate limited`, "rate-limit");
  }
  if (status === 401 || status === 403) {
    return new AiProviderError(`${provider} auth failed`, "auth");
  }
  if (status >= 500) {
    return new AiProviderError(`${provider} server error`, "server");
  }
  return new AiProviderError(
    `${provider} failed with status ${status}`,
    "other",
  );
};

const completionCache = new Map<
  string,
  { expiresAt: number; result: AiResult }
>();

// NOTE: moderation_hint/ticket_triage are not dispatched by any caller yet
// (see the AiTask comment above) — this Set only takes effect once a real
// handler starts passing those tasks.
const cacheableTasks = new Set<AiTask>([
  "translate",
  "summarize_short",
  "moderation_hint",
  "ticket_triage",
]);

const cacheKeyFor = (
  providerFamily: string,
  messages: readonly AiMessageInput[],
  options: AiCompleteOptions,
): string | undefined => {
  const task = options.task ?? "fast_chat";
  if (!cacheableTasks.has(task)) {
    return undefined;
  }
  const normalized = messages
    .map((message) => `${message.role}:${message.content.trim().toLowerCase()}`)
    .join("\n");
  return createHash("sha256")
    .update(
      JSON.stringify({
        task,
        normalized,
        providerFamily,
        extra: options.cacheKeyParts ?? [],
      }),
    )
    .digest("hex");
};

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;

  constructor(
    readonly providerId: "groq" | "openrouter",
    private readonly pool: AiKeyPool,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs = 30_000,
  ) {
    this.name = providerId;
    if (providerId === "groq") {
      assertGroqModelAllowed(model);
    }
  }

  async complete(
    messages: readonly AiMessageInput[],
    options: AiCompleteOptions = {},
  ): Promise<AiResult> {
    const key = this.pool.select();
    if (!key) {
      throw new AiProviderError(
        `${this.name} has no available keys`,
        "rate-limit",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/u, "")}/chat/completions`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${key.key}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.maxTokens ?? 512,
            ...(options.jsonMode
              ? { response_format: { type: "json_object" } }
              : {}),
          }),
        },
      );

      if (!response.ok) {
        throw classifyHttpError(response.status, this.name);
      }

      const body = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      const tokensIn =
        body.usage?.prompt_tokens ??
        messages.reduce(
          (sum, message) => sum + estimateTokens(message.content),
          0,
        );
      const tokensOut = body.usage?.completion_tokens ?? estimateTokens(text);
      this.pool.recordSuccess(key, tokensIn + tokensOut);
      return {
        text,
        tokensIn,
        tokensOut,
        provider: this.name,
        model: this.model,
        keyId: key.keyId,
      };
    } catch (error) {
      const aiError =
        error instanceof AiProviderError
          ? error
          : new AiProviderError(`${this.name} request failed`, "other");
      this.pool.recordFailure(key, aiError);
      throw aiError;
    } finally {
      clearTimeout(timer);
    }
  }
}

const geminiRoleFor = (role: AiRole): "user" | "model" =>
  role === "assistant" ? "model" : "user";

export class GeminiPoolProvider implements AiProvider {
  readonly name = "gemini";

  constructor(
    private readonly pool: AiKeyPool,
    private readonly model: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async complete(
    messages: readonly AiMessageInput[],
    options: AiCompleteOptions = {},
  ): Promise<AiResult> {
    const key = this.pool.select();
    if (!key) {
      throw new AiProviderError("gemini has no available keys", "rate-limit");
    }

    const systemInstruction = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n");
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: geminiRoleFor(message.role),
        parts: [{ text: message.content }],
      }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          this.model,
        )}:generateContent?key=${encodeURIComponent(key.key)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents,
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
            generationConfig: {
              temperature: options.temperature ?? 0.3,
              maxOutputTokens: options.maxTokens ?? 512,
            },
          }),
        },
      );

      if (!response.ok) {
        throw classifyHttpError(response.status, this.name);
      }

      const body = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };
      const candidate = body.candidates?.[0];
      if (!candidate?.content?.parts?.length) {
        throw new AiProviderError("gemini returned no text", "other");
      }
      const text = candidate.content.parts
        .map((part) => part.text ?? "")
        .join("")
        .trim();
      const tokensIn =
        body.usageMetadata?.promptTokenCount ??
        messages.reduce(
          (sum, message) => sum + estimateTokens(message.content),
          0,
        );
      const tokensOut =
        body.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);
      this.pool.recordSuccess(key, tokensIn + tokensOut);
      return {
        text,
        tokensIn,
        tokensOut,
        provider: this.name,
        model: this.model,
        keyId: key.keyId,
      };
    } catch (error) {
      const aiError =
        error instanceof AiProviderError
          ? error
          : new AiProviderError("gemini request failed", "other");
      this.pool.recordFailure(key, aiError);
      throw aiError;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Deterministic provider used for tests and as the always-available fallback when
 * no real provider is configured. It never performs network I/O and produces a
 * stable, bounded response derived from the last user message.
 */
export class FakeAiProvider implements AiProvider {
  readonly name: string;

  constructor(name = "fake") {
    this.name = name;
  }

  async complete(
    messages: readonly AiMessageInput[],
    options?: AiCompleteOptions,
  ): Promise<AiResult> {
    const lastUser = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const prompt = lastUser?.content ?? "";
    const max = options?.maxTokens ?? 256;
    const text = `Respuesta simulada (${this.name}): ${prompt.slice(0, max).trim()}`;
    const tokensIn = messages.reduce(
      (sum, message) => sum + estimateTokens(message.content),
      0,
    );
    return {
      text,
      tokensIn,
      tokensOut: estimateTokens(text),
      provider: this.name,
    };
  }
}

/** Provider that always fails — used to exercise fallback/circuit-breaker paths. */
export class FailingAiProvider implements AiProvider {
  readonly name: string;

  constructor(name = "failing") {
    this.name = name;
  }

  async complete(): Promise<AiResult> {
    throw new Error(`${this.name} provider unavailable`);
  }
}

/**
 * Tries providers in order, skipping those whose circuit breaker is open, and
 * falls back to the next on error. Records consecutive failures per provider and
 * opens the breaker after `failureThreshold` failures for `cooldownMs`.
 */
export class AiRouter implements AiProvider {
  readonly name = "router";
  private readonly failures = new Map<string, number>();
  private readonly openedAt = new Map<string, number>();

  constructor(
    private readonly providers: readonly AiProvider[],
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly cacheTtlMs = 3_600_000,
  ) {}

  private isOpen(name: string, nowMs: number): boolean {
    const opened = this.openedAt.get(name);
    if (opened === undefined) {
      return false;
    }
    if (nowMs - opened >= this.cooldownMs) {
      this.openedAt.delete(name);
      this.failures.set(name, 0);
      return false;
    }
    return true;
  }

  private recordFailure(name: string, nowMs: number): void {
    const next = (this.failures.get(name) ?? 0) + 1;
    this.failures.set(name, next);
    if (next >= this.failureThreshold) {
      this.openedAt.set(name, nowMs);
    }
  }

  async complete(
    messages: readonly AiMessageInput[],
    options?: AiCompleteOptions,
  ): Promise<AiResult> {
    const nowMs = this.nowMs();
    let lastError: unknown;
    const task = options?.task ?? "fast_chat";
    const orderedProviders = this.providersForTask(task);

    for (const provider of orderedProviders) {
      if (this.isOpen(provider.name, nowMs)) {
        continue;
      }
      const cacheKey = cacheKeyFor(provider.name, messages, options ?? {});
      if (cacheKey) {
        const cached = completionCache.get(cacheKey);
        if (cached && cached.expiresAt > nowMs) {
          return { ...cached.result, degraded: false };
        }
      }
      try {
        const result = await provider.complete(messages, options);
        this.failures.set(provider.name, 0);
        if (cacheKey) {
          completionCache.set(cacheKey, {
            expiresAt: nowMs + this.cacheTtlMs,
            result,
          });
        }
        return result;
      } catch (error) {
        lastError = error;
        this.recordFailure(provider.name, nowMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("no AI provider available");
  }

  /** Overridable clock so tests can control breaker timing deterministically. */
  protected nowMs(): number {
    return Date.now();
  }

  private providersForTask(task: AiTask): readonly AiProvider[] {
    const byName = new Map(
      this.providers.map((provider) => [provider.name, provider]),
    );
    // NOTE: summarize_long / owner_copilot / template_generate are not
    // currently dispatched by any real caller (see the AiTask comment
    // above) — these preferred-provider orderings are pre-designed for
    // when those features ship, not exercised by production traffic today.
    const order: readonly string[] =
      task === "summarize_long" || task === "owner_copilot"
        ? ["gemini", "openrouter", "groq", "local", "fake"]
        : task === "template_generate"
          ? ["gemini", "groq", "openrouter", "local", "fake"]
          : ["groq", "gemini", "openrouter", "local", "fake"];
    const selected = order
      .map((name) => byName.get(name))
      .filter((provider): provider is AiProvider => Boolean(provider));
    const selectedNames = new Set(selected.map((provider) => provider.name));
    return [
      ...selected,
      ...this.providers.filter((provider) => !selectedNames.has(provider.name)),
    ];
  }
}

export const buildAiProviderFromEnv = (env: RuntimeEnv): AiProvider => {
  if (!env.AI_ENABLED) {
    return new AiRouter([new FakeAiProvider("local")]);
  }

  const providers: AiProvider[] = [];

  if (env.AI_GROQ_ENABLED) {
    const model = env.AI_GROQ_MODEL || "llama-3.1-8b-instant";
    assertGroqModelAllowed(model);
    const pool = new AiKeyPool(
      parseKeyPool(
        "groq",
        [
          env.AI_GROQ_API_KEY_1,
          env.AI_GROQ_API_KEY_2,
          env.AI_GROQ_API_KEY_3,
          env.AI_GROQ_API_KEY_4,
          env.AI_GROQ_API_KEY_5,
        ],
        env.AI_GROQ_API_KEYS,
      ),
      env.AI_GROQ_KEY_COOLDOWN_SECONDS * 1000,
    );
    if (pool.size > 0) {
      providers.push(
        new OpenAiCompatibleProvider(
          "groq",
          pool,
          "https://api.groq.com/openai/v1",
          model,
        ),
      );
    }
  }

  if (env.AI_GEMINI_ENABLED) {
    const pool = new AiKeyPool(
      parseKeyPool(
        "gemini",
        [
          env.AI_GEMINI_PROJECT_1_API_KEY,
          env.AI_GEMINI_PROJECT_2_API_KEY,
          env.AI_GEMINI_PROJECT_3_API_KEY,
          env.AI_GEMINI_PROJECT_4_API_KEY,
          env.AI_GEMINI_PROJECT_5_API_KEY,
        ],
        env.AI_GEMINI_API_KEYS,
      ),
      env.AI_GEMINI_KEY_COOLDOWN_SECONDS * 1000,
    );
    if (pool.size > 0) {
      providers.push(
        new GeminiPoolProvider(
          pool,
          env.AI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        ),
      );
    }
  }

  if (env.AI_OPENROUTER_ENABLED && env.AI_OPENROUTER_API_KEY) {
    const model = env.AI_OPENROUTER_MODEL || "openrouter/free";
    assertOpenRouterModelAllowed(model, env.AI_OPENROUTER_ALLOW_PAID_MODELS);
    providers.push(
      new OpenAiCompatibleProvider(
        "openrouter",
        new AiKeyPool(
          parseKeyPool("openrouter", [env.AI_OPENROUTER_API_KEY], undefined),
          60_000,
        ),
        "https://openrouter.ai/api/v1",
        model,
      ),
    );
  }

  return new AiRouter(
    providers.length > 0 ? providers : [new FakeAiProvider("local")],
    3,
    30_000,
    env.AI_CACHE_TTL_SECONDS * 1000,
  );
};
