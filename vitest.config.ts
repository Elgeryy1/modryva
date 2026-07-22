import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@superbot/shared": fileURLToPath(
        new URL("./packages/shared/src/index.ts", import.meta.url),
      ),
      "@superbot/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url),
      ),
      "@superbot/telegram": fileURLToPath(
        new URL("./packages/telegram/src/index.ts", import.meta.url),
      ),
      "@superbot/auth": fileURLToPath(
        new URL("./packages/auth/src/index.ts", import.meta.url),
      ),
      "@superbot/data": fileURLToPath(
        new URL("./packages/data/src/index.ts", import.meta.url),
      ),
      "@superbot/module-core": fileURLToPath(
        new URL("./modules/core/src/index.ts", import.meta.url),
      ),
      "@superbot/module-security": fileURLToPath(
        new URL("./modules/security/src/index.ts", import.meta.url),
      ),
      "@superbot/module-guardian": fileURLToPath(
        new URL("./modules/guardian/src/index.ts", import.meta.url),
      ),
      "@superbot/module-community": fileURLToPath(
        new URL("./modules/community/src/index.ts", import.meta.url),
      ),
      "@superbot/module-support": fileURLToPath(
        new URL("./modules/support/src/index.ts", import.meta.url),
      ),
      "@superbot/module-automation": fileURLToPath(
        new URL("./modules/automation/src/index.ts", import.meta.url),
      ),
      "@superbot/module-files": fileURLToPath(
        new URL("./modules/files/src/index.ts", import.meta.url),
      ),
      "@superbot/module-games": fileURLToPath(
        new URL("./modules/games/src/index.ts", import.meta.url),
      ),
      "@superbot/module-ai": fileURLToPath(
        new URL("./modules/ai/src/index.ts", import.meta.url),
      ),
      "@superbot/module-payments": fileURLToPath(
        new URL("./modules/payments/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
