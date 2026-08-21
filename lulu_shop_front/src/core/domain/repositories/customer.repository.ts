import type {
  CustomerDetails,
  CustomerFilters,
  CustomerPage,
} from "../models/customer";

export interface CustomerRepository {
  list(filters: CustomerFilters, token: string): Promise<CustomerPage>;
  getDetails(id: string, token: string): Promise<CustomerDetails>;
}
