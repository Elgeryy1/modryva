/**
 * Quién abre el enlace de verificación cuando ya no hay sesión viva.
 *
 * El embudo de Guardian dice que 255 de 878 personas (29 %) "reciben el enlace
 * y nunca abren la Mini App". Eso no se sabe: `progressStep` se queda en 0 tanto
 * si alguien no tocó nada como si tocó tarde y se encontró la puerta cerrada.
 * Son dos problemas distintos y solo uno se arregla subiendo el TTL — que en
 * los cuatro grupos con Guardian encendido son 10 minutos (`sessionTtlSeconds`,
 * su valor por defecto), no los 30 que decía aquí.
 *
 * `GuardianSessionGuard` ya distingue los dos portazos (410), pero los tiraba
 * sin contarlos. Esto no cambia lo que se le responde a nadie: solo deja el
 * dato que hace falta para decidir con números en vez de con la intuición de
 * que "30 minutos parecen pocos".
 *
 * El número que decide es `desdeElPrincipioMs`, no `tardeMs`: si la gente
 * aparece a los 40 minutos, subir el TTL a 2 h los recupera casi a todos; si
 * aparece a los tres días, el TTL no tiene nada que ver y subirlo solo alarga
 * la ventana en la que un enlace vivo puede reenviarse a otra persona.
 */

/** Lo mínimo que se necesita de la sesión — así esto no depende de Prisma. */
export interface SesionCaducada {
  readonly status: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface LlegadaTarde {
  /** `caducada` = el TTL se la llevó; `cerrada` = ya se había resuelto,
   * cancelado o rechazado. Solo la primera es una candidata a subir el TTL. */
  readonly motivo: "caducada" | "cerrada";
  readonly estado: string;
  /** Cuánto tarde llegó, contado desde que la sesión murió. */
  readonly tardeMs: number;
  /** Cuánto tardó en abrir desde que pidió entrar. El número que decide. */
  readonly desdeElPrincipioMs: number;
}

/**
 * Pura y total: no lee reloj propio (se le pasa `ahora`) ni lanza. Los negativos
 * se recortan a 0 porque un reloj que va hacia atrás es un fallo de infra, no un
 * dato de embudo, y un número negativo en una media la envenena en silencio.
 */
export const describeLlegadaTarde = (
  session: SesionCaducada,
  ahora: Date,
  motivo: "caducada" | "cerrada",
): LlegadaTarde => ({
  motivo,
  estado: session.status,
  tardeMs: Math.max(0, ahora.getTime() - session.expiresAt.getTime()),
  desdeElPrincipioMs: Math.max(
    0,
    ahora.getTime() - session.createdAt.getTime(),
  ),
});
