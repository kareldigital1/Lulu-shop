import type { StockMovementFilters } from "@/core/domain/models/stock-movement";
import { stockMovementRepository } from "@/lib/container";

export function fetchAdminStockMovements(
  filters: StockMovementFilters,
  token: string,
) {
  return stockMovementRepository.list(filters, token);
}
