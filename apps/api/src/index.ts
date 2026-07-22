import "dotenv/config";
import { Logger } from "@nestjs/common";
import { buildApiServer } from "./server.js";

const main = async () => {
  const app = await buildApiServer();
  const port = Number(process.env.API_PORT ?? 3001);

  await app.listen(port, "0.0.0.0");
  new Logger("Api").log(`api server listening on ${port}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
