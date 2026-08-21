export type ContactRequestInput = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

export type ContactRequestResponse = {
  message: string;
  id: string;
};
