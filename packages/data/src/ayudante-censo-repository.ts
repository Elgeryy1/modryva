import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * El censo del ayudante: quien esta de verdad en el grupo, segun el userbot
 * (`channels.getParticipants`), no segun quien le ha escrito al bot alguna
 * vez. Y el historial de alias de cada uno, que el censo puede ver aunque la
 * persona este callada.
 */

export interface MiembroCensado {
  readonly chatId: string;
  readonly userTelegramId: bigint;
  readonly alias: string | null;
  readonly nombre: string | null;
  readonly ultimaConexionEn: Date | null;
}

export interface FilaCenso extends MiembroCensado {
  readonly id: string;
  readonly tenantId: string;
  readonly presente: boolean;
  readonly vistoEn: Date;
}

export interface FilaAlias {
  readonly alias: string | null;
  readonly detectadoEn: Date;
}

export interface AyudanteCensoRepository {
  /**
   * Aplica un censo nuevo del grupo: hace upsert de cada miembro visto (marca
   * `presente: true` y actualiza `vistoEn`), y marca `presente: false` a quien
   * estaba `presente` en el censo anterior y no aparece en este. No borra
   * ninguna fila: una salida silenciosa es un dato, no un olvido.
   *
   * Devuelve quienes se detectaron como salida silenciosa en esta pasada.
   */
  aplicarCenso(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly miembros: readonly MiembroCensado[];
  }): Promise<{ readonly salidasSilenciosas: readonly bigint[] }>;

  listarDelGrupo(
    tenantId: string,
    chatId: string,
  ): Promise<readonly FilaCenso[]>;

  /** Solo quienes siguen presentes y no tienen ninguna actividad conocida (se cruza con `member_activity_profiles` fuera de este repositorio). */
  listarPresentes(
    tenantId: string,
    chatId: string,
  ): Promise<readonly FilaCenso[]>;

  /**
   * Registra un alias si es distinto del ultimo conocido para esa persona en
   * ese grupo. Idempotente: llamarlo con el mismo alias repetidas veces no
   * añade filas.
   */
  registrarAliasSiCambio(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
    readonly alias: string | null;
  }): Promise<boolean>;

  historialDeAlias(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
  }): Promise<readonly FilaAlias[]>;
}

/**
 * Dos alias son el mismo si solo se diferencian en mayusculas: Telegram no las
 * distingue en un `@username`, y distintos clientes reportan al mismo miembro
 * como `@Fulano` o `@fulano` sin que nadie se haya cambiado nada. Comparar
 * exacto llenaba el historial de cambios que nunca ocurrieron, justo en la
 * tabla cuyo proposito es cazar a quien SI se cambia el nombre para escapar de
 * una sancion.
 *
 * Se compara normalizado y se guarda tal cual llego: lo que se escribe es lo
 * que Telegram dijo, y lo que se compara es lo que significa.
 */
const mismoAlias = (a: string | null, b: string | null): boolean => {
  if (a === null || b === null) return a === b;
  return a.toLowerCase() === b.toLowerCase();
};

export class AyudanteCensoRepositoryPrisma implements AyudanteCensoRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async aplicarCenso(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly miembros: readonly MiembroCensado[];
  }): Promise<{ readonly salidasSilenciosas: readonly bigint[] }> {
    const vistoEn = new Date();
    const vistosAhora = new Set(
      input.miembros.map((m) => m.userTelegramId.toString()),
    );

    const presentesAntes = await this.prisma.ayudanteCensoMiembro.findMany({
      where: { tenantId: input.tenantId, chatId: input.chatId, presente: true },
      select: { userTelegramId: true },
    });

    for (const miembro of input.miembros) {
      await this.prisma.ayudanteCensoMiembro.upsert({
        where: {
          tenantId_chatId_userTelegramId: {
            tenantId: input.tenantId,
            chatId: input.chatId,
            userTelegramId: miembro.userTelegramId,
          },
        },
        create: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          userTelegramId: miembro.userTelegramId,
          alias: miembro.alias,
          nombre: miembro.nombre,
          ultimaConexionEn: miembro.ultimaConexionEn,
          presente: true,
          vistoEn,
        },
        update: {
          alias: miembro.alias,
          nombre: miembro.nombre,
          ultimaConexionEn: miembro.ultimaConexionEn,
          presente: true,
          vistoEn,
        },
      });
    }

    const salidas = presentesAntes
      .map((fila) => fila.userTelegramId)
      .filter((id) => !vistosAhora.has(id.toString()));

    if (salidas.length > 0) {
      await this.prisma.ayudanteCensoMiembro.updateMany({
        where: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          userTelegramId: { in: salidas },
        },
        data: { presente: false },
      });
    }

    return { salidasSilenciosas: salidas };
  }

  async listarDelGrupo(
    tenantId: string,
    chatId: string,
  ): Promise<readonly FilaCenso[]> {
    return this.prisma.ayudanteCensoMiembro.findMany({
      where: { tenantId, chatId },
      orderBy: { vistoEn: "desc" },
    });
  }

  async listarPresentes(
    tenantId: string,
    chatId: string,
  ): Promise<readonly FilaCenso[]> {
    return this.prisma.ayudanteCensoMiembro.findMany({
      where: { tenantId, chatId, presente: true },
      orderBy: { vistoEn: "desc" },
    });
  }

  async registrarAliasSiCambio(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
    readonly alias: string | null;
  }): Promise<boolean> {
    const ultimo = await this.prisma.ayudanteAliasHistorial.findFirst({
      where: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        userTelegramId: input.userTelegramId,
      },
      orderBy: { detectadoEn: "desc" },
    });
    if (ultimo && mismoAlias(ultimo.alias, input.alias)) return false;

    await this.prisma.ayudanteAliasHistorial.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        userTelegramId: input.userTelegramId,
        alias: input.alias,
      },
    });
    return true;
  }

  async historialDeAlias(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
  }): Promise<readonly FilaAlias[]> {
    return this.prisma.ayudanteAliasHistorial.findMany({
      where: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        userTelegramId: input.userTelegramId,
      },
      orderBy: { detectadoEn: "asc" },
      select: { alias: true, detectadoEn: true },
    });
  }
}
