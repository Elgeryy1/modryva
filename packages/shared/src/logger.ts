import pino, { type LoggerOptions } from "pino";

export const createLogger = (
  name: string,
  level: LoggerOptions["level"] = "info",
) =>
  pino({
    name,
    level,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.x-telegram-bot-api-secret-token",
        "telegrams.secretToken",
        "token",
        "*.token",
        "*.secret",
      ],
      remove: true,
    },
  });
