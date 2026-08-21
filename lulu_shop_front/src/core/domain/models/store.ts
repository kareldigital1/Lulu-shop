export type HeroStat = {
  label: string;
  value: number;
  suffix: string;
};

export type Benefit = {
  icon: string;
  title: string;
  description: string;
};

export type Testimonial = {
  quote: string;
  author: string;
  location: string;
  rating: number;
};

export type Faq = {
  question: string;
  answer: string;
};

export type StoreContent = {
  _id?: string;
  slug: string;
  name: string;
  seoTitle: string;
  seoDescription: string;
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroImageUrl: string;
  heroCtas: Array<{
    enabled: boolean;
    label: string;
    url: string;
  }>;
  heroStats: HeroStat[];
  about: {
    title: string;
    subtitle: string;
    paragraphs: string[];
    values: string[];
    history: string;
    mission: string;
    presentation: string;
  };
  productsSection: {
    title: string;
    subtitle: string;
  };
  benefitsSection: {
    title: string;
    subtitle: string;
    items: Benefit[];
  };
  testimonialsSection: {
    title: string;
    subtitle: string;
    items: Testimonial[];
  };
  faqSection: {
    title: string;
    items: Faq[];
  };
  locationSection: {
    subtitle: string;
    mapEmbedUrl: string;
    mapUrl: string;
    addressLines: string[];
    openingHours: string;
    city: string;
    country: string;
    gps: {
      latitude: number;
      longitude: number;
    };
  };
  contactSection: {
    title: string;
    subtitle: string;
    successMessage: string;
  };
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  whatsappNumber: string;
  whatsappUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  logoUrl: string;
  faviconUrl: string;
  fullDescription: string;
  openGraphImageUrl: string;
  pdfSettings: {
    logoUrl: string;
    address: string;
    phone: string;
    email: string;
    footerText: string;
  };
  footerTagline: string;
  footerDescription: string;
  categories: string[];
};

export type StoreSettingsInput = {
  name: string;
  footerTagline: string;
  footerDescription: string;
  fullDescription: string;
  logoUrl: string;
  faviconUrl: string;
  email: string;
  primaryPhone: string;
  whatsappNumber: string;
  whatsappUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroImageUrl: string;
  heroCtas: StoreContent["heroCtas"];
  about: Pick<
    StoreContent["about"],
    "title" | "subtitle" | "history" | "mission" | "presentation" | "values"
  >;
  locationSection: {
    mapUrl: string;
    mapEmbedUrl: string;
    addressLines: string[];
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  seoTitle: string;
  seoDescription: string;
  openGraphImageUrl: string;
  pdfSettings: StoreContent["pdfSettings"];
};

export type AdminSystemStatus = {
  checkedAt: string;
  services: {
    storefront: { ok: boolean; label: string };
    data: { ok: boolean; label: string };
    emails: { ok: boolean; label: string };
    backups: { ok: boolean; label: string };
  };
};
