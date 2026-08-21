import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram } from "lucide-react";
import type { StoreContent } from "@/core/domain/models/store";
import { TiktokIcon, WhatsappIcon } from "@/presentation/components/ui/brand-icons";

type NavigationLink = {
  label: string;
  href: string;
};

type StorefrontFooterProps = {
  store: StoreContent;
  navigationLinks: NavigationLink[];
  productsPageHref?: string;
};

export function StorefrontFooter({
  store,
  navigationLinks,
  productsPageHref = "/produits",
}: StorefrontFooterProps) {
  const whatsappBaseUrl = `https://wa.me/${store.whatsappNumber.replace(/[^\d]/g, "")}`;
  const footerCategories = store.categories;
  const footerLinks = [
    { label: "Accueil", href: "/" },
    { label: "À propos", href: "/a-propos" },
    { label: "Catalogue", href: productsPageHref },
    { label: "Contact", href: "/#contact" },
    ...navigationLinks,
  ].filter((link, index, array) => array.findIndex((entry) => entry.href === link.href) === index);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-logo-text">
              <span className="footer-logo-mark" aria-hidden="true">
                <Image src={store.faviconUrl || "/favicon.ico"} alt="" width={36} height={36} unoptimized />
              </span>
              <span>{store.name}</span>
            </div>
            <p className="footer-tagline">{store.footerTagline}</p>
            <p className="footer-description">{store.footerDescription}</p>
          </div>

          <nav className="footer-col" aria-label="Navigation du pied de page">
            <h4>Navigation</h4>
            <ul>
              {footerLinks.slice(0, 5).map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer-col">
            <h4>Catégories</h4>
            <ul>
              {footerCategories.map((category) => (
                <li key={category}>
                  <Link href={`${productsPageHref}?category=${encodeURIComponent(category)}`}>{category}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>Suivez-nous</h4>
            <div className="footer-social">
              {store.facebookUrl ? (
                <a href={store.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook (nouvel onglet)">
                  <Facebook size={18} aria-hidden="true" />
                </a>
              ) : null}
              {store.instagramUrl ? (
                <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram (nouvel onglet)">
                  <Instagram size={18} aria-hidden="true" />
                </a>
              ) : null}
              <a href={store.tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok (nouvel onglet)">
                <TiktokIcon size={18} />
              </a>
              <a href={whatsappBaseUrl} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp (nouvel onglet)">
                <WhatsappIcon size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          © {new Date().getFullYear()} {store.name}. Tous droits réservés. Made with{" "}
          <span className="footer-heart" aria-hidden="true">
            ♥
          </span>{" "}
          in Benin.
          <br />
          Site réalisé par <strong>KStalker</strong>
        </div>
      </div>
    </footer>
  );
}
