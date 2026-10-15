/**
 * Rangos por actividad y antigüedad: VIP → Titán → Veterano → Leyenda.
 *
 * Moderador queda FUERA a propósito. Es el único que implica confianza y no
 * mérito acumulado, y un bot no puede juzgar eso: se nombra a mano.
 *
 * Puro y determinista — sin reloj, sin E/S. El llamante trae los números.
 */

export type RankKey = "vip" | "titan" | "veterano" | "leyenda";

export interface RankDefinition {
  readonly key: RankKey;
  /** Lo que se muestra. Cabe en el tope de 16 caracteres de un título de
   * administrador de Telegram, emoji incluido. */
  readonly label: string;
  /** Mensajes acumulados en el grupo. */
  readonly minMessages: number;
  /** Días desde que el bot lo vio por primera vez. */
  readonly minDays: number;
  /** Una línea para el anuncio, tomada de la tarjeta del grupo. */
  readonly blurb: string;
  /**
   * Si este rango lleva ademas el titulo visible junto al nombre en Telegram.
   *
   * HOY ES SIEMPRE FALSE, y el campo se queda para que conste por que.
   *
   * Un titulo visible ES un titulo de administrador: Telegram no tiene etiquetas
   * para miembros normales. La primera version intentaba resolverlo ascendiendo
   * con TODOS los permisos a false — pero en la Bot API eso no crea una insignia
   * sin poder, ES la forma documentada de degradar. Resultado, comprobado en
   * produccion el 6 de agosto de 2026: `9000000009` fue nombrado moderador con
   * `/admin` a las 04:18 y a las 19:00 el ascenso a Leyenda le dejo de miembro
   * raso; `9000000010` igual al cruzar Veterano. Ninguno de los dos llego a
   * tener titulo — `setChatAdministratorCustomTitle` se ejecuta despues y falla,
   * porque para entonces ya no son administradores.
   *
   * O sea que la insignia nunca funciono ni una vez, y de paso costaba el cargo
   * a quien lo tuviera.
   *
   * Para recuperarla hace falta una decision de producto, no un arreglo:
   * conceder al menos UN permiso real (`can_invite_users` es el candidato
   * barato), porque Telegram no da titulo a quien no es administrador. Mientras
   * eso no se decida, ningun rango lleva titulo y `applyRankTitle` ya no existe.
   */
  readonly titled: boolean;
}

/**
 * De menor a mayor. Los umbrales piden LAS DOS COSAS, mensajes y días, porque
 * cada rango de la tarjeta promete ambas: "tu actividad y tu antigüedad te
 * hacen subir". Solo con mensajes, una tarde de spam te haría Leyenda.
 *
 * Calibrados contra la actividad REAL del grupo el 3 ago 2026, no a ojo: de
 * 175 personas activas, 52 pasaban de 50 mensajes, 19 de 200 y UNA de 1000; y
 * el miembro mas antiguo que el bot conocia llevaba 22 dias. Con los numeros
 * inventados de la primera version, Veterano y Leyenda eran inalcanzables
 * durante meses — una escalera con dos peldaños decorativos.
 *
 * Conviene revisarlos cuando el grupo lleve unos meses: lo que hoy es Leyenda
 * sera corriente cuando todo el mundo acumule historial.
 */
export const RANKS: readonly RankDefinition[] = [
  {
    key: "vip",
    label: "💎 VIP",
    minMessages: 50,
    minDays: 3,
    blurb: "Miembro destacado.",
    titled: false,
  },
  {
    key: "titan",
    label: "⚔️ Titán",
    minMessages: 150,
    minDays: 7,
    blurb: "Participas activamente y se te nota.",
    titled: false,
  },
  {
    key: "veterano",
    label: "🛡️ Veterano",
    minMessages: 400,
    minDays: 14,
    blurb: "Tu constancia y tu antigüedad te destacan.",
    titled: false,
  },
  {
    key: "leyenda",
    label: "👑 Leyenda",
    minMessages: 800,
    minDays: 21,
    blurb: "Eres parte esencial de la comunidad.",
    titled: false,
  },
];

export interface RankStats {
  readonly messages: number;
  readonly ageDays: number;
}

