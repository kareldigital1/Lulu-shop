import type { StoreContent } from "../../domain/models/store";
import { resolveApiAssetUrl } from "../http/request-manager";

export type StoreContentDto = StoreContent;

export function mapStoreContentDto(storeContentDto: StoreContentDto): StoreContent {
  const resolveOptionalImage = (reference: string) =>
    reference ? resolveApiAssetUrl(reference) : "";
  const history =
    storeContentDto.about.history || storeContentDto.about.paragraphs[0] || "";
  const presentation =
    storeContentDto.about.presentation ||
    storeContentDto.about.paragraphs[1] ||
    history;
  const pdfSettings = storeContentDto.pdfSettings ?? {
    logoUrl: storeContentDto.logoUrl || "/images/logo.png",
    address: storeContentDto.locationSection.addressLines.join(", "),
    phone: storeContentDto.primaryPhone,
    email: storeContentDto.email,
    footerText: "Merci pour votre confiance.",
  };

  return {
    ...storeContentDto,
    fullDescription:
      storeContentDto.fullDescription ||
      storeContentDto.about.paragraphs.join("\n\n"),
    logoUrl: resolveOptionalImage(storeContentDto.logoUrl || "/images/logo.png"),
    faviconUrl: resolveOptionalImage(
      storeContentDto.faviconUrl || "/images/favicon-round-preview.png",
    ),
    heroImageUrl: resolveOptionalImage(storeContentDto.heroImageUrl || ""),
    heroCtas: storeContentDto.heroCtas ?? [],
    facebookUrl: storeContentDto.facebookUrl || "",
    instagramUrl: storeContentDto.instagramUrl || "",
    openGraphImageUrl: resolveOptionalImage(
      storeContentDto.openGraphImageUrl || "",
    ),
    about: {
      ...storeContentDto.about,
      history,
      mission:
        storeContentDto.about.mission || storeContentDto.about.subtitle,
      presentation,
    },
    locationSection: {
      ...storeContentDto.locationSection,
      city: storeContentDto.locationSection.city || "Abomey-Calavi",
      country: storeContentDto.locationSection.country || "Bénin",
    },
    pdfSettings: {
      ...pdfSettings,
      logoUrl: resolveOptionalImage(pdfSettings.logoUrl),
    },
  };
}
