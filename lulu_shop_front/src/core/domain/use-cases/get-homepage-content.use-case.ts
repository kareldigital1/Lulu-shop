import type { StoreRepository } from "../repositories/store.repository";

export async function getHomepageContent(storeRepository: StoreRepository) {
  return storeRepository.getHomepageContent();
}
