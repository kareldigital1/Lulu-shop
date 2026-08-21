import type { ProductRepository } from "../repositories/product.repository";

export async function getProducts(productRepository: ProductRepository) {
  return productRepository.list();
}
