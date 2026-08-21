import type {
  AdminOrderUpdateInput,
  CreateOrderInput,
  Order,
  OrderDocumentDownload,
  OrderFilters,
  OrderPage,
} from "../models/order";

export interface OrderRepository {
  create(input: CreateOrderInput): Promise<Order>;
  list(filters: OrderFilters, token: string): Promise<OrderPage>;
  update(
    id: string,
    input: AdminOrderUpdateInput,
    token: string,
  ): Promise<Order>;
  confirm(id: string, token: string): Promise<Order>;
  cancel(id: string, token: string): Promise<Order>;
  complete(id: string, token: string): Promise<Order>;
  generatePurchaseOrder(id: string, token: string): Promise<Order>;
  downloadPurchaseOrder(
    id: string,
    token: string,
  ): Promise<OrderDocumentDownload>;
}
