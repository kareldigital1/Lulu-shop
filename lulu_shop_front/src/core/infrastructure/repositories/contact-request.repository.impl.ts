import type { ContactRequestInput, ContactRequestResponse } from "../../domain/models/contact-request";
import type { ContactRequestRepository } from "../../domain/repositories/contact-request.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class ContactRequestRepositoryImpl implements ContactRequestRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async create(input: ContactRequestInput): Promise<ContactRequestResponse> {
    return this.datasource.createContactRequest(input);
  }
}
