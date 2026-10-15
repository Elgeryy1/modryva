/**
 * Deteccion de suplantacion de admin/soporte/bot. Logica pura: recibe el
 * candidato y la lista de admins reales por parametro y devuelve un veredicto
 * determinista. Sin I/O, sin red, sin Date.now()/Math.random(). Dos senales
 * disparan la alerta: (1) el nombre visible se parece mucho al de un admin
 * real (tras normalizar confusables), o (2) el nombre/username contiene una
 * palabra de rol ("admin", "soporte", "support", "staff"...) sin ser admin.
 */

/** Umbral de similitud por defecto (0..1) para considerar suplantacion. */
export const IMPERSONATION_THRESHOLD = 0.82;

/**
 * Palabras de rol que, presentes en el nombre o username de alguien que no es
 * admin real, delatan un intento de hacerse pasar por staff. Ya normalizadas
 * (minusculas, sin diacriticos, sin confusables).
 */
const ROLE_KEYWORDS: readonly string[] = [
  "admin",
  "admins",
  "administrador",
  "administradora",
  "administrator",
  "adm",
  "soporte",
  "support",
  "staff",
  "owner",
  "mod",
  "mods",
  "moderator",
  "moderador",
  "moderadora",
];

/**
 * Las palabras de rol se buscan como PALABRA, no como trozo de palabra.
 *
 * Buscarlas como subcadena marcaba a cualquiera llamado "Adminah" o "Modesta",
 * y un detector que señala a personas reales por su nombre deja de mirarse a la
 * tercera vez. Por eso la lista de arriba enumera las formas de verdad
 * ("administrador", "moderador"): antes se colaban por contener "admin" y
 * "mod", lo mismo que hacía colarse a los inocentes.
 *
 * Se permiten dígitos pegados ("admin01", "staff2") porque eso sigue siendo una
 * afirmación de cargo, y separadores de cualquier tipo alrededor ("- ADMIN -",
 * "soporte_oficial"). El texto llega ya normalizado: minúsculas, sin
 * diacríticos y con los confusables colapsados.
 */
const ROLE_WORD_PATTERN = new RegExp(
  `(?:^|[^a-z])(?:${ROLE_KEYWORDS.join("|")})[0-9]*(?:$|[^a-z])`,
  "u",
);

/**
 * Forma estructural de una senal ponderada. Redefinida localmente a proposito
 * para no acoplar este modulo a otros de esta oleada.
 */
export interface ImpersonationSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Identidad minima (nombre visible + username opcional) de un usuario. */
export interface ImpersonationIdentity {
  readonly name: string;
  readonly username?: string;
}

/** Veredicto de la deteccion. `score` es la mejor similitud hallada (0..1). */
export interface ImpersonationVerdict {
  readonly isImpersonation: boolean;
  readonly matchedAdminName?: string;
  readonly score: number;
  readonly reason: string;
}

const CONFUSABLES: readonly (readonly [RegExp, string])[] = [
  [/rn/g, "m"],
  [/\$/g, "s"],
  [/0/g, "o"],
  [/1/g, "l"],
];

/**
 * Normaliza un nombre visible para comparar: minusculas, sin diacriticos,
 * colapsa confusables comunes (0->o, 1->l, rn->m, $->s) y colapsa espacios.
 * Determinista.
 */
export const normalizeDisplayName = (s: string): string => {
  let out = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const [pattern, replacement] of CONFUSABLES) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, " ").trim();
};

/** Distancia de Levenshtein entre dos cadenas ya preparadas. */
const levenshtein = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  let prev: number[] = [];
  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    prev = curr;
  }

  return prev[b.length] ?? 0;
};

/**
 * Similitud (0..1) entre dos nombres: 1 = identicos, 0 = totalmente distintos.
 * Se calcula como 1 - distanciaLevenshtein/maxLongitud sobre los nombres
 * normalizados. Dos cadenas vacias se consideran identicas (1). Determinista.
 */
export const nameSimilarity = (a: string, b: string): number => {
  const na = normalizeDisplayName(a);
  const nb = normalizeDisplayName(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) {
    return 1;
  }
  return 1 - levenshtein(na, nb) / maxLen;
};

const stripAt = (username: string): string =>
  username.startsWith("@") ? username.slice(1) : username;

/**
 * Devuelve la palabra de rol contenida en el texto normalizado, o undefined.
 */
/**
 * Normalizacion para buscar palabras de rol: minusculas, sin diacriticos y con
 * los confusables de LETRAS colapsados, pero **conservando los digitos**.
 *
 * `normalizeDisplayName` convierte `0→o` y `1→l` para que "M0dryva" se parezca
 * a "Modryva" — util comparando nombres, y contraproducente aqui: convierte
 * "admin01" en "adminol", que ya no contiene ninguna palabra de rol. Y
 * "admin01" es exactamente como se llama un suplantador.
 */
const normalizeForRoleWords = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/rn/gu, "m")
    .replace(/\$/gu, "s")
    .replace(/\s+/gu, " ")
    .trim();

const findRoleKeyword = (normalized: string): string | undefined => {
  const match = ROLE_WORD_PATTERN.exec(normalized);
  if (!match) {
    return undefined;
  }
  // Se devuelve la palabra reconocible, no el trozo con los separadores que la
  // rodean: acaba en el aviso que lee una persona.
  return ROLE_KEYWORDS.find((word) => match[0].includes(word));
};

