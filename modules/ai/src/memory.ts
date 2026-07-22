import { createHash } from "node:crypto";

export type AiMemoryScope = "user" | "chat";

export interface AiMemoryFact {
  readonly scope: AiMemoryScope;
  readonly key: string;
  readonly value: string;
}

export interface AiMemoryProfile {
  readonly userId?: string;
  readonly username?: string;
  readonly firstName?: string;
  readonly languageCode?: string;
  readonly chatId?: string;
  readonly chatTitle?: string;
  readonly chatType?: string;
  readonly facts: readonly AiMemoryFact[];
}

const compactValue = (value: string, max = 160): string =>
  value.replace(/\s+/gu, " ").trim().slice(0, max);

const isUsefulValue = (value: string): boolean =>
  value.length >= 2 && value.length <= 160 && !/[{}<>]/u.test(value);

export const buildAiMemorySystemHint = (
  profile: AiMemoryProfile,
): string | undefined => {
  const lines = [
    "Contexto persistente disponible para personalizar la respuesta:",
    profile.firstName
      ? `- Nombre visible del usuario: ${profile.firstName}`
      : "",
    profile.username ? `- Username del usuario: @${profile.username}` : "",
    profile.userId ? `- Telegram user id: ${profile.userId}` : "",
    profile.languageCode
      ? `- Idioma Telegram del usuario: ${profile.languageCode}`
      : "",
    profile.chatTitle ? `- Chat/grupo actual: ${profile.chatTitle}` : "",
    profile.chatType ? `- Tipo de chat: ${profile.chatType}` : "",
    ...profile.facts.map((fact) =>
      fact.scope === "chat"
        ? `- Memoria del chat: ${fact.key} = ${fact.value}`
        : `- Memoria del usuario: ${fact.key} = ${fact.value}`,
    ),
    "Usa esta memoria solo cuando sea relevante. Si contradice el mensaje actual, prioriza el mensaje actual. No reveles que existe una base de datos de memoria salvo que el usuario pregunte.",
  ].filter(Boolean);

  return lines.length > 2 ? lines.join("\n") : undefined;
};

export const extractAiMemoryFacts = (text: string): AiMemoryFact[] => {
  const normalized = compactValue(text, 500);
  const facts: AiMemoryFact[] = [];

  const patterns: Array<{
    key: string;
    scope: AiMemoryScope;
    pattern: RegExp;
  }> = [
    {
      key: "preferred_name",
      scope: "user",
      pattern:
        /\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][\wÁÉÍÓÚÜÑáéíóúüñ ._-]{1,40})/iu,
    },
    {
      key: "preferred_address",
      scope: "user",
      pattern:
        /\b(?:llamame|llámame|prefiero que me llames)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][\wÁÉÍÓÚÜÑáéíóúüñ ._-]{1,40})/iu,
    },
    {
      key: "location",
      scope: "user",
      pattern:
        /\b(?:soy de|vivo en|estoy en)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][\wÁÉÍÓÚÜÑáéíóúüñ ._-]{1,60})/iu,
    },
    {
      key: "preference",
      scope: "user",
      pattern: /\b(?:me gusta|prefiero)\s+([^.!?\n]{2,100})/iu,
    },
    {
      key: "group_purpose",
      scope: "chat",
      pattern:
        /\b(?:este grupo es para|este chat es para|aqui hablamos de|aquí hablamos de)\s+([^.!?\n]{3,120})/iu,
    },
  ];

  for (const { key, scope, pattern } of patterns) {
    const match = normalized.match(pattern);
    const value = compactValue(match?.[1] ?? "");
    if (isUsefulValue(value)) {
      facts.push({ scope, key, value });
    }
  }

  return facts;
};

// ---------------------------------------------------------------------------
// Explicit "remember this" — the Saved Info / Saved Memories layer that
// ChatGPT, Claude and Gemini all expose: the user tells the bot a durable fact
// in natural language and it is stored verbatim (free-form), not squeezed into
// one of the regex patterns above. See docs / AI memory design.
// ---------------------------------------------------------------------------

const NOTE_MAX = 300;

/** A free-form note is looser than a structured fact: allow up to NOTE_MAX and
 * reject only markup that could break the injected system hint. */
const isUsefulNote = (value: string): boolean =>
  value.length >= 2 && value.length <= NOTE_MAX && !/[{}<>]/u.test(value);

export interface RememberCommand {
  readonly value: string;
}

