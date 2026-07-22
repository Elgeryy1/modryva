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
  "soporte",
  "support",
  "staff",
  "owner",
  "moderator",
  "moderador",
];

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
const findRoleKeyword = (normalized: string): string | undefined =>
  ROLE_KEYWORDS.find((word) => normalized.includes(word));

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

  const roleHaystack = [
    normalizeDisplayName(candidate.name),
    candidateUsername ? normalizeDisplayName(candidateUsername) : "",
  ].join(" ");
  const roleKeyword = findRoleKeyword(roleHaystack);

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
