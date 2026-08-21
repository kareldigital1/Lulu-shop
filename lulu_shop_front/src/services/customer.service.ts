import type {
  CustomerFilters,
  CustomerPage,
  CustomerDetails,
} from "@/core/domain/models/customer";
import { customerRepository } from "@/lib/container";

export function fetchAdminCustomers(
  filters: CustomerFilters,
  token: string,
): Promise<CustomerPage> {
  return customerRepository.list(filters, token);
}

export function fetchAdminCustomerDetails(
  id: string,
  token: string,
): Promise<CustomerDetails> {
  return customerRepository.getDetails(id, token);
}
