import { describe, expect, it } from "vitest";
import { scrubEvent } from "./error-tracking.js";
import { redactDeep, redactSecrets, redactSensitive } from "./redaction.js";

describe("redactSecrets", () => {
  it.each([
    ["Groq", "gsk_abcdefghijklmnopqrstuvwxyz0123"],
    ["OpenRouter", "sk-or-v1-abcdefghijklmnopqrstuvwxyz"],
    // Exactly 35 characters after the AIza prefix, as Google issues them.
    ["Gemini", "AIzaSyA12345678901234567890123456789012"],
    ["Telegram bot token", "9000000013:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"],
  ])("removes a %s key", (_label, secret) => {
    const out = redactSecrets(`falló con ${secret} dentro`);
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED_SECRET]");
  });

  it("removes any NAME=value assignment ending in SECRET/TOKEN/KEY/PASSWORD", () => {
    const out = redactSecrets(
      "GUARDIAN_SESSION_SECRET=hunter2 S3_SECRET_KEY=abc123",
    );
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("abc123");
  });

  it("removes credentials embedded in a Postgres URL", () => {
    const out = redactSecrets(
      "postgresql://superbot:pw@postgres:5432/superbot",
    );
    expect(out).not.toContain("pw@postgres");
  });
});

describe("redactSensitive", () => {
  it("removes the initData signature and the Telegram user object", () => {
    const initData =
      "query_id=AAHdqTcvAAAAAN2pNy8&user=%7B%22id%22%3A123%7D&auth_date=1785000000&hash=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const out = redactSensitive(initData);
    expect(out).not.toContain("0123456789abcdef");
    expect(out).not.toContain("%7B%22id%22");
    expect(out).not.toContain("AAHdqTcvAAAAAN2pNy8");
  });

  it("removes a Guardian retry deep-link token", () => {
    const out = redactSensitive("/start grdv_aBcDeF0123456789");
    expect(out).not.toContain("aBcDeF0123456789");
  });

  // Guardian pins client IPs on purpose (they are the multi-account signal) —
  // which is exactly why they must not ALSO end up in a crash report.
  it("removes IPv4 and IPv6 addresses", () => {
    expect(redactSensitive("desde 192.168.1.50")).not.toContain("192.168.1");
    expect(
      redactSensitive("desde 2a02:9130:88b7:d00d:90b3:660e:16b6:7d8"),
    ).not.toContain("2a02:9130");
  });
});

describe("redactDeep", () => {
  it("drops the value of a credential-bearing key entirely", () => {
    const out = redactDeep({
      headers: {
        Authorization: "Bearer abc",
        "x-guardian-session": "tok",
        "user-agent": "curl",
      },
    }) as { headers: Record<string, string> };
    expect(out.headers.Authorization).toBe("[REDACTED]");
    expect(out.headers["x-guardian-session"]).toBe("[REDACTED]");
    expect(out.headers["user-agent"]).toBe("curl");
  });

  it("truncates a captured photo instead of shipping somebody's face", () => {
    const out = redactDeep({ note: "A".repeat(60_000) }) as { note: string };
    expect(out.note.length).toBeLessThan(1200);
    expect(out.note).toContain("[TRUNCATED]");
  });

  it("survives a cycle rather than hanging the reporter", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    expect(() => redactDeep(cyclic)).not.toThrow();
  });
});

describe("scrubEvent", () => {
  it("cleans a realistic event end to end", () => {
    const event = scrubEvent({
      message: "sendMessage failed for 9000000013:AAHdqTcvCH1vGWJxfSeofSAs0K5P",
      user: { id: "1", ip_address: "192.168.1.50", username: "marc" },
      request: {
        headers: { cookie: "session=abc" },
        query_string:
          "hash=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      extra: { verifierIp: "10.0.0.4" },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("AAHdqTcvCH1vGWJxfSeofSAs0K5P");
    expect(serialized).not.toContain("192.168.1.50");
    expect(serialized).not.toContain("marc");
    expect(serialized).not.toContain("session=abc");
    expect(serialized).not.toContain("10.0.0.4");
  });

  // A scrubber that throws must not fall through to sending the raw event.
  it("drops the event rather than shipping it unscrubbed on failure", () => {
    const hostile = {
      get bad() {
        throw new Error("boom");
      },
    };
    expect(
      scrubEvent(hostile as unknown as Record<string, unknown>),
    ).toBeNull();
  });
});

/**
 * El token de Telegram en la UNICA forma en que existe de verdad.
 *
 * El patron llevaba `\b` delante, y en `.../bot<TOKEN>/sendMessage` el caracter
 * previo a los digitos es la `t` de "bot": letra→letra, sin frontera de
 * palabra. Resultado: no casaba nunca donde importa. Los tests de arriba lo
 * probaban separado por espacios —forma comoda de escribir, forma que no ocurre
 * jamas— asi que estaban en verde afirmando lo contrario de la verdad.
 *
 * Se verifico capturando el sobre real hacia el rastreador: la IP de la misma
 * cadena salia redactada y el token entero en claro.
 */
describe("token de Telegram dentro de una URL", () => {
  const TOKEN = "9000000013:AAFqz2m9pQwErTyUiOpAsDfGhJkLzXcVbNm";

  it("lo redacta en la URL de la API", () => {
    const out = redactSensitive(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    );
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain("9000000013");
  });

  it("lo redacta en la URL de descarga de ficheros", () => {
    const out = redactSensitive(
      `https://api.telegram.org/file/bot${TOKEN}/photos/file_1.jpg`,
    );
    expect(out).not.toContain(TOKEN);
  });

  it("lo redacta dentro de una miga de Sentry anidada", () => {
    const out = JSON.stringify(
      redactDeep({
        category: "http",
        data: {
          url: `https://api.telegram.org/bot${TOKEN}/getUpdates`,
          status_code: 200,
        },
      }),
    );
    expect(out).not.toContain(TOKEN);
  });

  it("un token acabado en guion se redacta entero", () => {
    // El `\b` de cierre tambien sobraba: dejaba fuera el ultimo caracter.
    const raro = "9000000013:AAFqz2m9pQwErTyUiOpAsDfGhJkLzXcVb-";
    expect(redactSensitive(`url/bot${raro}/x`)).not.toContain(raro);
  });

  it("no confunde una fecha con un token", () => {
    // Guardarraíl del patron mas permisivo: sin `\b`, no puede volverse glotón.
    expect(redactSensitive("20260805123000:not-a-token")).toContain(
      "not-a-token",
    );
  });
});

describe("request.url no puede sobrevivir al scrubber", () => {
  it("borra la url completa, no solo la query", () => {
    // Borrar `query_string` y dejar `url` es borrar el dato de un sitio y
    // publicarlo en el de al lado: el SDK rellena `url` SIEMPRE, con la query
    // pegada.
    const event = scrubEvent({
      request: {
        url: "https://app.example/guardian/verify?session=B5GW9eayHbmkuPlhW0hhJcMr9cVblUAV_IURQ_FqW40",
        method: "GET",
      },
    });
    expect(JSON.stringify(event)).not.toContain(
      "B5GW9eayHbmkuPlhW0hhJcMr9cVblUAV_IURQ_FqW40",
    );
  });
});
