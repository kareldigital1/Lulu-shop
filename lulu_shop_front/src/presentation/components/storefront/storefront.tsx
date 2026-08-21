"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCircle2,
  Clock,
  Globe2,
  Locate,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Star,
  Truck,
} from "lucide-react";
import type { ContactRequestInput } from "@/core/domain/models/contact-request";
import {
  getPopularProducts,
  type Product,
} from "@/core/domain/models/product";
import type { StoreContent } from "@/core/domain/models/store";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { sendContactRequest } from "@/core/domain/use-cases/send-contact-request.use-case";
import type { ContactRequestRepository } from "@/core/domain/repositories/contact-request.repository";
import { contactRequestRepository } from "@/lib/container";
import { ProductCatalog } from "./product-catalog";
import { ProductPhotoBackdrop } from "./product-photo-backdrop";
import { storefrontNavbarLinks } from "./storefront-links";
import { StorefrontFloatingActions } from "./storefront-floating-actions";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontNavigation } from "./storefront-navigation";

type StorefrontProps = {
  store: StoreContent;
  products: Product[];
  /**
   * Injectable pour les tests et la réutilisation : par défaut, le composant
   * reprend l'implémentation câblée dans le composition root.
   */
  contactRequests?: ContactRequestRepository;
};

type ContactStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const initialContactValues: ContactRequestInput = {
  name: "",
  email: "",
  phone: "",
  message: "",
};

const homeNavigationLinks = storefrontNavbarLinks;

function formatHeroLabel(label: string, suffix: string) {
  return suffix === "%" ? `% ${label}` : label;
}

