import "dotenv/config";
import {
  restoreMongoBackupDirectory,
  validateMongoBackupDirectory,
} from "../modules/backups/backup-restore.service";

type Arguments = {
  source?: string;
  confirmation?: string;
  apply: boolean;
  help: boolean;
};

function parseArguments(argv: string[]): Arguments {
  const result: Arguments = {
    apply: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--apply") {
      result.apply = true;
      continue;
    }

    if (argument === "apply") {
      result.apply = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      result.help = true;
      continue;
    }

    const [name, inlineValue] = argument.split("=", 2);

    if (name === "--source" || name === "--confirm") {
      const value = inlineValue ?? argv[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Valeur manquante pour ${name}.`);
      }

      if (inlineValue === undefined) {
        index += 1;
      }

      if (name === "--source") {
        result.source = value;
      } else {
        result.confirmation = value;
      }
      continue;
    }

    if (!argument.startsWith("--") && !result.source) {
      result.source = argument;
      continue;
    }

    throw new Error(`Argument inconnu : ${argument}`);
  }

  return result;
}

function printHelp() {
  console.info(
    [
      "Validation seule (aucune écriture MongoDB) :",
      '  npm run restore:backup -- "<DOSSIER_EXTRAIT>"',
      "",
      "Restauration dans une nouvelle base vide :",
      "  définir RESTORE_MONGO_URI, RESTORE_DATABASE et RESTORE_CONFIRMATION dans la session",
      '  npm run restore:backup -- "<DOSSIER_EXTRAIT>" apply',
    ].join("\n"),
  );
}

async function main() {
  const args = parseArguments(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.source) {
    throw new Error(
      'Le dossier extrait est requis. Utilise npm run restore:backup -- "<DOSSIER_EXTRAIT>".',
    );
  }

  if (!args.apply) {
    const result = await validateMongoBackupDirectory(args.source);
    console.info("Sauvegarde MongoDB valide. Aucune donnée n'a été écrite.");
    console.info(JSON.stringify(result, null, 2));
    return;
  }

  const mongoUri = process.env.RESTORE_MONGO_URI ?? "";
  const targetDatabase = process.env.RESTORE_DATABASE ?? "";
  const result = await restoreMongoBackupDirectory({
    sourceDirectory: args.source,
    mongoUri,
    targetDatabase,
    confirmation:
      args.confirmation ?? process.env.RESTORE_CONFIRMATION ?? "",
  });

  console.info("Restauration terminée et contrôlée.");
  console.info(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Restauration impossible.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
