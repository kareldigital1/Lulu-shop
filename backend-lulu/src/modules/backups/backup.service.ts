import { once } from "node:events";
import { Readable } from "node:stream";
import { EJSON } from "bson";
import type { HttpDownloadTarget } from "../../utils/http-download-target";
import mongoose from "mongoose";
import { ZipFile } from "yazl";
import { AppError } from "../../utils/AppError";

export const JSON_BACKUP_FORMAT = "tata-lulu-shop-json";
export const MONGODB_BACKUP_FORMAT = "tata-lulu-shop-mongodb";
export const BACKUP_VERSION = 1;
const GRIDFS_CHUNKS_SUFFIX = ".chunks";

export type BackupCollection = {
  name: string;
  documentCount: number;
  dataFile: string;
  indexesFile?: string;
};

export type BackupResult = {
  fileName: string;
  collectionCount: number;
  documentCount: number;
  includesGridFsBinary: boolean;
};

function getDatabase() {
  const database = mongoose.connection.db;

  if (!database) {
    throw new AppError("La base de données n'est pas disponible.", 503);
  }

  return database;
}

function createTimestamp(date: Date) {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[:-]/g, "")
    .replace("T", "-");
}

function sanitizeArchiveEntryName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function listBackupCollections(
  includeGridFsBinary: boolean,
): Promise<BackupCollection[]> {
  const database = getDatabase();
  const collections = await database
    .listCollections({}, { nameOnly: true })
    .toArray();
  const names = collections
    .map((collection) => collection.name)
    .filter((name) => !name.startsWith("system."))
    .filter(
      (name) => includeGridFsBinary || !name.endsWith(GRIDFS_CHUNKS_SUFFIX),
    )
    .sort((left, right) => left.localeCompare(right, "en"));

  return Promise.all(
    names.map(async (name) => ({
      name,
      documentCount: await database.collection(name).countDocuments(),
      dataFile: `collections/${sanitizeArchiveEntryName(name)}.ejson`,
      indexesFile: includeGridFsBinary
        ? `indexes/${sanitizeArchiveEntryName(name)}.ejson`
        : undefined,
    })),
  );
}

function getDocumentCount(collections: BackupCollection[]) {
  return collections.reduce(
    (total, collection) => total + collection.documentCount,
    0,
  );
}

async function writeResponseChunk(response: HttpDownloadTarget, chunk: string) {
  if (!response.write(chunk)) {
    await once(response, "drain");
  }
}

function createCollectionStream(
  collectionName: string,
  serialize: (document: Record<string, unknown>) => string,
) {
  const database = getDatabase();

  async function* generate() {
    yield "[\n";
    let isFirstDocument = true;
    const cursor = database
      .collection<Record<string, unknown>>(collectionName)
      .find({})
      .sort({ _id: 1 });

    try {
      for await (const document of cursor) {
        yield `${isFirstDocument ? "" : ",\n"}${serialize(document)}`;
        isFirstDocument = false;
      }
    } finally {
      await cursor.close();
    }

    yield "\n]\n";
  }

  return Readable.from(generate());
}

