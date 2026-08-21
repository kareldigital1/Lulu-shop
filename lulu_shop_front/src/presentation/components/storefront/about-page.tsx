import type { Product } from "@/core/domain/models/product";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  Gem,
  Globe,
  Globe2,
  Handshake,
  Leaf,
  Locate,
  Shirt,
  Smile,
  Star,
  Tag,
  Tags,
  Truck,
} from "lucide-react";
import type { StoreContent } from "@/core/domain/models/store";
import { storefrontNavbarLinks } from "./storefront-links";
import { StorefrontFloatingActions } from "./storefront-floating-actions";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontNavigation } from "./storefront-navigation";

type AboutPageProps = {
  store: StoreContent;
  products: Product[];
};

const aboutNavigationLinks = storefrontNavbarLinks;

function getBenefitIcon(icon: string): ReactNode {
  const iconProps = { size: 24, strokeWidth: 1.6, "aria-hidden": true } as const;

  switch (icon) {
    case "sparkles":
      return <Gem {...iconProps} />;
    case "globe":
      return <Globe2 {...iconProps} />;
    case "tag":
      return <Tag {...iconProps} />;
    case "shirt":
      return <Shirt {...iconProps} />;
    case "truck":
      return <Truck {...iconProps} />;
    case "service":
      return <Smile {...iconProps} />;
    default:
      return <Star {...iconProps} />;
  }
}

function getAboutValueIcon(value: string): ReactNode {
  const normalized = value.toLowerCase();
  const iconProps = { size: 14, strokeWidth: 2, "aria-hidden": true } as const;

  if (normalized.includes("qualit")) {
    return <CheckCircle2 {...iconProps} />;
  }
  if (normalized.includes("import")) {
    return <Globe {...iconProps} />;
  }
  if (normalized.includes("unique")) {
    return <Handshake {...iconProps} />;
  }
  if (normalized.includes("prix")) {
    return <Tags {...iconProps} />;
  }
  if (normalized.includes("durable")) {
    return <Leaf {...iconProps} />;
  }

  return <Star {...iconProps} />;
}

export function AboutPage({ store, products }: AboutPageProps) {
  return (
    <>
      <StorefrontNavigation store={store} products={products} links={aboutNavigationLinks} logoHref="/" />

      <main id="main-content">
        <section className="section about-page-story">
          <div className="container">
            <div className="about-page-grid">
              <div className="about-visual">
                <div className="about-img-card" role="img" aria-label="Sélection de vêtements au marché" />
                <div className="about-img-card" role="img" aria-label="Tata Lulu dans sa boutique" />
                <div className="about-img-card" role="img" aria-label="Cliente satisfaite de Tata Lulu Shop" />
              </div>

              <div className="about-text about-page-copy-block">
                <p className="section-label left">Notre histoire</p>
                <h2 className="about-page-subtitle">{store.about.title}</h2>
                <p>{store.about.subtitle}</p>
                {store.about.paragraphs.map((paragraph) => (
                  <p key={paragraph}>
                    {paragraph.startsWith(store.name) ? <strong>{store.name}</strong> : null}
                    {paragraph.startsWith(store.name) ? paragraph.slice(store.name.length) : paragraph}
                  </p>
                ))}

                <div className="about-values">
                  {store.about.values.map((value) => (
                    <span className="about-value-tag" key={value}>
                      {getAboutValueIcon(value)} {value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section about-page-commitments">
          <div className="container">
            <p className="section-label">Nos Engagements</p>
            <h2 className="section-title">Ce qui fait la différence Lulu</h2>
            <p className="section-subtitle">{store.about.mission}</p>

            <div className="benefits-grid">
              {store.benefitsSection.items.map((item) => (
                <div className="benefit-card" key={item.title}>
                  <div className="benefit-icon">{getBenefitIcon(item.icon)}</div>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section about-page-details">
          <div className="container about-page-detail-grid">
            <div className="about-page-panel">
              <p className="section-label left">La Boutique</p>
              <h3>Où nous trouver et comment acheter</h3>
              <p>
                Nous sommes installés à {store.locationSection.addressLines.join(", ")}. Si tu veux aller vite, ouvre
                directement la carte ou écris-nous sur WhatsApp pour confirmer la disponibilité d&apos;un article.
              </p>
              <div className="about-page-actions">
                <a
                  href={store.locationSection.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                >
                  <Locate size={16} strokeWidth={1.75} aria-hidden="true" />
                  Voir l&apos;itinéraire
                </a>
              </div>
            </div>

            <div className="about-page-info-cards">
              <div className="about-page-info-card">
                <span>Horaires</span>
                <strong>{store.locationSection.openingHours}</strong>
              </div>
              <div className="about-page-info-card">
                <span>Téléphone</span>
                <strong>{store.primaryPhone}</strong>
              </div>
              <div className="about-page-info-card">
                <span>Email</span>
                <strong>{store.email}</strong>
              </div>
              <div className="about-page-info-card">
                <span>Coordonnées GPS</span>
                <strong>
                  {store.locationSection.gps.latitude}, {store.locationSection.gps.longitude}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </main>

      <StorefrontFooter store={store} navigationLinks={aboutNavigationLinks} />
      <StorefrontFloatingActions whatsappUrl={store.whatsappUrl} />
    </>
  );
}
