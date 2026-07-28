import type { AdminRole, Permission } from "@ai-art-platform/domain";

/**
 * The only representation of "who is calling" that Guards/Controllers may
 * trust — always derived from the Session's `admin_user_id`, never from a
 * client-supplied `tenantId`/`role` in a Body, Query, or Header (section 9).
 */
export interface AuthenticatedAdminContext {
  sessionId: string;
  csrfTokenHash: string;
  adminId: string;
  tenantId: string | null;
  tenantKey: string | null;
  email: string;
  name: string;
  role: AdminRole;
  permissions: readonly Permission[];
}
