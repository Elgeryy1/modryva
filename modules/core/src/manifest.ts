import type { ModuleManifest } from "@superbot/domain";

export const coreManifest: ModuleManifest = {
  name: "core",
  version: "0.1.0",
  description: "Core onboarding, navigation and settings.",
  dependencies: [],
  permissions: [
    "bot.read",
    "bot.write",
    "config.read",
    "config.write",
    "audit.read",
  ],
  commands: [
    { name: "start", description: "Inicia el bot" },
    { name: "help", description: "Ayuda contextual" },
    { name: "menu", description: "Menú principal" },
    { name: "settings", description: "Ajustes" },
    { name: "status", description: "Estado operativo" },
    { name: "cancel", description: "Cancela el flujo activo" },
  ],
  jobs: [],
  featureFlag: "core.enabled",
};
