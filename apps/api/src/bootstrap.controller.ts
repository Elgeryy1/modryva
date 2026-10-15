import { Controller, Get } from "@nestjs/common";
import { coreManifest } from "@superbot/module-core";
import { guardianManifest } from "@superbot/module-guardian";
import { securityManifest } from "@superbot/module-security";
import { getRuntimeEnv } from "@superbot/shared";

const manifests = [coreManifest, securityManifest, guardianManifest];

@Controller("v1")
export class BootstrapController {
  @Get("bootstrap")
  getBootstrap() {
    const env = getRuntimeEnv();

    return {
      ok: true,
      appName: "Superbot",
      modules: manifests,
      webUrl: env.TELEGRAM_APP_URL,
    };
  }

  @Get("modules")
  getModules() {
    return {
      ok: true,
      modules: manifests,
    };
  }
}