/**
 * El rango que le corresponde a alguien, o null si aún no llega al primero.
 *
 * Devuelve el MÁS ALTO que cumpla, no el primero: alguien que entra ya con
 * mucha actividad importada no tiene por qué subir escalón a escalón.
 */
export const rankFor = (stats: RankStats): RankDefinition | null => {
  let alcanzado: RankDefinition | null = null;
  for (const rank of RANKS) {
    if (stats.messages >= rank.minMessages && stats.ageDays >= rank.minDays) {
      alcanzado = rank;
    }
  }
  return alcanzado;
};

/** Posición en la escalera, para comparar dos rangos. -1 = sin rango. */
export const rankOrder = (key: RankKey | null | undefined): number =>
  key ? RANKS.findIndex((r) => r.key === key) : -1;

/**
 * Si hay ascenso respecto a lo que ya tenía.
 *
 * Solo hacia arriba: un rango no se quita por dejar de escribir. Bajarlo
 * castigaría a quien se fue de vacaciones, y el mérito ya estaba hecho.
 */
export const isPromotion = (
  actual: RankKey | null | undefined,
  nuevo: RankDefinition | null,
): boolean => Boolean(nuevo) && rankOrder(nuevo?.key) > rankOrder(actual);

/** Lo que se publica cuando alguien sube. `who` ya viene como HTML. */
export const buildRankAnnouncement = (
  who: string,
  rank: RankDefinition,
): string => `🎉 ${who} sube a <b>${rank.label}</b> — ${rank.blurb}`;

/** Lo que contesta /rango a quien aún no tiene ninguno. */
export const buildNoRankReply = (stats: RankStats): string => {
  const siguiente = RANKS[0];
  if (!siguiente) {
    return "Este grupo no tiene rangos configurados.";
  }
  const faltanMsg = Math.max(0, siguiente.minMessages - stats.messages);
  const faltanDias = Math.max(0, siguiente.minDays - stats.ageDays);
  const partes: string[] = [];
  if (faltanMsg > 0) {
    partes.push(`${faltanMsg} mensajes`);
  }
  if (faltanDias > 0) {
    partes.push(`${faltanDias} días`);
  }
  return partes.length > 0
    ? `Aún no tienes rango. Para ${siguiente.label} te faltan ${partes.join(" y ")}.`
    : `Aún no tienes rango, pero ya cumples para ${siguiente.label}.`;
};

/** Lo que contesta /rango a quien sí lo tiene. */
export const buildRankReply = (
  rank: RankDefinition,
  stats: RankStats,
): string => {
  const siguiente = RANKS[rankOrder(rank.key) + 1];
  const cabecera = `${rank.label} — ${rank.blurb}`;
  if (!siguiente) {
    return `${cabecera}\n\nEs el rango más alto que se consigue participando.`;
  }
  const faltanMsg = Math.max(0, siguiente.minMessages - stats.messages);
  const faltanDias = Math.max(0, siguiente.minDays - stats.ageDays);
  const partes: string[] = [];
  if (faltanMsg > 0) {
    partes.push(`${faltanMsg} mensajes`);
  }
  if (faltanDias > 0) {
    partes.push(`${faltanDias} días`);
  }
  return partes.length > 0
    ? `${cabecera}\n\nPara ${siguiente.label} te faltan ${partes.join(" y ")}.`
    : `${cabecera}\n\nYa cumples para ${siguiente.label}.`;
};

/**
 * Cuántos títulos de Telegram caben todavía.
 *
 * Telegram no admite más de 50 administradores por grupo, y un rango visible
 * junto al nombre ES un título de administrador. Se deja un colchón para que
 * los ascensos automáticos nunca consuman los últimos huecos: quedarse sin
 * sitio para nombrar a un moderador de verdad, por haber repartido insignias,
 * sería un mal negocio.
 */
export const TELEGRAM_ADMIN_CAP = 50;
export const RANK_TITLE_RESERVE = 10;

export const titleSlotsLeft = (currentAdmins: number): number =>
  Math.max(0, TELEGRAM_ADMIN_CAP - RANK_TITLE_RESERVE - currentAdmins);
