import type {
  StockMovementFilters,
  StockMovementPage,
} from "../../domain/models/stock-movement";
import type { StockMovementRepository } from "../../domain/repositories/stock-movement.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class StockMovementRepositoryImpl implements StockMovementRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async list(
    filters: StockMovementFilters,
    token: string,
  ): Promise<StockMovementPage> {
    return this.datasource.getAdminStockMovements(filters, token);
  }
}
