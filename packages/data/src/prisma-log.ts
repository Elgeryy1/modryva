/**
 * Qué nivel merece un error que escribe Prisma por su cuenta.
 *
 * Dos problemas distintos, y el segundo es el gordo:
 *
 * 1. RUIDO. En 40 h de producción el bot escribió 94 `prisma:error`, y los 94
 *    eran mecanismos funcionando: 76 choques de `idempotencyKey` (que es
 *    exactamente para lo que existe esa clave única) y 18 de dos personas
 *    pulsando "Unirme" a la vez sobre el mismo asiento. El código captura los
 *    dos casos y sigue; Prisma no puede saberlo y los escribe igual.
 *
 * 2. INVISIBILIDAD. Prisma no escribe por nuestro logger: suelta texto plano
 *    multilínea a stderr, fuera del JSON de pino. Contando por nivel, el bot
 *    parecía tener CERO errores mientras tenía 94. Cualquier alerta montada
 *    sobre `"level":50` estaba ciega a todo lo que rompiera en la base de datos.
 *
 * Bajar de nivel un choque de clave única es seguro por una razón concreta: si
 * NO estuviera capturado, la excepción sube y quien llama ya lo registra por la
 * vía normal. La línea de Prisma sobra en los dos casos — capturado (ruido) y
 * sin capturar (duplicado). Cualquier otra cosa se queda en `error`, que es
 * donde tiene que estar un fallo de base de datos de verdad.
 */

/** Lo que dice Prisma cuando choca una restricción de unicidad. */
const UNIQUE_VIOLATION = /P2002|Unique constraint failed/iu;

export type PrismaLogLevel = "debug" | "error";

/**
 * Deliberadamente conservador: solo el choque de unicidad baja. Un timeout, una
 * conexión caída o una migración pendiente siguen siendo `error`, porque de
 * esos nadie tiene un `catch` esperándolos.
 */
export const prismaLogLevel = (message: string): PrismaLogLevel =>
  UNIQUE_VIOLATION.test(message) ? "debug" : "error";
