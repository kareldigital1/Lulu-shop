import mongoose from "mongoose";
import { connectToDatabase } from "../config/db";
import {
  auditProductImages,
  cleanupOrphanProductImages,
  PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS,
} from "../modules/uploads/upload.service";

function formatBytes(bytes: number) {
  if (bytes < 1_024) {
    return `${bytes} o`;
  }

  if (bytes < 1_024 * 1_024) {
    return `${(bytes / 1_024).toFixed(1)} Ko`;
  }

  return `${(bytes / (1_024 * 1_024)).toFixed(2)} Mo`;
}

async function checkImages() {
  const shouldCleanup = process.argv.includes("--apply");

  try {
    await connectToDatabase();

    if (shouldCleanup) {
      const result = await cleanupOrphanProductImages(
        PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS,
      );
      console.info(
        `${result.deletedFiles} image(s) orpheline(s) supprimée(s), ${formatBytes(result.reclaimedBytes)} récupéré(s).`,
      );
    }

    const audit = await auditProductImages(
      PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS,
    );
    console.info(
      JSON.stringify(
        {
          references: audit.referencedImages,
          fichiersGridFS: audit.storedFiles,
          tailleGridFS: formatBytes(audit.storedBytes),
          types: audit.contentTypes,
          fichiersOrphelins: audit.orphanFiles.length,
          fichiersOrphelinsNettoyables: audit.orphanFiles.filter(
            (file) => file.eligibleForCleanup,
          ).length,
          morceauxGridFS: audit.storedChunks,
          morceauxOrphelins: audit.orphanChunks,
          referencesManquantes: audit.missingReferences,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

void checkImages().catch((error) => {
  console.error("Audit des images impossible.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
