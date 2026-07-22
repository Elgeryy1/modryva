import { config as loadDotenv } from "dotenv";

loadDotenv();

const errors = [];
const warnings = [];

const placeholderValues = new Set([
  "replace-me",
  "replace-me-too",
  "change-me",
  "changeme",
  "todo",
  "example",
]);

const read = (name) => process.env[name]?.trim() ?? "";

const isPlaceholder = (value) =>
  value.length === 0 || placeholderValues.has(value.toLowerCase());

const addSecretError = (name, message) => {
  errors.push(`${name}: ${message}`);
};

const requirePresent = (name) => {
  const value = read(name);
  if (isPlaceholder(value)) {
    addSecretError(name, "missing or still using a placeholder");
  }
  return value;
};

const requireMinLength = (name, minLength) => {
  const value = requirePresent(name);
  if (value && value.length < minLength) {
    addSecretError(name, `must be at least ${minLength} characters`);
  }
  return value;
};

const requireUrl = (name, { protocol, allowDockerHost = false } = {}) => {
  const value = requirePresent(name);
  if (!value) {
    return value;
  }
  try {
    const url = new URL(value);
    if (protocol && url.protocol !== protocol) {
      addSecretError(name, `must use ${protocol}`);
    }
    if (
      !allowDockerHost &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      addSecretError(name, "must not point to localhost in production");
    }
  } catch {
    addSecretError(name, "must be a valid URL");
  }
  return value;
};

const requireOptionalUrl = (name, { protocol } = {}) => {
  const value = read(name);
  if (!value) {
    return;
  }
  try {
    const url = new URL(value);
    if (protocol && url.protocol !== protocol) {
      addSecretError(name, `must use ${protocol} when set`);
    }
  } catch {
    addSecretError(name, "must be a valid URL when set");
  }
};

const nodeEnv = requirePresent("NODE_ENV");
if (nodeEnv && nodeEnv !== "production") {
  errors.push("NODE_ENV: must be production");
}

requireUrl("DATABASE_URL", { protocol: "postgresql:", allowDockerHost: true });
requireUrl("REDIS_URL", { protocol: "redis:", allowDockerHost: true });
requireUrl("TELEGRAM_APP_URL", { protocol: "https:" });
requireOptionalUrl("TELEGRAM_WEBHOOK_BASE_URL", { protocol: "https:" });

const botToken = requirePresent("TELEGRAM_BOT_TOKEN");
if (botToken && !/^\d+:[A-Za-z0-9_-]{20,}$/u.test(botToken)) {
  addSecretError("TELEGRAM_BOT_TOKEN", "does not look like a BotFather token");
}

requireMinLength("TELEGRAM_WEBHOOK_SECRET", 16);
requireMinLength("SESSION_SECRET", 32);

const ownerId = requirePresent("SUPERBOT_OWNER_TELEGRAM_ID");
if (ownerId && (!/^\d+$/u.test(ownerId) || ownerId === "123456789")) {
  addSecretError(
    "SUPERBOT_OWNER_TELEGRAM_ID",
    "must be the real positive Telegram user id of the owner",
  );
}

const botUsername = requirePresent("TELEGRAM_BOT_USERNAME");
if (botUsername === "superbot_bot" || botUsername.startsWith("@")) {
  addSecretError(
    "TELEGRAM_BOT_USERNAME",
    "must be the real bot username without @",
  );
}

const miniappName = read("TELEGRAM_MINIAPP_NAME") || "config";
if (!/^[A-Za-z0-9_]{1,64}$/u.test(miniappName)) {
  addSecretError(
    "TELEGRAM_MINIAPP_NAME",
    "must match the BotFather short name format",
  );
}

const managedBotTokenKey = read("MANAGED_BOT_TOKEN_KEY");
if (!managedBotTokenKey) {
  warnings.push(
    "MANAGED_BOT_TOKEN_KEY is not set; managed child bots and encrypted token recovery will be unavailable.",
  );
} else if (managedBotTokenKey.length < 32) {
  warnings.push(
    "MANAGED_BOT_TOKEN_KEY is shorter than 32 characters; use a high-entropy secret before selling managed bots.",
  );
}

if (warnings.length > 0) {
  console.warn("Production warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error("Production environment check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Production environment check passed.");
