import type {
  ProductMutationInput,
  ProductRestockInput,
} from "../../domain/models/admin";
import type { Product } from "../../domain/models/product";
import type { AdminProductRepository } from "../../domain/repositories/admin-product.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class AdminProductRepositoryImpl implements AdminProductRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async list(token: string): Promise<Product[]> {
    return this.datasource.getAdminProducts(token);
  }

  async create(input: ProductMutationInput, token: string): Promise<Product> {
    return this.datasource.createAdminProduct(input, token);
  }

  async update(
    id: string,
    input: Partial<ProductMutationInput>,
    token: string,
  ): Promise<Product> {
    return this.datasource.updateAdminProduct(id, input, token);
  }

  async restock(
    id: string,
    input: ProductRestockInput,
    token: string,
  ): Promise<Product> {
    return this.datasource.restockAdminProduct(id, input, token);
  }

  async remove(id: string, token: string): Promise<void> {
    return this.datasource.deleteAdminProduct(id, token);
  }

  async uploadImage(file: File, token: string): Promise<string> {
    return this.datasource.uploadAdminProductImage(file, token);
  }
}
