import {
  DEFAULT_CLOTHING_SIZE,
  getAvailabilityFromStock,
  isReservedAutomaticProductBadge,
  parseProductPriceAmount,
  type Product,
} from "@/core/domain/models/product";
import type { StoreContent } from "@/core/domain/models/store";

export const fallbackStoreContent: StoreContent = {
  slug: "main-store",
  name: "Tata Lulu Shop",
  seoTitle: "Tata Lulu Shop | Friperie femme à Abomey-Calavi, Bénin",
  seoDescription:
    "Tata Lulu Shop, friperie femme à Atrokpocodji, Abomey-Calavi au Bénin. Robes, blazers, ceintures, nuisettes et vêtements importés de qualité à prix doux.",
  heroBadge: "Friperie femme à Abomey-Calavi • Importé",
  heroTitle: "Bienvenue chez Tata Lulu",
  heroHighlight: "Tata Lulu Shop – Friperie femme à Atrokpocodji, Bénin",
  heroDescription:
    "Des vêtements importés et de seconde main, sélectionnés avec soin sur les meilleurs marchés de friperie pour les clientes d'Abomey-Calavi, Cotonou et du Bénin. Qualité, style et prix doux pour une garde robe unique.",
  heroImageUrl: "",
  heroCtas: [],
  heroStats: [
    { label: "Pièces uniques", value: 100, suffix: "%" },
    { label: "Clientes satisfaites", value: 500, suffix: "+" },
    { label: "Catégories mode", value: 6, suffix: "" },
  ],
  about: {
    title: "Tata Lulu Shop, la friperie femme qui vous sublime à Abomey-Calavi",
    subtitle:
      "Des vêtements importés de qualité, chinés avec passion pour vous offrir un style unique à petit prix au Bénin.",
    paragraphs: [
      "Tata Lulu Shop est née d'une passion pour la mode accessible et responsable. Nous parcourons les marchés internationaux de friperie pour dénicher des pièces uniques, de qualité irréprochable, que nous mettons à votre disposition à Atrokpocodji, Abomey-Calavi et partout au Bénin.",
      "Robes, palazzo, t-shirts, crop tops, bodys, chemises, blazers, ceintures, combinaisons et nuisettes… Chaque article est lavé, repassé et contrôlé avant d'arriver dans votre dressing. Nous croyons que le style n'a pas de prix, mais qu'il doit rester abordable.",
    ],
    values: ["Qualité contrôlée", "Importé", "Pièces uniques", "Prix doux", "Mode durable"],
    history:
      "Tata Lulu Shop est née d'une passion pour la mode accessible et responsable. Nous parcourons les marchés internationaux de friperie pour dénicher des pièces uniques, de qualité irréprochable, que nous mettons à votre disposition à Atrokpocodji, Abomey-Calavi et partout au Bénin.",
    mission:
      "Rendre une mode féminine, durable et soigneusement sélectionnée accessible à toutes les clientes.",
    presentation:
      "Robes, palazzo, t-shirts, crop tops, bodys, chemises, blazers, ceintures, combinaisons et nuisettes : chaque article est lavé, repassé et contrôlé avant d'arriver dans votre dressing.",
  },
  productsSection: {
    title: "Des pièces uniques pour tous les styles",
    subtitle:
      "Découvrez nos catégories de vêtements importés et de seconde main, soigneusement sélectionnés pour vous au Bénin.",
  },
  benefitsSection: {
    title: "La différence Lulu",
    subtitle: "Un service attentionné et des vêtements qui vous ressemblent vraiment.",
    items: [
      { icon: "sparkles", title: "Qualité premium", description: "Chaque pièce est contrôlée : pas de taches, pas de trous. Rien que du impeccable." },
      { icon: "globe", title: "Importé avec soin", description: "Vêtements chinés sur les marchés internationaux, sélectionnés un par un." },
      { icon: "tag", title: "Prix imbattables", description: "La mode de qualité à des prix qui respectent votre budget." },
      { icon: "shirt", title: "Styles uniques", description: "Des pièces rares que vous ne verrez pas sur tout le monde." },
      { icon: "truck", title: "Livraison rapide", description: "Expédition soignée partout au Bénin, sous 48h après validation." },
      { icon: "service", title: "Service client", description: "Tata Lulu vous conseille avec le sourire, avant et après l'achat." },
    ],
  },
  testimonialsSection: {
    title: "Elles adorent Tata Lulu Shop",
    subtitle: "La satisfaction de nos clientes est notre plus belle récompense.",
    items: [
      {
        quote: "Ma robe Lulu Shop a fait sensation au mariage ! Qualité incroyable, on dirait du neuf. Tata Lulu a un œil infaillible.",
        author: "Clarisse M.",
        location: "Cotonou, Bénin",
        rating: 5,
      },
      {
        quote: "J'ai acheté un lot de t-shirts et un palazzo. Les finitions sont parfaites, les prix plus que raisonnables. Je recommande !",
        author: "Fatima A.",
        location: "Calavi, Bénin",
        rating: 5,
      },
      {
        quote: "Enfin une friperie qui sélectionne vraiment de belles pièces. Ma combinaison est devenue ma tenue préférée.",
        author: "Aïcha K.",
        location: "Parakou, Bénin",
        rating: 5,
      },
    ],
  },
  faqSection: {
    title: "Tout savoir sur Tata Lulu Shop",
    items: [
      {
        question: "D'où viennent les vêtements ?",
        answer:
          "Nos articles sont importés depuis des marchés de friperie internationaux. Nous les sélectionnons nous-mêmes pour leur qualité et leur style. Aucune production locale, ce sont de véritables trouvailles de seconde main haut de gamme.",
      },
      {
        question: "Les vêtements sont-ils en bon état ?",
        answer:
          "Tous nos vêtements sont triés, lavés et repassés. Nous vérifions l'absence de défauts majeurs. Ils sont comme neufs ou très peu portés. La qualité est notre priorité absolue.",
      },
      {
        question: "Comment commander ?",
        answer:
          "Contactez-nous directement via WhatsApp au 56 37 56 82 ou appelez-nous. Envoyez-nous la photo du modèle qui vous plaît, et nous vous indiquons la disponibilité et le prix. Paiement à la livraison possible.",
      },
      {
        question: "Quelles sont les heures d'ouverture ?",
        answer:
          "Nous sommes disponibles du lundi au samedi, de 9h à 18h. Les commandes passées en dehors de ces horaires seront traitées le jour ouvré suivant.",
      },
    ],
  },
  locationSection: {
    subtitle:
      "Repérez Tata Lulu Shop rapidement, lancez votre itinéraire et gardez le bon point de repère avant de nous contacter.",
    mapEmbedUrl: "https://www.google.com/maps?q=6.387366,2.321474&z=18&output=embed",
    mapUrl: "https://maps.google.com/?q=6.387366,2.321474",
    addressLines: [
      "Atrokpocodji, Carrefour Séminaire st Jean Eudes",
      "Rue en face Station Bénin pétro, cinquième boutique à droite",
      "Abomey-Calavi, Bénin",
    ],
    openingHours: "Lundi au samedi, de 8h à 20h.",
    city: "Abomey-Calavi",
    country: "Bénin",
    gps: {
      latitude: 6.387366,
      longitude: 2.321474,
    },
  },
  contactSection: {
    title: "Une question ? Écrivez à Tata Lulu",
    subtitle: "Nous sommes à votre écoute pour toute demande de renseignement ou commande.",
    successMessage: "Votre message a été envoyé avec succès ! Tata Lulu vous répondra dans les plus brefs délais.",
  },
  email: "tatalulushop@gmail.com",
  primaryPhone: "+229 01 56 37 56 82",
  secondaryPhone: "+229 01 66 38 60 30",
  whatsappNumber: "+229 56 37 56 82",
  whatsappUrl:
    "https://wa.me/22956375682?text=Bonjour%20Tata%20lulu%2C%20je%20souhaite%20d%C3%A9couvrir%20les%20articles%20Tata%20Lulu%20Shop.",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "https://www.tiktok.com/@tatalulu229?_r=1&_t=ZS-96okuMST9iT",
  logoUrl: "/images/logo.png",
  faviconUrl: "/images/favicon-round-preview.png",
  fullDescription:
    "Tata Lulu Shop propose une sélection de vêtements féminins importés et de seconde main, contrôlés avec soin et proposés à prix accessibles.",
  openGraphImageUrl: "/images/logo.png",
  pdfSettings: {
    logoUrl: "/images/logo.png",
    address:
      "Atrokpocodji, Carrefour Séminaire st Jean Eudes, Abomey-Calavi, Bénin",
    phone: "+229 01 56 37 56 82",
    email: "tatalulushop@gmail.com",
    footerText: "Merci pour votre confiance.",
  },
  footerTagline: "Friperie de luxe, style accessible",
  footerDescription: "Vêtements importés sélectionnés avec soin. La mode seconde main haut de gamme au Bénin.",
  categories: ["Robes", "Hauts", "Bas", "Combinaisons", "Lingerie & Nuit", "Accessoires"],
};

