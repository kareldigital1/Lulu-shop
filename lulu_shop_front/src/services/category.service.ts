import { categoryRepository } from "@/lib/container";

export async function fetchAdminCategories(token: string) {
  return categoryRepository.list(token);
}
