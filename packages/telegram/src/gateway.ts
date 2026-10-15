import type { BotReply } from "@superbot/domain";

/**
 * Tope de tiempo para cualquier peticion a Telegram.
 *
 * Hasta ahora este fichero no tenia ni un solo timeout: cero `AbortSignal` en
 * 2.400 lineas. Una conexion colgada contra api.telegram.org se quedaba
 * esperando indefinidamente, y como el bot procesa el lote de updates en
 * cadena, esa espera bloqueaba el pipeline entero. Es una de las formas en que
 * una solicitud de union llegaba tarde y caducaba.
 *
 * 20 segundos son holgados para la Bot API —un envio normal ronda las decimas—
 * y a la vez muy por debajo del TTL de sesion de Guardian, que es lo que hay
 * que proteger.
 *
 * Subir descargas de fichero aparte: `descargarFichero` mueve bytes y merece
 * mas margen.
 */
const TIMEOUT_TELEGRAM_MS = 20_000;
const TIMEOUT_DESCARGA_MS = 60_000;

/**
 * Una senal que corta la peticion al llegar al tope.
 *
 * Un timeout NO se reintenta: cuando salta, no se sabe si Telegram llego a
 * aplicar el efecto (un ban, un mensaje enviado). Reintentar a ciegas
 * duplicaria acciones. Se propaga el error y quien corresponda decide.
 */
const conTope = (ms: number): AbortSignal => AbortSignal.timeout(ms);

export interface SendTelegramMessageInput {
  readonly chatId: bigint;
  readonly reply: BotReply;
  readonly token: string | undefined;
  /** Forum topic (message_thread_id): when set, the message lands in that
   * topic instead of the group's General thread. Used by Guardian to route
   * STAFF reports to a dedicated verification topic. */
  readonly messageThreadId?: number;
}

export interface TelegramModerationInput {
  readonly chatId: bigint;
  readonly userId: bigint;
  readonly token: string | undefined;
  readonly untilDate: Date | undefined;
}

export interface TelegramChatPermissions {
  readonly can_send_messages: boolean;
  readonly can_send_audios: boolean;
  readonly can_send_documents: boolean;
  readonly can_send_photos: boolean;
  readonly can_send_videos: boolean;
  readonly can_send_video_notes: boolean;
  readonly can_send_voice_notes: boolean;
  readonly can_send_polls: boolean;
  readonly can_send_other_messages: boolean;
  readonly can_add_web_page_previews: boolean;
}

export interface TelegramSetChatPermissionsInput {
  readonly chatId: bigint;
  readonly permissions: TelegramChatPermissions;
  readonly token: string | undefined;
}

export interface TelegramForumTopicInput {
  readonly chatId: bigint;
  readonly messageThreadId: number;
  readonly token: string | undefined;
}

export interface TelegramGatewayResult {
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly reason?: "missing-token";
}

export interface TelegramSendMessageResult extends TelegramGatewayResult {
  /** Telegram's own message_id, when the send succeeded and the response
   * could be parsed — lets a caller (e.g. Guardian's STAFF report) later
   * delete that exact message via deleteMessage(), instead of never being
   * able to reference it again. */
  readonly messageId?: number;
}

export interface TelegramGetMeResult extends TelegramGatewayResult {
  readonly botUserId?: bigint | undefined;
  readonly name?: string | undefined;
  readonly username?: string | undefined;
  readonly supportsGuestQueries?: boolean | undefined;
  /** Bot API 10.1: whether this bot can receive `chat_join_request.query_id`
   * and use sendChatJoinRequestWebApp / answerChatJoinRequestQuery. */
  readonly supportsJoinRequestQueries?: boolean | undefined;
}

export interface TelegramDiceResult extends TelegramGatewayResult {
  /** The value Telegram rolled: 🎲/🎯/🎳 = 1-6, 🏀/⚽ = 1-5, 🎰 (slot) = 1-64. */
  readonly value?: number;
}

export interface TelegramRevokeInput {
  readonly chatId: bigint;
  readonly userId: bigint;
  readonly token: string | undefined;
  /** unbanChatMember only: defaults to true (never removes a member who
   * isn't actually banned — the safe behavior for a real /unban). Pass
   * false for a kick's ban-then-immediately-unban pattern, where Telegram's
   * own ban can lag behind the call that issued it — with the default,
   * unban would then see "not banned yet" and no-op, leaving the ban
   * permanent instead of a kick. */
  readonly onlyIfBanned?: boolean;
}

export interface TelegramPinMessageInput {
  readonly chatId: bigint;
  readonly messageId: number;
  readonly token: string | undefined;
}

export interface TelegramChatTextInput {
  readonly chatId: bigint;
  readonly text: string;
  readonly token: string | undefined;
}

export interface TelegramChatActionInput {
  readonly chatId: bigint;
  readonly action: "typing";
  readonly token: string | undefined;
}

export interface TelegramMessageDraftInput {
  readonly chatId: bigint;
  readonly text: string;
  readonly token: string | undefined;
}

export interface TelegramPromoteInput {
  readonly chatId: bigint;
  readonly userId: bigint;
  readonly customTitle: string | undefined;
  readonly token: string | undefined;
  /**
   * Exact rights to grant. Omit for the historical /promote set. /admin passes
   * an explicit one so the granted powers are declared at the call site rather
   * than buried here — in particular so `can_promote_members: false` is stated
   * outright instead of relying on Telegram's default for an omitted field.
   */
  readonly rights?: Readonly<Record<string, boolean>>;
}

export interface TelegramInviteLinkResult extends TelegramGatewayResult {
  readonly inviteLink?: string;
}

export interface TelegramChatAdminInfo {
  readonly userId: bigint;
  readonly username: string | undefined;
  readonly firstName: string | undefined;
  readonly isOwner: boolean;
  readonly customTitle: string | undefined;
  /** Un bot administrador. Mencionarlo no avisa a nadie, asi que quien busca
   * humanos (por ejemplo `@admin`) tiene que poder descartarlo. */
  readonly isBot: boolean;
  /**
   * Los poderes concretos, que Telegram ya mandaba en cada respuesta y nadie
   * leia. Sin ellos "es admin" es un si/no, y no se puede distinguir a quien
   * solo fija mensajes de quien puede vaciar el grupo — que es justo la
   * diferencia que hace falta para auditar privilegios.
   *
   * El dueño (`isOwner`) los tiene todos siempre, aunque Telegram no los
   * enumere en su entrada.
   */
  readonly canRestrict: boolean;
  readonly canDelete: boolean;
  readonly canPin: boolean;
  readonly canPromote: boolean;
}

export interface TelegramAdminsResult extends TelegramGatewayResult {
  readonly admins?: readonly TelegramChatAdminInfo[];
}

export interface TelegramChatMemberResult extends TelegramGatewayResult {
  readonly status?: string;
  /**
   * Whether this member can delete messages (Bot API ChatMember). True for
   * creators/owners, the explicit flag for administrators, absent otherwise.
   * Used to check the BOT's own rights before a reaction-moderation call so we
   * never fire a request Telegram would reject with 400/403.
   */
  readonly canDeleteMessages?: boolean;
  /**
   * Whether this member can restrict others (Bot API ChatMember). Same
   * tri-state as canDeleteMessages: true/false when Telegram said so,
   * undefined when it did not answer.
   *
   * Read for the BOT's own rights before the social roulette offers a
   * temporary mute — a group that configured one but never granted the right
   * has to be told, not silently ignored.
   */
  readonly canRestrictMembers?: boolean;
  /**
   * Whether this member is a bot. Undefined when the lookup failed, i.e.
   * unknown rather than "no".
   *
   * Load-bearing for /admin: Telegram refuses to let one bot change another
   * bot's admin rights (BOT_CHANNELS_NA), so appointing a bot would create an
   * administrator this bot can never take back — the exact state the appointed
   * admin guard exists to prevent.
   */
  readonly isBot?: boolean;
  /**
   * Identity and per-member restrictions, read for the `/info` dossier.
   *
   * Telegram only ever hands a bot a person's name through an update that
   * mentions them, so for anyone who has not spoken lately this call is the
   * only place the name exists. Each permission stays tri-state for the usual
   * reason: absent means Telegram did not say, never "denied".
   */
  readonly firstName?: string;
  readonly lastName?: string;
  readonly username?: string;
  readonly languageCode?: string;
  /** The admin's custom title ("Capitán", "Mod"…), when the group set one. */
  readonly customTitle?: string;
  readonly canSendMessages?: boolean;
  readonly canSendMedia?: boolean;
  readonly canSendLinks?: boolean;
  readonly canAddWebPagePreviews?: boolean;
  /** When a restriction expires (Telegram `until_date`), if it is temporary. */
  readonly restrictedUntil?: Date;
  /**
   * Whether THIS bot may edit this administrator's rank (`can_be_edited`).
   *
   * Telegram only lets a bot touch the admins it appointed itself, and this is
   * the only field that says which is which. It decides whether a sanction on
   * an admin is even possible: false means `restrictChatMember` will be
   * rejected outright, so promising the moderator anything else is a lie.
   *
   * Tri-state like the rest: absent means Telegram did not say, never "no".
   */
  readonly canBeEdited?: boolean;
  /**
   * The administrator's rights, in Telegram's own snake_case, ready to be
   * handed straight back to `promoteChatMember`.
   *
   * Kept as a bag of flags and not a typed record on purpose: it exists to be
   * SAVED and REPLAYED, not read. Telegram keeps adding rights
   * (`can_post_stories` and friends arrived in Bot API 7.0), and a hand-written
   * type would silently drop the new ones — which for a restore means giving
   * someone back less power than they had, without anyone noticing.
   */
  readonly adminRights?: Readonly<Record<string, boolean>>;
}

