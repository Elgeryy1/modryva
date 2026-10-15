/**
 * Lo que `modules/automation` necesita guardar y volver a leer del chat.
 *
 * Los declara el MODULO, no `packages/domain`: los puertos del dominio son
 * transversales —Telegram, permisos, reloj— y la persistencia de cada modulo es
 * suya. Y no son un `leer(clave)/guardar(clave, valor)` generico a proposito:
 * un puerto asi es el repositorio de ajustes con otro nombre, y reconstruiria
 * el acoplamiento con un paso mas de por medio.
 *
 * Cada puerto dice exactamente **que** dato necesita. Quien lo implementa sabe
 * bajo que clave vive; el modulo no tiene por que.
 */

/** Lo que se sabe de una fuente de contenido: si es de fiar y con que margen. */
export interface ReputacionDeFuente {
  readonly trusted: boolean;
  readonly score: number;
}

/** El mapa de fuentes de confianza del chat. */
export interface FuentesDeConfianzaPort {
  leer(): Promise<Record<string, ReputacionDeFuente>>;
  guardar(fuentes: Record<string, ReputacionDeFuente>): Promise<void>;
}

/** Las explicaciones oficiales de las reglas del chat, por nombre de regla. */
export interface ExplicacionesDeReglaPort {
  leer(): Promise<Record<string, string>>;
  guardar(explicaciones: Record<string, string>): Promise<void>;
}
