import { readFile } from "node:fs/promises";
import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { Binary, EJSON } from "bson";
import {
  MongoClient,
  type CreateIndexesOptions,
  type Document,
  type IndexSpecification,
} from "mongodb";
import {
  BACKUP_VERSION,
  MONGODB_BACKUP_FORMAT,
  type BackupCollection,
} from "./backup.service";

type BackupManifest = {
  format: typeof MONGODB_BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  database: string;
  encoding: string;
  includesGridFsBinary: true;
  collections: Required<BackupCollection>[];
};

type ParsedCollection = {
  manifest: Required<BackupCollection>;
  documents: Document[];
  indexes: Document[];
};

export type BackupValidationResult = {
  sourceDirectory: string;
  sourceDatabase: string;
  createdAt: string;
  collectionCount: number;
  documentCount: number;
  indexCount: number;
  gridFsBucketCount: number;
  gridFsFileCount: number;
  gridFsChunkCount: number;
  gridFsBinaryBytes: number;
};

export type BackupRestoreResult = BackupValidationResult & {
  targetDatabase: string;
  restoredDocumentCount: number;
  restoredIndexCount: number;
};

type RestoreOptions = {
  sourceDirectory: string;
  mongoUri: string;
  targetDatabase: string;
  confirmation: string;
};

const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,38}$/;
const RESERVED_DATABASE_NAMES = new Set(["admin", "config", "local"]);
const INSERT_BATCH_SIZE = 500;

function fail(message: string): never {
  throw new Error(`Sauvegarde invalide : ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getSafeEntryPath(rootDirectory: string, entryPath: string) {
  if (!entryPath.trim() || isAbsolute(entryPath)) {
    fail(`chemin d'archive interdit (${entryPath || "vide"}).`);
  }

  const resolvedPath = resolve(rootDirectory, entryPath);
  const relativePath = relative(rootDirectory, resolvedPath);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    fail(`chemin sortant du dossier extrait (${entryPath}).`);
  }

  return resolvedPath;
}

async function readJsonFile(filePath: string, label: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`${label} n'est pas un JSON lisible (${reason}).`);
  }
}

async function readEjsonArray(
  rootDirectory: string,
  entryPath: string,
  label: string,
  relaxed: boolean,
) {
  const filePath = getSafeEntryPath(rootDirectory, entryPath);

  try {
    const parsed = EJSON.parse(await readFile(filePath, "utf8"), {
      relaxed,
    }) as unknown;

    if (!Array.isArray(parsed) || parsed.some((entry) => !isRecord(entry))) {
      fail(`${label} doit contenir un tableau de documents.`);
    }

    return parsed as Document[];
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Sauvegarde invalide")
    ) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : String(error);
    fail(`${label} n'est pas un EJSON lisible (${reason}).`);
  }
}

function parseManifest(value: unknown): BackupManifest {
  if (!isRecord(value)) {
    fail("manifest.json doit contenir un objet.");
  }

  if (value.format !== MONGODB_BACKUP_FORMAT) {
    fail(`format attendu "${MONGODB_BACKUP_FORMAT}".`);
  }

  if (value.version !== BACKUP_VERSION) {
    fail(`version attendue ${BACKUP_VERSION}.`);
  }

  if (
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    fail("date de création absente ou incorrecte.");
  }

  if (typeof value.database !== "string" || !value.database.trim()) {
    fail("nom de base source absent.");
  }

  if (
    value.encoding !== "MongoDB Canonical Extended JSON" ||
    value.includesGridFsBinary !== true
  ) {
    fail("encodage Canonical EJSON ou inclusion GridFS non confirmé.");
  }

  if (!Array.isArray(value.collections)) {
    fail("liste des collections absente.");
  }

  const names = new Set<string>();
  const entryPaths = new Set<string>();
  const collections = value.collections.map((entry, index) => {
    if (!isRecord(entry)) {
      fail(`collection ${index + 1} incorrecte dans le manifeste.`);
    }

    const { name, documentCount, dataFile, indexesFile } = entry;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.startsWith("system.")
    ) {
      fail(`nom de collection interdit à la position ${index + 1}.`);
    }

    if (names.has(name)) {
      fail(`collection déclarée plusieurs fois (${name}).`);
    }

    if (!Number.isSafeInteger(documentCount) || Number(documentCount) < 0) {
      fail(`nombre de documents incorrect pour ${name}.`);
    }

    if (
      typeof dataFile !== "string" ||
      typeof indexesFile !== "string" ||
      !dataFile.trim() ||
      !indexesFile.trim()
    ) {
      fail(`fichiers de données ou d'index absents pour ${name}.`);
    }

    for (const entryPath of [dataFile, indexesFile]) {
      if (entryPaths.has(entryPath)) {
        fail(`fichier déclaré plusieurs fois (${entryPath}).`);
      }
      entryPaths.add(entryPath);
    }

    names.add(name);

    return {
      name,
      documentCount: Number(documentCount),
      dataFile,
      indexesFile,
    };
  });

  return {
    format: MONGODB_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: value.createdAt,
    database: value.database,
    encoding: value.encoding,
    includesGridFsBinary: true,
    collections,
  };
}

