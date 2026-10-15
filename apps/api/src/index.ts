import "dotenv/config";
import { Logger } from "@nestjs/common";
import { getRuntimeEnv, initErrorTracking } from "@superbot/shared";
import { buildApiServer } from "./server.js";

const main = async () => {
  // Before the server is built, so a crash during boot is reported too — that
  // is precisely the failure nobody is watching for.
  const env = getRuntimeEnv();
  await initErrorTracking({
    dsn: env.SENTRY_DSN,
    service: "api",
    release: env.APP_BUILD_SHA,
    environment: env.NODE_ENV,
  });
  const app = await buildApiServer();
  const port = Number(process.env.API_PORT ?? 3001);

  await app.listen(port, "0.0.0.0");
  new Logger("Api").log(`api server listening on ${port}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
