import { Controller, Get } from "@nestjs/common";
import { coreManifest } from "@superbot/module-core";
import { guardianManifest } from "@superbot/module-guardian";
import { securityManifest } from "@superbot/module-security";

const manifests = [coreManifest, securityManifest, guardianManifest];

@Controller()
export class HealthController {
  @Get("health")
  getHealth() {
    return {
      ok: true,
      service: "api",
      runtime: "nestjs-fastify",
      manifests: manifests.map((manifest) => manifest.name),
    };
  }
}
