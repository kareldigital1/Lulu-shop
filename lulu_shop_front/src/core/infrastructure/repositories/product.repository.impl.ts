import type { Product } from "../../domain/models/product";
import type { ProductRepository } from "../../domain/repositories/product.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class ProductRepositoryImpl implements ProductRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async list(): Promise<Product[]> {
    return this.datasource.getProducts();
  }
}
