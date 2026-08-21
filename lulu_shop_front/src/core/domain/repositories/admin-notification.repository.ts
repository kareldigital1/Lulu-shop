import type {
  AdminNotification,
  AdminNotificationCenter,
} from "../models/admin-notification";

export interface AdminNotificationRepository {
  list(token: string): Promise<AdminNotificationCenter>;
  markRead(id: string, token: string): Promise<AdminNotification>;
  markUnread(id: string, token: string): Promise<AdminNotification>;
  markAllRead(token: string): Promise<{ updatedCount: number }>;
  markAllUnread(token: string): Promise<{ updatedCount: number }>;
  deleteRead(token: string): Promise<{ deletedCount: number }>;
}
