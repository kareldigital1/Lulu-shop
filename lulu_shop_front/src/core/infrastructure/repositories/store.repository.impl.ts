import type { StoreContent } from "../../domain/models/store";
import type { StoreRepository } from "../../domain/repositories/store.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class StoreRepositoryImpl implements StoreRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async getHomepageContent(): Promise<StoreContent> {
    return this.datasource.getHomepageContent();
  }
}
