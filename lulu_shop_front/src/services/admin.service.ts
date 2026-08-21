import type {
  AdminLoginInput,
  ProductMutationInput,
  ProductRestockInput,
} from "@/core/domain/models/admin";
import { DEFAULT_CLOTHING_SIZE } from "@/core/domain/models/product";
import { adminAuthRepository, adminProductRepository } from "@/lib/container";

export async function loginAdmin(input: AdminLoginInput) {
  return adminAuthRepository.login(input);
}

export async function logoutAdmin(token: string) {
  return adminAuthRepository.logout(token);
}

export async function fetchAdminProducts(token: string) {
  return adminProductRepository.list(token);
}

export async function createAdminProduct(input: ProductMutationInput, token: string) {
  return adminProductRepository.create(input, token);
}

export async function updateAdminProduct(id: string, input: Partial<ProductMutationInput>, token: string) {
  return adminProductRepository.update(id, input, token);
}

export async function restockAdminProduct(
  id: string,
  input: ProductRestockInput,
  token: string,
) {
  return adminProductRepository.restock(id, input, token);
}

export async function deleteAdminProduct(id: string, token: string) {
  return adminProductRepository.remove(id, token);
}

export async function uploadAdminProductImage(file: File, token: string) {
  return adminProductRepository.uploadImage(file, token);
}

export function makeEmptyProductTemplate(): ProductMutationInput {
  return {
    slug: "",
    categoryId: "",
    category: "",
    types: [],
    name: "",
    shortDescription: "",
    description: "",
    benefits: [],
    priceLabel: "",
    priceAmount: null,
    promotionPrice: null,
    promotionStartAt: null,
    promotionEndAt: null,
    image: "",
    badge: "",
    whatsappMessage: "",
    featured: false,
    order: 0,
    variants: [
      {
        id: "default",
        colorName: "",
        colorHex: "#D8C4A3",
        images: [],
        sizes: [{ size: DEFAULT_CLOTHING_SIZE, stock: 0 }],
        stock: 0,
      },
    ],
    stock: 0,
    availability: "unavailable",
    status: "draft",
    isActive: false,
  };
}