function toSafeNumber(value: unknown, label: string) {
  const primitive =
    value !== null &&
    typeof value === "object" &&
    typeof (value as { valueOf?: unknown }).valueOf === "function"
      ? (value as { valueOf: () => unknown }).valueOf()
      : value;

  if (
    typeof primitive !== "number" ||
    !Number.isSafeInteger(primitive) ||
    primitive < 0
  ) {
    fail(`${label} doit être un entier positif.`);
  }

  return primitive;
}

function getIdentifier(value: unknown, label: string) {
  if (value === undefined || value === null) {
    fail(`${label} absent.`);
  }

  return EJSON.stringify(value, { relaxed: false, legacy: false });
}

function validateIndexes(collectionName: string, indexes: Document[]) {
  const names = new Set<string>();

  for (const index of indexes) {
    if (
      typeof index.name !== "string" ||
      !index.name ||
      !isRecord(index.key)
    ) {
      fail(`définition d'index incorrecte pour ${collectionName}.`);
    }

    if (names.has(index.name)) {
      fail(`index déclaré plusieurs fois (${collectionName}.${index.name}).`);
    }

    names.add(index.name);
  }

  if (!names.has("_id_")) {
    fail(`index _id_ absent pour ${collectionName}.`);
  }
}

function validateGridFsBucket(
  bucketName: string,
  files: Document[],
  chunks: Document[],
) {
  const filesById = new Map<
    string,
    { length: number; chunkSize: number }
  >();
  const chunksByFile = new Map<
    string,
    Map<number, number>
  >();
  let binaryBytes = 0;

  for (const file of files) {
    const fileId = getIdentifier(file._id, `${bucketName}.files._id`);

    if (filesById.has(fileId)) {
      fail(`identifiant GridFS dupliqué dans ${bucketName}.files.`);
    }

    filesById.set(fileId, {
      length: toSafeNumber(file.length, `${bucketName}.files.length`),
      chunkSize: toSafeNumber(
        file.chunkSize,
        `${bucketName}.files.chunkSize`,
      ),
    });
  }

  for (const chunk of chunks) {
    const fileId = getIdentifier(
      chunk.files_id,
      `${bucketName}.chunks.files_id`,
    );
    const chunkNumber = toSafeNumber(chunk.n, `${bucketName}.chunks.n`);

    if (!(chunk.data instanceof Binary)) {
      fail(`donnée binaire GridFS incorrecte dans ${bucketName}.chunks.`);
    }

    const chunkLength = chunk.data.value().length;
    const fileChunks = chunksByFile.get(fileId) ?? new Map<number, number>();

    if (fileChunks.has(chunkNumber)) {
      fail(`bloc GridFS ${chunkNumber} dupliqué dans ${bucketName}.chunks.`);
    }

    fileChunks.set(chunkNumber, chunkLength);
    chunksByFile.set(fileId, fileChunks);
    binaryBytes += chunkLength;
  }

  for (const fileId of chunksByFile.keys()) {
    if (!filesById.has(fileId)) {
      fail(`bloc GridFS orphelin dans ${bucketName}.chunks.`);
    }
  }

  for (const [fileId, file] of filesById) {
    if (file.chunkSize === 0) {
      fail(`taille de bloc GridFS nulle dans ${bucketName}.files.`);
    }

    const expectedChunkCount =
      file.length === 0 ? 0 : Math.ceil(file.length / file.chunkSize);
    const fileChunks = chunksByFile.get(fileId) ?? new Map<number, number>();

    if (fileChunks.size !== expectedChunkCount) {
      fail(`nombre de blocs GridFS incorrect pour un fichier de ${bucketName}.`);
    }

    let restoredLength = 0;

    for (let index = 0; index < expectedChunkCount; index += 1) {
      const chunkLength = fileChunks.get(index);

      if (chunkLength === undefined) {
        fail(`séquence de blocs GridFS incomplète dans ${bucketName}.chunks.`);
      }

      restoredLength += chunkLength;
    }

    if (restoredLength !== file.length) {
      fail(`taille binaire GridFS incorrecte pour un fichier de ${bucketName}.`);
    }
  }

  return {
    fileCount: files.length,
    chunkCount: chunks.length,
    binaryBytes,
  };
}

