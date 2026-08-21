/**
 * Composition root de l'application.
 *
 * C'est le seul endroit qui construit le datasource concret et le branche sur
 * les implémentations de repositories. Tout le reste du code ne dépend que des
 * interfaces déclarées dans core/domain/repositories.
 *
 * Le datasource n'est volontairement pas exporté : passer par un repository
 * garantit que la couche présentation ne connaît jamais le transport HTTP.
 */
import { LuluShopApiDatasource } from "@/core/infrastructure/datasources/lulu-shop-api.datasource";
import { AdminAuthRepositoryImpl } from "@/core/infrastructure/repositories/admin-auth.repository.impl";
import { AdminNotificationRepositoryImpl } from "@/core/infrastructure/repositories/admin-notification.repository.impl";
import { AdminProductRepositoryImpl } from "@/core/infrastructure/repositories/admin-product.repository.impl";
import { AuditEventRepositoryImpl } from "@/core/infrastructure/repositories/audit-event.repository.impl";
import { BackupRepositoryImpl } from "@/core/infrastructure/repositories/backup.repository.impl";
import { CategoryRepositoryImpl } from "@/core/infrastructure/repositories/category.repository.impl";
import { ContactRequestRepositoryImpl } from "@/core/infrastructure/repositories/contact-request.repository.impl";
import { CustomerRepositoryImpl } from "@/core/infrastructure/repositories/customer.repository.impl";
import { DashboardRepositoryImpl } from "@/core/infrastructure/repositories/dashboard.repository.impl";
import { OrderRepositoryImpl } from "@/core/infrastructure/repositories/order.repository.impl";
import { ProductRepositoryImpl } from "@/core/infrastructure/repositories/product.repository.impl";
import { StockMovementRepositoryImpl } from "@/core/infrastructure/repositories/stock-movement.repository.impl";
import { StoreRepositoryImpl } from "@/core/infrastructure/repositories/store.repository.impl";
import { StoreSettingsRepositoryImpl } from "@/core/infrastructure/repositories/store-settings.repository.impl";

import type { AdminAuthRepository } from "@/core/domain/repositories/admin-auth.repository";
import type { AdminNotificationRepository } from "@/core/domain/repositories/admin-notification.repository";
import type { AdminProductRepository } from "@/core/domain/repositories/admin-product.repository";
import type { AuditEventRepository } from "@/core/domain/repositories/audit-event.repository";
import type { BackupRepository } from "@/core/domain/repositories/backup.repository";
import type { CategoryRepository } from "@/core/domain/repositories/category.repository";
import type { ContactRequestRepository } from "@/core/domain/repositories/contact-request.repository";
import type { CustomerRepository } from "@/core/domain/repositories/customer.repository";
import type { DashboardRepository } from "@/core/domain/repositories/dashboard.repository";
import type { OrderRepository } from "@/core/domain/repositories/order.repository";
import type { ProductRepository } from "@/core/domain/repositories/product.repository";
import type { StockMovementRepository } from "@/core/domain/repositories/stock-movement.repository";
import type { StoreRepository } from "@/core/domain/repositories/store.repository";
import type { StoreSettingsRepository } from "@/core/domain/repositories/store-settings.repository";

const datasource = new LuluShopApiDatasource();

export const productRepository: ProductRepository = new ProductRepositoryImpl(datasource);
export const storeRepository: StoreRepository = new StoreRepositoryImpl(datasource);
export const contactRequestRepository: ContactRequestRepository =
  new ContactRequestRepositoryImpl(datasource);
export const adminAuthRepository: AdminAuthRepository = new AdminAuthRepositoryImpl(datasource);
export const adminProductRepository: AdminProductRepository =
  new AdminProductRepositoryImpl(datasource);
export const adminNotificationRepository: AdminNotificationRepository =
  new AdminNotificationRepositoryImpl(datasource);
export const auditEventRepository: AuditEventRepository = new AuditEventRepositoryImpl(datasource);
export const backupRepository: BackupRepository = new BackupRepositoryImpl(datasource);
export const categoryRepository: CategoryRepository = new CategoryRepositoryImpl(datasource);
export const customerRepository: CustomerRepository = new CustomerRepositoryImpl(datasource);
export const dashboardRepository: DashboardRepository = new DashboardRepositoryImpl(datasource);
export const orderRepository: OrderRepository = new OrderRepositoryImpl(datasource);
export const stockMovementRepository: StockMovementRepository =
  new StockMovementRepositoryImpl(datasource);
export const storeSettingsRepository: StoreSettingsRepository =
  new StoreSettingsRepositoryImpl(datasource);
