import type {
  AdminSystemStatus,
  StoreContent,
  StoreSettingsInput,
} from "../models/store";

export interface StoreSettingsRepository {
  getSettings(token: string): Promise<StoreContent>;
  updateSettings(
    input: StoreSettingsInput,
    token: string,
  ): Promise<StoreContent>;
  getSystemStatus(token: string): Promise<AdminSystemStatus>;
}