export function Storefront({
  store,
  products,
  contactRequests = contactRequestRepository,
}: StorefrontProps) {
  const [contactValues, setContactValues] = useState<ContactRequestInput>(initialContactValues);
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof ContactRequestInput, boolean>>>({});
  const [contactStatus, setContactStatus] = useState<ContactStatus>({ type: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeProducts = products.filter((product) => product.isActive).sort((left, right) => left.order - right.order);
  const popularProducts = getPopularProducts(activeProducts);
  const hasPopularProducts = popularProducts.length > 0;
  const homepageProducts = hasPopularProducts
    ? popularProducts
    : activeProducts;
  const heroProduct = activeProducts[0];

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("no-js");
    root.classList.add("js");

    return () => {
      root.classList.remove("js");
      root.classList.add("no-js");
    };
  }, []);

  useEffect(() => {
    const revealElements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

    if (!("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [products.length]);

  useEffect(() => {
    const statNumbers = Array.from(document.querySelectorAll<HTMLElement>(".hero-stat-number[data-count]"));

    // Le compteur animé est purement décoratif : si l'utilisateur a demandé
    // un mouvement réduit, on affiche directement la valeur finale.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const showFinalValues = () => {
      statNumbers.forEach((element) => {
        const target = Number.parseInt(element.dataset.count ?? "0", 10);
        const suffix = element.dataset.suffix ?? "";
        element.textContent = `${target.toLocaleString()}${suffix}`;
      });
    };

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      showFinalValues();
      return undefined;
    }

    const animateCounter = (element: HTMLElement, target: number, suffix: string) => {
      const duration = 2000;
      const startTime = performance.now();

      const updateCounter = (timestamp: number) => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - (1 - progress) ** 3;
        const current = Math.round(target * easeOut);

        element.textContent = `${current.toLocaleString()}${suffix}`;

        if (progress < 1) {
          window.requestAnimationFrame(updateCounter);
        } else {
          element.textContent = `${target.toLocaleString()}${suffix}`;
        }
      };

      window.requestAnimationFrame(updateCounter);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const element = entry.target as HTMLElement;
          const target = Number.parseInt(element.dataset.count ?? "0", 10);
          const suffix = element.dataset.suffix ?? "";

          animateCounter(element, target, suffix);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.6 },
    );

    statNumbers.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [store.heroStats]);

  useEffect(() => {
    if (contactStatus.type !== "success") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setContactStatus({ type: "idle", message: "" });
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [contactStatus]);

  function updateContactField(field: keyof ContactRequestInput, value: string) {
    setContactValues((current) => ({
      ...current,
      [field]: value,
    }));

    if (contactErrors[field]) {
      setContactErrors((current) => ({
        ...current,
        [field]: false,
      }));
    }
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors: Partial<Record<keyof ContactRequestInput, boolean>> = {
      name: !contactValues.name.trim(),
      email: !contactValues.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValues.email.trim()),
      message: !contactValues.message.trim(),
    };

    setContactErrors(errors);
    setContactStatus({ type: "idle", message: "" });

    if (errors.name || errors.email || errors.message) {
      return;
    }

    setIsSubmitting(true);

    try {
      await sendContactRequest(contactRequests, contactValues);
      setContactValues(initialContactValues);
      setContactStatus({
        type: "success",
        message: store.contactSection.successMessage,
      });
    } catch (requestError) {
      setContactStatus({
        type: "error",
        message: getApiErrorMessage(
          requestError,
          "Le message n’a pas pu être envoyé pour le moment. Veuillez réessayer.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <StorefrontNavigation store={store} products={products} links={storefrontNavbarLinks} logoHref="#hero" />

      <main id="main-content">
        <section className="hero" id="hero">
          <div className="hero-bg-orb orb-1" aria-hidden="true" />
          <div className="hero-bg-orb orb-2" aria-hidden="true" />
          <div className="hero-bg-orb orb-3" aria-hidden="true" />

          <div className="hero-container">
            <div className="hero-text">
              <span className="hero-badge">
                <Globe2 size={14} strokeWidth={2} aria-hidden="true" />
                {store.heroBadge}
              </span>

              <h1 className="hero-title">
                {store.heroTitle}
                <span>{store.heroHighlight}</span>
              </h1>

              <p className="hero-subtitle">{store.heroDescription}</p>

              {store.heroCtas.some((cta) => cta.enabled && cta.label && cta.url) ? (
                <div className="hero-actions">
                  {store.heroCtas
                    .filter((cta) => cta.enabled && cta.label && cta.url)
                    .map((cta, index) => (
                      <a className={`btn ${index === 0 ? "btn-primary" : "btn-outline"}`} href={cta.url} key={`${cta.label}-${cta.url}`}>
                        {cta.label}
                      </a>
                    ))}
                </div>
              ) : null}

              <div className="hero-stats">
                {store.heroStats.map((stat) => (
                  <div className="hero-stat" key={stat.label}>
                    <div className="hero-stat-number" data-count={stat.value} data-suffix={stat.suffix}>
                      0
                    </div>
                    <div className="hero-stat-label">{formatHeroLabel(stat.label, stat.suffix)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-product-card">
                <div className="hero-product-glow" aria-hidden="true" />
                <div className="hero-product-img">
                  {store.heroImageUrl || heroProduct ? (
                    <ProductPhotoBackdrop src={store.heroImageUrl || heroProduct?.image || ""} />
                  ) : null}
                  <Image
                    src={store.heroImageUrl || heroProduct?.image || "/images/robe.png"}
                    alt={store.heroImageUrl ? `Sélection ${store.name}` : heroProduct?.name ?? "Robe de friperie femme chez Tata Lulu Shop à Abomey-Calavi"}
                    width={600}
                    height={760}
                    preload
                    sizes="(max-width: 900px) 75vw, 32vw"
                    quality={82}
                  />
                </div>
                <div style={{ textAlign: "center", marginTop: 14, position: "relative", zIndex: 1 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-primary-text)" }}>
                    {heroProduct?.name ?? "Robe Élégance"}
                  </p>
                  <p style={{ fontSize: "0.7rem", color: "var(--color-accent-dark)", letterSpacing: "1px" }}>
                    {heroProduct?.category ?? "Fripes de Luxe"}
                  </p>
                </div>
              </div>

              <div className="hero-floating-tag tag-1">
                <Star size={13} strokeWidth={2} aria-hidden="true" />
                Qualité Premium
              </div>
              <div className="hero-floating-tag tag-2">
                <Truck size={13} strokeWidth={2} aria-hidden="true" />
                Livraison rapide
              </div>
            </div>
          </div>
        </section>

        <ProductCatalog
          products={homepageProducts}
          mode="preview"
          label={
            hasPopularProducts
              ? "Les plus commandées"
              : "Sélection Tata Lulu"
          }
          title={
            hasPopularProducts
              ? "Les favorites de nos clientes"
              : "Nos pièces à découvrir"
          }
          subtitle={
            hasPopularProducts
              ? "Un classement vivant, calculé uniquement à partir des commandes confirmées."
              : "Une sélection courte en attendant les premières commandes confirmées."
          }
          sectionId="best-sellers"
          previewCount={4}
          ctaHref="/produits"
          ctaLabel="Voir tout le catalogue"
        />

        <section className="section" id="location">
          <div className="container">
            <p className="section-label reveal">Localisation</p>
            <p className="section-subtitle reveal reveal-delay-2">{store.locationSection.subtitle}</p>

            <div className="location-shell">
              <div className="location-card reveal reveal-delay-2">
                <div className="location-meta">
                  <div className="location-meta-item">
                    <div className="location-meta-icon">
                      <MapPin size={18} strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div>
                      <strong>Adresse</strong>
                      <span>{store.locationSection.addressLines.join(", ")}</span>
                    </div>
                  </div>

                  <div className="location-meta-item">
                    <div className="location-meta-icon">
                      <Clock size={18} strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div>
                      <strong>Horaires</strong>
                      <span>{store.locationSection.openingHours}</span>
                    </div>
                  </div>

                  <div className="location-meta-item">
                    <div className="location-meta-icon">
                      <Locate size={18} strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div>
                      <strong>Coordonnées GPS</strong>
                      <span>
                        {store.locationSection.gps.latitude}, {store.locationSection.gps.longitude}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="location-actions">
                  <a
                    href={store.locationSection.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    <Locate size={16} strokeWidth={1.75} aria-hidden="true" />
                    Ouvrir Google Maps
                  </a>
                </div>
              </div>

              <div className="location-map-stage reveal reveal-delay-3">
                <iframe
                  src={store.locationSection.mapEmbedUrl}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Carte Google Maps de ${store.name}`}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="contact">
          <div className="container">
            <p className="section-label reveal">Contactez-nous</p>
            <h2 className="section-title reveal reveal-delay-1">{store.contactSection.title}</h2>
            <p className="section-subtitle reveal reveal-delay-2">{store.contactSection.subtitle}</p>

            <div className="contact-grid">
              <form
                className="contact-form reveal reveal-delay-2"
                id="contactForm"
                onSubmit={(event) => void handleContactSubmit(event)}
                noValidate
              >
                {/* Chaque champ porte un libellé masqué visuellement : le
                    placeholder seul disparaît à la saisie et n'est pas un
                    substitut valable pour un lecteur d'écran. */}
                <div>
                  <label className="sr-only" htmlFor="contactName">
                    Votre nom complet
                  </label>
                  <input
                    type="text"
                    placeholder="Votre nom complet"
                    id="contactName"
                    name="nom"
                    autoComplete="name"
                    value={contactValues.name}
                    onChange={(event) => updateContactField("name", event.target.value)}
                    className={contactErrors.name ? "form-error" : ""}
                    aria-invalid={contactErrors.name ? true : undefined}
                    required
                  />
                </div>

                <div>
                  <label className="sr-only" htmlFor="contactEmail">
                    Votre adresse email
                  </label>
                  <input
                    type="email"
                    placeholder="Votre adresse email"
                    id="contactEmail"
                    name="email"
                    autoComplete="email"
                    value={contactValues.email}
                    onChange={(event) => updateContactField("email", event.target.value)}
                    className={contactErrors.email ? "form-error" : ""}
                    aria-invalid={contactErrors.email ? true : undefined}
                    required
                  />
                </div>

                <div>
                  <label className="sr-only" htmlFor="contactPhone">
                    Votre numéro de téléphone (facultatif)
                  </label>
                  <input
                    type="tel"
                    placeholder="Votre numéro de téléphone (facultatif)"
                    id="contactPhone"
                    name="telephone"
                    autoComplete="tel"
                    value={contactValues.phone ?? ""}
                    onChange={(event) => updateContactField("phone", event.target.value)}
                  />
                </div>

                <div>
                  <label className="sr-only" htmlFor="contactMessage">
                    Votre message
                  </label>
                  <textarea
                    placeholder="Votre message..."
                    id="contactMessage"
                    name="message"
                    value={contactValues.message}
                    onChange={(event) => updateContactField("message", event.target.value)}
                    className={contactErrors.message ? "form-error" : ""}
                    aria-invalid={contactErrors.message ? true : undefined}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={isSubmitting}
                  data-loading={isSubmitting ? "true" : undefined}
                >
                  <Send size={16} strokeWidth={1.75} aria-hidden="true" />
                  {isSubmitting ? "Envoi..." : "Envoyer le message"}
                </button>

                {/* `role="status"` fait annoncer le résultat de l'envoi sans
                    déplacer le focus de l'utilisateur. */}
                <div role="status" aria-live="polite">
                  {contactStatus.type === "success" ? (
                    <div className="form-success-msg show" id="formSuccessMsg">
                      <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />
                      <span>{contactStatus.message}</span>
                    </div>
                  ) : null}

                  {contactStatus.type === "error" ? (
                    <div className="form-feedback-error">
                      <span>{contactStatus.message}</span>
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="contact-info reveal reveal-delay-3">
                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <Phone size={18} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="contact-info-text">
                    <h4>Téléphone</h4>
                    <p>
                      <a href={`tel:${store.primaryPhone.replace(/\s/g, "")}`}>{store.primaryPhone}</a>
                      <br />
                      <a href={`tel:${store.secondaryPhone.replace(/\s/g, "")}`}>{store.secondaryPhone}</a>
                    </p>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="contact-info-text">
                    <h4>Email</h4>
                    <a href={`mailto:${store.email}`}>{store.email}</a>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <MessageSquare size={18} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="contact-info-text">
                    <h4>WhatsApp</h4>
                    <p>
                      {store.whatsappNumber}
                      <br />
                      Réponse rapide garantie
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <StorefrontFooter store={store} navigationLinks={homeNavigationLinks} />
      <StorefrontFloatingActions whatsappUrl={store.whatsappUrl} />
    </>
  );
}
