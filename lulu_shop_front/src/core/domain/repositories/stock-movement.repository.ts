import type {
  StockMovementFilters,
  StockMovementPage,
} from "../models/stock-movement";

export interface StockMovementRepository {
  list(
    filters: StockMovementFilters,
    token: string,
  ): Promise<StockMovementPage>;
}
