import type {
  AdminOrderUpdateInput,
  CreateOrderInput,
  Order,
  OrderDocumentDownload,
  OrderFilters,
  OrderPage,
} from "../../domain/models/order";
import type { OrderRepository } from "../../domain/repositories/order.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class OrderRepositoryImpl implements OrderRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async create(input: CreateOrderInput): Promise<Order> {
    return this.datasource.createOrder(input);
  }

  async list(filters: OrderFilters, token: string): Promise<OrderPage> {
    return this.datasource.getAdminOrders(filters, token);
  }

  async update(
    id: string,
    input: AdminOrderUpdateInput,
    token: string,
  ): Promise<Order> {
    return this.datasource.updateAdminOrder(id, input, token);
  }

  async confirm(id: string, token: string): Promise<Order> {
    return this.datasource.confirmAdminOrder(id, token);
  }

  async cancel(id: string, token: string): Promise<Order> {
    return this.datasource.cancelAdminOrder(id, token);
  }

  async complete(id: string, token: string): Promise<Order> {
    return this.datasource.completeAdminOrder(id, token);
  }

  async generatePurchaseOrder(id: string, token: string): Promise<Order> {
    return this.datasource.generateAdminOrderPurchaseOrder(id, token);
  }

  async downloadPurchaseOrder(
    id: string,
    token: string,
  ): Promise<OrderDocumentDownload> {
    return this.datasource.downloadAdminOrderPurchaseOrder(id, token);
  }
}
