import type { Product } from "../models/product";

export interface ProductRepository {
  list(): Promise<Product[]>;
}