const fallbackProductsSeed = [
  {
    slug: "robe-elegance",
    reference: "TLS-ROBE-ELEGANCE",
    category: "Robe",
    name: "Robe Élégance",
    shortDescription: "Des robes tendance, coupées dans de belles matières, pour toutes les occasions.",
    description:
      "Des robes tendance, coupées dans de belles matières, pour toutes les occasions. Chaque modèle est unique, sélectionné avec soin sur les marchés de friperie internationaux. Lavées et repassées, elles sont prêtes à être portées.",
    benefits: ["Styles variés", "Tailles S-XL", "Bon état général", "Prix doux"],
    priceLabel: "À partir de 3 000 FCFA",
    image: "/images/robe.png",
    badge: "Best-seller",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les Robes.",
    featured: true,
    order: 1,
    stock: 8,
    isActive: true,
  },
  {
    slug: "palazzo-chic",
    reference: "TLS-PALAZZO-CHIC",
    category: "Palazzo",
    name: "Palazzo Chic",
    shortDescription: "Pantalons fluides et élégants, parfaits pour un look décontracté ou habillé.",
    description:
      "Pantalons fluides et élégants, parfaits pour un look décontracté ou habillé. Grande variété d'imprimés et de couleurs, sélectionnés pour leur coupe flatteuse.",
    benefits: ["Confort absolu", "Imprimés tendance", "Taille élastiquée", "Pièce unique"],
    priceLabel: "À partir de 2 000 FCFA",
    image: "/images/palazzo.png",
    badge: "",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les Palazzos.",
    featured: true,
    order: 2,
    stock: 6,
    isActive: true,
  },
  {
    slug: "tshirt-tendance",
    reference: "TLS-TSHIRT-TENDANCE",
    category: "T-shirt",
    name: "T-shirt Tendance",
    shortDescription: "Basiques ou graphiques, nos t-shirts s'adaptent à toutes vos envies mode.",
    description:
      "Basiques ou graphiques, nos t-shirts s'adaptent à toutes vos envies mode. Coton doux, coupes modernes, pour un look effortless chic.",
    benefits: ["Coton doux", "Coupes modernes", "Facile à porter", "Disponible en plusieurs couleurs"],
    priceLabel: "À partir de 1 500 FCFA",
    image: "/images/tshirt.png",
    badge: "",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les T-shirts.",
    featured: false,
    order: 3,
    stock: 11,
    isActive: true,
  },
  {
    slug: "crop-top-audace",
    reference: "TLS-CROP-TOP-AUDACE",
    category: "Crop top",
    name: "Crop top Audace",
    shortDescription: "Pour un look estival ou à superposer, ce crop top apporte une touche audacieuse et facile à porter.",
    description:
      "Pour un look estival ou à superposer, ce crop top apporte une touche audacieuse et facile à porter. Sa coupe tendance et son esprit léger réveillent la garde-robe sans effort.",
    benefits: ["Tendances 2025", "Associable facilement", "Matières agréables", "Idéal pour les chaudes journées"],
    priceLabel: "À partir de 1 000 FCFA",
    image: "/images/croptop.png",
    badge: "",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les Crop tops.",
    featured: false,
    order: 4,
    stock: 9,
    isActive: true,
  },
  {
    slug: "body-sweet-sensuel",
    reference: "TLS-BODY-SWEET-SENSUEL",
    category: "Body Sweet",
    name: "Body Sweet Sensuel",
    shortDescription: "Bodys élégants, près du corps, parfaits pour un look chic et glamour.",
    description:
      "Bodys élégants, près du corps, parfaits pour un look chic et glamour. Tissus extensibles de qualité pour un maintien impeccable.",
    benefits: ["Maintien parfait", "Tissus extensibles", "Look sophistiqué", "Facile à accessoiriser"],
    priceLabel: "À partir de 1 500 FCFA",
    image: "/images/nuisette.png",
    badge: "",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les Body Sweets.",
    featured: false,
    order: 5,
    stock: 5,
    isActive: true,
  },
  {
    slug: "chemise-raffinee",
    reference: "TLS-CHEMISE-RAFFINEE",
    category: "Chemise",
    name: "Chemise Raffinée",
    shortDescription: "Des chemises de qualité, pour un style professionnel ou décontracté chic.",
    description:
      "Des chemises de qualité, pour un style professionnel ou décontracté chic. Coupes impeccables, faciles d'entretien.",
    benefits: ["Coupe impeccable", "Facile d'entretien", "Look soigné", "Plusieurs coloris"],
    priceLabel: "À partir de 2 000 FCFA",
    image: "/images/chemise.png",
    badge: "",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les Chemises.",
    featured: false,
    order: 6,
    stock: 4,
    isActive: true,
  },
  {
    slug: "combinaison-glamour",
    reference: "TLS-COMBINAISON-GLAMOUR",
    category: "Combinaison",
    name: "Combinaison",
    shortDescription: "Des combinaisons tendance qui habillent instantanément avec caractère.",
    description:
      "Des combinaisons tendance qui habillent instantanément avec caractère. Taille élastique ou ceinturée, pour un tombé parfait.",
    benefits: ["Style affirmé", "Taille élastique", "Parfaite pour les soirées", "Pièce forte du dressing"],
    priceLabel: "À partir de 2 500 FCFA",
    image: "/images/combinaison.png",
    badge: "Nouveauté",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les Combinaisons.",
    featured: true,
    order: 7,
    stock: 3,
    isActive: true,
  },
  {
    slug: "nuisette-charme",
    reference: "TLS-NUISETTE-CHARME",
    category: "Nuisette",
    name: "Nuisette Charme",
    shortDescription: "Une nuisette légère et féminine pour un look délicat et raffiné.",
    description:
      "Une nuisette légère et féminine pour un look délicat et raffiné. En attendant un vrai visuel dédié, cette catégorie est déjà intégrée au catalogue et au backoffice.",
    benefits: ["Matière douce", "Style raffiné", "Coupe légère", "Pièce tendance"],
    priceLabel: "À partir de 2 500 FCFA",
    image: "/images/body.png",
    badge: "Nouveau",
    whatsappMessage: "Bonjour Tata lulu, je suis intéressé(e) par les Nuisettes.",
    featured: false,
    order: 8,
    stock: 7,
    isActive: true,
  },
];

export const fallbackProducts: Product[] = fallbackProductsSeed.map((product) => ({
  ...product,
  categoryId: "",
  priceAmount: parseProductPriceAmount(product.priceLabel),
  promotionPrice: null,
  promotionStartAt: null,
  promotionEndAt: null,
  displayPriceLabel: product.priceLabel,
  currentPrice: parseProductPriceAmount(product.priceLabel),
  isPromotionActive: false,
  discountPercentage: null,
  publishedAt: null,
  updatedAt: null,
  displayBadge: isReservedAutomaticProductBadge(product.badge)
    ? ""
    : product.badge,
  isNew: false,
  newBadgeExpiresAt: null,
  newBadgeDurationDays: 0,
  confirmedOrderCount: 0,
  confirmedQuantity: 0,
  popularityRank: null,
  isPopular: false,
  status: "published",
  isActive: true,
  types: [],
  variants: [
    {
      id: "default",
      colorName: "Couleur unique",
      colorHex: "#D8C4A3",
      images: product.image ? [product.image] : [],
      sizes: [{ size: DEFAULT_CLOTHING_SIZE, stock: product.stock }],
      stock: product.stock,
    },
  ],
  availability: getAvailabilityFromStock(product.stock),
}));