async function parseBackupDirectory(sourceDirectory: string) {
  const rootDirectory = resolve(sourceDirectory);
  const manifestValue = await readJsonFile(
    resolve(rootDirectory, "manifest.json"),
    "manifest.json",
  );
  const manifest = parseManifest(manifestValue);
  const parsedCollections: ParsedCollection[] = [];

  for (const collection of manifest.collections) {
    const documents = await readEjsonArray(
      rootDirectory,
      collection.dataFile,
      collection.dataFile,
      false,
    );
    const indexes = await readEjsonArray(
      rootDirectory,
      collection.indexesFile,
      collection.indexesFile,
      true,
    );

    if (documents.length !== collection.documentCount) {
      fail(
        `${collection.name} contient ${documents.length} documents au lieu de ${collection.documentCount}.`,
      );
    }

    validateIndexes(collection.name, indexes);
    parsedCollections.push({
      manifest: collection,
      documents,
      indexes,
    });
  }

  const byName = new Map(
    parsedCollections.map((collection) => [
      collection.manifest.name,
      collection,
    ]),
  );
  const bucketNames = new Set<string>();

  for (const collectionName of byName.keys()) {
    if (collectionName.endsWith(".files")) {
      bucketNames.add(collectionName.slice(0, -".files".length));
    }
    if (collectionName.endsWith(".chunks")) {
      bucketNames.add(collectionName.slice(0, -".chunks".length));
    }
  }

  let gridFsFileCount = 0;
  let gridFsChunkCount = 0;
  let gridFsBinaryBytes = 0;

  for (const bucketName of bucketNames) {
    const files = byName.get(`${bucketName}.files`);
    const chunks = byName.get(`${bucketName}.chunks`);

    if (!files || !chunks) {
      fail(`paire GridFS incomplète pour le bucket ${bucketName}.`);
    }

    const result = validateGridFsBucket(
      bucketName,
      files.documents,
      chunks.documents,
    );
    gridFsFileCount += result.fileCount;
    gridFsChunkCount += result.chunkCount;
    gridFsBinaryBytes += result.binaryBytes;
  }

  const validation: BackupValidationResult = {
    sourceDirectory: rootDirectory,
    sourceDatabase: manifest.database,
    createdAt: manifest.createdAt,
    collectionCount: parsedCollections.length,
    documentCount: parsedCollections.reduce(
      (total, collection) => total + collection.documents.length,
      0,
    ),
    indexCount: parsedCollections.reduce(
      (total, collection) => total + collection.indexes.length,
      0,
    ),
    gridFsBucketCount: bucketNames.size,
    gridFsFileCount,
    gridFsChunkCount,
    gridFsBinaryBytes,
  };

  return { manifest, parsedCollections, validation };
}

export async function validateMongoBackupDirectory(
  sourceDirectory: string,
): Promise<BackupValidationResult> {
  return (await parseBackupDirectory(sourceDirectory)).validation;
}

async function insertDocuments(
  collection: ReturnType<ReturnType<MongoClient["db"]>["collection"]>,
  documents: Document[],
) {
  for (let index = 0; index < documents.length; index += INSERT_BATCH_SIZE) {
    await collection.insertMany(
      documents.slice(index, index + INSERT_BATCH_SIZE),
      { ordered: true },
    );
  }
}

