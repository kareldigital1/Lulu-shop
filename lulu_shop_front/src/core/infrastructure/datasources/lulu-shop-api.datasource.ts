import type {
  AdminLoginInput,
  AdminLoginResponse,
  ProductMutationInput,
  ProductRestockInput,
} from "../../domain/models/admin";
import type {
  AdminNotification,
  AdminNotificationCenter,
} from "../../domain/models/admin-notification";
import type {
  BackupDownload,
  BackupFormat,
} from "../../domain/models/backup";
import type {
  AuditEventFilters,
  AuditEventPage,
} from "../../domain/models/audit-event";
import type {
  StockMovementFilters,
  StockMovementPage,
} from "../../domain/models/stock-movement";
import type { ContactRequestInput, ContactRequestResponse } from "../../domain/models/contact-request";
import type {
  CustomerDetails,
  CustomerFilters,
  CustomerPage,
} from "../../domain/models/customer";
import type { AdminDashboardStats } from "../../domain/models/dashboard";
import type {
  AdminOrderUpdateInput,
  CreateOrderInput,
  Order,
  OrderDocumentDownload,
  OrderFilters,
  OrderPage,
} from "../../domain/models/order";
import type { Product } from "../../domain/models/product";
import type { ProductCategory } from "../../domain/models/category";
import type {
  AdminSystemStatus,
  StoreContent,
  StoreSettingsInput,
} from "../../domain/models/store";
import { mapProductDto } from "../dtos/product.dto";
import { mapOrderDto } from "../dtos/order.dto";
import { mapStoreContentDto } from "../dtos/store.dto";
import {
  requestManager,
  resolveApiAssetUrl,
  toApiAssetReference,
} from "../http/request-manager";

function toApiProductPayload(input: Partial<ProductMutationInput>) {
  return {
    ...input,
    image: input.image ? toApiAssetReference(input.image) : input.image,
    variants: input.variants?.map((variant) => ({
      ...variant,
      images: variant.images.map(toApiAssetReference),
    })),
  };
}

function readDownloadFileName(
  contentDisposition: string | undefined,
  fallback: string,
) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1]?.trim() || fallback;
}

export class LuluShopApiDatasource {
  async getHomepageContent(): Promise<StoreContent> {
    const response = await requestManager.get<StoreContent>("/api/store/homepage");
    return mapStoreContentDto(response.data);
  }

