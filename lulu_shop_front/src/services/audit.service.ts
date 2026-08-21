import type { AuditEventFilters } from "@/core/domain/models/audit-event";
import { auditEventRepository } from "@/lib/container";

export function fetchAdminAuditEvents(
  filters: AuditEventFilters,
  token: string,
) {
  return auditEventRepository.list(filters, token);
}
