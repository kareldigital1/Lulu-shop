import type { Metadata } from "next";

export const SITE_NAME = "Tata Lulu Shop";
export const HOME_TITLE =
  "Tata Lulu Shop | Friperie femme à Abomey-Calavi, Bénin";
export const HOME_DESCRIPTION =
  "Friperie femme à Atrokpocodji, Abomey-Calavi. Vêtements importés de qualité, pièces uniques et commande rapide sur WhatsApp.";

const DEFAULT_SOCIAL_IMAGE_DETAILS = {
  width: 1200,
  height: 630,
  alt: "Tata Lulu Shop, friperie femme à Abomey-Calavi",
};

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: {
    url: string;
    alt: string;
  };
};

export function createPageMetadata({
  title,
  description,
  path,
  image,
}: PageMetadataOptions): Metadata {
  const openGraphImage = image
    ? {
        url: image.url,
        alt: image.alt,
      }
    : {
        ...DEFAULT_SOCIAL_IMAGE_DETAILS,
        url: "/opengraph-image",
      };
  const twitterImage = image
    ? {
        url: image.url,
        alt: image.alt,
      }
    : {
        ...DEFAULT_SOCIAL_IMAGE_DETAILS,
        url: "/twitter-image",
      };

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "fr_BJ",
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      images: [openGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImage],
    },
  };
}
