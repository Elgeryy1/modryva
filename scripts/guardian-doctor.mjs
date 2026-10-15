import { access } from "node:fs/promises";
import net from "node:net";
import { config as loadDotenv } from "dotenv";

loadDotenv();

// guardian:doctor — diagnostics for Guardian Verification. Never prints a
// secret value, only whether it's configured. No workspace-package imports
// (mirrors scripts/check-production-env.mjs) so it runs with plain `node`.

const read = (name) => process.env[name]?.trim() ?? "";
const bool = (name, fallback = false) => {
  const v = read(name).toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true";
};

const args = process.argv.slice(2);
const chatArgIndex = args.indexOf("--chat");
const chatId = chatArgIndex >= 0 ? args[chatArgIndex + 1] : undefined;

const results = [];
const ok = (label, detail) => results.push({ label, status: "ok", detail });
const warn = (label, detail) => results.push({ label, status: "warn", detail });
const fail = (label, detail) => results.push({ label, status: "fail", detail });

const checkTcp = (label, urlString, defaultPort) =>
  new Promise((resolve) => {
    let host;
    let port;
    try {
      const url = new URL(urlString);
      host = url.hostname;
      port = Number(url.port) || defaultPort;
    } catch {
      fail(label, "not a valid URL");
      resolve();
      return;
    }
    const socket = net.createConnection({ host, port, timeout: 3000 });
    socket.on("connect", () => {
      ok(label, `reachable at ${host}:${port}`);
      socket.destroy();
      resolve();
    });
    socket.on("timeout", () => {
      fail(label, `timed out connecting to ${host}:${port}`);
      socket.destroy();
      resolve();
    });
    socket.on("error", (err) => {
      fail(label, `${host}:${port} — ${err.message}`);
      resolve();
    });
  });

// --- Env presence ---

const guardianEnabled = bool("GUARDIAN_ENABLED");
ok("GUARDIAN_ENABLED", guardianEnabled ? "1 (on)" : "0 (off)");

const sessionSecret = read("GUARDIAN_SESSION_SECRET");
if (!sessionSecret) {
  fail(
    "GUARDIAN_SESSION_SECRET",
    "not set — Guardian will refuse to open Mini Apps or sign STAFF callbacks",
  );
} else if (sessionSecret.length < 16) {
  warn("GUARDIAN_SESSION_SECRET", "set but shorter than 16 characters");
} else {
  ok("GUARDIAN_SESSION_SECRET", "configured");
}

const mediaKey = read("GUARDIAN_MEDIA_ENCRYPTION_KEY");
if (!mediaKey) {
  warn(
    "GUARDIAN_MEDIA_ENCRYPTION_KEY",
    "not set (reserved for future media-at-rest encryption, not yet applied)",
  );
} else {
  ok("GUARDIAN_MEDIA_ENCRYPTION_KEY", "configured");
}

const storageDriver = read("GUARDIAN_STORAGE_DRIVER") || "local";
if (storageDriver === "s3") {
  const required = [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "S3_REGION",
  ];
  const missing = required.filter((name) => !read(name));
  if (missing.length > 0) {
    fail("GUARDIAN_STORAGE_DRIVER=s3", `missing: ${missing.join(", ")}`);
  } else {
    ok(
      "GUARDIAN_STORAGE_DRIVER=s3",
      `bucket ${read("S3_BUCKET")} @ ${read("S3_ENDPOINT")}`,
    );
  }
} else {
  const storagePath = read("GUARDIAN_STORAGE_PATH") || "./data/guardian-media";
  try {
    await access(storagePath).catch(async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(storagePath, { recursive: true });
    });
    ok("GUARDIAN_STORAGE_DRIVER=local", `path ${storagePath} is accessible`);
  } catch (err) {
    fail(
      "GUARDIAN_STORAGE_DRIVER=local",
      `path ${storagePath} — ${err.message}`,
    );
  }
}

// AUTO/STRICT can only ever auto-approve when the real visual/liveness
// analyzer (AI_SERVICE_URL — services/guardian-vision-analyzer) is both
// configured AND actually reachable; the decision engine fails closed to
// manual_review otherwise (safe, but silently defeats the point of running
// AUTO/STRICT mode). This is a hard FAIL, not a warning, on purpose — see
// the rule "AUTO y STRICT no pueden aprobar basándose en señales no evaluadas".
const aiServiceUrl = read("AI_SERVICE_URL");
if (!aiServiceUrl) {
  fail(
    "AUTO/STRICT readiness (AI_SERVICE_URL)",
    "not configured — any chat set to auto/strict mode will silently fall back to manual_review",
  );
} else {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${aiServiceUrl}/healthz`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (response.ok) {
      ok(
        "AUTO/STRICT readiness (AI_SERVICE_URL)",
        `reachable at ${aiServiceUrl}`,
      );
    } else {
      fail(
        "AUTO/STRICT readiness (AI_SERVICE_URL)",
        `${aiServiceUrl}/healthz responded ${response.status} — auto/strict chats will fall back to manual_review`,
      );
    }
  } catch (err) {
    fail(
      "AUTO/STRICT readiness (AI_SERVICE_URL)",
      `${aiServiceUrl} unreachable — ${err.message}`,
    );
  }
}

const testMode = bool("GUARDIAN_TEST_MODE");
if (testMode && read("NODE_ENV") === "production") {
  fail(
    "GUARDIAN_TEST_MODE",
    "is 1 in production — must never be true outside dev/test",
  );
} else {
  ok("GUARDIAN_TEST_MODE", testMode ? "1 (dev harness enabled)" : "0");
}

// --- Connectivity ---

const databaseUrl = read("DATABASE_URL");
if (databaseUrl) {
  await checkTcp("DATABASE_URL", databaseUrl, 5432);
} else {
  fail("DATABASE_URL", "not set");
}

const redisUrl = read("REDIS_URL");
if (redisUrl) {
  await checkTcp("REDIS_URL", redisUrl, 6379);
} else {
  fail("REDIS_URL", "not set");
}

// --- Telegram (only if a token is configured) ---

const botToken = read("TELEGRAM_BOT_TOKEN");
if (!botToken) {
  warn("TELEGRAM_BOT_TOKEN", "not set — skipping getMe/getChat checks");
} else {
  try {
    const meResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const me = await meResponse.json();
    if (me.ok) {
      ok("getMe", `@${me.result.username}`);
      ok(
        "supports_join_request_queries",
        me.result.supports_join_request_queries
          ? "true"
          : "false/undefined (feature-detected fallback applies)",
      );
    } else {
      fail("getMe", me.description ?? "unknown error");
    }
  } catch (err) {
    fail("getMe", err.message);
  }

  if (chatId) {
    try {
      const chatResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      );
      const chat = await chatResponse.json();
      if (chat.ok) {
        ok(
          "getChat",
          `${chat.result.title ?? chat.result.type} (guard_bot=${chat.result.guard_bot ?? "unset"})`,
        );
      } else {
        fail("getChat", chat.description ?? "unknown error");
      }
    } catch (err) {
      fail("getChat", err.message);
    }
  } else {
    warn(
      "getChat",
      "pass --chat <id> to check a specific chat (admin status, guard_bot)",
    );
  }
}

// --- Report ---

console.log(`\nGuardian Verification doctor\n${"=".repeat(30)}`);
for (const r of results) {
  const icon = r.status === "ok" ? "✅" : r.status === "warn" ? "⚠️ " : "❌";
  console.log(`${icon} ${r.label}: ${r.detail}`);
}

const failures = results.filter((r) => r.status === "fail").length;
console.log(
  `\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`,
);
process.exit(failures === 0 ? 0 : 1);