/**
 * A deliberately BROAD "save this" intent so a user can phrase it a thousand
 * ways and still have it stick — recuerda / recuérdame / recuérdate /
 * acuérdate (de) / no (te) olvides (de) / memoriza / anota / apunta / guarda /
 * ten en cuenta / ten presente / que sepas / quiero que recuerdes|sepas… — with
 * or without "que"/"de"/":", accented or not. Precision comes from two places,
 * NOT from being strict here: (1) the message must START with one of these
 * verbs, and (2) the bot only consults this when the message is addressed to
 * Modryva (DM, @mention or reply), so it never hijacks human-to-human chatter.
 */
const MEMORY_INTENT = new RegExp(
  "^" +
    "(?:@?modryva\\w*[\\s,:.!¡-]+)?" + // optional leading bot mention
    "(?:" +
    "recu[eé]rda(?:me|te)?" +
    "|acu[eé]rdate(?:\\s+de)?" +
    "|no\\s+(?:te\\s+|me\\s+)?olvides(?:\\s+de)?" +
    "|memor[ií]za(?:me)?" +
    "|an[oó]ta(?:me)?" +
    "|ap[uú]nta(?:me|te)?" +
    "|gu[aá]rda(?:me|te)?" +
    "|ten\\s+(?:en\\s+cuenta|presente)" +
    "|(?:quiero|necesito|me\\s+gustar[ií]a)\\s+que\\s+(?:recuerdes|sepas|tengas\\s+en\\s+cuenta|anotes|guardes)" +
    "|(?:para\\s+)?que\\s+sepas" +
    ")" +
    "[\\s,:.-]*(?:de\\s+)?(?:que\\s+)?(.+)$",
  "iu",
);

/** The captured tail must not be a lone filler word left over from a phrase like
 * "recuerda que" (no actual fact) or "acuérdate de eso". */
const LONE_FILLER = /^(?:que|de|eso|esto|lo|los?|las?|algo|:|,|\.)$/iu;

export const parseRememberCommand = (text: string): RememberCommand | null => {
  const trimmed = text.replace(/\s+/gu, " ").trim();
  const match = trimmed.match(MEMORY_INTENT);
  if (!match) {
    return null;
  }
  const value = compactValue(match[1] ?? "", NOTE_MAX)
    // strip a connector the verb group didn't consume ("recuerda, que X").
    .replace(/^(?:que|de\s+que|de|:|,|\.|-)\s+/iu, "")
    .trim();
  if (!isUsefulNote(value) || LONE_FILLER.test(value)) {
    return null;
  }
  return { value };
};

/** Stable dedup key for an explicit note so saying the same thing twice updates
 * one row instead of piling up duplicates (mirrors how ChatGPT merges). */
export const memoryKeyForNote = (value: string): string =>
  `note:${createHash("sha256")
    .update(compactValue(value, NOTE_MAX).toLowerCase())
    .digest("hex")
    .slice(0, 12)}`;

// ---------------------------------------------------------------------------
// Rendering the "what do you remember about me" list (the manage-memory view).
// ---------------------------------------------------------------------------

export interface StoredMemory {
  readonly key: string;
  readonly value: string;
  readonly source?: string;
}

const STRUCTURED_FACT_LABEL: Record<string, (value: string) => string> = {
  preferred_name: (v) => `Te llamas ${v}`,
  preferred_address: (v) => `Prefieres que te llame ${v}`,
  location: (v) => `Eres de / estás en ${v}`,
  preference: (v) => `Te gusta ${v}`,
  group_purpose: (v) => `Este grupo es para ${v}`,
};

/** One memory rendered as a human sentence: explicit notes show verbatim; the
 * regex-extracted structured facts get a friendly label. */
export const describeMemory = (memory: StoredMemory): string => {
  if (memory.source === "explicit" || memory.key.startsWith("note:")) {
    return memory.value;
  }
  const label = STRUCTURED_FACT_LABEL[memory.key];
  return label ? label(memory.value) : `${memory.key}: ${memory.value}`;
};

export const renderMemoryList = (
  memories: readonly StoredMemory[],
): string => {
  if (memories.length === 0) {
    return 'Todavía no recuerdo nada de ti. Dime «Modryva, recuerda que…» y lo apunto. 🧠';
  }
  const lines = memories.map((m, i) => `${i + 1}. ${describeMemory(m)}`);
  return [
    "🧠 Esto es lo que recuerdo de ti:",
    ...lines,
    "",
    "Borra una con /olvida <número>, o todo con /olvidatodo.",
  ].join("\n");
};
