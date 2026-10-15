import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface OwnerNetworkEntitlementRecord {
  readonly plan: string;
  readonly maxChats: number;
  readonly premiumUntil: Date | null;
  readonly grantedByCode: string | null;
}

export type RedeemCodeResult =
  | { readonly ok: true; readonly entitlement: OwnerNetworkEntitlementRecord }
  | { readonly ok: false; readonly reason: "not-found" | "already-used" };

export interface EntitlementRepository {
  getEntitlement(fedId: string): Promise<OwnerNetworkEntitlementRecord>;
  generateCode(
    createdBy: string,
    plan: string,
    maxChats: number,
    days: number,
  ): Promise<string>;
  redeemCode(
    fedId: string,
    code: string,
    redeemedBy: string,
  ): Promise<RedeemCodeResult>;
  isOverChatLimit(fedId: string, currentChatCount: number): Promise<boolean>;
}

const DEFAULT_ENTITLEMENT: OwnerNetworkEntitlementRecord = {
  plan: "free",
  maxChats: 3,
  premiumUntil: null,
  grantedByCode: null,
};

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

export class PrismaEntitlementRepository implements EntitlementRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getEntitlement(fedId: string): Promise<OwnerNetworkEntitlementRecord> {
    const row = await this.client.ownerNetworkEntitlement.findUnique({
      where: { fedId },
    });
    return row
      ? {
          plan: row.plan,
          maxChats: row.maxChats,
          premiumUntil: row.premiumUntil,
          grantedByCode: row.grantedByCode,
        }
      : DEFAULT_ENTITLEMENT;
  }

  async generateCode(
    createdBy: string,
    plan: string,
    maxChats: number,
    days: number,
  ): Promise<string> {
    const code = randomUUID().replace(/-/gu, "");
    await this.client.ownerNetworkPremiumCode.create({
      data: { code, plan, maxChats, days, createdBy },
    });
    return code;
  }

  async redeemCode(
    fedId: string,
    code: string,
    redeemedBy: string,
  ): Promise<RedeemCodeResult> {
    return this.client.$transaction(async (tx) => {
      const found = await tx.ownerNetworkPremiumCode.findUnique({
        where: { code },
      });
      if (!found) {
        return { ok: false, reason: "not-found" } as const;
      }
      if (found.redeemedBy) {
        return { ok: false, reason: "already-used" } as const;
      }

      // Atomically claim the one-time code: only the transaction whose UPDATE
      // still matches the null `redeemedBy` wins. Under READ COMMITTED two
      // concurrent redemptions can both read `redeemedBy === null` above, so an
      // unguarded update (no `redeemedBy: null` filter) would grant a premium
      // entitlement TWICE from a single code — a real double-spend. The guarded
      // updateMany + count check closes that race, mirroring
      // ai-access-repository.redeemCode.
      const claimed = await tx.ownerNetworkPremiumCode.updateMany({
        where: { code, redeemedBy: null },
        data: { redeemedBy, redeemedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return { ok: false, reason: "already-used" } as const;
      }

      const premiumUntil = daysFromNow(found.days);
      const row = await tx.ownerNetworkEntitlement.upsert({
        where: { fedId },
        create: {
          tenantId: fedId,
          fedId,
          plan: found.plan,
          maxChats: found.maxChats,
          premiumUntil,
          grantedByCode: code,
        },
        update: {
          plan: found.plan,
          maxChats: found.maxChats,
          premiumUntil,
          grantedByCode: code,
        },
      });

      return {
        ok: true,
        entitlement: {
          plan: row.plan,
          maxChats: row.maxChats,
          premiumUntil: row.premiumUntil,
          grantedByCode: row.grantedByCode,
        },
      } as const;
    });
  }

  async isOverChatLimit(
    fedId: string,
    currentChatCount: number,
  ): Promise<boolean> {
    const entitlement = await this.getEntitlement(fedId);
    return currentChatCount > entitlement.maxChats;
  }
}

interface InMemoryCode {
  readonly code: string;
  readonly plan: string;
  readonly maxChats: number;
  readonly days: number;
  readonly createdBy: string;
  redeemedBy: string | null;
}

export class InMemoryEntitlementRepository implements EntitlementRepository {
  private readonly entitlements = new Map<
    string,
    OwnerNetworkEntitlementRecord
  >();
  private readonly codes = new Map<string, InMemoryCode>();

  async getEntitlement(fedId: string): Promise<OwnerNetworkEntitlementRecord> {
    return this.entitlements.get(fedId) ?? DEFAULT_ENTITLEMENT;
  }

  async generateCode(
    createdBy: string,
    plan: string,
    maxChats: number,
    days: number,
  ): Promise<string> {
    const code = randomUUID().replace(/-/gu, "");
    this.codes.set(code, {
      code,
      plan,
      maxChats,
      days,
      createdBy,
      redeemedBy: null,
    });
    return code;
  }

  async redeemCode(
    fedId: string,
    code: string,
    redeemedBy: string,
  ): Promise<RedeemCodeResult> {
    const found = this.codes.get(code);
    if (!found) {
      return { ok: false, reason: "not-found" };
    }
    if (found.redeemedBy) {
      return { ok: false, reason: "already-used" };
    }

    found.redeemedBy = redeemedBy;

    const entitlement: OwnerNetworkEntitlementRecord = {
      plan: found.plan,
      maxChats: found.maxChats,
      premiumUntil: daysFromNow(found.days),
      grantedByCode: code,
    };
    this.entitlements.set(fedId, entitlement);
    return { ok: true, entitlement };
  }

  async isOverChatLimit(
    fedId: string,
    currentChatCount: number,
  ): Promise<boolean> {
    const entitlement = await this.getEntitlement(fedId);
    return currentChatCount > entitlement.maxChats;
  }
}
