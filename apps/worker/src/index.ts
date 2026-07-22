import "dotenv/config";
import { buildWorkerServer } from "./server.js";

const main = async () => {
  const server = await buildWorkerServer();
  const port = Number(process.env.WORKER_PORT ?? 3004);

  await server.listen({ port, host: "0.0.0.0" });
  server.log.info({ port }, "worker server listening");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
