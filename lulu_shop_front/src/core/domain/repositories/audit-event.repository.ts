import type {
  AuditEventFilters,
  AuditEventPage,
} from "../models/audit-event";

export interface AuditEventRepository {
  list(filters: AuditEventFilters, token: string): Promise<AuditEventPage>;
}
