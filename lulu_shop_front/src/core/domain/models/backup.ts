export type BackupFormat = "json" | "mongodb";

export type BackupDownload = {
  blob: Blob;
  fileName: string;
};
