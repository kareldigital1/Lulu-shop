import type {
  CustomerDetails,
  CustomerFilters,
  CustomerPage,
} from "../../domain/models/customer";
import type { CustomerRepository } from "../../domain/repositories/customer.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async list(filters: CustomerFilters, token: string): Promise<CustomerPage> {
    return this.datasource.getAdminCustomers(filters, token);
  }

  async getDetails(id: string, token: string): Promise<CustomerDetails> {
    return this.datasource.getAdminCustomerDetails(id, token);
  }
}
