import type { ModuleManifest } from "@superbot/domain";

export const guardianManifest: ModuleManifest = {
  name: "guardian",
  version: "0.1.0",
  description:
    "Join-request verification via Mini App camera challenges (Guardian Bots / Bot API 10.1 join request queries).",
  dependencies: ["core", "security"],
  permissions: ["guardian.read", "guardian.write", "guardian.staff_decide"],
  commands: [
    { name: "guardian", description: "Ayuda de Guardian Verification" },
    { name: "guardian_status", description: "Estado de Guardian en este chat" },
    { name: "guardian_on", description: "Activa Guardian Verification" },
    { name: "guardian_off", description: "Desactiva Guardian Verification" },
    {
      name: "guardian_mode",
      description: "Cambia el modo (off|manual|assisted|auto|strict)",
    },
  ],
  jobs: [
    { name: "guardian.session.expire", queue: "guardian" },
    { name: "guardian.media.retention_cleanup", queue: "guardian" },
  ],
  featureFlag: "guardian.enabled",
};
