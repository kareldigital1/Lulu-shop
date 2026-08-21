import type {
  AdminLoginInput,
  AdminLoginResponse,
} from "../../domain/models/admin";
import type { AdminAuthRepository } from "../../domain/repositories/admin-auth.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class AdminAuthRepositoryImpl implements AdminAuthRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async login(input: AdminLoginInput): Promise<AdminLoginResponse> {
    return this.datasource.loginAdmin(input);
  }

  async logout(token: string): Promise<void> {
    return this.datasource.logoutAdmin(token);
  }
}
