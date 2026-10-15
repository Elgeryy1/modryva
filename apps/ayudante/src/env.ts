import { z } from "zod";

/**
 * Configuración del Ayudante.
 *
 * Proceso aparte de Modryva y del consultor, con esquema propio: no comparte
 * token (no tiene — es una cuenta de usuario, no un bot), ni webhook, ni el
 * grupo del consultor. Lo único que comparte con el resto es la base de datos,
 * a través de la cola de `AyudanteSolicitud`.
 */

/**
 * Una variable opcional que puede llegar vacía.
 *
 * `docker-compose` escribe `VAR: ${VAR:-}` cuando no hay valor, y eso llega al
 * proceso como **cadena vacía**, no como ausente. Con un `.min(1).optional()`
 * pelado eso falla la validación en vez de contar como "no configurado", y el
 * contenedor no arranca aunque la otra alternativa sí esté puesta. Pasó en el
 * primer despliegue.
 */
const vacioEsAusente = z
  .preprocess(
    (valor) =>
      typeof valor === "string" && valor.trim() === "" ? undefined : valor,
    z.string().min(1).optional(),
  )
  .optional();

const esquema = z
  .object({
    /**
     * La sesión MTProto (GramJS) de la cuenta ayudante, como cadena.
     *
     * Tiene el mismo peso que la contraseña de la cuenta entera: quien la
     * tenga puede actuar como esa persona en Telegram, sin límite y sin
     * segundo factor. Nunca en git, nunca en un informe, nunca en un log. Y
     * nunca la del propietario, salvo la excepción documentada de sincronizar
     * BotFather.
     *
     * Se genera una vez con `apps/ayudante/src/login.ts`. Alternativa:
     * `AYUDANTE_SESSION_PATH`, un fichero que la contenga — más cómodo si se
     * monta como volumen en el NAS.
     */
    AYUDANTE_SESSION: vacioEsAusente,
    AYUDANTE_SESSION_PATH: vacioEsAusente,
    /** Credenciales de la app de Telegram (my.telegram.org), para abrir esa sesión. */
    AYUDANTE_API_ID: z.coerce.number().int().positive(),
    AYUDANTE_API_HASH: z.string().min(1),
    /** La misma base de datos que el resto del bot. */
    DATABASE_URL: z.string().min(1),
    /**
     * Cada cuánto reclama la cola, en milisegundos. Un valor bajo no acelera
     * nada de verdad —MTProto tiene su propio ritmo por `FLOOD_WAIT`— y solo
     * gasta ciclos comprobando una cola vacía.
     */
    AYUDANTE_POLL_MS: z.coerce.number().int().positive().default(5000),
    /** Cuántas solicitudes reclama como mucho por pasada. */
    AYUDANTE_LOTE: z.coerce.number().int().positive().default(5),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
  })
  .refine(
    (valores) =>
      valores.AYUDANTE_SESSION !== undefined ||
      valores.AYUDANTE_SESSION_PATH !== undefined,
    {
      message:
        "Hace falta AYUDANTE_SESSION (la cadena de sesión) o " +
        "AYUDANTE_SESSION_PATH (un fichero que la contenga). Se genera con " +
        "`node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.base.json " +
        "apps/ayudante/src/login.ts`.",
      path: ["AYUDANTE_SESSION"],
    },
  );

export type AyudanteEnv = z.infer<typeof esquema>;

let cache: AyudanteEnv | undefined;

/**
 * Lee y valida el entorno una sola vez. Falla ruidosamente y con el nombre de
 * cada variable que falta: un ayudante que arranca a medias y calla solicitud
 * tras solicitud es más difícil de diagnosticar que uno que no arranca.
 */
export const obtenerEnv = (
  fuente: NodeJS.ProcessEnv = process.env,
): AyudanteEnv => {
  if (cache) return cache;
  const resultado = esquema.safeParse(fuente);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuración del ayudante incompleta:\n${detalle}`);
  }
  cache = resultado.data;
  return cache;
};

/** Solo para tests: limpia la caché entre casos. */
export const _resetEnvCacheParaTests = (): void => {
  cache = undefined;
};
