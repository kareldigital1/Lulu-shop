import type { ContactRequestInput, ContactRequestResponse } from "../models/contact-request";

export interface ContactRequestRepository {
  create(input: ContactRequestInput): Promise<ContactRequestResponse>;
}
