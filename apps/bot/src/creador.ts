/**
 * Lee un id de Telegram del entorno. Sin la variable, o con algo que no sea un
 * numero, devuelve -1: ningun usuario tiene un id negativo, asi que nadie lo es.
 */
const idDelEntorno = (nombre: string): bigint => {
  const valor = process.env[nombre]?.trim();
  return valor && /^\d+$/u.test(valor) ? BigInt(valor) : -1n;
};

/**
 * El creador de Modryva. La persona, no el despliegue.
 *
 * **No es `SUPERBOT_OWNER_TELEGRAM_ID`**, y confundirlos ya costo un despliegue:
 * esa variable identifica al dueño de ESTA instalacion, asi que un mando que la
 * mirara le contestaba "solo el propietario" al propietario. Lo que hace falta
 * aqui es "¿eres tu?", y eso solo lo sabe el id.
 *
 * Sale del entorno a proposito, y no de la base de datos: el sentido de estos
 * permisos es que **no se puedan ampliar** desde dentro de un grupo, por un
 * admin ni desde la Mini App. Solo los fija quien despliega.
 */
export const CREADOR_TELEGRAM_ID = idDelEntorno("CREADOR_TELEGRAM_ID");

/** The creator as the AI knows him. When HE is the one talking, the AI gets an
 *  extra devotion note (see CREATOR_PRESENT). Keyed on the verified id, never
 *  on a text claim, so "soy el creador" from anyone else changes nothing. */
export const CREATOR_TELEGRAM_ID = idDelEntorno("CREADOR_IA_TELEGRAM_ID");
