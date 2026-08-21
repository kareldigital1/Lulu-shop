import type { ContactRequestInput } from "../models/contact-request";
import type { ContactRequestRepository } from "../repositories/contact-request.repository";

export async function sendContactRequest(
  contactRequestRepository: ContactRequestRepository,
  input: ContactRequestInput,
) {
  return contactRequestRepository.create(input);
}