async function restoreIndexes(
  collection: ReturnType<ReturnType<MongoClient["db"]>["collection"]>,
  indexes: Document[],
) {
  for (const index of indexes) {
    if (index.name === "_id_") {
      continue;
    }

    const {
      key,
      v: _version,
      ns: _namespace,
      ...options
    } = index;

    await collection.createIndex(
      key as IndexSpecification,
      options as CreateIndexesOptions,
    );
  }
}

export async function restoreMongoBackupDirectory(
  options: RestoreOptions,
): Promise<BackupRestoreResult> {
  const { manifest, parsedCollections, validation } =
    await parseBackupDirectory(options.sourceDirectory);
  const targetDatabase = options.targetDatabase.trim();

  if (!DATABASE_NAME_PATTERN.test(targetDatabase)) {
    throw new Error(
      "RESTORE_DATABASE doit contenir uniquement des lettres, chiffres, tirets ou underscores (38 caractères maximum).",
    );
  }

  const normalizedTargetDatabase = targetDatabase.toLocaleLowerCase("en");

  if (RESERVED_DATABASE_NAMES.has(normalizedTargetDatabase)) {
    throw new Error(
      `La base MongoDB réservée "${targetDatabase}" ne peut pas être utilisée comme cible.`,
    );
  }

  if (
    normalizedTargetDatabase ===
    manifest.database.toLocaleLowerCase("en")
  ) {
    throw new Error(
      "La restauration directe dans la base source est interdite. Utilise une nouvelle base vide.",
    );
  }

  if (options.confirmation !== `RESTORE-${targetDatabase}`) {
    throw new Error(
      `Confirmation incorrecte. Valeur attendue : RESTORE-${targetDatabase}`,
    );
  }

  if (!options.mongoUri.trim()) {
    throw new Error("RESTORE_MONGO_URI est requis pour appliquer la restauration.");
  }

  const client = new MongoClient(options.mongoUri, {
    serverSelectionTimeoutMS: 15_000,
  });
  let targetWasWritten = false;

  try {
    await client.connect();
    const database = client.db(targetDatabase);
    const existingCollections = await database
      .listCollections({}, { nameOnly: true })
      .toArray();

    if (existingCollections.length > 0) {
      throw new Error(
        `La base cible "${targetDatabase}" n'est pas vide. Restauration refusée.`,
      );
    }

    for (const parsedCollection of parsedCollections) {
      await database.createCollection(parsedCollection.manifest.name);
      targetWasWritten = true;
      await insertDocuments(
        database.collection(parsedCollection.manifest.name),
        parsedCollection.documents,
      );
    }

    for (const parsedCollection of parsedCollections) {
      await restoreIndexes(
        database.collection(parsedCollection.manifest.name),
        parsedCollection.indexes,
      );
    }

    let restoredDocumentCount = 0;
    let restoredIndexCount = 0;

    for (const parsedCollection of parsedCollections) {
      const collection = database.collection(parsedCollection.manifest.name);
      const documentCount = await collection.countDocuments();
      const indexes = await collection.indexes();

      if (documentCount !== parsedCollection.manifest.documentCount) {
        throw new Error(
          `Contrôle après restauration échoué pour ${parsedCollection.manifest.name}.`,
        );
      }

      const restoredIndexNames = indexes
        .map((index) => index.name)
        .sort();
      const expectedIndexNames = parsedCollection.indexes
        .map((index) => String(index.name))
        .sort();

      if (
        JSON.stringify(restoredIndexNames) !==
        JSON.stringify(expectedIndexNames)
      ) {
        throw new Error(
          `Contrôle des index échoué pour ${parsedCollection.manifest.name}.`,
        );
      }

      restoredDocumentCount += documentCount;
      restoredIndexCount += indexes.length;
    }

    return {
      ...validation,
      targetDatabase,
      restoredDocumentCount,
      restoredIndexCount,
    };
  } catch (error) {
    if (targetWasWritten) {
      try {
        await client.db(targetDatabase).dropDatabase();
      } catch (cleanupError) {
        const reason =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);
        throw new Error(
          `La restauration a échoué et le nettoyage automatique de "${targetDatabase}" a aussi échoué : ${reason}`,
          { cause: error },
        );
      }
    }

    throw error;
  } finally {
    await client.close();
  }
}
