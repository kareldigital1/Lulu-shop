import type {
  AdminSystemStatus,
  StoreContent,
  StoreSettingsInput,
} from "../../domain/models/store";
import type { StoreSettingsRepository } from "../../domain/repositories/store-settings.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class StoreSettingsRepositoryImpl implements StoreSettingsRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async getSettings(token: string): Promise<StoreContent> {
    return this.datasource.getAdminStoreSettings(token);
  }

  async updateSettings(
    input: StoreSettingsInput,
    token: string,
  ): Promise<StoreContent> {
    return this.datasource.updateAdminStoreSettings(input, token);
  }

  async getSystemStatus(token: string): Promise<AdminSystemStatus> {
    return this.datasource.getAdminSystemStatus(token);
  }
}
