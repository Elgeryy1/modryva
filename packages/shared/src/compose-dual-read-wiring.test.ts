import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the deploy-time wiring invariant behind the rotation dual-read: the app
 * reads env.GUARDIAN_*_PREVIOUS / MANAGED_BOT_TOKEN_KEY_NEW, but those only reach
 * a container if docker-compose.yml forwards them. Without this, a rotation's
 * dual-read is silently INERT in production even though the code and unit tests
 * are green. See docs/INCIDENT-ROTATION-AND-DEPLOY-2026-07-17.md.
 */

const compose = readFileSync(
  fileURLToPath(new URL("../../../docker-compose.yml", import.meta.url)),
  "utf8",
);

// Split the compose into per-service scopes. Service (and top-level volume)
// names sit at a 2-space indent; every deeper line until the next 2-space key
// belongs to that scope. Non-service scopes simply hold no env vars.
const scopes = ((): Record<string, string> => {
  const blocks: Record<string, string> = {};
  let current: string | undefined;
  for (const line of compose.split("\n")) {
    const name = line.match(/^ {2}([a-z0-9_-]+):\s*$/)?.[1];
    if (name) {
      current = name;
      blocks[current] = "";
    } else if (current) {
      blocks[current] += `${line}\n`;
    }
  }
  return blocks;
})();

const receives = (service: string, envVar: string): boolean =>
  new RegExp(`^\\s+${envVar}:`, "m").test(scopes[service] ?? "");

describe("docker-compose dual-read env wiring", () => {
  it("forwards GUARDIAN_SESSION_SECRET_PREVIOUS to every service that decrypts query_ids", () => {
    // api (guardian-verify.service) and worker (guardian.session.expire) decrypt.
    for (const svc of ["api", "worker"]) {
      expect(receives(svc, "GUARDIAN_SESSION_SECRET")).toBe(true);
      expect(receives(svc, "GUARDIAN_SESSION_SECRET_PREVIOUS")).toBe(true);
    }
  });

  it("never holds the media key without its rotation fallback", () => {
    for (const [svc, block] of Object.entries(scopes)) {
      if (/^\s+GUARDIAN_MEDIA_ENCRYPTION_KEY:/m.test(block)) {
        expect(receives(svc, "GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS")).toBe(
          true,
        );
      }
    }
  });

  it("gives api the temporary MANAGED_BOT_TOKEN_KEY_NEW channel for re-encryption", () => {
    expect(receives("api", "MANAGED_BOT_TOKEN_KEY_NEW")).toBe(true);
  });
});
