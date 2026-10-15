/**
 * Todo lo que el Ayudante puede pedirle a MTProto, en un solo puerto.
 *
 * Ningún bloque llama a una librería de Telegram directamente: todos reciben
 * este puerto y solo esto. Es el mismo patrón que `TelegramPort` en
 * `packages/domain` — la frontera existe para que la lógica de cada bloque se
 * pruebe con `FakeUserbot`, sin sesión real, sin red y sin `FLOOD_WAIT`.
 *
 * NO HAY IMPLEMENTACIÓN REAL TODAVÍA. Conectar esto a GramJS (`npm i
 * telegram`) o a un puente con Telethon es EL SIGUIENTE PASO, deliberadamente
 * fuera de este cambio: instalar una librería nueva contra una conexión lenta
 * sin poder probarla contra Telegram real desde aquí habría dejado código sin
 * verificar detrás de una interfaz que sí lo está. `docs/PLAN-AYUDANTE.md`
 * detalla cómo cablearlo cuando haya sesión a mano.
 *
 * Restricciones que CUALQUIER implementación real de este puerto tiene que
 * respetar, decididas ya y no opcionales:
 *
 * - Nunca moderar: ningún método bane, expulse ni borre. Eso lo hace el bot,
 *   que tiene auditoría y `PermisosPort`.
 * - Nunca leer localización, ni "gente cercana".
 * - Nunca resolver ni importar números de teléfono.
 * - Nunca archivar fotos ni vídeos de terceros (ver `docs/PLAN-AYUDANTE.md`).
 * - Nunca suplantar a una persona concreta, ni hablar como si fuera Modryva.
 */

/**
 * Un trozo de un mensaje con menciones: o texto tal cual, o una persona a la
 * que enlazar. El nombre que se ve lo resuelve el adaptador contra Telegram,
 * así que sale siempre actualizado y quien compone el mensaje no tiene que
 * saberlo.
 */
export type SegmentoDeMensaje =
  | { readonly tipo: "texto"; readonly valor: string }
  | { readonly tipo: "mencion"; readonly userTelegramId: bigint };

export interface MiembroDelGrupo {
  readonly userTelegramId: bigint;
  readonly alias: string | null;
  readonly nombre: string | null;
  readonly ultimaConexionEn: Date | null;
}

export interface FichaCompleta {
  readonly userTelegramId: bigint;
  readonly bio: string | null;
  readonly chatsEnComun: number;
  readonly esPremium: boolean;
  readonly antiguedadEstimadaDias: number | null;
  readonly tieneFoto: boolean;
}

export interface ResultadoEnvioPrivado {
  readonly estado: "enviado" | "rebotado" | "bloqueado";
}

export interface EventoAdminLogCrudo {
  readonly telegramEventId: string;
  readonly accion: string;
  readonly actorTelegramId: bigint;
  readonly objetivoTelegramId: bigint | null;
  readonly detalle: unknown;
  readonly ocurrioEn: Date;
}

export interface EnlaceInvitacionCrudo {
  readonly enlaceId: string;
  readonly creadorTelegramId: bigint;
  readonly usosTotal: number;
}

export interface ReaccionCruda {
  readonly userTelegramId: bigint;
  readonly emoji: string;
}

export interface MensajeDeHistorial {
  readonly messageId: number;
  readonly userTelegramId: bigint;
  readonly texto: string;
  readonly fecha: Date;
  readonly borradoPorAdmin: boolean;
}

export interface UserbotPort {
  /**
   * Resuelve a alguien para poder mencionarlo de verdad
   * (`MessageEntityMentionName`), aunque no tenga `@username` y aunque nunca
   * le haya escrito al bot. `null` si el ayudante tampoco lo alcanza — sin
   * `access_hash` no hay mención posible, ni para una cuenta de usuario.
   */
  resolverParaMencion(input: {
    readonly chatId: bigint;
    readonly userTelegramId: bigint;
  }): Promise<{ readonly accessHash: string } | null>;

  /** Manda un privado aunque la persona nunca haya hablado con el bot. Dice si llegó, rebotó o está bloqueada. */
  enviarPrivado(input: {
    readonly userTelegramId: bigint;
    readonly texto: string;
  }): Promise<ResultadoEnvioPrivado>;

