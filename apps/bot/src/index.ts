import "dotenv/config";
import { Logger } from "@nestjs/common";
import { getRuntimeEnv, initErrorTracking } from "@superbot/shared";
import { BotUpdateService } from "./bot-update.service.js";
import { startPolling } from "./poller.js";
import { buildBotServer } from "./server.js";

const main = async () => {
  // Before the server is built, so a crash during boot is reported too — that
  // is precisely the failure nobody is watching for.
  const bootEnv = getRuntimeEnv();
  await initErrorTracking({
    dsn: bootEnv.SENTRY_DSN,
    service: "bot",
    release: bootEnv.APP_BUILD_SHA,
    environment: bootEnv.NODE_ENV,
  });
  const app = await buildBotServer();
  const port = Number(process.env.BOT_PORT ?? 3002);
  const logger = new Logger("Bot");

  await app.listen(port, "0.0.0.0");
  logger.log(`bot server listening on ${port}`);

  if (process.env.BOT_MODE === "polling") {
    const updates = app.get(BotUpdateService);
    // Fire-and-forget: the long-poll loop runs for the process lifetime.
    void startPolling(updates, getRuntimeEnv(), logger);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
