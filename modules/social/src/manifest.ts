import type { ModuleManifest } from "@superbot/domain";

/**
 * The social core's declared surface.
 *
 * `featureFlag` and the per-group settings are two different switches on
 * purpose: this one turns the module off everywhere, the settings turn each
 * function off for one group. Neither is needed to make a fresh deploy safe —
 * every social function ships disabled (see DEFAULT_SOCIAL_SETTINGS).
 */
export const socialManifest: ModuleManifest = {
  name: "social",
  version: "0.1.0",
  description:
    "Rituales sociales del grupo: pole diaria con rankings y rachas, ruleta virtual, Paulo, gatos y perros.",
  dependencies: ["core"],
  // moderation.write is listed because the roulette's optional temporary mute
  // goes through the existing sanction path — the module never restricts a
  // member itself.
  permissions: [
    "config.read",
    "config.write",
    "audit.write",
    "moderation.write",
  ],
  commands: [
    {
      name: "pole",
      aliases: ["poles"],
      description: "Reclama tu puesto del día",
      scope: ["group", "supergroup"],
    },
    {
      name: "ruleta",
      aliases: ["roulette"],
      description: "Ruleta rusa virtual del grupo",
      scope: ["group", "supergroup"],
    },
    { name: "paulo", description: "Frase motivacional absurda" },
    { name: "gato", aliases: ["cat"], description: "Un gato" },
    { name: "perro", aliases: ["dog"], description: "Un perro" },
    {
      name: "apoyar",
      aliases: ["invitameauncafe"],
      description: "Cómo apoyar el proyecto",
    },
  ],
  jobs: [],
  featureFlag: "social.enabled",
};
