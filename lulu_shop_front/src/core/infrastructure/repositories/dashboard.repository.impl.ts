import type { AdminDashboardStats } from "../../domain/models/dashboard";
import type { DashboardRepository } from "../../domain/repositories/dashboard.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class DashboardRepositoryImpl implements DashboardRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async getStats(token: string): Promise<AdminDashboardStats> {
    return this.datasource.getAdminDashboard(token);
  }
}