/**
 * Decide si `candidate` esta suplantando a algun admin real. Marca
 * suplantacion cuando el nombre visible se parece a un admin por encima del
 * umbral (comparando tanto contra su name como contra su username), o cuando
 * el name/username contiene una palabra de rol sin coincidir con un admin
 * real. Los admins reales (mismo username, case-insensitive) nunca se marcan.
 * Pura y determinista.
 */
export const detectImpersonation = (
  candidate: ImpersonationIdentity,
  admins: readonly ImpersonationIdentity[],
  opts?: { readonly threshold?: number },
): ImpersonationVerdict => {
  const threshold = opts?.threshold ?? IMPERSONATION_THRESHOLD;

  const candidateUsername = candidate.username
    ? stripAt(candidate.username).toLowerCase()
    : undefined;

  const isRealAdmin =
    candidateUsername !== undefined &&
    admins.some(
      (admin) =>
        admin.username !== undefined &&
        stripAt(admin.username).toLowerCase() === candidateUsername,
    );

  if (isRealAdmin) {
    return {
      isImpersonation: false,
      score: 0,
      reason: "El usuario es un admin real; no hay suplantacion.",
    };
  }

  let bestScore = 0;
  let matchedAdminName: string | undefined;

  for (const admin of admins) {
    const targets = [admin.name, admin.username].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    for (const target of targets) {
      const score = nameSimilarity(candidate.name, target);
      if (score > bestScore) {
        bestScore = score;
        matchedAdminName = admin.name;
      }
    }
  }

  if (matchedAdminName !== undefined && bestScore >= threshold) {
    return {
      isImpersonation: true,
      matchedAdminName,
      score: bestScore,
      reason: `El nombre se parece al del admin "${matchedAdminName}" (${bestScore.toFixed(2)}).`,
    };
  }

  // Se mira con las dos normalizaciones porque cada una ve lo que la otra no:
  // la de similitud caza "adrnin" (rn→m) y la de dígitos caza "admin01", que la
  // otra habría convertido en "adminol".
  const crudo = [candidate.name, candidateUsername ?? ""].join(" ");
  const roleKeyword =
    findRoleKeyword(normalizeDisplayName(crudo)) ??
    findRoleKeyword(normalizeForRoleWords(crudo));

  if (roleKeyword !== undefined) {
    return {
      isImpersonation: true,
      score: bestScore,
      reason: `Usa la palabra de rol "${roleKeyword}" sin ser staff real.`,
    };
  }

  return {
    isImpersonation: false,
    ...(matchedAdminName !== undefined ? { matchedAdminName } : {}),
    score: bestScore,
    reason: "El nombre no se parece a ningun admin ni usa palabras de rol.",
  };
};

/**
 * Convierte la lista de administradores tal como la devuelve Telegram en algo
 * contra lo que comparar.
 *
 * Descarta los bots: nadie entra a un grupo haciendose pasar por @GroupHelp, y
 * dejarlos dentro solo produce falsos positivos — sus nombres suelen llevar
 * "bot" y palabras de rol. Descarta tambien a quien no tiene ningun nombre
 * legible, porque comparar contra la cadena vacia da similitud 1 con cualquier
 * cosa y marcaria a todo el mundo.
 *
 * Pura y total.
 */
export const adminIdentitiesFrom = (
  admins: readonly {
    readonly username?: string | undefined;
    readonly firstName?: string | undefined;
    readonly isBot?: boolean;
  }[],
): readonly ImpersonationIdentity[] =>
  admins
    .filter((admin) => admin.isBot !== true)
    .map((admin) => ({
      name: admin.firstName ?? admin.username ?? "",
      ...(admin.username !== undefined ? { username: admin.username } : {}),
    }))
    .filter((identity) => identity.name.length > 0);

/**
 * El aviso que lee el STAFF.
 *
 * Dice explicitamente que NO se ha hecho nada, y no es un detalle de cortesia:
 * quien lee "posible suplantacion" en un bot de moderacion asume que el bot ya
 * ha actuado, deja de mirar, y el suplantador se queda dentro escribiendo
 * privados. El texto tiene que desmontar esa suposicion.
 *
 * Pura y determinista.
 */
export const buildImpersonationAlert = (
  label: string,
  verdict: ImpersonationVerdict,
): string =>
  [
    "🎭 Posible suplantación de admin",
    "",
    `${label} acaba de entrar. ${verdict.reason}`,
    "",
    "No se ha hecho nada: esto es solo un aviso. Míralo antes de que escriba por privado a nadie.",
  ].join("\n");

/**
 * Construye las senales ponderadas del veredicto, utiles para depurar o para
 * un log de moderacion. Pura y determinista.
 */
export const buildImpersonationSignals = (
  verdict: ImpersonationVerdict,
): readonly ImpersonationSignal[] => [
  {
    key: "name-similarity",
    weight: verdict.score,
    present: verdict.matchedAdminName !== undefined,
    ...(verdict.matchedAdminName !== undefined
      ? { detail: verdict.matchedAdminName }
      : {}),
  },
  {
    key: "verdict",
    weight: verdict.isImpersonation ? 1 : 0,
    present: verdict.isImpersonation,
    detail: verdict.reason,
  },
];
