export function normalizeProductSlug(value: string) {
  let decodedValue = value;

  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    // Une saisie contenant un "%" isolé reste normalisable sans interrompre le formulaire.
  }

  return decodedValue
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
