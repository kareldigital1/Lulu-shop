import type { AdminLoginInput, AdminLoginResponse } from "../models/admin";

export interface AdminAuthRepository {
  login(input: AdminLoginInput): Promise<AdminLoginResponse>;
  logout(token: string): Promise<void>;
}
