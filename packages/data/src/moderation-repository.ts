// `Prisma` entra como VALOR, no solo como tipo: se usa
// `Prisma.PrismaClientKnownRequestError` en un `instanceof` para distinguir el
// choque del indice unico de un fallo de verdad.

import type { PrismaClient, SanctionKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ModerationRecordInput {
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly actorUserId: string | undefined;
  readonly subjectTelegramUserId: bigint;
  readonly reason: string | undefined;
}

export interface CreateWarningInput extends ModerationRecordInput {
  readonly weight?: number;
  /**
   * Clave para que un reintento no cree el aviso dos veces.
   *
   * Aqui importa mas que en una sancion suelta, y el motivo es la **escalada**:
   * el handler cuenta los avisos activos justo despues de crear este y, al
   * llegar a `warnLimit` (3 por defecto), banea o silencia solo. El tope de
   * reintentos del poller son **3**, el mismo numero. Asi que un unico
   * `/warn` reprocesado tres veces podia acabar en expulsion automatica.
   *
   * La ironia era que la sancion de la escalada SI estaba protegida: se cerro
   * el efecto y se dejo suelto el contador que lo dispara.
   *
   * Opcional: sin ella el comportamiento es el de siempre. **Tiene que ser
   * determinista** — derivala del `updateId`, que es lo unico que Telegram
   * garantiza igual entre entregas del mismo update.
   */
  readonly claveIdempotencia?: string;
}

/**
 * El cargo de un administrador, guardado para devolverselo despues.
 *
 * Existe porque restringir a un admin nombrado por el bot lo DEGRADA: Telegram
 * no tiene "silenciar sin quitar el cargo". Se guarda antes de la mordaza y se
 * replica tal cual al levantarla.
 *
 * `rights` viaja en la forma de Telegram (`can_pin_messages`…) a proposito: se
 * le pasa entero a `promoteChatMember` sin traducir, asi que un permiso nuevo
 * de la Bot API viaja solo. Traducirlo a nombres nuestros seria justo lo que
 * haria que un dia se devolviera menos poder del que habia.
 */
export interface CargoGuardado {
  readonly rights: Readonly<Record<string, boolean>>;
  readonly titulo?: string;
}

export interface CreateSanctionInput extends ModerationRecordInput {
  readonly kind: SanctionKind;
  readonly endsAt?: Date;
  readonly telegramChatId?: bigint;
  /**
   * El cargo que el objetivo pierde al aplicarse esta sancion, si lo tenia.
   *
   * Se guarda en el `payload` de la propia sancion y no en una tabla aparte
   * porque asi el respaldo vive y muere con lo que lo causo: no puede quedarse
   * huerfano, no hay que limpiarlo, y al revertir ya se sabe donde mirar.
   */
  readonly cargoGuardado?: CargoGuardado;
  /**
   * Clave para que un reintento no cree la sancion dos veces.
   *
   * Opcional: sin ella el comportamiento es exactamente el de siempre. Con
   * ella, el mismo (kind, clave) crea UNA sancion aunque el update se
   * reprocese, y las llamadas siguientes devuelven el resultado de la primera.
   *
   * **Tiene que ser determinista.** Derivala del `updateId`, que es lo unico
   * que Telegram garantiza igual entre entregas del mismo update; con un
   * aleatorio o con el reloj no protege de nada.
   */
  readonly claveIdempotencia?: string;
}

export interface ModerationRecordResult {
  readonly caseId: string;
  readonly caseNumber: number;
  readonly recordId: string;
  readonly subjectUserId: string;
}

export interface RevertSanctionsInput {
  readonly tenantId: string;
  readonly subjectTelegramUserId: bigint;
  readonly kind: SanctionKind;
}

/**
 * Lo mismo que revertir, mas el grupo.
 *
 * El grupo va aparte y no en `RevertSanctionsInput` porque aquella consulta
 * **no filtra por chat** —revierte en todo el tenant— y cambiarlo ahora seria
 * otro arreglo, con su propio riesgo. Pero un cargo SI es de un grupo concreto:
 * devolver en el grupo B los permisos que alguien tenia en el A es repartir
 * poder que nadie le dio. Asi que aqui se filtra aunque alli no.
 */
export interface LeerCargoInput extends RevertSanctionsInput {
  readonly telegramChatId?: bigint;
}

/**
 * A real, already-persisted moderation case, read back for report/analysis
 * commands (conflict clustering, hot users, etc.). `targetTelegramUserId` is
 * recovered from the case's own JSON payload, so no join is required.
 */
export interface ModerationCaseSummary {
  readonly caseId: string;
  readonly targetTelegramUserId: bigint | undefined;
  readonly reason: string | undefined;
  readonly createdAt: Date;
}

/** A single sanction's kind and current status, for the chat that owns its case. */
export interface ChatSanctionOutcome {
  readonly kind: SanctionKind;
  readonly status: string;
}

export interface ModerationRepository {
  createWarning(input: CreateWarningInput): Promise<ModerationRecordResult>;
  createSanction(input: CreateSanctionInput): Promise<ModerationRecordResult>;
  revertSanctions(input: RevertSanctionsInput): Promise<number>;
  /**
   * El cargo guardado en la sancion viva que se va a levantar, si lo hay.
   *
   * **Hay que llamarlo ANTES de `revertSanctions`**: mira solo las sanciones
   * `active`, que es lo que aquella deja de dejar. Al reves devuelve null
   * siempre y el cargo se pierde en silencio, que es el fallo que todo esto
   * viene a evitar.
   */
  leerCargoGuardado(input: LeerCargoInput): Promise<CargoGuardado | null>;
  listRecentCases(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<ModerationCaseSummary[]>;
  /**
   * Cuenta los warnings activos (sin `expiredAt`) de un usuario dentro de un
   * chat concreto, para modulos como trust-tiers que degradan el tier por
   * sanciones vigentes. 0 si el usuario no tiene AppUser o no hay warnings.
   */
  countActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number>;
  /**
   * Kind + status of recent sanctions tied to this chat's moderation cases,
   * for reports like reverted-actions-ranking. Two-step lookup (case ids for
   * the chat, then sanctions referencing those case ids) since `Sanction`
   * only carries a plain `caseId` string, not a Prisma relation.
   */
  listRecentSanctionsForChat(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<ChatSanctionOutcome[]>;
}

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

export class PrismaModerationRepository implements ModerationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  /**
   * Reserva la clave del aviso. Misma maquinaria que `reservarSancion` y
   * mismo razonamiento, en su propio espacio de claves para que avisar y
   * sancionar en el mismo update no se estorben.
   *
   * "Reservada y SIN resultado" significa que alguien reservo y murio antes de
   * crear el aviso — o sea que el aviso NO llego a existir— asi que se crea.
   * El caso que de verdad se cierra es el otro, que ademas es el frecuente: el
   * update muere DESPUES de crear el aviso, al contar, auditar o reiniciar el
   * contador, y entonces la reserva ya lleva su resultado.
   */
  private async reservarAviso(
    clave: string,
    input: CreateWarningInput,
  ): Promise<{ seguir: boolean; anterior?: ModerationRecordResult }> {
    try {
      await this.client.idempotencyKey.create({
        data: {
          tenantId: input.tenantId,
          namespace: "moderacion.aviso",
          key: clave,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { seguir: true };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }

    const reserva = await this.client.idempotencyKey.findUnique({
      where: { namespace_key: { namespace: "moderacion.aviso", key: clave } },
      select: { payload: true },
    });

    const anterior = reserva?.payload as ModerationRecordResult | null;
    return anterior?.recordId ? { seguir: false, anterior } : { seguir: true };
  }

  async createWarning(
    input: CreateWarningInput,
  ): Promise<ModerationRecordResult> {
    const clave = input.claveIdempotencia;
    if (clave) {
      const reserva = await this.reservarAviso(clave, input);
      if (!reserva.seguir && reserva.anterior) {
        return reserva.anterior;
      }
    }

    const subject = await this.ensureSubjectUser(input);
    const moderationCase = await this.createCase(input, subject.id);
    const warning = await this.client.warning.create({
      data: {
        tenantId: input.tenantId,
        userId: subject.id,
        caseId: moderationCase.id,
        weight: input.weight ?? 1,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    const resultado: ModerationRecordResult = {
      caseId: moderationCase.id,
      caseNumber: moderationCase.caseNumber,
      recordId: warning.id,
      subjectUserId: subject.id,
    };

    if (clave) {
      // El resultado va DESPUES de crear el aviso: es lo que convierte la
      // reserva en "esto ya se hizo" y lo que un reintento encuentra.
      await this.client.idempotencyKey
        .update({
          where: {
            namespace_key: { namespace: "moderacion.aviso", key: clave },
          },
          data: { payload: toJson(resultado) },
        })
        // Igual que en las sanciones: el aviso YA existe. Fallar aqui abortaria
        // el update y provocaria el reintento que este codigo evita.
        .catch(() => undefined);
    }

    return resultado;
  }

  /**
   * El espacio de claves de las sanciones dentro de `idempotency_keys`.
   *
   * Lleva el tipo de sancion dentro para que avisar y silenciar a la misma
   * persona en el mismo update sean dos efectos distintos, como lo son.
   */
  private claveDeSancion(input: CreateSanctionInput): string | undefined {
    return input.claveIdempotencia
      ? `${input.kind}:${input.claveIdempotencia}`
      : undefined;
  }

  /**
   * Reserva la clave antes de sancionar y decide si hay que seguir.
   *
   * El orden es reservar → sancionar → guardar el resultado en la reserva, y no
   * al reves, porque el indice unico de `idempotency_keys` es lo unico que
   * excluye sin carrera: comprobar-y-luego-escribir la tiene en medio y dos
   * reintentos concurrentes la encontrarian.
   *
   * De ahi salen tres situaciones, y la tercera es la que importa:
   *
   * - **Nadie reservo**: seguimos y sancionamos.
   * - **Reservada y CON resultado**: la sancion ya se aplico. Se devuelve
   *   aquel resultado y no se crea otra.
   * - **Reservada y SIN resultado**: alguien reservo y murio antes de
   *   sancionar. No sabemos si llego a aplicarse, y aqui **se sanciona igual**.
   *   Es deliberado y es lo contrario que en economia: con dinero, no pagar de
   *   mas vale mas que no pagar; con una sancion, dejar suelto a quien habia
   *   que parar es peor que un apunte duplicado en el historial.
   */
  private async reservarSancion(
    clave: string,
    input: CreateSanctionInput,
  ): Promise<{ seguir: boolean; anterior?: ModerationRecordResult }> {
    try {
      await this.client.idempotencyKey.create({
        data: {
          tenantId: input.tenantId,
          namespace: "moderacion.sancion",
          key: clave,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { seguir: true };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }

    const reserva = await this.client.idempotencyKey.findUnique({
      where: { namespace_key: { namespace: "moderacion.sancion", key: clave } },
      select: { payload: true },
    });

    const anterior = reserva?.payload as ModerationRecordResult | null;
    return anterior?.recordId ? { seguir: false, anterior } : { seguir: true };
  }

  async createSanction(
    input: CreateSanctionInput,
  ): Promise<ModerationRecordResult> {
    const clave = this.claveDeSancion(input);
    if (clave) {
      const reserva = await this.reservarSancion(clave, input);
      if (!reserva.seguir && reserva.anterior) {
        return reserva.anterior;
      }
    }

    const subject = await this.ensureSubjectUser(input);
    const moderationCase = await this.createCase(input, subject.id);
    const sanction = await this.client.sanction.create({
      data: {
        tenantId: input.tenantId,
        userId: subject.id,
        caseId: moderationCase.id,
        kind: input.kind,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        payload: toJson({
          telegramUserId: input.subjectTelegramUserId.toString(),
          ...(input.telegramChatId
            ? { telegramChatId: input.telegramChatId.toString() }
            : {}),
          ...(input.cargoGuardado
            ? { cargoGuardado: input.cargoGuardado }
            : {}),
        }),
      },
    });

    const resultado: ModerationRecordResult = {
      caseId: moderationCase.id,
      caseNumber: moderationCase.caseNumber,
      recordId: sanction.id,
      subjectUserId: subject.id,
    };

    if (clave) {
      // El resultado se guarda DESPUES de sancionar: es lo que convierte la
      // reserva en "ya esta hecho" para el proximo intento. Si esto falla, la
      // sancion ya se aplico y un reintento la repetiria — feo, no grave, y
      // preferible a fallar toda la sancion por no poder anotarla.
      await this.client.idempotencyKey
        .update({
          where: {
            namespace_key: { namespace: "moderacion.sancion", key: clave },
          },
          data: { payload: toJson(resultado) },
        })
        .catch(() => undefined);
    }

    return resultado;
  }

  async leerCargoGuardado(
    input: LeerCargoInput,
  ): Promise<CargoGuardado | null> {
    const subject = await this.client.appUser.findUnique({
      where: { telegramUserId: input.subjectTelegramUserId },
    });
    if (!subject) {
      return null;
    }

    // Las vivas, de la mas nueva a la mas vieja: si alguien acumulo dos
    // mordazas, la que se levanta es la ultima y su cargo es el bueno. El de la
    // anterior ya estaba desfasado cuando se puso la segunda.
    const vivas = await this.client.sanction.findMany({
      where: {
        tenantId: input.tenantId,
        userId: subject.id,
        kind: input.kind,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // El chat se filtra aqui y no en el `where` porque vive dentro del JSON del
    // payload: son como mucho veinte filas y compararlas en memoria cuesta
    // menos que un indice sobre un campo JSON que solo usa esta consulta.
    const viva = vivas.find((fila) => {
      if (input.telegramChatId === undefined) {
        return true;
      }
      const suyo = (fila.payload as { telegramChatId?: unknown } | null)
        ?.telegramChatId;
      return suyo === input.telegramChatId.toString();
    });

    const guardado = (viva?.payload as { cargoGuardado?: unknown } | null)
      ?.cargoGuardado;
    if (typeof guardado !== "object" || guardado === null) {
      return null;
    }
    const { rights, titulo } = guardado as {
      rights?: unknown;
      titulo?: unknown;
    };
    if (typeof rights !== "object" || rights === null) {
      return null;
    }
    // Se filtra a booleanos: el payload es JSON libre y `promoteChatMember`
    // rechaza la llamada entera si le llega un campo que no es booleano.
    const limpios: Record<string, boolean> = {};
    for (const [clave, valor] of Object.entries(rights)) {
      if (typeof valor === "boolean") {
        limpios[clave] = valor;
      }
    }
    return {
      rights: limpios,
      ...(typeof titulo === "string" && titulo.length > 0 ? { titulo } : {}),
    };
  }

  async revertSanctions(input: RevertSanctionsInput): Promise<number> {
    const subject = await this.client.appUser.findUnique({
      where: { telegramUserId: input.subjectTelegramUserId },
    });

    if (!subject) {
      return 0;
    }

    const result = await this.client.sanction.updateMany({
      where: {
        tenantId: input.tenantId,
        userId: subject.id,
        kind: input.kind,
        status: "active",
      },
      data: { status: "reverted" },
    });

    return result.count;
  }

  async listRecentCases(
    tenantId: string,
    chatId: string,
    limit = 100,
  ): Promise<ModerationCaseSummary[]> {
    const cases = await this.client.moderationCase.findMany({
      where: { tenantId, chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return cases.map((moderationCase) => {
      const payload = moderationCase.payload as {
        subjectTelegramUserId?: string;
      } | null;
      const targetTelegramUserId = payload?.subjectTelegramUserId
        ? BigInt(payload.subjectTelegramUserId)
        : undefined;
      return {
        caseId: moderationCase.id,
        targetTelegramUserId,
        reason: moderationCase.reason ?? undefined,
        createdAt: moderationCase.createdAt,
      };
    });
  }

  async countActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number> {
    const subject = await this.client.appUser.findUnique({
      where: { telegramUserId: subjectTelegramUserId },
    });
    if (!subject) {
      return 0;
    }

    const cases = await this.client.moderationCase.findMany({
      where: { tenantId, chatId },
      select: { id: true },
    });
    const caseIds = cases.map((moderationCase) => moderationCase.id);
    if (caseIds.length === 0) {
      return 0;
    }

    return this.client.warning.count({
      where: {
        tenantId,
        userId: subject.id,
        expiredAt: null,
        caseId: { in: caseIds },
      },
    });
  }

  async listRecentSanctionsForChat(
    tenantId: string,
    chatId: string,
    limit = 100,
  ): Promise<ChatSanctionOutcome[]> {
    const cases = await this.client.moderationCase.findMany({
      where: { tenantId, chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true },
    });
    const caseIds = cases.map((moderationCase) => moderationCase.id);
    if (caseIds.length === 0) {
      return [];
    }

    const sanctions = await this.client.sanction.findMany({
      where: { tenantId, caseId: { in: caseIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { kind: true, status: true },
    });
    return sanctions.map((sanction) => ({
      kind: sanction.kind,
      status: sanction.status,
    }));
  }

  private async ensureSubjectUser(input: ModerationRecordInput) {
    const existing = await this.client.appUser.findUnique({
      where: { telegramUserId: input.subjectTelegramUserId },
    });

    if (existing) {
      return this.client.appUser.update({
        where: { id: existing.id },
        data: {
          tenantId: existing.tenantId ?? input.tenantId,
        },
      });
    }

    return this.client.appUser.create({
      data: {
        tenantId: input.tenantId,
        telegramUserId: input.subjectTelegramUserId,
      },
    });
  }

  private async createCase(
    input: ModerationRecordInput,
    subjectUserId: string,
  ) {
    const latest = await this.client.moderationCase.aggregate({
      where: { tenantId: input.tenantId },
      _max: { caseNumber: true },
    });
    const caseNumber = (latest._max.caseNumber ?? 0) + 1;
    const data: Prisma.ModerationCaseUncheckedCreateInput = {
      tenantId: input.tenantId,
      caseNumber,
      subjectUserId,
      status: "open",
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.chatId ? { chatId: input.chatId } : {}),
      payload: toJson({
        actorUserId: input.actorUserId,
        subjectTelegramUserId: input.subjectTelegramUserId.toString(),
      }),
    };

    return this.client.moderationCase.create({ data });
  }
}
