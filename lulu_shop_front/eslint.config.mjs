import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Les plugins utilisés ici (import, typescript-eslint, react, react-hooks,
 * jsx-a11y, @next/next) sont fournis et enregistrés par eslint-config-next :
 * aucune dépendance supplémentaire n'est nécessaire.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Garde-fou contre un éventuel reste d'installation ratée.
    "node_modules_broken_*/**",
  ]),

  {
    name: "lulu/qualite-generale",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Le code utilise déjà la convention `_nom` pour les valeurs extraites
      // uniquement afin de les exclure d'un rest. On l'honore au lieu de poser
      // des eslint-disable, et on passe la règle en erreur.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "import/no-cycle": ["error", { maxDepth: Infinity }],
      "import/no-self-import": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../../**"],
              message:
                "Chemin relatif trop profond : utilise l'alias @/ (configuré dans tsconfig.json).",
            },
          ],
        },
      ],
    },
  },

  {
    name: "lulu/clean-architecture",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      /**
       * Sens des dépendances autorisé :
       *
       *   core/domain  ←  core/infrastructure  ←  services  ←  presentation  ←  app
       *
       * `target` désigne le dossier où vit l'import, `from` le dossier importé.
       * Une couche interne ne doit jamais atteindre une couche plus externe.
       */
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // Le domaine ne dépend de rien d'autre que de lui-même.
            {
              target: "./src/core/domain",
              from: "./src/core/infrastructure",
              message:
                "Le domaine ne doit pas connaître l'infrastructure : déclare un contrat dans core/domain/repositories.",
            },
            {
              target: "./src/core/domain",
              from: "./src/presentation",
              message: "Le domaine ne doit pas dépendre de l'interface utilisateur.",
            },
            {
              target: "./src/core/domain",
              from: "./src/services",
              message: "Le domaine ne doit pas dépendre des façades applicatives.",
            },
            {
              target: "./src/core/domain",
              from: "./src/app",
              message: "Le domaine ne doit pas dépendre des routes Next.js.",
            },
            {
              target: "./src/core/domain",
              from: "./src/lib",
              message:
                "Le domaine ne doit pas dépendre du composition root ni des helpers applicatifs.",
            },

            // L'infrastructure implémente le domaine, sans remonter plus haut.
            {
              target: "./src/core/infrastructure",
              from: "./src/presentation",
              message: "L'infrastructure ne doit pas dépendre de l'interface utilisateur.",
            },
            {
              target: "./src/core/infrastructure",
              from: "./src/app",
              message: "L'infrastructure ne doit pas dépendre des routes Next.js.",
            },
            {
              target: "./src/core/infrastructure",
              from: "./src/services",
              message: "L'infrastructure ne doit pas dépendre des façades applicatives.",
            },

            // Les façades s'appuient sur les repositories, jamais sur l'UI.
            {
              target: "./src/services",
              from: "./src/presentation",
              message: "Une façade applicative ne doit pas dépendre de l'interface utilisateur.",
            },
            {
              target: "./src/services",
              from: "./src/app",
              message: "Une façade applicative ne doit pas dépendre des routes Next.js.",
            },

            // Les composants réutilisables ne dépendent pas des routes.
            {
              target: "./src/presentation",
              from: "./src/app",
              message:
                "Un composant de présentation ne doit pas importer une route : passe la donnée en prop.",
            },
          ],
        },
      ],
    },
  },

  {
    name: "lulu/pas-de-http-hors-infrastructure",
    files: [
      "src/core/domain/**/*.{ts,tsx}",
      "src/services/**/*.{ts,tsx}",
      "src/presentation/**/*.{ts,tsx}",
      "src/app/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "axios",
              message:
                "Les appels HTTP appartiennent à core/infrastructure/http : passe par un repository (core/domain/repositories) puis par le composition root.",
            },
          ],
          patterns: [
            {
              group: ["../../../**"],
              message:
                "Chemin relatif trop profond : utilise l'alias @/ (configuré dans tsconfig.json).",
            },
          ],
        },
      ],
    },
  },

  {
    name: "lulu/typescript-type-aware",
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Une promesse non attendue avale silencieusement ses erreurs.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },
]);

export default eslintConfig;
