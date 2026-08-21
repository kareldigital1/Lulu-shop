import type { BackupDownload, BackupFormat } from "../models/backup";

export interface BackupRepository {
  download(format: BackupFormat, token: string): Promise<BackupDownload>;
}
