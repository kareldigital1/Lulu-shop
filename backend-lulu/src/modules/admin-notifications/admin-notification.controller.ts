import type { NextFunction, Request, Response } from "express";
import {
  deleteReadAdminNotifications,
  listAdminNotifications,
  markAdminNotificationRead,
  markAdminNotificationUnread,
  markAllAdminNotificationsRead,
  markAllAdminNotificationsUnread,
} from "./admin-notification.service";

export async function getAdminNotifications(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await listAdminNotifications(request.query));
  } catch (error) {
    next(error);
  }
}

export async function readAdminNotification(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(
      await markAdminNotificationRead(String(request.params.id)),
    );
  } catch (error) {
    next(error);
  }
}

export async function readAllAdminNotifications(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await markAllAdminNotificationsRead());
  } catch (error) {
    next(error);
  }
}

export async function unreadAdminNotification(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(
      await markAdminNotificationUnread(String(request.params.id)),
    );
  } catch (error) {
    next(error);
  }
}

export async function unreadAllAdminNotifications(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await markAllAdminNotificationsUnread());
  } catch (error) {
    next(error);
  }
}

export async function deleteReadNotifications(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await deleteReadAdminNotifications());
  } catch (error) {
    next(error);
  }
}
