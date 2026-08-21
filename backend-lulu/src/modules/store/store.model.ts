import { Schema, model } from "mongoose";

const heroStatSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: Number, required: true },
    suffix: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const aboutSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    paragraphs: { type: [String], default: [] },
    values: { type: [String], default: [] },
    history: { type: String, default: "", trim: true },
    mission: { type: String, default: "", trim: true },
    presentation: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const benefitSchema = new Schema(
  {
    icon: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const sectionWithSubtitleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const testimonialSchema = new Schema(
  {
    quote: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false },
);

const faqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const gpsSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false },
);

const locationSchema = new Schema(
  {
    subtitle: { type: String, required: true, trim: true },
    mapEmbedUrl: { type: String, required: true, trim: true },
    mapUrl: { type: String, required: true, trim: true },
    addressLines: { type: [String], default: [] },
    openingHours: { type: String, required: true, trim: true },
    city: { type: String, default: "Abomey-Calavi", trim: true },
    country: { type: String, default: "Bénin", trim: true },
    gps: { type: gpsSchema, required: true },
  },
  { _id: false },
);

const heroCtaSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const pdfSettingsSchema = new Schema(
  {
    logoUrl: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    footerText: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const contactSectionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    successMessage: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const storeSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    seoTitle: { type: String, required: true, trim: true },
    seoDescription: { type: String, required: true, trim: true },
    heroBadge: { type: String, required: true, trim: true },
    heroTitle: { type: String, required: true, trim: true },
    heroHighlight: { type: String, required: true, trim: true },
    heroDescription: { type: String, required: true, trim: true },
    heroImageUrl: { type: String, default: "", trim: true },
    heroCtas: { type: [heroCtaSchema], default: [] },
    heroStats: { type: [heroStatSchema], default: [] },
    about: { type: aboutSchema, required: true },
    productsSection: { type: sectionWithSubtitleSchema, required: true },
    benefitsSection: {
      type: new Schema(
        {
          title: { type: String, required: true, trim: true },
          subtitle: { type: String, required: true, trim: true },
          items: { type: [benefitSchema], default: [] },
        },
        { _id: false },
      ),
      required: true,
    },
    testimonialsSection: {
      type: new Schema(
        {
          title: { type: String, required: true, trim: true },
          subtitle: { type: String, required: true, trim: true },
          items: { type: [testimonialSchema], default: [] },
        },
        { _id: false },
      ),
      required: true,
    },
    faqSection: {
      type: new Schema(
        {
          title: { type: String, required: true, trim: true },
          items: { type: [faqSchema], default: [] },
        },
        { _id: false },
      ),
      required: true,
    },
    locationSection: { type: locationSchema, required: true },
    contactSection: { type: contactSectionSchema, required: true },
    email: { type: String, required: true, trim: true },
    primaryPhone: { type: String, required: true, trim: true },
    secondaryPhone: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true },
    whatsappUrl: { type: String, required: true, trim: true },
    facebookUrl: { type: String, default: "", trim: true },
    instagramUrl: { type: String, default: "", trim: true },
    tiktokUrl: { type: String, required: true, trim: true },
    logoUrl: { type: String, default: "/images/logo.png", trim: true },
    faviconUrl: {
      type: String,
      default: "/images/favicon-round-preview.png",
      trim: true,
    },
    fullDescription: { type: String, default: "", trim: true },
    openGraphImageUrl: { type: String, default: "", trim: true },
    pdfSettings: { type: pdfSettingsSchema, default: () => ({}) },
    footerTagline: { type: String, required: true, trim: true },
    footerDescription: { type: String, required: true, trim: true },
    categories: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
);

export const StoreModel = model("Store", storeSchema);
