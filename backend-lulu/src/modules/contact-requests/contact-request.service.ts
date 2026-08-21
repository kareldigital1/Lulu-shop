import { ContactRequestModel } from "./contact-request.model";

type CreateContactRequestInput = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

export async function createContactRequest(input: CreateContactRequestInput) {
  return ContactRequestModel.create({
    name: input.name,
    email: input.email,
    phone: input.phone ?? "",
    message: input.message,
  });
}
