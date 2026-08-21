import type { BackupDownload, BackupFormat } from "../../domain/models/backup";
import type { BackupRepository } from "../../domain/repositories/backup.repository";
import type { LuluShopApiDatasource } from "../datasources/lulu-shop-api.datasource";

export class BackupRepositoryImpl implements BackupRepository {
  constructor(private readonly datasource: LuluShopApiDatasource) {}

  async download(format: BackupFormat, token: string): Promise<BackupDownload> {
    return this.datasource.downloadAdminBackup(format, token);
  }
}
