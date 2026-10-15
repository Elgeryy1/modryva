/**
 * Lo que se le dice a cada uno en El Impostor.
 *
 * Vive fuera del componente para poder probarlo. El fallo que motivó esto no
 * fue de datos —el rol llegaba bien— sino de que las dos pantallas eran
 * indistinguibles: mismo título, misma palabra en cuerpo enorme, y la única
 * diferencia era una línea de letra pequeña al final. El impostor abría, leía
 * su palabra y jugaba sin enterarse.
 *
 * Lo que hay que poder afirmar de esto es que impostor y grupo NO se parecen,
 * y eso es una propiedad, no una opinión: se comprueba.
 */

export type ImpostorRole = "impostor" | "crew";

export interface RoleCopy {
  /** Color del aviso. Distinto a propósito entre roles. */
  readonly kind: "success" | "error";
  readonly caption: string;
  /** El titular, lo primero que se lee. */
  readonly headline: string;
  /** Qué es la palabra que se enseña debajo. */
  readonly wordLabel: string;
  readonly hint: string;
}

const IMPOSTOR: RoleCopy = {
  kind: "error",
  caption: "Tu papel",
  headline: "ERES EL IMPOSTOR",
  wordLabel: "Tu palabra (NO es la de ellos)",
  hint: "Todos los demás comparten otra palabra, parecida a la tuya. Da pistas que encajen con las suyas sin saber cuál es, y que no te delaten.",
};

const CREW: RoleCopy = {
  kind: "success",
  caption: "La palabra del grupo",
  headline: "Vas con el grupo",
  wordLabel: "Tu palabra",
  hint: "Uno de vosotros tiene otra palabra. Da una pista de UNA palabra que encaje sin regalar la vuestra.",
};

/**
 * Ante la duda, se trata a la persona como del grupo.
 *
 * Es la dirección barata de equivocarse: a alguien del grupo se le dice que es
 * del grupo y no pasa nada. Decirle "eres el impostor" a quien no lo es
 * arruina la partida para todos.
 */
export const roleCopyOf = (role: string | undefined): RoleCopy =>
  role === "impostor" ? IMPOSTOR : CREW;
