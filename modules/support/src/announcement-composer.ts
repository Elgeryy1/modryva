/**
 * Composer de anuncios con test de claridad y tono. Logica pura: analiza un
 * texto (largo, confusion, agresividad, tono, temas sensibles) y construye un
 * resumen previo al envio. Sin I/O, sin red, sin Date.now()/Math.random();
 * todo determinista a partir de inputs planos.
 */

/**
 * Senal estructural reutilizable dentro de este modulo (forma redefinida
 * localmente para no acoplarse a otros modulos de la oleada).
 */
export interface AnnouncementSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Tono percibido del anuncio segun senales lexicas. */
export type AnnouncementTone =
  | "serio"
  | "cercano"
  | "hype"
  | "urgente"
  | "tecnico";

/** Resultado del analisis de un anuncio. Puro y determinista. */
export interface AnnouncementAnalysis {
  readonly lengthOk: boolean;
  readonly clarityIssues: readonly string[];
  readonly tone: AnnouncementTone;
  readonly sensitiveFlags: readonly string[];
}

/** Largo maximo recomendado (caracteres) antes de avisar de texto largo. */
export const ANNOUNCEMENT_MAX_LENGTH = 600;

/** Largo minimo util (caracteres) para considerar el texto un anuncio. */
export const ANNOUNCEMENT_MIN_LENGTH = 12;

/** Numero de signos de exclamacion a partir del cual se marca agresividad. */
export const ANNOUNCEMENT_SHOUT_THRESHOLD = 3;

/** Ratio de mayusculas (0..1) sobre letras a partir del cual se avisa. */
export const ANNOUNCEMENT_CAPS_RATIO = 0.6;

const LETTER = /\p{L}/u;
const UPPER = /\p{Lu}/u;

const AGGRESSIVE_WORDS: readonly string[] = [
  "idiota",
  "idiotas",
  "estupido",
  "estupidos",
  "basura",
  "callate",
  "callense",
  "obligatorio",
  "ahora mismo",
  "ya mismo",
];

const TONE_KEYWORDS: Readonly<Record<AnnouncementTone, readonly string[]>> = {
  urgente: [
    "urgente",
    "urge",
    "inmediato",
    "inmediatamente",
    "ahora mismo",
    "ya mismo",
    "atencion",
    "cuidado",
    "importante",
    "ultima hora",
  ],
  hype: [
    "gratis",
    "sorteo",
    "premio",
    "regalo",
    "increible",
    "brutal",
    "mega",
    "enorme",
    "gana",
    "ganate",
    "no te lo pierdas",
  ],
  tecnico: [
    "version",
    "deploy",
    "servidor",
    "api",
    "endpoint",
    "config",
    "release",
    "parche",
    "migracion",
    "bug",
    "backend",
  ],
  cercano: [
    "hola",
    "chicos",
    "gracias",
    "equipo",
    "comunidad",
    "juntos",
    "familia",
    "abrazo",
    "saludos",
    "carino",
  ],
  serio: [],
};

const SENSITIVE_TOPICS: Readonly<Record<string, readonly string[]>> = {
  politica: [
    "politica",
    "gobierno",
    "elecciones",
    "partido",
    "presidente",
    "votar",
    "voto",
    "ministro",
  ],
  dinero: [
    "dinero",
    "pago",
    "pagar",
    "precio",
    "inversion",
    "cripto",
    "bitcoin",
    "euros",
    "dolares",
    "banco",
    "prestamo",
  ],
  salud: [
    "salud",
    "medico",
    "medicina",
    "vacuna",
    "enfermedad",
    "sintomas",
    "tratamiento",
    "hospital",
    "cura",
  ],
};

/** Normaliza a minusculas y sin acentos para comparar de forma estable. */
const normalize = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/gu, "");

/** True si `haystack` contiene `needle` como palabra o frase completa. */
const containsWord = (haystack: string, needle: string): boolean => {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "u").test(haystack);
};

/** Ratio (0..1) de letras en mayuscula sobre el total de letras. */
const capsRatio = (text: string): number => {
  let letters = 0;
  let uppers = 0;
  for (const ch of text) {
    if (LETTER.test(ch)) {
      letters += 1;
      if (UPPER.test(ch)) {
        uppers += 1;
      }
    }
  }
  return letters === 0 ? 0 : uppers / letters;
};

/** Cuenta ocurrencias de un caracter concreto. */
const countChar = (text: string, ch: string): number => {
  let n = 0;
  for (const c of text) {
    if (c === ch) {
      n += 1;
    }
  }
  return n;
};

/**
 * Genera las senales de agresividad/grito del texto ya normalizado. Expuesta
 * para inspeccion y tests; el orden es estable.
 */
