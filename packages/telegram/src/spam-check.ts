/**
 * Global known-spammer check against CAS (Combot Anti-Spam), the same public,
 * free, no-key ban list Rose/Combot use. Kept as an injectable seam (like the
 * quote renderer) so the bot can call the real service in production and a
 * fake in tests.
 */

export interface SpamCheckProvider {
  isKnownSpammer(telegramUserId: bigint): Promise<boolean>;
}

const DEFAULT_CAS_ENDPOINT = "https://api.cas.chat/check";

/**
 * Calls the public CAS API. Fails OPEN on any network error, non-OK response,
 * or unexpected body shape: CAS being briefly unreachable must never block a
 * legitimate new member from joining.
 */
export class HttpSpamCheckProvider implements SpamCheckProvider {
  constructor(
    private readonly endpoint: string = DEFAULT_CAS_ENDPOINT,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async isKnownSpammer(telegramUserId: bigint): Promise<boolean> {
    try {
      const response = await this.fetcher(
        `${this.endpoint}?user_id=${telegramUserId.toString()}`,
      );
      if (!response.ok) {
        return false;
      }
      const data = (await response.json()) as { ok?: boolean };
      return data.ok === true;
    } catch {
      return false;
    }
  }
}

/**
 * Deterministic fake used in tests: flags exactly the ids added to `spammers`,
 * no network access.
 */
export class FakeSpamCheckProvider implements SpamCheckProvider {
  spammers = new Set<string>();

  async isKnownSpammer(telegramUserId: bigint): Promise<boolean> {
    return this.spammers.has(telegramUserId.toString());
  }
}
