import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Presets/modos de configuracion para un grupo, al estilo de los "modos"
 * de GroupHelp/Combot: aplicar de golpe un paquete de ajustes coherente,
 * y detectar cuando dos ajustes activos se contradicen. Logica pura: recibe
 * inputs planos y devuelve valores deterministas, sin I/O.
 */

/** Modos de configuracion soportados, en orden de presentacion. */
export const CONFIG_MODES = [
  "principiante",
  "avanzado",
  "vacaciones",
  "aula",
  "evento",
  "directo",
] as const;

/** Union de los nombres de modo validos. */
export type ConfigMode = (typeof CONFIG_MODES)[number];

/** Valor que un modo puede fijar sobre una clave de configuracion. */
export type ConfigModeValue = boolean | number | string;

/** Overrides que un modo aplica: mapa clave -> valor. */
export type ConfigModeOverrides = Readonly<Record<string, ConfigModeValue>>;

const CONFIG_MODE_SET: ReadonlySet<string> = new Set(CONFIG_MODES);

/** True si `value` es uno de los modos soportados. */
export const isConfigMode = (value: string): value is ConfigMode =>
  CONFIG_MODE_SET.has(value);

const CONFIG_MODE_OVERRIDES: Readonly<Record<ConfigMode, ConfigModeOverrides>> =
  {
    // Grupo nuevo/pequeno: proteccion suave, sin frenos duros.
    principiante: {
      antiSpam: true,
      antiFlood: false,
      captcha: false,
      lockUrl: false,
      allowLinks: true,
      warnLimit: 3,
      slowModeSeconds: 0,
    },
    // Comunidad grande y ruidosa: proteccion agresiva.
    avanzado: {
      antiSpam: true,
      antiFlood: true,
      captcha: true,
      lockUrl: true,
      allowLinks: false,
      warnLimit: 2,
      slowModeSeconds: 5,
    },
    // Admins fuera: cerrar el grupo y frenar el ritmo.
    vacaciones: {
      antiSpam: true,
      antiFlood: true,
      captcha: true,
      lockUrl: true,
      allowLinks: false,
      slowModeSeconds: 30,
      warnLimit: 1,
    },
    // Clase/curso: silencio salvo turno de palabra, sin enlaces.
    aula: {
      antiSpam: true,
      antiFlood: true,
      lockUrl: true,
      allowLinks: false,
      slowModeSeconds: 15,
      welcome: "Bienvenido al aula. Respeta el turno de palabra.",
    },
    // Evento con mucha gente entrando: captcha y bienvenida.
    evento: {
      antiSpam: true,
      antiFlood: true,
      captcha: true,
      allowLinks: true,
      lockUrl: false,
      welcome: "Bienvenido al evento!",
      slowModeSeconds: 3,
    },
    // Emision en directo: solo lectura efectiva, ritmo muy lento.
    directo: {
      antiFlood: true,
      lockUrl: true,
      allowLinks: false,
      slowModeSeconds: 60,
      captcha: false,
    },
  };

/**
 * Devuelve los overrides (copia inmutable) que aplica un modo. El resultado
 * es un objeto nuevo en cada llamada, seguro para mutar por el llamador.
 * Deterministico.
 */
export const expandConfigMode = (mode: ConfigMode): ConfigModeOverrides => ({
  ...CONFIG_MODE_OVERRIDES[mode],
});

/**
 * Regla de contradiccion: si las dos claves estan activas (true) a la vez,
 * se emite `message`. `detail` explica el porque en lenguaje neutro.
 */
interface ConfigContradictionRule {
  readonly a: string;
  readonly b: string;
  readonly message: string;
}

const CONFIG_CONTRADICTION_RULES: readonly ConfigContradictionRule[] = [
  {
    a: "allowLinks",
    b: "lockUrl",
    message:
      "allowLinks y lockUrl estan activos a la vez: los enlaces se permiten y se bloquean.",
  },
  {
    a: "silentMode",
    b: "welcomeEnabled",
    message:
      "silentMode y welcomeEnabled estan activos a la vez: el modo silencioso oculta la bienvenida.",
  },
  {
    a: "readOnly",
    b: "allowLinks",
    message:
      "readOnly y allowLinks estan activos a la vez: nadie puede escribir para enviar enlaces.",
  },
  {
    a: "antiFlood",
    b: "slowModeDisabled",
    message:
      "antiFlood y slowModeDisabled estan activos a la vez: el anti-flood exige limitar el ritmo.",
  },
  {
    a: "captcha",
    b: "autoApprove",
    message:
      "captcha y autoApprove estan activos a la vez: la aprobacion automatica salta el captcha.",
  },
];

/**
 * Detecta pares de ajustes activos que se contradicen. Recibe un mapa plano
 * clave -> boolean; una clave ausente cuenta como no activa. Devuelve los
 * mensajes en el orden fijo de las reglas, sin duplicados. Deterministico.
 */
export const detectConfigContradictions = (
  config: Readonly<Record<string, boolean>>,
): readonly string[] => {
  const messages: string[] = [];
  for (const rule of CONFIG_CONTRADICTION_RULES) {
    if (config[rule.a] === true && config[rule.b] === true) {
      messages.push(rule.message);
    }
  }
  return messages;
};

/** Comando parseado `/modo <nombre>`. */
export interface ConfigModeCommand {
  readonly mode: ConfigMode;
}

/** Codigos de error del parser de `/modo`. */
export type ConfigModeCommandErrorCode = "missing-mode" | "unknown-mode";

export interface ConfigModeCommandError {
  readonly code: ConfigModeCommandErrorCode;
  readonly usage: string;
}

export type ConfigModeCommandResult =
  | { readonly ok: true; readonly command: ConfigModeCommand }
  | { readonly ok: false; readonly error: ConfigModeCommandError };

const CONFIG_MODE_COMMAND_NAMES: ReadonlySet<string> = new Set([
  "modo",
  "preset",
]);

const CONFIG_MODE_USAGE = `Uso: /modo ${CONFIG_MODES.join("|")}`;

/**
 * Parsea `/modo <nombre>` (alias `/preset`). Devuelve null cuando el update
 * no trae uno de esos comandos. Si falta el nombre o es desconocido, devuelve
 * un resultado de error discriminado. Pura y deterministica.
 */
export const parseConfigModeCommand = (
  update: TelegramUpdateEnvelope,
): ConfigModeCommandResult | null => {
  const name = update.command?.name;

  if (!name || !CONFIG_MODE_COMMAND_NAMES.has(name)) {
    return null;
  }

  const raw = update.command?.args?.[0]?.trim().toLowerCase();

  if (!raw) {
    return {
      ok: false,
      error: { code: "missing-mode", usage: CONFIG_MODE_USAGE },
    };
  }

  if (!isConfigMode(raw)) {
    return {
      ok: false,
      error: { code: "unknown-mode", usage: CONFIG_MODE_USAGE },
    };
  }

  return { ok: true, command: { mode: raw } };
};
