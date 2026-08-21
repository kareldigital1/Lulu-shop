import type {
  ProductMutationInput,
  ProductRestockInput,
} from "../models/admin";
import type { Product } from "../models/product";

export interface AdminProductRepository {
  list(token: string): Promise<Product[]>;
  create(input: ProductMutationInput, token: string): Promise<Product>;
  update(
    id: string,
    input: Partial<ProductMutationInput>,
    token: string,
  ): Promise<Product>;
  restock(
    id: string,
    input: ProductRestockInput,
    token: string,
  ): Promise<Product>;
  remove(id: string, token: string): Promise<void>;
  uploadImage(file: File, token: string): Promise<string>;
}
