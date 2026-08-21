import type { StoreSettingsInput } from "@/core/domain/models/store";
import { storeSettingsRepository } from "@/lib/container";

export function fetchAdminStoreSettings(token: string) {
  return storeSettingsRepository.getSettings(token);
}

export function updateAdminStoreSettings(
  input: StoreSettingsInput,
  token: string,
) {
  return storeSettingsRepository.updateSettings(input, token);
}

export function fetchAdminSystemStatus(token: string) {
  return storeSettingsRepository.getSystemStatus(token);
}
