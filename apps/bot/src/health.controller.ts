import { Controller, Get } from "@nestjs/common";
import { coreManifest } from "@superbot/module-core";
import { guardianManifest } from "@superbot/module-guardian";
import { securityManifest } from "@superbot/module-security";

const moduleManifests = [coreManifest, securityManifest, guardianManifest];

@Controller()
export class HealthController {
  @Get("health")
  getHealth() {
    return {
      ok: true,
      service: "bot",
      runtime: "nestjs-fastify",
      modules: moduleManifests.map((manifest) => manifest.name),
    };
  }
}
