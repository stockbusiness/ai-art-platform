import { Prisma } from "@ai-art-platform/database";
import {
  PrimaryTenantDomainAlreadyExistsError,
  Tenant,
  TenantDomainAlreadyExistsError,
  TenantKeyAlreadyExistsError,
  type CreateTenantDomainInput,
  type TenantKey,
  type TenantRepository,
  type UpsertTenantSettingInput,
} from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

import { toCreateInput, toDomainTenant, toUpdateInput } from "./tenant.mapper.js";

function isUniqueConstraintViolation(error: unknown, constraintNameFragment: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.["target"];
  const targetText = Array.isArray(target)
    ? target.filter((item): item is string => typeof item === "string").join(",")
    : typeof target === "string"
      ? target
      : "";
  return targetText.includes(constraintNameFragment);
}

@Injectable()
export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.prisma.client.tenant.findUnique({ where: { id } });
    return row ? toDomainTenant(row) : null;
  }

  async findByTenantKey(tenantKey: TenantKey): Promise<Tenant | null> {
    const row = await this.prisma.client.tenant.findUnique({
      where: { tenantKey: tenantKey.toString() },
    });
    return row ? toDomainTenant(row) : null;
  }

  async create(tenant: Tenant): Promise<void> {
    try {
      await this.prisma.client.tenant.create({ data: toCreateInput(tenant) });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error, "tenant_key")) {
        throw new TenantKeyAlreadyExistsError(
          `Tenant key "${tenant.tenantKey.toString()}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(tenant: Tenant): Promise<void> {
    await this.prisma.client.tenant.update({
      where: { id: tenant.id },
      data: toUpdateInput(tenant),
    });
  }

  async addTenantDomain(input: CreateTenantDomainInput): Promise<void> {
    try {
      await this.prisma.client.tenantDomain.create({
        data: {
          tenantId: input.tenantId,
          host: input.host,
          isPrimary: input.isPrimary,
        },
      });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error, "host")) {
        throw new TenantDomainAlreadyExistsError(`Domain "${input.host}" already exists`);
      }
      // The Primary Domain constraint is a partial unique index added by
      // raw SQL in the migration (Prisma can't express it in schema.prisma
      // — see prisma/migrations/.../migration.sql), so Prisma reports its
      // violation against the bare column name "tenant_id", not a named
      // constraint or the "host" field.
      if (isUniqueConstraintViolation(error, "tenant_id")) {
        throw new PrimaryTenantDomainAlreadyExistsError(
          `Tenant ${input.tenantId} already has a primary domain`,
        );
      }
      throw error;
    }
  }

  async upsertTenantSetting(input: UpsertTenantSettingInput): Promise<void> {
    await this.prisma.client.tenantSetting.upsert({
      where: { tenantId_key: { tenantId: input.tenantId, key: input.key } },
      create: {
        tenantId: input.tenantId,
        key: input.key,
        valueJson: input.valueJson as Prisma.InputJsonValue,
        isSecret: input.isSecret,
      },
      update: {
        valueJson: input.valueJson as Prisma.InputJsonValue,
        isSecret: input.isSecret,
      },
    });
  }
}
