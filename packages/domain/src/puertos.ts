import type { PermissionKey } from "./permissions.js";
import type { BotReply } from "./reply.js";
import type { TelegramUpdateEnvelope } from "./update.js";

/**
 * Los puertos que el nucleo entrega a un modulo.
 *
 * Este fichero es la frontera. Un modulo recibe capacidades y no busca nada por
 * su cuenta: no importa Prisma, no importa `@superbot/data`, no construye un
 * gateway, no lee el reloj del sistema. Todo lo que necesita para actuar llega
 * por aqui, y por eso se le puede probar en aislamiento y romperlo no puede
 * llevarse por delante al resto del bot.
 *
 * Nada de esto lo garantiza la buena voluntad: `scripts/arquitectura.test.ts`
 * comprueba que ningun modulo alcance la capa de datos, otro modulo o una app.
 *
 * NOTA DE MIGRACION: los contratos existen antes que sus implementaciones, a
 * proposito. Se definen primero para que el reparto de handlers tenga contra
 * que programar; hoy `bot-update.service.ts` todavia hace este trabajo con sus
 * 56 dependencias inyectadas.
 */

/**
 * El contexto ya resuelto de un update.
 *
 * Es deliberadamente pobre. `FoundationContext` vive en `@superbot/data` y
 * arrastra la capa de persistencia consigo; un modulo que lo aceptara quedaria
 * acoplado a Prisma por la puerta de atras. Aqui solo estan los identificadores
 * que un modulo necesita de verdad para decidir.
 */
export interface ContextoDeUpdate {
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly userId: string | undefined;
  readonly membershipRole: string | undefined;
}

/**
 * La salida a Telegram, **ya atada al bot correcto para ESTE update**.
 *
 * No lleva `token` en ninguna firma, y eso es el punto entero del puerto. El
 * bot es multi-bot: el nucleo resuelve que token corresponde a este update y
 * construye el puerto dentro de ese ambito. Un modulo no puede elegir bot
 * porque no tiene con que, y por tanto **no puede existir el fallo de que un
 * bot hijo conteste como el bot padre**.
 *
 * Si algun dia una firma de aqui acepta un token, la propiedad se ha perdido.
 */
export interface TelegramPort {
  enviarMensaje(entrada: {
    readonly chatId: bigint;
    readonly respuesta: BotReply;
    readonly messageThreadId?: number;
  }): Promise<{ readonly ok: boolean; readonly messageId?: number }>;

  borrarMensaje(entrada: {
    readonly chatId: bigint;
    readonly messageId: number;
  }): Promise<{ readonly ok: boolean }>;

  restringirMiembro(entrada: {
    readonly chatId: bigint;
    readonly userId: bigint;
    readonly hasta?: Date;
  }): Promise<{ readonly ok: boolean }>;

  expulsarMiembro(entrada: {
    readonly chatId: bigint;
    readonly userId: bigint;
  }): Promise<{ readonly ok: boolean }>;
}

/**
 * Las DOS preguntas de autorizacion. No son la misma, y unificarlas seria una
 * escalada de privilegios.
 *
 * `puedeModerar` acepta a cualquiera que sea admin en Telegram, y un admin
 * nombrado con `/admin` cuenta, porque el bot lo promociona de verdad.
 * `puedeConfigurar` lo **rechaza** a proposito: alguien nombrado por el bot no
 * puede abrir los ajustes y apagar al guardia que le vigila.
 *
 * Un modulo debe elegir cual de las dos pregunta. Que el menu muestre un boton
 * no concede nada: la respuesta la da siempre el backend.
 */
export interface PermisosPort {
  puedeModerar(
    contexto: ContextoDeUpdate,
    update: TelegramUpdateEnvelope,
    permiso: PermissionKey,
  ): Promise<boolean>;

  puedeConfigurar(
    contexto: ContextoDeUpdate,
    update: TelegramUpdateEnvelope,
    permiso: PermissionKey,
  ): Promise<boolean>;
}

