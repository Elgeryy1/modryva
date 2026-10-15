import type { AyudanteAvisoPrivadoRepository } from "@superbot/data";
import { enviarAvisoPrivado } from "../avisos.js";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

// ---------------------------------------------------------------------------
// 1. La identidad del personaje -- PLACEHOLDER, a decidir por el propietario.
// ---------------------------------------------------------------------------

/**
 * Nombre y tono del ayudante como personaje. Valores de ejemplo, no una
 * decision de producto: quien cierre el bloque de comunicacion o el de
 * mascotas necesita ALGO con lo que redactar, y este es el sitio donde vive
 * ese "algo" para que cambiarlo despues sea editar dos strings, no buscar por
 * el repo entero.
 *
 * `tono` no es una plantilla de texto: es una descripcion en prosa de como
 * suena, para que quien escriba una reaccion nueva en `componerReaccion` sepa
 * que registro usar sin tener que adivinarlo de un ejemplo suelto.
 */
export const PERSONAJE = {
  nombre: "Bicho",
  tono: "cercano y breve, nunca formal, nunca en nombre de Modryva",
} as const;

// ---------------------------------------------------------------------------
// 2. componerReaccion -- PURA
// ---------------------------------------------------------------------------

/**
 * Un tipo de evento simple ("buen_mensaje", "victoria_casino") a un texto
 * corto en el tono de `PERSONAJE`, o `null` si este evento no tiene reaccion
 * definida todavia -- que no es un fallo, es que nadie la ha escrito aun.
 *
 * ESTO NUNCA es para avisos de moderacion (ban, warn, verificacion) ni para
 * hablar en nombre de Modryva: el personaje es un bicho con su propia voz,
 * suelto al lado del bot, no un disfraz del bot. Un evento de moderacion que
 * necesite texto lo redacta el modulo que decide la sancion, con el tono
 * institucional de Modryva -- nunca este catalogo.
 */
export const componerReaccion = (tipoDeEvento: string): string | null => {
  switch (tipoDeEvento) {
    case "buen_mensaje":
      return `${PERSONAJE.nombre}: ¡qué mensaje más bueno!`;
    case "victoria_casino":
      return `${PERSONAJE.nombre}: ¡eso es, a por más!`;
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Lectura de payload -- mismo patron que `bloques/identidad.ts` y
// `bloques/censo.ts`: la cola guarda JSON, todo llega como `unknown`.
// ---------------------------------------------------------------------------

const comoRegistro = (payload: unknown): Record<string, unknown> => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("payload invalido: se esperaba un objeto");
  }
  return payload as Record<string, unknown>;
};

const comoBigInt = (valor: unknown, campo: string): bigint => {
  if (typeof valor === "number" && Number.isInteger(valor)) {
    return BigInt(valor);
  }
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return BigInt(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

// ---------------------------------------------------------------------------
// 3. personaje.entregar_premio
// ---------------------------------------------------------------------------

export interface RepositoriosDePersonaje {
  readonly avisos: AyudanteAvisoPrivadoRepository;
}

/**
 * `personaje.entregar_premio`: compone un texto de premio en el tono del
 * personaje y lo manda por privado. Entrega un premio ya decidido por quien
 * encola -- este manejador no decide QUE premio ni SI corresponde, solo lo
 * anuncia. No banea, no expulsa, no modera: eso esta prohibido para el
 * ayudante entero, y para este bloque en particular por ser el que mas
 * riesgo tiene de sonar a Modryva o a moderacion.
 */
const entregarPremio = (
  repos: RepositoriosDePersonaje,
): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const destinatarioTelegramId = comoBigInt(
      datos.destinatarioTelegramId,
      "destinatarioTelegramId",
    );
    const premio = comoTexto(datos.premio, "premio");

    const texto = `${PERSONAJE.nombre}: te traigo un premio -- ${premio}. ¡Disfrútalo!`;

    const resultado = await enviarAvisoPrivado(repos.avisos, contexto.userbot, {
      tenantId,
      destinatarioTelegramId,
      tipo: "personaje.premio",
      texto,
    });

    contexto.logger.info(
      {
        tenantId,
        destinatarioTelegramId: destinatarioTelegramId.toString(),
        premio,
        yaAvisado: resultado.yaAvisado,
        estado: resultado.envio?.estado ?? null,
      },
      "personaje: premio entregado",
    );

    return resultado;
  };
};

/**
 * El catalogo del bloque, con el repositorio inyectado por quien lo construye.
 *
 * Fabrica y no objeto ya construido, igual que los otros nueve bloques: antes
 * este fichero instanciaba `AyudanteAvisoPrivadoRepositoryPrisma` en el ambito
 * del modulo, asi que importarlo -- cosa que hace `index.ts` y tambien su
 * propio test -- inicializaba el cliente Prisma compartido antes incluso de
 * que `obtenerEnv()` hubiera validado la configuracion.
 */
export const crearManejadoresDePersonaje = (
  repos: RepositoriosDePersonaje,
): CatalogoDeManejadores => ({
  "personaje.entregar_premio": entregarPremio(repos),
});
