import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * El historial de avatares de cada cuenta, y la deteccion de multicuenta que
 * sale de comparar hashes entre cuentas distintas. Nunca se guarda la foto en
 * si, solo su huella (`hash`): esta tabla no es un almacen de imagenes.
 */

export interface CoincidenciaDeAvatar {
  readonly telegramId: bigint;
  readonly hash: string;
  readonly detectadoEn: Date;
}

export interface AyudanteIdentidadRepository {
  /** Idempotente por `(telegramId, hash)`: ver el mismo avatar otra vez no duplica. */
  registrarAvatar(input: {
    readonly telegramId: bigint;
    readonly hash: string;
  }): Promise<void>;

  /** Otras cuentas que han tenido el mismo hash de avatar, excluyendo la propia. */
  buscarCoincidencias(input: {
    readonly telegramId: bigint;
    readonly hash: string;
  }): Promise<readonly CoincidenciaDeAvatar[]>;
}

export class AyudanteIdentidadRepositoryPrisma
  implements AyudanteIdentidadRepository
{
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async registrarAvatar(input: {
    readonly telegramId: bigint;
    readonly hash: string;
  }): Promise<void> {
    await this.prisma.ayudanteAvatarHash.upsert({
      where: {
        telegramId_hash: { telegramId: input.telegramId, hash: input.hash },
      },
      create: { telegramId: input.telegramId, hash: input.hash },
      update: {},
    });
  }

  async buscarCoincidencias(input: {
    readonly telegramId: bigint;
    readonly hash: string;
  }): Promise<readonly CoincidenciaDeAvatar[]> {
    return this.prisma.ayudanteAvatarHash.findMany({
      where: {
        hash: input.hash,
        telegramId: { not: input.telegramId },
      },
      select: { telegramId: true, hash: true, detectadoEn: true },
    });
  }
}