export async function streamJsonBackup(
  response: HttpDownloadTarget,
  now = new Date(),
): Promise<BackupResult> {
  const database = getDatabase();
  const collections = await listBackupCollections(false);
  const fileName = `tata-lulu-shop-${createTimestamp(now)}.json`;
  const excludedCollections = (
    await database.listCollections({}, { nameOnly: true }).toArray()
  )
    .map((collection) => collection.name)
    .filter((name) => name.endsWith(GRIDFS_CHUNKS_SUFFIX))
    .sort((left, right) => left.localeCompare(right, "en"));

  response.status(200);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"`,
  );
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  await writeResponseChunk(
    response,
    `{\n  "format": ${JSON.stringify(JSON_BACKUP_FORMAT)},\n`,
  );
  await writeResponseChunk(response, `  "version": ${BACKUP_VERSION},\n`);
  await writeResponseChunk(
    response,
    `  "createdAt": ${JSON.stringify(now.toISOString())},\n`,
  );
  await writeResponseChunk(
    response,
    `  "database": ${JSON.stringify(database.databaseName)},\n`,
  );
  await writeResponseChunk(
    response,
    `  "excludedBinaryCollections": ${JSON.stringify(excludedCollections)},\n`,
  );
  await writeResponseChunk(response, '  "collections": {\n');

  for (const [index, collection] of collections.entries()) {
    await writeResponseChunk(
      response,
      `${index === 0 ? "" : ",\n"}    ${JSON.stringify(collection.name)}: [\n`,
    );
    let isFirstDocument = true;
    const cursor = database
      .collection<Record<string, unknown>>(collection.name)
      .find({})
      .sort({ _id: 1 });

    try {
      for await (const document of cursor) {
        const serialized = JSON.stringify(document, null, 2)
          .split("\n")
          .map((line) => `      ${line}`)
          .join("\n");
        await writeResponseChunk(
          response,
          `${isFirstDocument ? "" : ",\n"}${serialized}`,
        );
        isFirstDocument = false;
      }
    } finally {
      await cursor.close();
    }

    await writeResponseChunk(response, "\n    ]");
  }

  await writeResponseChunk(response, "\n  }\n}\n");
  response.end();

  return {
    fileName,
    collectionCount: collections.length,
    documentCount: getDocumentCount(collections),
    includesGridFsBinary: false,
  };
}

export async function streamMongoDbBackup(
  response: HttpDownloadTarget,
  now = new Date(),
): Promise<BackupResult> {
  const database = getDatabase();
  const collections = await listBackupCollections(true);
  const fileName = `tata-lulu-shop-mongodb-${createTimestamp(now)}.zip`;
  const archive = new ZipFile();
  const outputFinished = new Promise<void>((resolve, reject) => {
    response.once("finish", resolve);
    response.once("close", () => {
      if (!response.writableFinished) {
        reject(new Error("Le téléchargement de la sauvegarde a été interrompu."));
      }
    });
    archive.outputStream.once("error", reject);
  });
  const manifest = {
    format: MONGODB_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    database: database.databaseName,
    encoding: "MongoDB Canonical Extended JSON",
    includesGridFsBinary: true,
    collections,
  };

  response.status(200);
  response.setHeader("Content-Type", "application/zip");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"`,
  );
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  archive.outputStream.pipe(response);
  archive.addBuffer(
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    "manifest.json",
  );
  archive.addBuffer(
    Buffer.from(
      [
      "Sauvegarde MongoDB de Tata Lulu Shop",
      "",
      "Chaque fichier du dossier collections contient un tableau au format",
      "MongoDB Canonical Extended JSON. Les collections GridFS files et chunks",
      "sont incluses afin de conserver les images des produits.",
      "",
      "Validation de l'archive depuis la racine du dépôt :",
      'pnpm --filter backend-lulu restore:backup -- "<DOSSIER_EXTRAIT>"',
      "",
      "La procédure complète et sécurisée se trouve dans :",
      "docs/backup-restore-procedure.md",
      "",
      "Ne restaure jamais directement par-dessus la base de production.",
      "",
      ].join("\n"),
      "utf8",
    ),
    "RESTAURATION.txt",
  );

  for (const collection of collections) {
    const indexes = await database.collection(collection.name).indexes();
    archive.addBuffer(
      Buffer.from(
        `${EJSON.stringify(indexes, { relaxed: false, legacy: false })}\n`,
        "utf8",
      ),
      collection.indexesFile ?? `indexes/${collection.name}.ejson`,
    );
    const collectionStream = createCollectionStream(
      collection.name,
      (document) =>
        EJSON.stringify(document, { relaxed: false, legacy: false }),
    );
    collectionStream.once("error", (error) => {
      archive.outputStream.emit("error", error);
    });
    archive.addReadStream(collectionStream, collection.dataFile, {
      compress: true,
      compressionLevel: 6,
    });
  }

  archive.end();
  await outputFinished;

  return {
    fileName,
    collectionCount: collections.length,
    documentCount: getDocumentCount(collections),
    includesGridFsBinary: true,
  };
}
