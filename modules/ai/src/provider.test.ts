import { getRuntimeEnv } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import {
  AiRouter,
  buildAiProviderFromEnv,
  estimateTokens,
  FailingAiProvider,
  FakeAiProvider,
} from "./provider.js";

class CountingAiProvider extends FakeAiProvider {
  calls = 0;

  override async complete(
    messages: Parameters<FakeAiProvider["complete"]>[0],
    options?: Parameters<FakeAiProvider["complete"]>[1],
  ) {
    this.calls += 1;
    return super.complete(messages, options);
  }
}

describe("FakeAiProvider", () => {
  it("returns a deterministic completion with token accounting", async () => {
    const provider = new FakeAiProvider("local");
    const result = await provider.complete([
      { role: "system", content: "guard" },
      { role: "user", content: "hola" },
    ]);

    expect(result.provider).toBe("local");
    expect(result.text).toContain("hola");
    expect(result.tokensIn).toBeGreaterThan(0);
    expect(result.tokensOut).toBeGreaterThan(0);
  });
});

describe("estimateTokens", () => {
  it("scales with length and is at least 1", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("12345678")).toBe(2);
  });
});

describe("AiRouter", () => {
  it("falls back to the next provider on failure", async () => {
    const router = new AiRouter([
      new FailingAiProvider("p1"),
      new FakeAiProvider("p2"),
    ]);
    const result = await router.complete([{ role: "user", content: "hi" }]);
    expect(result.provider).toBe("p2");
  });

  it("throws when all providers fail", async () => {
    const router = new AiRouter([
      new FailingAiProvider("p1"),
      new FailingAiProvider("p2"),
    ]);
    await expect(
      router.complete([{ role: "user", content: "hi" }]),
    ).rejects.toThrow();
  });

  it("caches deterministic task completions", async () => {
    const provider = new CountingAiProvider("p1");
    const router = new AiRouter([provider]);
    const messages = [{ role: "user" as const, content: "hola" }];

    await router.complete(messages, { task: "translate" });
    await router.complete(messages, { task: "translate" });

    expect(provider.calls).toBe(1);
  });
});

describe("buildAiProviderFromEnv", () => {
  it("uses a fake local provider when AI is disabled", async () => {
    const provider = buildAiProviderFromEnv(getRuntimeEnv({ AI_ENABLED: "0" }));
    const result = await provider.complete([{ role: "user", content: "hola" }]);
    expect(result.provider).toBe("local");
  });

  it("blocks Groq 70B", () => {
    expect(() =>
      buildAiProviderFromEnv(
        getRuntimeEnv({
          AI_ENABLED: "1",
          AI_GROQ_ENABLED: "1",
          AI_GROQ_MODEL: "llama-3.1-70b-versatile",
          AI_GROQ_API_KEY_1: "dummy-key",
        }),
      ),
    ).toThrow("Groq 70B disabled");
  });

  it("blocks OpenRouter paid models when AI_OPENROUTER_ALLOW_PAID_MODELS=0", () => {
    expect(() =>
      buildAiProviderFromEnv(
        getRuntimeEnv({
          AI_ENABLED: "1",
          AI_OPENROUTER_ENABLED: "1",
          AI_OPENROUTER_API_KEY: "dummy-key",
          AI_OPENROUTER_MODEL: "openai/gpt-4o",
          AI_OPENROUTER_ALLOW_PAID_MODELS: "0",
        }),
      ),
    ).toThrow("OpenRouter paid models disabled");
  });

  it("allows the free OpenRouter model when paid models are disallowed", () => {
    expect(() =>
      buildAiProviderFromEnv(
        getRuntimeEnv({
          AI_ENABLED: "1",
          AI_OPENROUTER_ENABLED: "1",
          AI_OPENROUTER_API_KEY: "dummy-key",
          AI_OPENROUTER_MODEL: "openrouter/free",
          AI_OPENROUTER_ALLOW_PAID_MODELS: "0",
        }),
      ),
    ).not.toThrow();
  });
});
