import type {
  AuditEventFilters,
  AuditEventPage,
} from "../../domain/models/audit-event";
import type { AuditEventRepository } from "../../domain/repositories/audit-event.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class AuditEventRepositoryImpl implements AuditEventRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async list(
    filters: AuditEventFilters,
    token: string,
  ): Promise<AuditEventPage> {
    return this.datasource.getAdminAuditEvents(filters, token);
  }
}
