import "dotenv/config";
import { getRuntimeEnv, initErrorTracking } from "@superbot/shared";
import { buildWorkerServer } from "./server.js";

const main = async () => {
  // Before the server is built, so a crash during boot is reported too — that
  // is precisely the failure nobody is watching for.
  const env = getRuntimeEnv();
  await initErrorTracking({
    dsn: env.SENTRY_DSN,
    service: "worker",
    release: env.APP_BUILD_SHA,
    environment: env.NODE_ENV,
  });
  const server = await buildWorkerServer();
  const port = Number(process.env.WORKER_PORT ?? 3004);

  await server.listen({ port, host: "0.0.0.0" });
  server.log.info({ port }, "worker server listening");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
