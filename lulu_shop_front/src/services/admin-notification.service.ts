import { adminNotificationRepository } from "@/lib/container";

export function fetchAdminNotifications(token: string) {
  return adminNotificationRepository.list(token);
}

export function readAdminNotification(id: string, token: string) {
  return adminNotificationRepository.markRead(id, token);
}

export function unreadAdminNotification(id: string, token: string) {
  return adminNotificationRepository.markUnread(id, token);
}

export function readAllAdminNotifications(token: string) {
  return adminNotificationRepository.markAllRead(token);
}

export function unreadAllAdminNotifications(token: string) {
  return adminNotificationRepository.markAllUnread(token);
}

export function deleteReadAdminNotifications(token: string) {
  return adminNotificationRepository.deleteRead(token);
}