  async getAdminStoreSettings(token: string): Promise<StoreContent> {
    const response = await requestManager.get<StoreContent>("/api/admin/store", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return mapStoreContentDto(response.data);
  }

  async updateAdminStoreSettings(
    input: StoreSettingsInput,
    token: string,
  ): Promise<StoreContent> {
    const payload = {
      ...input,
      logoUrl: input.logoUrl ? toApiAssetReference(input.logoUrl) : "",
      faviconUrl: input.faviconUrl ? toApiAssetReference(input.faviconUrl) : "",
      heroImageUrl: input.heroImageUrl
        ? toApiAssetReference(input.heroImageUrl)
        : "",
      openGraphImageUrl: input.openGraphImageUrl
        ? toApiAssetReference(input.openGraphImageUrl)
        : "",
      pdfSettings: {
        ...input.pdfSettings,
        logoUrl: input.pdfSettings.logoUrl
          ? toApiAssetReference(input.pdfSettings.logoUrl)
          : "",
      },
    };
    const response = await requestManager.patch<StoreContent>(
      "/api/admin/store",
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return mapStoreContentDto(response.data);
  }

  async getAdminSystemStatus(token: string): Promise<AdminSystemStatus> {
    const response = await requestManager.get<AdminSystemStatus>(
      "/api/admin/system/status",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  }

  async getProducts(): Promise<Product[]> {
    const response = await requestManager.get<Product[]>("/api/products");
    return response.data.map(mapProductDto);
  }

  async createContactRequest(input: ContactRequestInput): Promise<ContactRequestResponse> {
    const response = await requestManager.post<ContactRequestResponse>("/api/contact-requests", input);
    return response.data;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const response = await requestManager.post<Order>("/api/orders", input);
    return mapOrderDto(response.data);
  }

  async loginAdmin(input: AdminLoginInput): Promise<AdminLoginResponse> {
    const response = await requestManager.post<AdminLoginResponse>("/api/auth/login", input);
    return response.data;
  }

  async logoutAdmin(token: string): Promise<void> {
    await requestManager.post(
      "/api/auth/logout",
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  async getAdminAuditEvents(
    filters: AuditEventFilters,
    token: string,
  ): Promise<AuditEventPage> {
    const response = await requestManager.get<AuditEventPage>(
      "/api/admin/audit-events",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
      },
    );
    return response.data;
  }

  async getAdminStockMovements(
    filters: StockMovementFilters,
    token: string,
  ): Promise<StockMovementPage> {
    const response = await requestManager.get<StockMovementPage>(
      "/api/admin/stock-movements",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
      },
    );
    return response.data;
  }

  async getAdminProducts(token: string): Promise<Product[]> {
    const response = await requestManager.get<Product[]>("/api/admin/products", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.map(mapProductDto);
  }

  async getAdminCategories(token: string): Promise<ProductCategory[]> {
    const response = await requestManager.get<ProductCategory[]>(
      "/api/admin/categories",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async getAdminDashboard(token: string): Promise<AdminDashboardStats> {
    const response = await requestManager.get<AdminDashboardStats>(
      "/api/admin/dashboard",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async getAdminNotifications(
    token: string,
  ): Promise<AdminNotificationCenter> {
    const response = await requestManager.get<AdminNotificationCenter>(
      "/api/admin/notifications",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async readAdminNotification(
    id: string,
    token: string,
  ): Promise<AdminNotification> {
    const response = await requestManager.patch<AdminNotification>(
      `/api/admin/notifications/${id}/read`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async unreadAdminNotification(
    id: string,
    token: string,
  ): Promise<AdminNotification> {
    const response = await requestManager.patch<AdminNotification>(
      `/api/admin/notifications/${id}/unread`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async readAllAdminNotifications(
    token: string,
  ): Promise<{ updatedCount: number }> {
    const response = await requestManager.post<{ updatedCount: number }>(
      "/api/admin/notifications/read-all",
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async unreadAllAdminNotifications(
    token: string,
  ): Promise<{ updatedCount: number }> {
    const response = await requestManager.post<{ updatedCount: number }>(
      "/api/admin/notifications/unread-all",
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async deleteReadAdminNotifications(
    token: string,
  ): Promise<{ deletedCount: number }> {
    const response = await requestManager.delete<{ deletedCount: number }>(
      "/api/admin/notifications/read",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async downloadAdminBackup(
    format: BackupFormat,
    token: string,
  ): Promise<BackupDownload> {
    const response = await requestManager.get<Blob>(
      `/api/admin/backups/${format}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
        timeout: 5 * 60 * 1000,
      },
    );
    const extension = format === "mongodb" ? "zip" : "json";

    return {
      blob: response.data,
      fileName: readDownloadFileName(
        response.headers["content-disposition"],
        `tata-lulu-shop-backup.${extension}`,
      ),
    };
  }

  async getAdminOrders(
    filters: OrderFilters,
    token: string,
  ): Promise<OrderPage> {
    const response = await requestManager.get<OrderPage>("/api/admin/orders", {
      headers: { Authorization: `Bearer ${token}` },
      params: filters,
    });
    return {
      ...response.data,
      items: response.data.items.map(mapOrderDto),
    };
  }

  async getAdminCustomers(
    filters: CustomerFilters,
    token: string,
  ): Promise<CustomerPage> {
    const response = await requestManager.get<CustomerPage>(
      "/api/admin/customers",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
      },
    );
    return response.data;
  }

  async getAdminCustomerDetails(
    id: string,
    token: string,
  ): Promise<CustomerDetails> {
    const response = await requestManager.get<CustomerDetails>(
      `/api/admin/customers/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return {
      ...response.data,
      orders: response.data.orders.map(mapOrderDto),
    };
  }

  async updateAdminOrder(
    id: string,
    input: AdminOrderUpdateInput,
    token: string,
  ): Promise<Order> {
    const response = await requestManager.patch<Order>(
      `/api/admin/orders/${id}`,
      input,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapOrderDto(response.data);
  }

  async confirmAdminOrder(id: string, token: string): Promise<Order> {
    const response = await requestManager.post<Order>(
      `/api/admin/orders/${id}/confirm`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapOrderDto(response.data);
  }

  async cancelAdminOrder(id: string, token: string): Promise<Order> {
    const response = await requestManager.post<Order>(
      `/api/admin/orders/${id}/cancel`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapOrderDto(response.data);
  }

  async completeAdminOrder(id: string, token: string): Promise<Order> {
    const response = await requestManager.post<Order>(
      `/api/admin/orders/${id}/complete`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapOrderDto(response.data);
  }

  async generateAdminOrderPurchaseOrder(
    id: string,
    token: string,
  ): Promise<Order> {
    const response = await requestManager.post<Order>(
      `/api/admin/orders/${id}/purchase-order`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapOrderDto(response.data);
  }

  async downloadAdminOrderPurchaseOrder(
    id: string,
    token: string,
  ): Promise<OrderDocumentDownload> {
    const response = await requestManager.get<Blob>(
      `/api/admin/orders/${id}/purchase-order`,
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      },
    );

    return {
      blob: response.data,
      fileName: readDownloadFileName(
        response.headers["content-disposition"],
        `bon-de-commande-${id}.pdf`,
      ),
    };
  }

  async createAdminProduct(input: ProductMutationInput, token: string): Promise<Product> {
    const response = await requestManager.post<Product>(
      "/api/admin/products",
      toApiProductPayload(input),
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapProductDto(response.data);
  }

  async updateAdminProduct(id: string, input: Partial<ProductMutationInput>, token: string): Promise<Product> {
    const response = await requestManager.patch<Product>(
      `/api/admin/products/${id}`,
      toApiProductPayload(input),
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapProductDto(response.data);
  }

  async restockAdminProduct(
    id: string,
    input: ProductRestockInput,
    token: string,
  ): Promise<Product> {
    const response = await requestManager.post<Product>(
      `/api/admin/products/${id}/restock`,
      input,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return mapProductDto(response.data);
  }

  async deleteAdminProduct(id: string, token: string): Promise<void> {
    await requestManager.delete(`/api/admin/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async uploadAdminProductImage(file: File, token: string): Promise<string> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await requestManager.post<{ image: string }>(
      "/api/admin/uploads",
      formData,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return resolveApiAssetUrl(response.data.image);
  }
}
