import type { BackupFormat } from "@/core/domain/models/backup";
import { backupRepository } from "@/lib/container";

export async function downloadAdminBackup(
  format: BackupFormat,
  token: string,
) {
  return backupRepository.download(format, token);
}