export const collectAnnouncementSignals = (
  text: string,
): readonly AnnouncementSignal[] => {
  const normalized = normalize(text);
  const shouts = countChar(text, "!");
  const caps = capsRatio(text);
  const badWord = AGGRESSIVE_WORDS.find((w) => containsWord(normalized, w));

  return [
    {
      key: "shouting",
      weight: 2,
      present: shouts >= ANNOUNCEMENT_SHOUT_THRESHOLD,
      detail: `${shouts} signos de exclamacion`,
    },
    {
      key: "caps",
      weight: 2,
      present: caps >= ANNOUNCEMENT_CAPS_RATIO,
      detail: `${Math.round(caps * 100)}% en mayusculas`,
    },
    {
      key: "aggressive-words",
      weight: 3,
      present: badWord !== undefined,
      ...(badWord !== undefined ? { detail: badWord } : {}),
    },
  ];
};

/**
 * Detecta el tono del anuncio por senales lexicas. Prioridad ante empates:
 * urgente > hype > tecnico > cercano > serio (serio es el valor por defecto
 * cuando no hay ninguna senal). Puro y determinista.
 */
export const detectAnnouncementTone = (text: string): AnnouncementTone => {
  const normalized = normalize(text);
  const order: readonly AnnouncementTone[] = [
    "urgente",
    "hype",
    "tecnico",
    "cercano",
  ];

  let best: AnnouncementTone = "serio";
  let bestScore = 0;

  for (const tone of order) {
    let score = 0;
    for (const kw of TONE_KEYWORDS[tone]) {
      if (containsWord(normalized, normalize(kw))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      best = tone;
      bestScore = score;
    }
  }

  return best;
};

/**
 * Marca temas sensibles presentes en el texto (politica, dinero, salud). El
 * orden de las flags es estable: politica, dinero, salud. Puro.
 */
export const detectSensitiveTopics = (text: string): readonly string[] => {
  const normalized = normalize(text);
  const flags: string[] = [];
  for (const topic of ["politica", "dinero", "salud"] as const) {
    if (
      SENSITIVE_TOPICS[topic]?.some((kw) =>
        containsWord(normalized, normalize(kw)),
      )
    ) {
      flags.push(topic);
    }
  }
  return flags;
};

/**
 * Analiza un anuncio: avisa si es demasiado largo/corto, lista problemas de
 * claridad (largo, confuso, agresivo), detecta el tono y marca temas
 * sensibles. Puro y determinista.
 */
export const analyzeAnnouncement = (text: string): AnnouncementAnalysis => {
  const trimmed = text.trim();
  const issues: string[] = [];

  const lengthOk =
    trimmed.length >= ANNOUNCEMENT_MIN_LENGTH &&
    trimmed.length <= ANNOUNCEMENT_MAX_LENGTH;

  if (trimmed.length < ANNOUNCEMENT_MIN_LENGTH) {
    issues.push("demasiado corto");
  } else if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) {
    issues.push("demasiado largo");
  }

  // Confuso: parrafo largo sin puntuacion de cierre (muro de texto).
  const hasSentenceBreak = /[.!?\n]/u.test(trimmed);
  if (trimmed.length > 160 && !hasSentenceBreak) {
    issues.push("confuso: bloque largo sin puntuacion");
  }

  const signals = collectAnnouncementSignals(trimmed);
  for (const signal of signals) {
    if (!signal.present) {
      continue;
    }
    if (signal.key === "shouting") {
      issues.push("agresivo: demasiados signos de exclamacion");
    } else if (signal.key === "caps") {
      issues.push("agresivo: demasiadas mayusculas");
    } else if (signal.key === "aggressive-words") {
      issues.push(
        signal.detail
          ? `agresivo: lenguaje hostil ("${signal.detail}")`
          : "agresivo: lenguaje hostil",
      );
    }
  }

  return {
    lengthOk,
    clarityIssues: issues,
    tone: detectAnnouncementTone(trimmed),
    sensitiveFlags: detectSensitiveTopics(trimmed),
  };
};

/**
 * Construye un resumen previo al envio: "Vas a enviar esto a N grupos y fijar
 * en M." Incluye una linea con el tono y, si hay, los avisos de claridad y
 * temas sensibles. `pinnedGroups` puede omitirse (ninguno fijado). Puro.
 */
export const buildAnnouncementPreview = (
  text: string,
  targetGroups: readonly string[],
  pinnedGroups: readonly string[] = [],
): string => {
  const analysis = analyzeAnnouncement(text);
  const n = targetGroups.length;
  const m = pinnedGroups.length;

  const groupWord = n === 1 ? "grupo" : "grupos";
  const pinWord = m === 1 ? "grupo" : "grupos";

  const lines: string[] = [
    `📣 Vas a enviar esto a ${n} ${groupWord} y fijar en ${m} ${pinWord}.`,
    `Tono detectado: ${analysis.tone}.`,
  ];

  if (analysis.clarityIssues.length > 0) {
    lines.push(`Avisos: ${analysis.clarityIssues.join("; ")}.`);
  }

  if (analysis.sensitiveFlags.length > 0) {
    lines.push(`Temas sensibles: ${analysis.sensitiveFlags.join(", ")}.`);
  }

  return lines.join("\n");
};
