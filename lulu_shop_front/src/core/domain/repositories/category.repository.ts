import type { ProductCategory } from "../models/category";

export interface CategoryRepository {
  list(token: string): Promise<ProductCategory[]>;
}
