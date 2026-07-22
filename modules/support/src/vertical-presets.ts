import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Presets de vertical: configuraciones "vendibles" que activan un set de
 * modulos, un mensaje de bienvenida, reglas y comandos sugeridos segun el
 * tipo de comunidad (aula educativa, soporte tecnico, creadores de contenido).
 * Logica pura: recibe una clave plana y devuelve la config; no toca I/O ni red.
 */

/** Verticales soportadas. Orden estable para menus deterministas. */
export const VERTICAL_KINDS = ["aula", "soporte", "creadores"] as const;

/** Clave de una vertical concreta. */
export type VerticalKind = (typeof VERTICAL_KINDS)[number];

/**
 * Config resuelta de una vertical. `modulesOn` reusa nombres de modulos reales
 * del repo (tickets, quizzes, reminders, misiones, scheduling). Todo readonly
 * para evitar mutaciones accidentales aguas abajo.
 */
export interface VerticalPreset {
  readonly modulesOn: readonly string[];
  readonly welcome: string;
  readonly rules: readonly string[];
  readonly commands: readonly string[];
}

const VERTICAL_PRESETS: Readonly<Record<VerticalKind, VerticalPreset>> = {
  aula: {
    modulesOn: ["quizzes", "reminders", "misiones", "scheduling"],
    welcome:
      "Bienvenido al aula! Aqui aprendemos juntos: responde los quizzes, " +
      "completa las misiones y no te pierdas los recordatorios de clase.",
    rules: [
      "Respeta el turno de palabra y a tus companeros",
      "Las dudas van al tema correspondiente, no al chat general",
      "Prohibido compartir respuestas de examenes",
    ],
    commands: ["quiz", "reminder", "mision", "agenda"],
  },
  soporte: {
    modulesOn: ["tickets", "reminders", "scheduling"],
    welcome:
      "Bienvenido al soporte! Abre un ticket con /ticket y te atenderemos " +
      "por orden de llegada. Describe tu problema con el mayor detalle posible.",
    rules: [
      "Un ticket por incidencia para poder seguirla",
      "No compartas contrasenas ni datos sensibles en el chat",
      "Se paciente: respondemos en horario de atencion",
    ],
    commands: ["ticket", "cerrar", "reminder", "agenda"],
  },
  creadores: {
    modulesOn: ["misiones", "scheduling", "reminders"],
    welcome:
      "Bienvenido al club de creadores! Coordina colaboraciones, cumple las " +
      "misiones de la comunidad y organiza tu calendario de publicaciones.",
    rules: [
      "Comparte solo contenido propio o con permiso",
      "El autobombo va en el hilo de promocion",
      "Da feedback constructivo, no derribes el trabajo ajeno",
    ],
    commands: ["mision", "agenda", "reminder"],
  },
};

/**
 * True cuando `value` es una vertical valida. Sirve de type guard para
 * estrechar `string` a `VerticalKind`. Puro y determinista.
 */
export const isVerticalKind = (value: string): value is VerticalKind =>
  (VERTICAL_KINDS as readonly string[]).includes(value);

/**
 * Devuelve la config de la vertical pedida. Copia superficial de los arrays
 * para que el llamador no pueda mutar el preset interno. Puro y determinista.
 */
export const resolveVerticalPreset = (kind: VerticalKind): VerticalPreset => {
  const preset = VERTICAL_PRESETS[kind];
  return {
    modulesOn: [...preset.modulesOn],
    welcome: preset.welcome,
    rules: [...preset.rules],
    commands: [...preset.commands],
  };
};

/** Comando parseado: la vertical elegida por el admin. */
export type VerticalCommand = { readonly kind: VerticalKind };

/** Error de parseo de `/vertical`. */
export interface VerticalCommandError {
  readonly code: "missing-kind" | "unknown-kind";
  readonly usage: string;
}

/** Resultado discriminado del parser de `/vertical`. */
export type VerticalCommandResult =
  | { readonly ok: true; readonly command: VerticalCommand }
  | { readonly ok: false; readonly error: VerticalCommandError };

const VERTICAL_USAGE = `Uso: /vertical ${VERTICAL_KINDS.join("|")}`;

/**
 * Parsea `/vertical <aula|soporte|creadores>`. Devuelve null si el update no
 * trae ese comando (no es el nuestro). Si falta la clave o es desconocida
 * devuelve `{ ok: false, error }`. Puro y determinista.
 */
export const parseVerticalCommand = (
  update: TelegramUpdateEnvelope,
): VerticalCommandResult | null => {
  const name = update.command?.name;

  if (name !== "vertical") {
    return null;
  }

  const raw = update.command?.args?.[0]?.toLowerCase();

  if (!raw) {
    return {
      ok: false,
      error: { code: "missing-kind", usage: VERTICAL_USAGE },
    };
  }

  if (!isVerticalKind(raw)) {
    return {
      ok: false,
      error: { code: "unknown-kind", usage: VERTICAL_USAGE },
    };
  }

  return { ok: true, command: { kind: raw } };
};

const VERTICAL_TITLES: Readonly<Record<VerticalKind, string>> = {
  aula: "Aula",
  soporte: "Soporte",
  creadores: "Creadores",
};

/**
 * Renderiza un preset como texto multilinea listo para enviar al chat:
 * titulo, modulos activados, bienvenida, reglas numeradas y comandos.
 * Puro y determinista.
 */
export const formatVerticalPreset = (kind: VerticalKind): string => {
  const preset = resolveVerticalPreset(kind);
  const lines: string[] = [
    `Vertical: ${VERTICAL_TITLES[kind]}`,
    `Modulos: ${preset.modulesOn.join(", ")}`,
    "",
    preset.welcome,
    "",
    "Reglas:",
    ...preset.rules.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    `Comandos: ${preset.commands.map((cmd) => `/${cmd}`).join(" ")}`,
  ];
  return lines.join("\n");
};
