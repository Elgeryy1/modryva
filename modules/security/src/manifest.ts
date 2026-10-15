import type { ModuleManifest } from "@superbot/domain";

export const securityManifest: ModuleManifest = {
  name: "security",
  version: "0.1.0",
  description: "Moderation, antispam, captcha and policy engine.",
  dependencies: ["core"],
  permissions: [
    "moderation.read",
    "moderation.write",
    "security.read",
    "security.write",
  ],
  commands: [
    { name: "ban", description: "Banea un usuario" },
    { name: "warn", description: "Añade una advertencia" },
    { name: "captcha", description: "Controla captchas" },
    { name: "policy_test", description: "Simula una política" },
  ],
  jobs: [],
  featureFlag: "security.enabled",
};