export interface TelegramChatInfo {
  readonly chatId: bigint | undefined;
  readonly type: string | undefined;
  readonly title: string | undefined;
  readonly username: string | undefined;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  /** ChatFullInfo.guard_bot (Bot API 10.1): whether a Guardian Bot is already
   * assigned to this chat. There is no API method to assign one — see
   * docs/GUARDIAN_TELEGRAM_TEST.md for the manual Telegram-side steps. */
  readonly guardBot?: boolean | undefined;
}

export interface TelegramChatResult extends TelegramGatewayResult {
  readonly chat?: TelegramChatInfo;
}

export interface TelegramDiceInput {
  readonly chatId: bigint;
  readonly emoji: string;
  readonly token: string | undefined;
}

export interface TelegramCallbackAnswerInput {
  readonly callbackQueryId: string;
  readonly text: string | undefined;
  readonly token: string | undefined;
  /** When true, Telegram shows `text` as a blocking modal popup (show_alert)
   * instead of a transient toast. Used by the welcome "rules" button. */
  readonly showAlert?: boolean;
}

export interface TelegramMediaInput {
  readonly chatId: bigint;
  readonly imageBase64: string;
  readonly type: "png" | "webp" | "jpg";
  readonly token: string | undefined;
  /** Optional caption. Telegram caps photo captions at 1024 chars — the
   * caller MUST pre-truncate; this layer sends it verbatim. */
  readonly caption?: string;
  /** Optional inline keyboard (e.g. Guardian's STAFF approve/decline row) so
   * the buttons attach directly to the photo message. */
  readonly replyMarkup?: Record<string, unknown>;
  /** Telegram's protect_content: when true, the sent media cannot be
   * forwarded or saved by the recipient chat. Used by Guardian's STAFF
   * report so the 'protectStaffContent' setting actually does something. */
  readonly protectContent?: boolean;
  /** Forum topic (message_thread_id): when set, the media lands in that topic
   * instead of the group's General thread. Used by Guardian to route STAFF
   * photo reports to a dedicated verification topic. */
  readonly messageThreadId?: number;
}

/**
 * Un video que ya esta bajado y hay que volver a subir.
 *
 * Va aparte de `TelegramMediaInput` y no es duplicar por gusto: ese lleva el
 * tipo cerrado a png/webp/jpg, que es justo el campo con el que Telegram decide
 * como enseñarlo. Un video mandado por `sendPhoto` es un 400, no un video
 * feo — asi que el tipo tiene que impedir escribirlo, no solo el comentario.
 */
export interface TelegramVideoInput {
  readonly chatId: bigint;
  readonly token: string | undefined;
  /** Los bytes del video, en base64. */
  readonly videoBase64: string;
  /** El MIME tal y como se guardo. `video/mp4` en casi todos los casos. */
  readonly mimeType: string;
  /**
   * Nombre con extension.
   *
   * Telegram la mira para decidir si puede reproducirlo dentro del chat: sin
   * ella lo entrega como fichero adjunto, que es exactamente lo que no quiere
   * quien pidio verlo.
   */
  readonly nombreFichero: string;
  /** Pie. Telegram corta a 1024 caracteres: recortalo antes de llegar aqui. */
  readonly caption?: string;
  readonly messageThreadId?: number;
  readonly protectContent?: boolean;
}

/**
 * Re-sending a picture Telegram already stores.
 *
 * No URL, no bytes: the only thing that travels is an identifier Telegram gave
 * this bot for a file it already holds. That is deliberate — it is what lets
 * the social media library exist without any code path that fetches a URL.
 */
export interface TelegramFileIdPhotoInput {
  readonly chatId: bigint;
  readonly fileId: string;
  readonly token: string | undefined;
  readonly caption?: string;
  readonly messageThreadId?: number;
  /** "HTML" | "Markdown" para el pie. Sin esto el pie va literal. */
  readonly parseMode?: string;
  /** Teclado inline tal cual lo espera la Bot API. */
  readonly replyMarkup?: Record<string, unknown>;
}

/**
 * Copiar a otro chat un mensaje que ya existe.
 *
 * `copyMessage` y no `forwardMessage` a proposito: el reenvio arrastra la
 * cabecera "Reenviado de", que Telegram OMITE cuando la persona tiene la
 * privacidad de reenvio puesta — justo la gente cuyo nombre mas falta hace en
 * la sala de staff. La copia no promete atribucion que Telegram pueda quitar,
 * asi que quien copia se hace responsable de decir de quien era, y eso se lee
 * igual para todo el mundo.
 *
 * Sin `caption`: el pie es lo que la persona escribio y sustituirlo por texto
 * nuestro seria tirar la mitad de la presentacion.
 */
export interface TelegramCopyMessageInput {
  /** A donde va la copia. */
  readonly chatId: bigint;
  /** De donde sale. El bot tiene que estar en los dos. */
  readonly fromChatId: bigint;
  readonly messageId: number;
  readonly token: string | undefined;
  /** Tema del foro de destino. */
  readonly messageThreadId?: number;
  readonly replyMarkup?: Record<string, unknown>;
}

/**
 * A quien le sale un menu de comandos.
 *
 * Telegram resuelve **el mas especifico**: si hay lista para
 * `all_chat_administrators`, un admin dentro de un grupo ve ESA y no la
 * general. Por eso la de admins tiene que incluir tambien lo comun — si no,
 * un admin pierde del menu lo que usa como cualquier otro.
 *
 * El tope de 100 entradas es **por ambito**, no total.
 */
export type TelegramCommandScope =
  | { readonly type: "default" }
  | { readonly type: "all_chat_administrators" };
