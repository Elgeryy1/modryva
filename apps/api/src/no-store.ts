import type { FastifyInstance } from "fastify";

/**
 * NADA de lo que sirve esta API es cacheable, y hasta el 2026-08-10 no lo decía.
 *
 * Sin `Cache-Control` ni `Expires`, una respuesta 404 o 410 es cacheable POR
 * DEFECTO según la norma, y el webview de Telegram puede quedársela.
 * `GET /v1/guardian/session` es además la MISMA URL para todo el mundo —lo que
 * distingue una sesión de otra es la cabecera `x-guardian-session`, que no viaja
 * en `Vary`—, así que a quien le cayera una vez un 410 se le repetía esa misma
 * respuesta en todas sus verificaciones siguientes, en cualquier grupo, sin que
 * la petición llegara nunca hasta aquí.
 *
 * Lo que costó verlo: dos sesiones recién creadas y sanas, sus dos páginas
 * servidas, cero peticiones a la API (`progressStep` 0 y `verifierIp` vacío) y
 * "esta verificación ya se completó o fue cancelada" en pantalla, mientras en
 * 2 h 45 min de log la API no había respondido un solo 410. Un fallo que no
 * aparece en los registros del servidor porque el servidor no llegó a enterarse.
 *
 * Un hook `onRequest` y no una cabecera por ruta, a propósito: tiene que estar
 * también en las respuestas que NO pasan por ningún controlador —el 429 del
 * limitador global, un 404 de ruta inexistente, un 500 del framework—, que son
 * justo las que nadie recuerda cuando esto se escribe endpoint a endpoint. Y se
 * registra el PRIMERO, para que ninguna respuesta pueda salir antes.
 *
 * En su propio fichero para que su prueba pueda montar un Fastify pelado sin
 * arrastrar el módulo entero de Nest: lo que hay que demostrar no es que una
 * ruta ponga la cabecera, sino que la llevan las rutas que nadie escribió.
 */
export const registrarNoStore = (fastify: FastifyInstance): void => {
  fastify.addHook("onRequest", (_request, reply, done) => {
    reply.header("cache-control", "no-store");
    done();
  });
};
