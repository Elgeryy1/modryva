import { createHash, randomBytes } from "node:crypto";

/**
 * Las semillas del juego justo (commit-reveal), compartidas por las dos
 * carteras que apuestan: las fichas del casino y la moneda del grupo.
 *
 * Viven aqui y no en `@superbot/module-games` —donde esta el resto del
 * provably-fair— porque quien las necesita es la capa de persistencia: la
 * semilla se genera al CREAR la cartera, dentro de la misma transaccion, y
 * hacer que `packages/data` dependa de un modulo funcional para tres lineas
 * invertiria la direccion de las dependencias del repo.
 *
 * Verificar un resultado (recomputar el HMAC) sigue estando alli: eso es logica
 * de dominio y no toca la base de datos.
 */

/** Semilla del servidor, secreta hasta que se rota y se revela. */
export const newServerSeed = (): string => randomBytes(32).toString("hex");

/** Semilla del cliente. Publica desde el primer momento. */
export const newClientSeed = (): string => randomBytes(8).toString("hex");

/**
 * El compromiso que se enseña ANTES de apostar: el sha256 de la semilla del
 * servidor. Es lo que impide elegir la semilla despues de ver la apuesta.
 */
export const commitOf = (seed: string): string =>
  createHash("sha256").update(seed).digest("hex");