export interface TelegramGateway {
  sendMessage(
    input: SendTelegramMessageInput,
  ): Promise<TelegramSendMessageResult>;
  sendChatAction(
    input: TelegramChatActionInput,
  ): Promise<TelegramGatewayResult>;
  sendMessageDraft(
    input: TelegramMessageDraftInput,
  ): Promise<TelegramGatewayResult>;
  editMessageText(
    input: TelegramEditMessageInput,
  ): Promise<TelegramGatewayResult>;
  editMessageCaption(
    input: TelegramEditMessageInput,
  ): Promise<TelegramGatewayResult>;
  banChatMember(input: TelegramModerationInput): Promise<TelegramGatewayResult>;
  restrictChatMember(
    input: TelegramModerationInput,
  ): Promise<TelegramGatewayResult>;
  unbanChatMember(input: TelegramRevokeInput): Promise<TelegramGatewayResult>;
  liftRestrictions(input: TelegramRevokeInput): Promise<TelegramGatewayResult>;
  /** Chat-wide permissions (Bot API setChatPermissions) — distinct from
   * restrictChatMember, which only restricts a single member. */
  setChatPermissions(
    input: TelegramSetChatPermissionsInput,
  ): Promise<TelegramGatewayResult>;
  closeForumTopic(
    input: TelegramForumTopicInput,
  ): Promise<TelegramGatewayResult>;
  deleteMessage(
    input: TelegramDeleteMessageInput,
  ): Promise<TelegramGatewayResult>;
  /** Remove an actor's reaction(s) from ONE message (Bot API 10.0). */
  deleteMessageReaction(
    input: TelegramDeleteMessageReactionInput,
  ): Promise<TelegramGatewayResult>;
  /**
   * Purge up to 10 000 of an actor's recent reactions across the WHOLE chat
   * (Bot API 10.0). Global + heavy — admin-confirmed use only, never automatic.
   */
  deleteAllMessageReactions(
    input: TelegramDeleteAllMessageReactionsInput,
  ): Promise<TelegramGatewayResult>;
  sendInvoice(input: TelegramInvoiceInput): Promise<TelegramGatewayResult>;
  createInvoiceLink(
    input: TelegramInvoiceLinkInput,
  ): Promise<TelegramInvoiceLinkResult>;
  editUserStarSubscription(
    input: TelegramEditStarSubscriptionInput,
  ): Promise<TelegramGatewayResult>;
  answerPreCheckoutQuery(
    input: TelegramPreCheckoutAnswer,
  ): Promise<TelegramGatewayResult>;
  answerInlineQuery(
    input: TelegramInlineAnswer,
  ): Promise<TelegramGatewayResult>;
  answerGuestQuery(input: TelegramGuestAnswer): Promise<TelegramGatewayResult>;
  pinChatMessage(
    input: TelegramPinMessageInput,
  ): Promise<TelegramGatewayResult>;
  unpinChatMessage(input: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  setChatTitle(input: TelegramChatTextInput): Promise<TelegramGatewayResult>;
  setChatDescription(
    input: TelegramChatTextInput,
  ): Promise<TelegramGatewayResult>;
  promoteChatMember(
    input: TelegramPromoteInput,
  ): Promise<TelegramGatewayResult>;
  demoteChatMember(input: TelegramRevokeInput): Promise<TelegramGatewayResult>;
  createChatInviteLink(input: {
    chatId: bigint;
    token: string | undefined;
    /**
     * Cuanta gente puede entrar con el enlace. Sin esto, Telegram lo crea
     * ilimitado y para siempre — un enlace asi, generado por una accion
     * automatica, es un agujero abierto en el grupo.
     */
    memberLimit?: number;
    /** Cuando caduca, en segundos epoch. */
    expireDate?: number;
  }): Promise<TelegramInviteLinkResult>;
  getChatAdministrators(input: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramAdminsResult>;
  getChat(input: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatResult>;
  sendDice(input: TelegramDiceInput): Promise<TelegramDiceResult>;
  setChatMenuButton(input: {
    url: string;
    text: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  getMe(input: { token: string | undefined }): Promise<TelegramGetMeResult>;
  /**
   * Pide a Telegram la ruta de un fichero y se baja los bytes.
   *
   * Va aqui, en el gateway, aunque sea LECTURA y no salida: la regla del repo
   * es que solo un sitio hable con la Bot API, y son sus reintentos ante un 429
   * los que hacen que bajar miles de ficheros no se atasque a la primera.
   *
   * Devuelve null cuando el fichero ya no esta: Telegram caduca las rutas de
   * getFile a la hora, y un fichero de hace meses puede haber desaparecido de
   * sus servidores. Es una respuesta normal, no un fallo que reintentar.
   */
  downloadFile(input: {
    fileId: string;
    token: string | undefined;
  }): Promise<Buffer | null>;
  /**
   * Reenvia un mensaje y devuelve el `file_id` de su foto.
   *
   * Es la unica forma que da la Bot API de recuperar el `file_id` de un mensaje
   * antiguo: no hay ningun "leer el mensaje X", y `copyMessage` solo devuelve
   * el numero del mensaje nuevo. Quien llame debe borrar el reenvio.
   */
  forwardMessage(input: {
    chatId: bigint;
    fromChatId: bigint;
    messageId: number;
    token: string | undefined;
  }): Promise<{
    readonly ok: boolean;
    readonly messageId?: number;
    readonly photoFileId?: string;
  }>;
  setMyCommands(input: {
    commands: readonly { command: string; description: string }[];
    token: string | undefined;
    /** Sin ambito, Telegram entiende `default`: el menu de todo el mundo. */
    scope?: TelegramCommandScope;
  }): Promise<TelegramGatewayResult>;
  setMyDescription(input: {
    description: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  setMyShortDescription(input: {
    shortDescription: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  getChatMember(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatMemberResult>;
  answerCallbackQuery(
    input: TelegramCallbackAnswerInput,
  ): Promise<TelegramGatewayResult>;
  sendSticker(input: TelegramMediaInput): Promise<TelegramGatewayResult>;
  /** Returns Telegram's message_id (when parseable) so a caller can later
   * delete this exact photo — Guardian's STAFF report relies on it for the
   * media-retention promise. */
  sendPhoto(input: TelegramMediaInput): Promise<TelegramSendMessageResult>;
  /**
   * Sends a photo Telegram ALREADY has, by file_id.
   *
   * Distinct from sendPhoto, which uploads bytes. A file_id is bound to the bot
   * identity that produced it, so callers must only ever pass one this same bot
   * uploaded — a child bot reusing the parent's id gets a 400.
   */
  sendPhotoByFileId(
    input: TelegramFileIdPhotoInput,
  ): Promise<TelegramSendMessageResult>;
  copyMessage(
    input: TelegramCopyMessageInput,
  ): Promise<TelegramSendMessageResult>;
  approveChatJoinRequest(
    input: TelegramRevokeInput,
  ): Promise<TelegramGatewayResult>;
  declineChatJoinRequest(
    input: TelegramRevokeInput,
  ): Promise<TelegramGatewayResult>;
  /** Bot API 10.1: opens the Guardian verification Mini App from a pending
   * chat_join_request. Must be called within Telegram's initial ~10s window. */
  sendChatJoinRequestWebApp(
    input: TelegramSendJoinRequestWebAppInput,
  ): Promise<TelegramGatewayResult>;
  /** Bot API 10.1: resolves a chat_join_request.query_id with approve/decline/
   * queue. Only valid for the FIRST answer to a given query_id — a later
   * manual staff decision (after `queue`) uses approveChatJoinRequest /
   * declineChatJoinRequest instead, since Telegram's query_id is considered
   * answered at that point. See docs/GUARDIAN_TELEGRAM_TEST.md. */
  answerChatJoinRequestQuery(
    input: TelegramAnswerJoinRequestQueryInput,
  ): Promise<TelegramGatewayResult>;
  editMessageReplyMarkup(input: {
    chatId: bigint;
    messageId: number;
    replyMarkup: Record<string, unknown>;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
}

// --- Bot API 10.1: Guardian Bots / join request queries ---

export interface TelegramSendJoinRequestWebAppInput {
  readonly chatJoinRequestQueryId: string;
  /** HTTPS URL of the Guardian verification Mini App, e.g. GUARDIAN_MINIAPP_URL. */
  readonly webAppUrl: string;
  readonly token: string | undefined;
}

export type TelegramJoinRequestQueryResult = "approve" | "decline" | "queue";

export interface TelegramAnswerJoinRequestQueryInput {
  readonly chatJoinRequestQueryId: string;
  readonly result: TelegramJoinRequestQueryResult;
  readonly token: string | undefined;
}

export interface TelegramManagedBotTokenInput {
  readonly userId: bigint;
  readonly token: string | undefined;
}

export interface TelegramSetWebhookInput {
  readonly url: string;
  readonly secretToken: string;
  readonly allowedUpdates: readonly string[];
  readonly token: string | undefined;
  /**
   * Whether Telegram should discard updates queued before this call. Defaults to
   * true (a fresh registration/activation wants a clean slate). A webhook REFRESH
   * that only rotates the secret / widens allowed_updates must pass false so it
   * never drops updates already waiting for delivery.
   */
  readonly dropPendingUpdates?: boolean;
}

export interface TelegramWebhookInfoResult extends TelegramGatewayResult {
  readonly url?: string;
  /** The update types Telegram will deliver; absent means "all default". */
  readonly allowedUpdates?: readonly string[];
  readonly pendingUpdateCount?: number;
}

export interface TelegramManagedBotGateway {
  getManagedBotToken(
    input: TelegramManagedBotTokenInput,
  ): Promise<string | undefined>;
  replaceManagedBotToken(
    input: TelegramManagedBotTokenInput,
  ): Promise<string | undefined>;
  setWebhook(input: TelegramSetWebhookInput): Promise<TelegramGatewayResult>;
}

export interface TelegramInlineResult {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly replyMarkup?: Record<string, unknown>;
}

export interface TelegramInlineAnswer {
  readonly inlineQueryId: string;
  readonly results: readonly TelegramInlineResult[];
  readonly cacheTime?: number;
  readonly token: string | undefined;
}

export interface TelegramGuestAnswer {
  readonly guestQueryId: string;
  readonly text: string;
  readonly token: string | undefined;
}

export interface TelegramDeleteMessageInput {
  readonly chatId: bigint;
  readonly messageId: number;
  readonly token: string | undefined;
}

/**
 * The ACTOR whose reaction(s) Telegram will remove — exactly one of a user or a
 * channel-as-actor. deleteMessageReaction / deleteAllMessageReactions identify
 * WHO reacted, never which emoji: the Bot API has no per-emoji targeting. The
 * `?: never` arms make it a compile error to pass both or neither.
 */
export type TelegramReactionActor =
  | { readonly userId: bigint; readonly actorChatId?: never }
  | { readonly actorChatId: bigint; readonly userId?: never };

/**
 * deleteMessageReaction (Bot API 10.0): removes the reaction(s) a single ACTOR
 * placed on ONE message. The bot must be an admin with can_delete_messages.
 * There is NO `reaction` parameter — removal is by actor, so this also clears
 * any other (innocent) reactions that same actor added to that message.
 * Requires exactly one of user_id / actor_chat_id (see {@link
 * TelegramReactionActor}).
 */
export interface TelegramDeleteMessageReactionInput {
  readonly chatId: bigint;
  readonly messageId: number;
  readonly actor: TelegramReactionActor;
  readonly token: string | undefined;
}

/**
 * deleteAllMessageReactions (Bot API 10.0): removes up to 10 000 of an actor's
 * MOST RECENT reactions across the WHOLE chat — NOT the reactions on one
 * message (there is no message_id). A heavy, global action on an actor's
 * history: keep it a deliberate, admin-CONFIRMED tool, never an automatic
 * response to a reaction surge.
 */
export interface TelegramDeleteAllMessageReactionsInput {
  readonly chatId: bigint;
  readonly actor: TelegramReactionActor;
  readonly token: string | undefined;
}

const reactionActorToPayload = (
  actor: TelegramReactionActor,
): Record<string, string> =>
  actor.userId !== undefined
    ? { user_id: actor.userId.toString() }
    : { actor_chat_id: actor.actorChatId.toString() };

export interface TelegramEditMessageInput {
  readonly chatId?: bigint;
  readonly messageId?: number;
  readonly inlineMessageId?: string;
  readonly reply: BotReply;
  readonly token: string | undefined;
}

export interface TelegramInvoiceInput {
  readonly chatId: bigint;
  readonly title: string;
  readonly description: string;
  readonly payload: string;
  readonly currency: string;
  readonly amount: number;
  readonly token: string | undefined;
}

export interface TelegramPreCheckoutAnswer {
  readonly preCheckoutQueryId: string;
  readonly ok: boolean;
  readonly errorMessage: string | undefined;
  readonly token: string | undefined;
}

export interface TelegramInvoiceLinkInput {
  readonly title: string;
  readonly description: string;
  readonly payload: string;
  readonly currency: string;
  readonly amount: number;
  /** Stars-only. Telegram currently accepts exactly 2_592_000 (30 days). */
  readonly subscriptionPeriodSeconds?: number;
  readonly token: string | undefined;
}

export interface TelegramInvoiceLinkResult extends TelegramGatewayResult {
  readonly url?: string;
}

export interface TelegramEditStarSubscriptionInput {
  readonly userId: bigint;
  readonly telegramPaymentChargeId: string;
  readonly isCanceled: boolean;
  readonly token: string | undefined;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface RetryPolicy {
  readonly maxAttempts: number;
  readonly capSeconds: number;
}

// Provisioning calls (managed-bot activation) are rare; getting them right
// matters more than latency, so telegramJson's own loop already affords a
// long wait across several attempts. This constant documents that existing
// policy for reference — telegramJson is NOT changed to use it, to avoid
// touching an already-working, already-covered code path.
// Documentation, not dead code: it records the policy telegramJson already
// applies, and deleting it to silence the linter would take the explanation
// with it. The suppression goes LAST — biome applies it to the next line, so a
// continuation comment underneath would swallow it.
// biome-ignore lint/correctness/noUnusedVariables: kept as documentation
const PROVISIONING_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  capSeconds: 30,
};

// High-volume calls (sendMessage, moderation, media uploads, editMessageText,
// getChatMember/createInvoiceLink, ...) run inside sequential loops: the
// bot's getUpdates poller processes one update's reply at a time, and the
// worker's due-item processors send one message per due item with no
// throttling between them. A long wait on one rate-limited call would stall
// every other pending chat behind it, so this policy allows only ONE retry,
// capped at 3s — enough to absorb Telegram's common per-chat "wait ~1s" flood
// control without turning a single 429 into a multi-second pileup.
const HIGH_VOLUME_RETRY_POLICY: RetryPolicy = { maxAttempts: 2, capSeconds: 3 };

/** Cuánto se puede ensanchar como máximo la espera para romper el rebaño. */
export const RETRY_JITTER_MAX_MS = 250;

/**
 * La espera antes de reintentar un 429, con dispersión.
 *
 * Sin dispersión, cien chats limitados en el mismo segundo reintentan todos en
 * el MISMO milisegundo y vuelven a provocar el 429 juntos. Un poco de ruido los
 * separa.
 *
 * La dispersión solo SUMA, nunca resta: `retry_after` es una instrucción del
 * servidor, y esperar menos de lo que pide es contraproducente. El tope de la
 * política puede excederse como mucho en `RETRY_JITTER_MAX_MS`, que es el
 * precio de no sincronizar el rebaño.
 *
 * `random` se inyecta para que los tests puedan fijar el resultado; en
 * producción es `Math.random`, que aquí es correcto: esto es dispersión de
 * carga, no una decisión que nadie pueda predecir para su beneficio.
 */
export const retryWaitMs = (
  retryAfterSeconds: number | undefined,
  attempt: number,
  policy: RetryPolicy,
  random: () => number = Math.random,
): number => {
  const base = Math.min(retryAfterSeconds ?? 2 ** attempt, policy.capSeconds);
  const jitter = Math.floor(random() * RETRY_JITTER_MAX_MS);
  return Math.max(0, base) * 1000 + jitter;
};

/**
 * Builds the Error for a failed Telegram call, folding in Telegram's OWN
 * `description` ("message is too long", "TOPIC_CLOSED", "BUTTON_URL_INVALID",
 * ...). A bare status code collapses a dozen unrelated causes into the same
 * unactionable "failed with status 400", which is worthless when the failure
 * happened unattended hours ago — the description is the entire diagnosis.
 *
 * Consumes the response body, so only call it on a response being discarded.
 */
const telegramFailure = async (
  method: string,
  response: Response,
): Promise<Error> => {
  const description = await response
    .json()
    .then((body) => (body as { description?: string }).description)
    .catch(() => undefined);
  return new Error(
    `Telegram ${method} failed with status ${response.status}${
      description ? `: ${description}` : ""
    }`,
  );
};

export class HttpTelegramGateway implements TelegramGateway {
  /**
   * POSTs to Telegram, transparently retrying a bounded number of times when
   * Telegram answers 429 (Too Many Requests) with parameters.retry_after.
   * Returns the final attempt's Response completely unread — every existing
   * caller's own response.json()/response.ok handling keeps working exactly
   * as it does today; this only inserts a capped wait-and-retry *before*
   * that handling runs, on 429 responses that would otherwise be discarded.
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    policy: RetryPolicy,
    // Subir bytes no es pedir datos: veinte segundos sobran para un
    // `sendMessage` y se quedan cortos para un video de dieciocho megas por una
    // linea domestica. Quien sube pide su propio tope; el resto no cambia.
    timeoutMs: number = TIMEOUT_TELEGRAM_MS,
  ): Promise<Response> {
    for (let attempt = 1; ; attempt += 1) {
      // Cada intento estrena su propio tope: el reintento por 429 no debe
      // heredar el tiempo ya consumido por el anterior.
      const response = await fetch(url, {
        ...init,
        signal: conTope(timeoutMs),
      });

      if (response.status !== 429 || attempt >= policy.maxAttempts) {
        return response;
      }

      // This response is being discarded (we're retrying), so it's safe to
      // consume its body here — the response we eventually return is always
      // the fresh, unread one from the branch above.
      const retryAfter = await response
        .json()
        .then(
          (body) =>
            (body as { parameters?: { retry_after?: number } }).parameters
              ?.retry_after,
        )
        .catch(() => undefined);

      await delay(retryWaitMs(retryAfter, attempt, policy));
    }
  }

  private async telegramJson<T>(
    token: string | undefined,
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    if (!token) {
      throw new Error("missing-token");
    }

    // Telegram answers a burst of writes (setWebhook, getManagedBotToken, ...)
    // with HTTP 429 + parameters.retry_after. Honour that delay and retry a few
    // times so a transient rate-limit doesn't fail a managed-bot activation.
    const maxAttempts = 4;
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/${method}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: conTope(TIMEOUT_TELEGRAM_MS),
        },
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        result?: T;
        description?: string;
        parameters?: { retry_after?: number };
      };

      if (response.ok && payload.ok) {
        return payload.result as T;
      }

      const retryAfter = payload.parameters?.retry_after;
      const isRateLimited = response.status === 429 || retryAfter !== undefined;
      if (isRateLimited && attempt < maxAttempts) {
        // Cap the wait so a hostile retry_after can't hang the request forever.
        const waitSeconds = Math.min(retryAfter ?? 2 ** attempt, 30);
        await delay(waitSeconds * 1000);
        continue;
      }

      const retryHint =
        retryAfter !== undefined ? ` retry_after=${retryAfter}s` : "";
      if (!response.ok) {
        throw new Error(
          `Telegram ${method} failed with status ${response.status}: ${payload.description ?? "unknown"}${retryHint}`,
        );
      }
      throw new Error(
        `Telegram ${method} failed: ${payload.description ?? "unknown"}${retryHint}`,
      );
    }
  }

  async getManagedBotToken({
    userId,
    token,
  }: TelegramManagedBotTokenInput): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }
    return this.telegramJson<string>(token, "getManagedBotToken", {
      user_id: userId.toString(),
    });
  }

  async replaceManagedBotToken({
    userId,
    token,
  }: TelegramManagedBotTokenInput): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }
    return this.telegramJson<string>(token, "replaceManagedBotToken", {
      user_id: userId.toString(),
    });
  }

  async setWebhook({
    url,
    secretToken,
    allowedUpdates,
    token,
    dropPendingUpdates = true,
  }: TelegramSetWebhookInput): Promise<TelegramGatewayResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }
    await this.telegramJson<boolean>(token, "setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: allowedUpdates,
      drop_pending_updates: dropPendingUpdates,
    });
    return { ok: true, skipped: false };
  }

  /**
   * Reads the current webhook registration. Used to VERIFY, after a refresh,
   * that a bot's allowed_updates actually contains what we set (e.g.
   * message_reaction). Never throws — a lookup failure surfaces as { ok: false }
   * so a bulk refresh can report it per bot instead of aborting.
   */
  async getWebhookInfo({
    token,
  }: {
    token: string | undefined;
  }): Promise<TelegramWebhookInfoResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }
    try {
      const info = await this.telegramJson<{
        url?: unknown;
        allowed_updates?: unknown;
        pending_update_count?: unknown;
      }>(token, "getWebhookInfo", {});
      const allowedUpdates = Array.isArray(info.allowed_updates)
        ? info.allowed_updates.filter(
            (value): value is string => typeof value === "string",
          )
        : undefined;
      return {
        ok: true,
        skipped: false,
        ...(typeof info.url === "string" ? { url: info.url } : {}),
        ...(allowedUpdates ? { allowedUpdates } : {}),
        ...(typeof info.pending_update_count === "number"
          ? { pendingUpdateCount: info.pending_update_count }
          : {}),
      };
    } catch {
      return { ok: false, skipped: false };
    }
  }

  /** Removes a bot's webhook — used to switch off a suspended managed bot. */
  async deleteWebhook({
    token,
  }: {
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }
    await this.telegramJson<boolean>(token, "deleteWebhook", {
      drop_pending_updates: true,
    });
    return { ok: true, skipped: false };
  }

  async sendMessage({
    chatId,
    reply,
    token,
    messageThreadId,
  }: SendTelegramMessageInput): Promise<TelegramSendMessageResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId.toString(),
          // undefined is omitted by JSON.stringify — only sent when routing to
          // a specific forum topic (same pattern as parse_mode above).
          message_thread_id: messageThreadId,
          text: reply.text,
          parse_mode: reply.parseMode,
          disable_web_page_preview: reply.disableWebPagePreview ?? true,
          reply_markup: reply.replyMarkup,
        }),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw await telegramFailure("sendMessage", response);
    }

    try {
      const body = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
      };
      const messageId = body.result?.message_id;
      return {
        ok: true,
        skipped: false,
        ...(messageId !== undefined ? { messageId } : {}),
      };
    } catch {
      // Response wasn't parseable JSON — the send itself already succeeded
      // (checked via response.ok above), just without a usable message_id.
      return { ok: true, skipped: false };
    }
  }

  async sendChatAction({
    chatId,
    action,
    token,
  }: TelegramChatActionInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendChatAction",
      payload: {
        chat_id: chatId.toString(),
        action,
      },
    });
  }

  async sendMessageDraft({
    chatId,
    text,
    token,
  }: TelegramMessageDraftInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendMessageDraft",
      payload: {
        chat_id: chatId.toString(),
        text,
      },
    });
  }

  async editMessageText({
    chatId,
    messageId,
    inlineMessageId,
    reply,
    token,
  }: TelegramEditMessageInput): Promise<TelegramGatewayResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/editMessageText`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...(inlineMessageId
            ? { inline_message_id: inlineMessageId }
            : {
                chat_id: chatId?.toString(),
                message_id: messageId,
              }),
          text: reply.text,
          parse_mode: reply.parseMode,
          disable_web_page_preview: reply.disableWebPagePreview ?? true,
          reply_markup: reply.replyMarkup,
        }),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram editMessageText failed with status ${response.status}`,
      );
    }

    return { ok: true, skipped: false };
  }

  /** Edits the caption of a media message (photo/video/…). editMessageText
   * rejects media messages ("no text in the message to edit"), so this is what
   * Guardian's STAFF photo report needs when a verdict edits it in place. */
  async editMessageCaption({
    chatId,
    messageId,
    inlineMessageId,
    reply,
    token,
  }: TelegramEditMessageInput): Promise<TelegramGatewayResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/editMessageCaption`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...(inlineMessageId
            ? { inline_message_id: inlineMessageId }
            : {
                chat_id: chatId?.toString(),
                message_id: messageId,
              }),
          caption: reply.text,
          parse_mode: reply.parseMode,
          reply_markup: reply.replyMarkup,
        }),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram editMessageCaption failed with status ${response.status}`,
      );
    }

    return { ok: true, skipped: false };
  }

  async banChatMember({
    chatId,
    userId,
    token,
    untilDate,
  }: TelegramModerationInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "banChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        ...(untilDate
          ? { until_date: Math.floor(untilDate.getTime() / 1000) }
          : {}),
      },
    });
  }

  async restrictChatMember({
    chatId,
    userId,
    token,
    untilDate,
  }: TelegramModerationInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "restrictChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
        },
        use_independent_chat_permissions: true,
        ...(untilDate
          ? { until_date: Math.floor(untilDate.getTime() / 1000) }
          : {}),
      },
    });
  }

  async setChatPermissions({
    chatId,
    permissions,
    token,
  }: TelegramSetChatPermissionsInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "setChatPermissions",
      payload: {
        chat_id: chatId.toString(),
        permissions,
      },
    });
  }

  async closeForumTopic({
    chatId,
    messageThreadId,
    token,
  }: TelegramForumTopicInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "closeForumTopic",
      payload: {
        chat_id: chatId.toString(),
        message_thread_id: messageThreadId,
      },
    });
  }

  async unbanChatMember({
    chatId,
    userId,
    token,
    onlyIfBanned,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "unbanChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        only_if_banned: onlyIfBanned ?? true,
      },
    });
  }

  async liftRestrictions({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "restrictChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        },
        use_independent_chat_permissions: true,
      },
    });
  }

  async deleteMessage({
    chatId,
    messageId,
    token,
  }: TelegramDeleteMessageInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "deleteMessage",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
      },
    });
  }

  async deleteMessageReaction({
    chatId,
    messageId,
    actor,
    token,
  }: TelegramDeleteMessageReactionInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "deleteMessageReaction",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
        ...reactionActorToPayload(actor),
      },
    });
  }

  async deleteAllMessageReactions({
    chatId,
    actor,
    token,
  }: TelegramDeleteAllMessageReactionsInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "deleteAllMessageReactions",
      payload: {
        chat_id: chatId.toString(),
        ...reactionActorToPayload(actor),
      },
    });
  }

  async sendInvoice({
    chatId,
    title,
    description,
    payload,
    currency,
    amount,
    token,
  }: TelegramInvoiceInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendInvoice",
      payload: {
        chat_id: chatId.toString(),
        title,
        description,
        payload,
        currency,
        prices: [{ label: title, amount }],
      },
    });
  }

  async createInvoiceLink({
    title,
    description,
    payload,
    currency,
    amount,
    subscriptionPeriodSeconds,
    token,
  }: TelegramInvoiceLinkInput): Promise<TelegramInvoiceLinkResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "createInvoiceLink",
      payload: {
        title,
        description,
        payload,
        currency,
        prices: [{ label: title, amount }],
        ...(subscriptionPeriodSeconds
          ? { subscription_period: subscriptionPeriodSeconds }
          : {}),
      },
    });
    if (!outcome.ok) {
      return outcome;
    }
    return {
      ok: true,
      skipped: false,
      ...(typeof outcome.result === "string" ? { url: outcome.result } : {}),
    };
  }

  async editUserStarSubscription({
    userId,
    telegramPaymentChargeId,
    isCanceled,
    token,
  }: TelegramEditStarSubscriptionInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "editUserStarSubscription",
      payload: {
        user_id: userId.toString(),
        telegram_payment_charge_id: telegramPaymentChargeId,
        is_canceled: isCanceled,
      },
    });
  }

  async answerPreCheckoutQuery({
    preCheckoutQueryId,
    ok,
    errorMessage,
    token,
  }: TelegramPreCheckoutAnswer): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerPreCheckoutQuery",
      payload: {
        pre_checkout_query_id: preCheckoutQueryId,
        ok,
        ...(ok ? {} : { error_message: errorMessage ?? "No disponible" }),
      },
    });
  }

  async answerInlineQuery({
    inlineQueryId,
    results,
    cacheTime,
    token,
  }: TelegramInlineAnswer): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerInlineQuery",
      payload: {
        inline_query_id: inlineQueryId,
        results: results.map((result) => ({
          type: "article",
          id: result.id,
          title: result.title,
          ...(result.description ? { description: result.description } : {}),
          ...(result.thumbnailUrl
            ? { thumbnail_url: result.thumbnailUrl }
            : {}),
          input_message_content: { message_text: result.content },
          ...(result.replyMarkup ? { reply_markup: result.replyMarkup } : {}),
        })),
        cache_time: cacheTime ?? 5,
      },
    });
  }

  async answerGuestQuery({
    guestQueryId,
    text,
    token,
  }: TelegramGuestAnswer): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerGuestQuery",
      payload: {
        guest_query_id: guestQueryId,
        result: {
          type: "article",
          id: `guest:${guestQueryId}`,
          title: "Modryva",
          input_message_content: { message_text: text },
        },
      },
    });
  }

  async pinChatMessage({
    chatId,
    messageId,
    token,
  }: TelegramPinMessageInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "pinChatMessage",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
        disable_notification: true,
      },
    });
  }

  async unpinChatMessage({
    chatId,
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "unpinChatMessage",
      payload: { chat_id: chatId.toString() },
    });
  }

  async setChatTitle({
    chatId,
    text,
    token,
  }: TelegramChatTextInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "setChatTitle",
      payload: { chat_id: chatId.toString(), title: text },
    });
  }

  async setChatDescription({
    chatId,
    text,
    token,
  }: TelegramChatTextInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "setChatDescription",
      payload: { chat_id: chatId.toString(), description: text },
    });
  }

  async promoteChatMember({
    chatId,
    userId,
    customTitle,
    token,
    rights,
  }: TelegramPromoteInput): Promise<TelegramGatewayResult> {
    const promoted = await this.callTelegramMethod({
      token,
      method: "promoteChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        ...(rights ?? {
          can_delete_messages: true,
          can_restrict_members: true,
          can_invite_users: true,
          can_pin_messages: true,
          can_manage_video_chats: true,
        }),
      },
    });

    if (promoted.ok && customTitle) {
      // Best-effort, and it MUST stay that way: the promotion has already
      // happened by now, so letting a title failure throw reports a successful
      // appointment as a failure — and leaves the caller's own bookkeeping
      // unwritten while the person really is an admin. That desync happened for
      // real: a 19-character title returned CUSTOM_TITLE_INVALID, the exception
      // escaped, and the bot ended up unable to revoke an admin it had just
      // created.
      try {
        await this.callTelegramMethod({
          token,
          method: "setChatAdministratorCustomTitle",
          payload: {
            chat_id: chatId.toString(),
            user_id: userId.toString(),
            // Telegram's hard limit is 16 characters; anything longer is
            // rejected outright rather than trimmed for you.
            custom_title: [...customTitle].slice(0, 16).join(""),
          },
        });
      } catch {
        // The badge is set; only its label is missing.
      }
    }

    return promoted;
  }

  async demoteChatMember({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "promoteChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        can_change_info: false,
        can_delete_messages: false,
        can_restrict_members: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_promote_members: false,
        can_manage_video_chats: false,
        can_post_messages: false,
        can_edit_messages: false,
      },
    });
  }

  async createChatInviteLink({
    chatId,
    token,
    memberLimit,
    expireDate,
  }: {
    chatId: bigint;
    token: string | undefined;
    memberLimit?: number;
    expireDate?: number;
  }): Promise<TelegramInviteLinkResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "createChatInviteLink",
      payload: {
        chat_id: chatId.toString(),
        ...(memberLimit !== undefined ? { member_limit: memberLimit } : {}),
        ...(expireDate !== undefined ? { expire_date: expireDate } : {}),
      },
    });

    if (!outcome.ok) {
      return outcome;
    }

    const link =
      typeof outcome.result === "object" &&
      outcome.result !== null &&
      "invite_link" in outcome.result &&
      typeof (outcome.result as { invite_link: unknown }).invite_link ===
        "string"
        ? (outcome.result as { invite_link: string }).invite_link
        : undefined;

    return { ok: true, skipped: false, ...(link ? { inviteLink: link } : {}) };
  }

  async getChatAdministrators({
    chatId,
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramAdminsResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "getChatAdministrators",
      payload: { chat_id: chatId.toString() },
    });

    if (!outcome.ok) {
      return outcome;
    }

    const admins = Array.isArray(outcome.result)
      ? outcome.result.flatMap((entry): TelegramChatAdminInfo[] => {
          if (typeof entry !== "object" || entry === null) {
            return [];
          }

          const member = entry as {
            status?: unknown;
            custom_title?: unknown;
            can_restrict_members?: unknown;
            can_delete_messages?: unknown;
            can_pin_messages?: unknown;
            can_promote_members?: unknown;
            user?: {
              id?: unknown;
              username?: unknown;
              first_name?: unknown;
              is_bot?: unknown;
            };
          };

          if (typeof member.user?.id !== "number") {
            return [];
          }

          // El dueño no trae los flags enumerados: los tiene todos por
          // definicion. Tratarlo como "sin permisos" lo dejaria fuera de
          // cualquier auditoria, que es precisamente al reves de lo que
          // interesa — es la cuenta con mas poder del grupo.
          const esDueno = member.status === "creator";
          const puede = (value: unknown): boolean => esDueno || value === true;

          return [
            {
              userId: BigInt(member.user.id),
              username:
                typeof member.user.username === "string"
                  ? member.user.username
                  : undefined,
              firstName:
                typeof member.user.first_name === "string"
                  ? member.user.first_name
                  : undefined,
              isOwner: esDueno,
              isBot: member.user.is_bot === true,
              customTitle:
                typeof member.custom_title === "string"
                  ? member.custom_title
                  : undefined,
              canRestrict: puede(member.can_restrict_members),
              canDelete: puede(member.can_delete_messages),
              canPin: puede(member.can_pin_messages),
              canPromote: puede(member.can_promote_members),
            },
          ];
        })
      : [];

    return { ok: true, skipped: false, admins };
  }

  async getChat({
    chatId,
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "getChat",
      payload: { chat_id: chatId.toString() },
    });

    if (!outcome.ok) {
      return outcome;
    }

    const chat =
      typeof outcome.result === "object" && outcome.result !== null
        ? (outcome.result as {
            id?: unknown;
            type?: unknown;
            title?: unknown;
            username?: unknown;
            first_name?: unknown;
            last_name?: unknown;
            guard_bot?: unknown;
          })
        : undefined;

    const id =
      typeof chat?.id === "number" || typeof chat?.id === "bigint"
        ? BigInt(chat.id)
        : undefined;

    return {
      ok: true,
      skipped: false,
      chat: {
        chatId: id,
        type: typeof chat?.type === "string" ? chat.type : undefined,
        title: typeof chat?.title === "string" ? chat.title : undefined,
        username:
          typeof chat?.username === "string" ? chat.username : undefined,
        ...(typeof chat?.first_name === "string"
          ? { firstName: chat.first_name }
          : {}),
        ...(typeof chat?.last_name === "string"
          ? { lastName: chat.last_name }
          : {}),
        ...(typeof chat?.guard_bot === "boolean"
          ? { guardBot: chat.guard_bot }
          : {}),
      },
    };
  }

  /** The bot's own identity (display name + @username) for the given token. */
  async getMe({
    token,
  }: {
    token: string | undefined;
  }): Promise<TelegramGetMeResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "getMe",
      payload: {},
    });
    if (!outcome.ok) {
      return {
        ok: false,
        skipped: outcome.skipped,
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      };
    }
    const me = outcome.result as
      | {
          id?: unknown;
          first_name?: unknown;
          username?: unknown;
          supports_guest_queries?: unknown;
          supports_join_request_queries?: unknown;
        }
      | undefined;
    return {
      ok: true,
      skipped: false,
      botUserId:
        typeof me?.id === "number" || typeof me?.id === "bigint"
          ? BigInt(me.id)
          : undefined,
      name: typeof me?.first_name === "string" ? me.first_name : undefined,
      username: typeof me?.username === "string" ? me.username : undefined,
      supportsGuestQueries:
        typeof me?.supports_guest_queries === "boolean"
          ? me.supports_guest_queries
          : undefined,
      supportsJoinRequestQueries:
        typeof me?.supports_join_request_queries === "boolean"
          ? me.supports_join_request_queries
          : undefined,
    };
  }

  async sendDice({
    chatId,
    emoji,
    token,
  }: TelegramDiceInput): Promise<TelegramDiceResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "sendDice",
      payload: { chat_id: chatId.toString(), emoji },
    });
    if (!outcome.ok) {
      return outcome;
    }
    const dice = (outcome.result as { dice?: { value?: unknown } } | undefined)
      ?.dice;
    const value = typeof dice?.value === "number" ? dice.value : undefined;
    return {
      ok: true,
      skipped: false,
      ...(value !== undefined ? { value } : {}),
    };
  }

  async answerCallbackQuery({
    callbackQueryId,
    text,
    token,
    showAlert,
  }: TelegramCallbackAnswerInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerCallbackQuery",
      payload: {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
        ...(showAlert ? { show_alert: true } : {}),
      },
    });
  }

  async editMessageReplyMarkup({
    chatId,
    messageId,
    replyMarkup,
    token,
  }: {
    chatId: bigint;
    messageId: number;
    replyMarkup: Record<string, unknown>;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "editMessageReplyMarkup",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
        reply_markup: replyMarkup,
      },
    });
  }

  async approveChatJoinRequest({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "approveChatJoinRequest",
      payload: { chat_id: chatId.toString(), user_id: userId.toString() },
    });
  }

  async declineChatJoinRequest({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "declineChatJoinRequest",
      payload: { chat_id: chatId.toString(), user_id: userId.toString() },
    });
  }

  async sendChatJoinRequestWebApp({
    chatJoinRequestQueryId,
    webAppUrl,
    token,
  }: TelegramSendJoinRequestWebAppInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendChatJoinRequestWebApp",
      payload: {
        chat_join_request_query_id: chatJoinRequestQueryId,
        // Bot API 10.1 takes a flat `web_app_url` STRING here — NOT a
        // `web_app: { url }` object like inline-keyboard buttons. Verified
        // against live Telegram: the object shape is rejected with 400
        // `parameter "web_app_url" is required`, so the query goes unanswered
        // and the user sees "the admin bot can't process the join request".
        web_app_url: webAppUrl,
      },
    });
  }

  async answerChatJoinRequestQuery({
    chatJoinRequestQueryId,
    result,
    token,
  }: TelegramAnswerJoinRequestQueryInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerChatJoinRequestQuery",
      payload: {
        chat_join_request_query_id: chatJoinRequestQueryId,
        result,
      },
    });
  }

  async sendSticker(input: TelegramMediaInput): Promise<TelegramGatewayResult> {
    return this.uploadMedia(input, "sendSticker", "sticker");
  }

  async sendPhoto(
    input: TelegramMediaInput,
  ): Promise<TelegramSendMessageResult> {
    return this.uploadMedia(input, "sendPhoto", "photo");
  }

  /**
   * Sube un video por bytes.
   *
   * NO esta en `TelegramGateway`, y es a proposito: hoy lo llama solo el
   * consultor, que tiene la clase concreta en la mano. Meterlo en el puerto
   * obligaria a cada doble a implementar un metodo que nadie invoca, que es
   * como una interfaz acaba llena de nombres que no significan nada. Cuando lo
   * necesite un modulo, sube al puerto en ese mismo cambio.
   *
   * El tope de tiempo es el de las descargas y no el de la Bot API. Subir
   * dieciocho megas pasa de veinte segundos con facilidad, y un corte a mitad
   * de subida no es Telegram tardando: es el tope nuestro, mal elegido.
   */
  async sendVideo({
    chatId,
    token,
    videoBase64,
    mimeType,
    nombreFichero,
    caption,
    messageThreadId,
    protectContent,
  }: TelegramVideoInput): Promise<TelegramSendMessageResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const bytes = Buffer.from(videoBase64, "base64");
    const form = new FormData();
    form.append("chat_id", chatId.toString());
    if (messageThreadId !== undefined) {
      form.append("message_thread_id", String(messageThreadId));
    }
    form.append("video", new Blob([bytes], { type: mimeType }), nombreFichero);
    if (caption !== undefined) {
      form.append("caption", caption);
    }
    // Que se pueda empezar a ver sin esperar a la descarga entera. Es gratis y
    // es la diferencia entre mirar un video y esperarlo.
    form.append("supports_streaming", "true");
    if (protectContent) {
      form.append("protect_content", "true");
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/sendVideo`,
      { method: "POST", body: form },
      HIGH_VOLUME_RETRY_POLICY,
      TIMEOUT_DESCARGA_MS,
    );

    if (!response.ok) {
      throw await telegramFailure("sendVideo", response);
    }

    try {
      const body = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
      };
      const messageId = body.result?.message_id;
      return {
        ok: true,
        skipped: false,
        ...(messageId !== undefined ? { messageId } : {}),
      };
    } catch {
      // La subida ya salio bien (el `response.ok` de arriba): lo unico que
      // falta es un message_id utilizable.
      return { ok: true, skipped: false };
    }
  }

  async sendPhotoByFileId({
    chatId,
    fileId,
    token,
    caption,
    messageThreadId,
    parseMode,
    replyMarkup,
  }: TelegramFileIdPhotoInput): Promise<TelegramSendMessageResult> {
    // JSON rather than multipart: there are no bytes to upload, only an id
    // Telegram already holds. Never a URL — see TelegramFileIdPhotoInput.
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "sendPhoto",
      payload: {
        chat_id: chatId.toString(),
        photo: fileId,
        ...(caption !== undefined ? { caption } : {}),
        ...(messageThreadId !== undefined
          ? { message_thread_id: messageThreadId }
          : {}),
        ...(parseMode !== undefined ? { parse_mode: parseMode } : {}),
        ...(replyMarkup !== undefined ? { reply_markup: replyMarkup } : {}),
      },
    });
    if (!outcome.ok) {
      return outcome;
    }
    const messageId =
      typeof outcome.result === "object" &&
      outcome.result !== null &&
      typeof (outcome.result as { message_id?: unknown }).message_id ===
        "number"
        ? (outcome.result as { message_id: number }).message_id
        : undefined;
    return {
      ok: true,
      skipped: false,
      ...(messageId !== undefined ? { messageId } : {}),
    };
  }

  /**
   * Reenvia un mensaje y devuelve el `file_id` de su foto, si la lleva.
   *
   * Existe para una sola cosa: recuperar fotos que el bot publico hace tiempo y
   * de las que ya no guarda el `file_id`. La Bot API no tiene ningun metodo
   * para "leer el mensaje X"; `copyMessage` devuelve solo el numero del mensaje
   * nuevo, y `getFile` necesita un `file_id` que no tenemos. `forwardMessage`
   * es el unico que devuelve el Message COMPLETO, con sus `file_id` dentro.
   *
   * Que el mirror de presentaciones use `copyMessage` y no esto sigue siendo
   * correcto y no se toca: alli el motivo es que el reenvio arrastra una
   * cabecera de atribucion que Telegram omite segun la privacidad de cada uno.
   * Aqui no se reenvia para que nadie lo lea, sino para leer la respuesta.
   *
   * Quien llame es responsable de borrar el mensaje reenviado.
   */
  async forwardMessage(input: {
    chatId: bigint;
    fromChatId: bigint;
    messageId: number;
    token: string | undefined;
  }): Promise<{
    readonly ok: boolean;
    readonly messageId?: number;
    readonly photoFileId?: string;
  }> {
    if (!input.token) return { ok: false };
    try {
      const mensaje = await this.telegramJson<{
        message_id?: number;
        photo?: { file_id?: string; file_size?: number }[];
      }>(input.token, "forwardMessage", {
        chat_id: input.chatId.toString(),
        from_chat_id: input.fromChatId.toString(),
        message_id: input.messageId,
        disable_notification: true,
      });
      // Telegram lista las variantes de menor a mayor. La ultima es la grande,
      // que es la que se quiere archivar: quedarse con la primera guardaria una
      // miniatura ilegible.
      const variantes = mensaje.photo ?? [];
      const mayor = variantes[variantes.length - 1];
      return {
        ok: true,
        ...(mensaje.message_id !== undefined
          ? { messageId: mensaje.message_id }
          : {}),
        ...(mayor?.file_id !== undefined ? { photoFileId: mayor.file_id } : {}),
      };
    } catch {
      // Un mensaje borrado, un chat del que salio el bot, contenido protegido:
      // todo eso es "no se puede" y no un fallo del que reintentar.
      return { ok: false };
    }
  }

  async copyMessage({
    chatId,
    fromChatId,
    messageId,
    token,
    messageThreadId,
    replyMarkup,
  }: TelegramCopyMessageInput): Promise<TelegramSendMessageResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "copyMessage",
      payload: {
        chat_id: chatId.toString(),
        from_chat_id: fromChatId.toString(),
        message_id: messageId,
        ...(messageThreadId !== undefined
          ? { message_thread_id: messageThreadId }
          : {}),
        ...(replyMarkup !== undefined ? { reply_markup: replyMarkup } : {}),
      },
    });
    if (!outcome.ok) {
      return outcome;
    }
    // copyMessage devuelve un MessageId (solo `message_id`), no un Message
    // entero — de ahi que se lea igual que en sendPhotoByFileId pero sin dar
    // por hecho nada mas del cuerpo.
    const copiedId =
      typeof outcome.result === "object" &&
      outcome.result !== null &&
      typeof (outcome.result as { message_id?: unknown }).message_id ===
        "number"
        ? (outcome.result as { message_id: number }).message_id
        : undefined;
    return {
      ok: true,
      skipped: false,
      ...(copiedId !== undefined ? { messageId: copiedId } : {}),
    };
  }

  private async uploadMedia(
    {
      chatId,
      imageBase64,
      type,
      token,
      caption,
      replyMarkup,
      protectContent,
      messageThreadId,
    }: TelegramMediaInput,
    method: string,
    field: string,
  ): Promise<TelegramSendMessageResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const bytes = Buffer.from(imageBase64, "base64");
    const mime =
      type === "png"
        ? "image/png"
        : type === "jpg"
          ? "image/jpeg"
          : "image/webp";
    const form = new FormData();
    form.append("chat_id", chatId.toString());
    if (messageThreadId !== undefined) {
      form.append("message_thread_id", String(messageThreadId));
    }
    form.append(field, new Blob([bytes], { type: mime }), `quote.${type}`);
    if (caption !== undefined) {
      form.append("caption", caption);
    }
    if (replyMarkup !== undefined) {
      form.append("reply_markup", JSON.stringify(replyMarkup));
    }
    if (protectContent) {
      form.append("protect_content", "true");
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/${method}`,
      { method: "POST", body: form },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw await telegramFailure(method, response);
    }

    try {
      const body = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
      };
      const messageId = body.result?.message_id;
      return {
        ok: true,
        skipped: false,
        ...(messageId !== undefined ? { messageId } : {}),
      };
    } catch {
      // Send already succeeded (response.ok above) — just no usable message_id.
      return { ok: true, skipped: false };
    }
  }

  async getChatMember({
    chatId,
    userId,
    token,
  }: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatMemberResult> {
    // A getChatMember lookup can fail (400/403/timeout/429-exhausted). Callers
    // must be able to distinguish "definitely can't delete" (false) from "we
    // don't know" (undefined) WITHOUT catching exceptions, so a failure resolves
    // to { ok: false } (no status, canDeleteMessages absent -> undefined) rather
    // than throwing. Lenient by design: never treat a lookup error as proof.
    let outcome: TelegramGatewayResult & { result?: unknown };
    try {
      outcome = await this.callTelegramMethodForResult({
        token,
        method: "getChatMember",
        payload: { chat_id: chatId.toString(), user_id: userId.toString() },
      });
    } catch {
      return { ok: false, skipped: false };
    }

    if (!outcome.ok) {
      return outcome;
    }

    const member =
      typeof outcome.result === "object" && outcome.result !== null
        ? (outcome.result as {
            status?: unknown;
            can_delete_messages?: unknown;
            can_restrict_members?: unknown;
            can_send_messages?: unknown;
            can_send_photos?: unknown;
            can_send_other_messages?: unknown;
            can_add_web_page_previews?: unknown;
            custom_title?: unknown;
            until_date?: unknown;
            user?: {
              is_bot?: unknown;
              first_name?: unknown;
              last_name?: unknown;
              username?: unknown;
              language_code?: unknown;
            };
          })
        : {};
    const status =
      typeof member.status === "string" ? member.status : undefined;
    const isBot =
      typeof member.user?.is_bot === "boolean" ? member.user.is_bot : undefined;
    // Tri-state can_delete_messages for the bot's OWN rights:
    //  - creator/owner        -> true  (can always delete)
    //  - administrator        -> the explicit flag (true/false); a missing flag
    //                            is an incomplete response -> undefined (unknown)
    //  - member/restricted/
    //    left/kicked          -> false (definitively cannot delete)
    //  - unknown/missing status or non-ok response -> undefined (unknown)
    // The caller treats undefined as "don't act, don't cry missing-permission".
    const canDeleteMessages: boolean | undefined = (() => {
      switch (status) {
        case "creator":
          return true;
        case "administrator":
          return typeof member.can_delete_messages === "boolean"
            ? member.can_delete_messages
            : undefined;
        case "member":
        case "restricted":
        case "left":
        case "kicked":
          return false;
        default:
          return undefined;
      }
    })();

    // Same tri-state, same reasoning, different right.
    const canRestrictMembers: boolean | undefined = (() => {
      switch (status) {
        case "creator":
          return true;
        case "administrator":
          return typeof member.can_restrict_members === "boolean"
            ? member.can_restrict_members
            : undefined;
        case "member":
        case "restricted":
        case "left":
        case "kicked":
          return false;
        default:
          return undefined;
      }
    })();

    const str = (value: unknown): string | undefined =>
      typeof value === "string" && value.length > 0 ? value : undefined;
    // Only a `restricted` member carries per-member permission flags. For
    // everyone else Telegram omits them, and absent must stay "unknown": a
    // plain member inherits the group's defaults, which this call cannot see.
    const flag = (value: unknown): boolean | undefined =>
      status === "restricted" && typeof value === "boolean"
        ? value
        : status === "creator" || status === "administrator"
          ? true
          : undefined;
    // until_date 0 (or absent) means "forever", not "expired at the epoch".
    const restrictedUntil =
      typeof member.until_date === "number" && member.until_date > 0
        ? new Date(member.until_date * 1000)
        : undefined;

    const crudo =
      typeof outcome.result === "object" && outcome.result !== null
        ? (outcome.result as Record<string, unknown>)
        : {};
    const canBeEdited =
      typeof crudo.can_be_edited === "boolean"
        ? crudo.can_be_edited
        : undefined;
    // Se recogen las claves por su forma y no por una lista escrita a mano,
    // justo para que un permiso que Telegram añada mañana viaje solo. Se cae
    // `can_be_edited` porque no es un poder SUYO —es si nosotros mandamos sobre
    // el— y `promoteChatMember` lo rechaza.
    const adminRights: Record<string, boolean> = {};
    if (status === "administrator") {
      for (const [clave, valor] of Object.entries(crudo)) {
        if (
          typeof valor === "boolean" &&
          clave !== "can_be_edited" &&
          (clave.startsWith("can_") || clave === "is_anonymous")
        ) {
          adminRights[clave] = valor;
        }
      }
    }

    return {
      ok: true,
      skipped: false,
      ...(status ? { status } : {}),
      ...(canDeleteMessages !== undefined ? { canDeleteMessages } : {}),
      ...(canRestrictMembers !== undefined ? { canRestrictMembers } : {}),
      ...(canBeEdited !== undefined ? { canBeEdited } : {}),
      ...(Object.keys(adminRights).length > 0 ? { adminRights } : {}),
      ...(isBot !== undefined ? { isBot } : {}),
      ...(str(member.user?.first_name)
        ? { firstName: str(member.user?.first_name) as string }
        : {}),
      ...(str(member.user?.last_name)
        ? { lastName: str(member.user?.last_name) as string }
        : {}),
      ...(str(member.user?.username)
        ? { username: str(member.user?.username) as string }
        : {}),
      ...(str(member.user?.language_code)
        ? { languageCode: str(member.user?.language_code) as string }
        : {}),
      ...(str(member.custom_title)
        ? { customTitle: str(member.custom_title) as string }
        : {}),
      ...(flag(member.can_send_messages) !== undefined
        ? { canSendMessages: flag(member.can_send_messages) as boolean }
        : {}),
      ...(flag(member.can_send_photos) !== undefined
        ? { canSendMedia: flag(member.can_send_photos) as boolean }
        : {}),
      ...(flag(member.can_send_other_messages) !== undefined
        ? { canSendLinks: flag(member.can_send_other_messages) as boolean }
        : {}),
      ...(flag(member.can_add_web_page_previews) !== undefined
        ? {
            canAddWebPagePreviews: flag(
              member.can_add_web_page_previews,
            ) as boolean,
          }
        : {}),
      ...(restrictedUntil ? { restrictedUntil } : {}),
    };
  }

  async setChatMenuButton(input: {
    url: string;
    text: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    // No chat_id -> sets the DEFAULT menu button for all private chats.
    return this.callTelegramMethod({
      token: input.token,
      method: "setChatMenuButton",
      payload: {
        menu_button: {
          type: "web_app",
          text: input.text,
          web_app: { url: input.url },
        },
      },
    });
  }

  async downloadFile(input: {
    fileId: string;
    token: string | undefined;
  }): Promise<Buffer | null> {
    if (!input.token) return null;
    const info = await this.telegramJson<{ file_path?: string }>(
      input.token,
      "getFile",
      { file_id: input.fileId },
    ).catch(() => null);
    const ruta = info?.file_path;
    if (!ruta) return null;

    // El host de descarga es OTRO distinto del de la API: los ficheros salen
    // por /file/bot<token>/<ruta>, no por /bot<token>/<metodo>.
    const respuesta = await fetch(
      `https://api.telegram.org/file/bot${input.token}/${ruta}`,
      { signal: conTope(TIMEOUT_DESCARGA_MS) },
    );
    if (!respuesta.ok) return null;
    return Buffer.from(await respuesta.arrayBuffer());
  }

  async setMyCommands(input: {
    commands: readonly { command: string; description: string }[];
    token: string | undefined;
    scope?: TelegramCommandScope;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token: input.token,
      method: "setMyCommands",
      payload: {
        commands: input.commands,
        // Se omite si no lo piden: mandar `scope` explicito con `default`
        // hace lo mismo, pero enviarlo solo cuando importa deja claro en el
        // log de red que hay dos listas y no una repetida.
        ...(input.scope ? { scope: input.scope } : {}),
      },
    });
  }

  async setMyDescription(input: {
    description: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token: input.token,
      method: "setMyDescription",
      payload: { description: input.description },
    });
  }

  async setMyShortDescription(input: {
    shortDescription: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token: input.token,
      method: "setMyShortDescription",
      payload: { short_description: input.shortDescription },
    });
  }

  private async callTelegramMethod(input: {
    readonly token: string | undefined;
    readonly method: string;
    readonly payload: Record<string, unknown>;
  }): Promise<TelegramGatewayResult> {
    if (!input.token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${input.token}/${input.method}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input.payload),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      // Surfacing Telegram's own description (rather than a bare status code)
      // is what exposed the Guardian `web_app_url` shape bug; telegramFailure
      // now applies that same treatment to every send path.
      throw await telegramFailure(input.method, response);
    }

    return { ok: true, skipped: false };
  }

  private async callTelegramMethodForResult(input: {
    readonly token: string | undefined;
    readonly method: string;
    readonly payload: Record<string, unknown>;
  }): Promise<TelegramGatewayResult & { result?: unknown }> {
    if (!input.token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${input.token}/${input.method}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input.payload),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram ${input.method} failed with status ${response.status}`,
      );
    }

    try {
      const body = (await response.json()) as {
        ok?: unknown;
        result?: unknown;
      };
      return { ok: true, skipped: false, result: body.result };
    } catch {
      // A 2xx whose body isn't parseable JSON (Telegram or an intermediary proxy
      // returning success with an empty/garbled body). response.ok already
      // confirmed the call itself succeeded, so degrade to success-without-result
      // exactly like sendMessage/getChatMember do — never throw. Throwing here was
      // caught by callers like sendDice as if the whole action had FAILED, so a
      // dice roll that Telegram actually launched got the stake refunded and the
      // user told the animation "could not be launched".
      return { ok: true, skipped: false };
    }
  }
}
