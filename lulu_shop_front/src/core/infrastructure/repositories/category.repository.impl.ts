import type { ProductCategory } from "../../domain/models/category";
import type { CategoryRepository } from "../../domain/repositories/category.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class CategoryRepositoryImpl implements CategoryRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async list(token: string): Promise<ProductCategory[]> {
    return this.datasource.getAdminCategories(token);
  }
}
