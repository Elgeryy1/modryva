import "dotenv/config";
import {
  AyudanteAdminLogRepositoryPrisma,
  AyudanteAvisoPrivadoRepositoryPrisma,
  AyudanteCensoRepositoryPrisma,
  AyudanteIdentidadRepositoryPrisma,
  AyudanteInvitacionRepositoryPrisma,
  AyudanteSolicitudRepositoryPrisma,
  AyudanteWatchdogRepositoryPrisma,
} from "@superbot/data";
import { createLogger, initErrorTracking } from "@superbot/shared";
import { crearManejadoresDeCenso } from "./bloques/censo.js";
import { manejadoresDeComunicacion } from "./bloques/comunicacion.js";
import { manejadoresDeComunidad } from "./bloques/comunidad.js";
import { manejadoresDeDatos } from "./bloques/datos.js";
import { manejadoresDeEconomia } from "./bloques/economia.js";
import { crearManejadoresDeIdentidad } from "./bloques/identidad.js";
import { manejadoresDeMascotas } from "./bloques/mascotas.js";
import { manejadoresDeModeracion } from "./bloques/moderacion.js";
import { manejadoresDeOperacion } from "./bloques/operacion.js";
import { crearManejadoresDePersonaje } from "./bloques/personaje.js";
import { manejadoresDeVinculacion } from "./bloques/vinculacion.js";
import { arrancarCola, type CatalogoDeManejadores } from "./despachador.js";
import { obtenerEnv } from "./env.js";
import { GramjsUserbot } from "./gramjs-userbot.js";

// Los repositorios Prisma no abren conexion al construirse -- son solo un
// envoltorio sobre el cliente compartido de `@superbot/data` -- asi que
// instanciarlos aqui, con la sesion MTProto todavia sin cablear mas abajo, no
// intenta hablar con nada. Es lo que permite tener el catalogo completo hoy
// aunque el ayudante no pueda arrancar todavia.
const manejadoresDeIdentidad = crearManejadoresDeIdentidad({
  identidad: new AyudanteIdentidadRepositoryPrisma(),
  censo: new AyudanteCensoRepositoryPrisma(),
});
const manejadoresDeCenso = crearManejadoresDeCenso({
  censo: new AyudanteCensoRepositoryPrisma(),
});

/**
 * El Ayudante: una cuenta de usuario de Telegram al lado de Modryva.
 *
 * Proceso aparte a propósito, igual que el consultor: comparte la base de
 * datos y nada más. Un fallo aquí no puede tumbar al bot que modera, y un
 * `FLOOD_WAIT` de tres horas en esta cuenta no para el ciclo de updates — el
 * bot solo escribe en la cola y sigue.
 *
 * Cada bloque (identidad, censo, moderación, comunicación...) exporta su
 * propio catálogo de manejadores en `bloques/`, y aquí se juntan en uno solo.
 * Cuando un bloque se cablea, esta lista es la única línea que toca.
 */
const CATALOGO: CatalogoDeManejadores = {
  ...manejadoresDeIdentidad,
  ...manejadoresDeCenso,
  ...manejadoresDeModeracion({
    adminLog: new AyudanteAdminLogRepositoryPrisma(),
  }),
  ...manejadoresDeComunicacion({
    avisos: new AyudanteAvisoPrivadoRepositoryPrisma(),
  }),
  ...manejadoresDeComunidad({
    invitaciones: new AyudanteInvitacionRepositoryPrisma(),
  }),
  ...manejadoresDeEconomia({
    avisos: new AyudanteAvisoPrivadoRepositoryPrisma(),
  }),
  ...manejadoresDeMascotas({
    avisos: new AyudanteAvisoPrivadoRepositoryPrisma(),
  }),
  ...crearManejadoresDePersonaje({
    avisos: new AyudanteAvisoPrivadoRepositoryPrisma(),
  }),
  ...manejadoresDeOperacion({
    watchdog: new AyudanteWatchdogRepositoryPrisma(),
  }),
  ...manejadoresDeDatos({
    censo: new AyudanteCensoRepositoryPrisma(),
  }),
  ...manejadoresDeVinculacion,
};

const main = async (): Promise<void> => {
  const env = obtenerEnv();
  const logger = createLogger("ayudante", env.LOG_LEVEL);

  await initErrorTracking({
    dsn: process.env.SENTRY_DSN ?? "",
    service: "ayudante",
    release: process.env.APP_BUILD_SHA ?? "unknown",
    environment: process.env.NODE_ENV ?? "development",
  });

  const userbot = new GramjsUserbot(env);
  await userbot.conectar();

  logger.info(
    { bloques: Object.keys(CATALOGO).length },
    "ayudante conectado, atendiendo la cola",
  );

  const cerrar = async (señal: string): Promise<void> => {
    logger.info({ señal }, "cerrando la sesion del ayudante");
    await userbot.desconectar();
    process.exit(0);
  };
  process.on("SIGINT", () => void cerrar("SIGINT"));
  process.on("SIGTERM", () => void cerrar("SIGTERM"));

  await arrancarCola({
    repositorio: new AyudanteSolicitudRepositoryPrisma(),
    catalogo: CATALOGO,
    contexto: { userbot, logger },
    intervaloMs: env.AYUDANTE_POLL_MS,
    lote: env.AYUDANTE_LOTE,
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
