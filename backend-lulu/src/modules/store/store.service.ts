import { StoreModel } from "./store.model";
import { listPublicCategories } from "../categories/category.service";
import type { StoreSettingsInput } from "./store.validation";

function buildWhatsappUrl(number: string) {
  const digits = number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function normalizeStoreContent(store: Record<string, any>) {
  const addressLines = store.locationSection?.addressLines ?? [];
  const history =
    store.about?.history || store.about?.paragraphs?.[0] || store.fullDescription || "";
  const presentation =
    store.about?.presentation || store.about?.paragraphs?.[1] || history;
  const mission = store.about?.mission || store.about?.subtitle || presentation;

  return {
    ...store,
    fullDescription: store.fullDescription || store.about?.paragraphs?.join("\n\n") || "",
    logoUrl: store.logoUrl || "/images/logo.png",
    faviconUrl: store.faviconUrl || "/images/favicon-round-preview.png",
    heroImageUrl: store.heroImageUrl || "",
    heroCtas: store.heroCtas ?? [],
    facebookUrl: store.facebookUrl || "",
    instagramUrl: store.instagramUrl || "",
    openGraphImageUrl: store.openGraphImageUrl || "",
    about: {
      ...store.about,
      history,
      mission,
      presentation,
    },
    locationSection: {
      ...store.locationSection,
      city: store.locationSection?.city || "Abomey-Calavi",
      country: store.locationSection?.country || "Bénin",
    },
    pdfSettings: {
      logoUrl: store.pdfSettings?.logoUrl || store.logoUrl || "/images/logo.png",
      address: store.pdfSettings?.address || addressLines.join(", "),
      phone: store.pdfSettings?.phone || store.primaryPhone,
      email: store.pdfSettings?.email || store.email,
      footerText:
        store.pdfSettings?.footerText || "Merci pour votre confiance.",
    },
  };
}

export async function getHomepageStoreContent() {
  const [store, categories] = await Promise.all([
    StoreModel.findOne({ slug: "main-store" }).lean(),
    listPublicCategories(),
  ]);

  return store
    ? normalizeStoreContent({
        ...store,
        categories: categories.map((category) => category.name),
      })
    : null;
}

export async function getAdminStoreSettings() {
  const store = await StoreModel.findOne({ slug: "main-store" }).lean();
  return store ? normalizeStoreContent(store) : null;
}

export async function updateAdminStoreSettings(input: StoreSettingsInput) {
  const whatsappUrl = input.whatsappUrl || buildWhatsappUrl(input.whatsappNumber);
  const store = await StoreModel.findOneAndUpdate(
    { slug: "main-store" },
    {
      $set: {
        name: input.name,
        footerTagline: input.footerTagline,
        footerDescription: input.footerDescription,
        fullDescription: input.fullDescription,
        logoUrl: input.logoUrl,
        faviconUrl: input.faviconUrl,
        email: input.email,
        primaryPhone: input.primaryPhone,
        whatsappNumber: input.whatsappNumber,
        whatsappUrl,
        facebookUrl: input.facebookUrl,
        instagramUrl: input.instagramUrl,
        tiktokUrl: input.tiktokUrl,
        heroTitle: input.heroTitle,
        heroHighlight: input.heroHighlight,
        heroDescription: input.heroDescription,
        heroImageUrl: input.heroImageUrl,
        heroCtas: input.heroCtas,
        "about.title": input.about.title,
        "about.subtitle": input.about.subtitle,
        "about.history": input.about.history,
        "about.mission": input.about.mission,
        "about.presentation": input.about.presentation,
        "about.paragraphs": [input.about.history, input.about.presentation],
        "about.values": input.about.values,
        "locationSection.mapUrl": input.locationSection.mapUrl,
        "locationSection.mapEmbedUrl": input.locationSection.mapEmbedUrl,
        "locationSection.addressLines": input.locationSection.addressLines,
        "locationSection.city": input.locationSection.city,
        "locationSection.country": input.locationSection.country,
        "locationSection.gps.latitude": input.locationSection.latitude,
        "locationSection.gps.longitude": input.locationSection.longitude,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        openGraphImageUrl: input.openGraphImageUrl,
        pdfSettings: input.pdfSettings,
      },
    },
    { new: true, runValidators: true },
  ).lean();

  return store ? normalizeStoreContent(store) : null;
}
