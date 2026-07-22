import "dotenv/config";
import { Logger } from "@nestjs/common";
import { getRuntimeEnv } from "@superbot/shared";
import { BotUpdateService } from "./bot-update.service.js";
import { startPolling } from "./poller.js";
import { buildBotServer } from "./server.js";

const main = async () => {
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
