import type {
  AdminNotification,
  AdminNotificationCenter,
} from "../../domain/models/admin-notification";
import type { AdminNotificationRepository } from "../../domain/repositories/admin-notification.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class AdminNotificationRepositoryImpl
  implements AdminNotificationRepository
{
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async list(token: string): Promise<AdminNotificationCenter> {
    return this.datasource.getAdminNotifications(token);
  }

  async markRead(id: string, token: string): Promise<AdminNotification> {
    return this.datasource.readAdminNotification(id, token);
  }

  async markUnread(id: string, token: string): Promise<AdminNotification> {
    return this.datasource.unreadAdminNotification(id, token);
  }

  async markAllRead(token: string): Promise<{ updatedCount: number }> {
    return this.datasource.readAllAdminNotifications(token);
  }

  async markAllUnread(token: string): Promise<{ updatedCount: number }> {
    return this.datasource.unreadAllAdminNotifications(token);
  }

  async deleteRead(token: string): Promise<{ deletedCount: number }> {
    return this.datasource.deleteReadAdminNotifications(token);
  }
}
