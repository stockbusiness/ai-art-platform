import { z } from "zod";

export const tenantStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

export type TenantStatusContract = z.infer<typeof tenantStatusSchema>;
