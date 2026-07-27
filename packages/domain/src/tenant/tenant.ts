import { Entity } from "../entity.js";

import { TenantStatusTransitionError } from "./tenant-errors.js";
import type { TenantKey } from "./tenant-key.js";
import { canTransitionTenantStatus, type TenantStatus } from "./tenant-status.js";

export interface TenantProps {
  id: string;
  tenantKey: TenantKey;
  name: string;
  status: TenantStatus;
  timezone: string;
  defaultLocale: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  id: string;
  tenantKey: TenantKey;
  name: string;
  timezone?: string;
  defaultLocale?: string;
  now: Date;
}

export class Tenant extends Entity<string> {
  private props: TenantProps;

  private constructor(props: TenantProps) {
    super(props.id);
    this.props = props;
  }

  static create(input: CreateTenantInput): Tenant {
    return new Tenant({
      id: input.id,
      tenantKey: input.tenantKey,
      name: input.name,
      status: "ACTIVE",
      timezone: input.timezone ?? "Asia/Tokyo",
      defaultLocale: input.defaultLocale ?? "ja-JP",
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Rehydrates a Tenant from persisted state — never validates business rules. */
  static reconstitute(props: TenantProps): Tenant {
    return new Tenant(props);
  }

  get tenantKey(): TenantKey {
    return this.props.tenantKey;
  }

  get name(): string {
    return this.props.name;
  }

  get status(): TenantStatus {
    return this.props.status;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get defaultLocale(): string {
    return this.props.defaultLocale;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  rename(name: string, now: Date): void {
    this.props.name = name;
    this.props.updatedAt = now;
  }

  changeStatus(next: TenantStatus, now: Date): void {
    if (!canTransitionTenantStatus(this.props.status, next)) {
      throw new TenantStatusTransitionError(this.props.status, next);
    }
    this.props.status = next;
    this.props.updatedAt = now;
  }
}