/** El rastro de auditoria. Un modulo deja constancia, no decide el formato. */
export interface AuditoriaPort {
  registrar(entrada: {
    readonly accion: string;
    readonly recurso: string;
    readonly recursoId?: string;
    readonly datos?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

/** Ajustes por chat. Tipado por quien llama, que es quien conoce su forma. */
export interface AjustesPort {
  leer<T>(clave: string): Promise<T | undefined>;
  escribir<T>(clave: string, valor: T): Promise<void>;
}

/**
 * Ejecutar-una-sola-vez, para efectos que no se pueden repetir.
 *
 * Existe porque un update se reprocesa entero cuando un intento anterior murio
 * a mitad. Envuelve con esto todo lo que mueva dinero, sanciones o premios.
 *
 * La clave **tiene que ser determinista**. Si se calcula con el reloj o con un
 * aleatorio, el reintento genera otra y la proteccion no sirve de nada — que es
 * exactamente el fallo que tenian diez sitios del servicio hasta el 2026-08-19.
 */
export interface IdempotenciaPort {
  reservar(entrada: {
    readonly namespace: string;
    readonly key: string;
    readonly expiraEn?: Date;
  }): Promise<boolean>;
}

/**
 * El reloj, como puerto.
 *
 * No es purismo: media docena de tests del repo congelan el reloj a mano
 * porque el codigo lee `Date.now()` directamente, y una clave de idempotencia
 * calculada con el reloj de pared es justo el bug que hubo que arreglar.
 */
export interface RelojPort {
  ahora(): Date;
  ahoraMs(): number;
}

/** Aleatoriedad, como puerto: sorteos y semillas reproducibles en test. */
export interface AleatoriedadPort {
  uuid(): string;
  entero(minimo: number, maximo: number): number;
}

/** Contadores por proceso. Un modulo mide; no sabe de Prometheus. */
export interface MetricasPort {
  incrementar(nombre: string, cuanto?: number): void;
  observar(nombre: string, valor: number): void;
}

/**
 * Todo lo que un modulo recibe. Nada mas, y nada por su cuenta.
 *
 * Se pasa como UN objeto con nombres, no como 56 parametros posicionales. El
 * constructor gigante de `BotUpdateService` es la razon por la que hoy cuesta
 * tanto instanciarlo en un test: 56 argumentos en orden, y equivocarse de
 * posicion entre dos repositorios del mismo tipo compila igual.
 */
export interface PuertosDeModulo {
  readonly telegram: TelegramPort;
  readonly permisos: PermisosPort;
  readonly auditoria: AuditoriaPort;
  readonly ajustes: AjustesPort;
  readonly idempotencia: IdempotenciaPort;
  readonly reloj: RelojPort;
  readonly aleatoriedad: AleatoriedadPort;
  readonly metricas: MetricasPort;
}

/** Lo que recibe un handler de modulo al ejecutarse. */
export interface EntradaDeHandler {
  readonly contexto: ContextoDeUpdate;
  readonly update: TelegramUpdateEnvelope;
  readonly puertos: PuertosDeModulo;
}

/**
 * Un handler de modulo.
 *
 * Devolver una respuesta **corta la cadena**: el nucleo deja de recorrer
 * handlers. Devolver `null` significa "esto no era para mi, que siga otro". Esa
 * semantica es la que hoy tiene `botHandlers()` y no cambia al repartirla: el
 * orden de la cadena es comportamiento observable del bot.
 */
export interface HandlerDeModulo {
  readonly nombre: string;
  ejecutar(entrada: EntradaDeHandler): Promise<BotReply | null>;
}

/**
 * Lo que exporta un modulo hacia el nucleo. Su API publica, y nada mas.
 *
 * El resto del modulo vive en `internal/` y no se importa desde fuera. Un
 * modulo se enchufa entregando su manifiesto y sus handlers; el nucleo decide
 * el orden, resuelve los puertos y los invoca.
 */
export interface ModuloDeBot {
  readonly nombre: string;
  readonly handlers: readonly HandlerDeModulo[];
}
