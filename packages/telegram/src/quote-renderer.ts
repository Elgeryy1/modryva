/**
 * Renderer for Quotly-style quote stickers. Kept as an injectable seam (like the
 * AI provider) so the bot can call the real LyoSU quote-api in production and a
 * fake in tests. The payload is passed opaquely so this package stays decoupled
 * from the pure quote module that builds it.
 */

export interface QuoteRenderResult {
  readonly imageBase64: string;
  readonly type: "png" | "webp";
}

export interface QuoteRenderer {
  renderQuote(
    payload: Record<string, unknown>,
  ): Promise<QuoteRenderResult | null>;
}

const DEFAULT_QUOTE_ENDPOINT = "https://quote.yuri.ly/generate";

/**
 * Calls the open-source quote-api (the same service Quotly uses). The fetcher
 * and endpoint are injectable for testing and self-hosting.
 */
export class HttpQuoteRenderer implements QuoteRenderer {
  constructor(
    private readonly endpoint: string = DEFAULT_QUOTE_ENDPOINT,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async renderQuote(
    payload: Record<string, unknown>,
  ): Promise<QuoteRenderResult | null> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      ok?: boolean;
      result?: { image?: unknown };
    };

    const image = data.result?.image;

    if (typeof image !== "string" || image.length === 0) {
      return null;
    }

    // The API's `result.type` is the render type ("quote"), not the image
    // format, so trust the format we requested in the payload instead.
    return {
      imageBase64: image,
      type: payload.format === "png" ? "png" : "webp",
    };
  }
}

/**
 * Deterministic fake used in tests: records the number of calls and returns a
 * tiny canned image without any network access.
 */
export class FakeQuoteRenderer implements QuoteRenderer {
  calls = 0;

  async renderQuote(): Promise<QuoteRenderResult> {
    this.calls += 1;
    return { imageBase64: "ZmFrZS1xdW90ZQ==", type: "webp" };
  }
}