  /**
   * Publica un mensaje con menciones REALES.
   *
   * Es la razón de ser de todo esto. Un bot no puede mencionar a quien no
   * tiene `@username`: la Bot API le borra la entidad al enviar y deja el
   * nombre en texto plano, sin dar error. Una cuenta de usuario sí genera un
   * `MessageEntityMentionName` de verdad, que abre cualquier cliente y
   * sobrevive al reenvío.
   *
   * Recibe el mensaje ya partido en trozos —texto suelto y menciones— porque
   * decidir dónde va cada mención es lógica pura y se prueba sin red; montar
   * las entidades con sus offsets es lo único que necesita a Telegram.
   *
   * A quien no se pueda resolver se le escribe su nombre sin enlace: perder el
   * enlace de uno es mucho mejor que perder el mensaje entero.
   */
  publicarConMenciones(input: {
    readonly chatId: bigint;
    readonly segmentos: readonly SegmentoDeMensaje[];
  }): Promise<{ readonly ok: boolean; readonly mencionesResueltas: number }>;

  /**
   * Publica en un canal o grupo.
   *
   * Separado de `enviarPrivado` porque en MTProto no son la misma operación:
   * un privado resuelve una entidad de usuario y un canal resuelve un
   * `InputPeerChannel`. Pasar un id de canal a `enviarPrivado` no es un atajo
   * inocente — o falla al resolver, o acierta con el usuario cuyo id coincide
   * con el del canal, que es peor.
   */
  publicarEnCanal(input: {
    readonly canalId: bigint;
    readonly texto: string;
  }): Promise<{ readonly ok: boolean }>;

  /**
   * Se une a un grupo con un enlace de invitación.
   *
   * Es la única forma de que el ayudante entre en un grupo: un bot **no puede
   * añadir a nadie** (la Bot API no tiene `addChatMember`), así que Modryva
   * crea un enlace de un solo uso y el ayudante lo usa él mismo.
   *
   * `yaDentro` no es un fallo: si ya era miembro, el resultado es el mismo que
   * se buscaba, y tratarlo como error haría que un reintento pareciera roto.
   */
  unirseConEnlace(input: { readonly enlace: string }): Promise<{
    readonly ok: boolean;
    readonly yaDentro: boolean;
    readonly motivo: string | null;
  }>;

  /** Se sale de un grupo por su cuenta. Es como se deshace `unirseConEnlace`. */
  salirDelGrupo(chatId: bigint): Promise<{ readonly ok: boolean }>;

  /** El censo real del grupo. Un bot no puede hacer esto: por eso existe el ayudante. */
  listarMiembros(chatId: bigint): Promise<readonly MiembroDelGrupo[]>;

  /** Bio, chats en común, Premium, antigüedad estimada. Nunca se expone al staff — solo al consultor. */
  obtenerFichaCompleta(userTelegramId: bigint): Promise<FichaCompleta>;

  /** Un hash del avatar actual, o `null` si no tiene foto. Nunca la foto en sí. */
  obtenerHashAvatar(userTelegramId: bigint): Promise<string | null>;

  /** El registro de administración nativo, que la Bot API no da. */
  listarEventosAdminLog(input: {
    readonly chatId: bigint;
    readonly desde: Date;
  }): Promise<readonly EventoAdminLogCrudo[]>;

  listarEnlacesInvitacion(
    chatId: bigint,
  ): Promise<readonly EnlaceInvitacionCrudo[]>;

  listarReacciones(input: {
    readonly chatId: bigint;
    readonly messageId: number;
  }): Promise<readonly ReaccionCruda[]>;

  /** Solo funciona en grupos de menos de 100 miembros; Telegram no lo da en grupos grandes. */
  listarVistos(input: {
    readonly chatId: bigint;
    readonly messageId: number;
  }): Promise<readonly bigint[]>;

  /** Solo texto. Nada de fotos ni vídeos: ver `docs/PLAN-AYUDANTE.md`. */
  buscarEnHistorial(input: {
    readonly chatId: bigint;
    readonly texto: string | null;
    readonly deUsuario: bigint | null;
    readonly limite: number;
  }): Promise<readonly MensajeDeHistorial[]>;

  /** Mide cuánto tarda el bot en contestar, desde fuera de su propio proceso. */
  ping(
    chatId: bigint,
  ): Promise<{ readonly ok: boolean; readonly latenciaMs: number | null }>;
}
