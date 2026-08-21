import type {
  AdminOrderUpdateInput,
  CreateOrderInput,
  OrderFilters,
} from "@/core/domain/models/order";
import { orderRepository } from "@/lib/container";

export function createOrder(input: CreateOrderInput) {
  return orderRepository.create(input);
}

export function fetchAdminOrders(filters: OrderFilters, token: string) {
  return orderRepository.list(filters, token);
}

export function updateAdminOrder(
  id: string,
  input: AdminOrderUpdateInput,
  token: string,
) {
  return orderRepository.update(id, input, token);
}

export function confirmAdminOrder(id: string, token: string) {
  return orderRepository.confirm(id, token);
}

export function cancelAdminOrder(id: string, token: string) {
  return orderRepository.cancel(id, token);
}

export function completeAdminOrder(id: string, token: string) {
  return orderRepository.complete(id, token);
}

export function generateAdminOrderPurchaseOrder(id: string, token: string) {
  return orderRepository.generatePurchaseOrder(id, token);
}

export function downloadAdminOrderPurchaseOrder(id: string, token: string) {
  return orderRepository.downloadPurchaseOrder(id, token);
}
