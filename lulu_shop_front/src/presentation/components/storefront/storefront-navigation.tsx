"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag, UserRound } from "lucide-react";
import type { Product } from "@/core/domain/models/product";
import type { StoreContent } from "@/core/domain/models/store";
import { useCart } from "@/presentation/providers/cart-provider";
import { CartDrawer } from "./cart-drawer";

type NavigationLink = {
  label: string;
  href: string;
};

type StorefrontNavigationProps = {
  store: StoreContent;
  products: Product[];
  links: NavigationLink[];
  logoHref?: string;
};

export function StorefrontNavigation({
  store,
  products,
  links,
  logoHref = "/",
}: StorefrontNavigationProps) {
  const { totalItems, hasHydrated, isCartOpen, openCart } = useCart();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const brandWordmark = store.name.toLowerCase();

  useEffect(() => {
    if (!store.faviconUrl) return;

    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = store.faviconUrl;
  }, [store.faviconUrl]);

  useEffect(() => {
    const updateNavbar = () => {
      setIsScrolled(window.scrollY > 60);
    };

    updateNavbar();
    window.addEventListener("scroll", updateNavbar, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateNavbar);
    };
  }, []);

  useEffect(() => {
    if (!isNavOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest("#navLinks") && !target.closest("#navToggle")) {
        setIsNavOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isNavOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNavOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Le tiroir mobile recouvre la page : on bloque le défilement du corps pour
  // éviter que l'arrière-plan glisse sous le menu ouvert. On rend aussi le
  // focus au bouton à la fermeture, afin que la navigation clavier ne reparte
  // pas du début du document.
  useEffect(() => {
    if (!isNavOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const toggleElement = toggleRef.current;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      toggleElement?.focus();
    };
  }, [isNavOpen]);

  function closeNav() {
    setIsNavOpen(false);
  }
  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>

      {isNavOpen ? (
        <button type="button" className="nav-mobile-overlay" aria-label="Fermer le menu" onClick={closeNav} />
      ) : null}

      <nav
        className={`navbar ${isScrolled ? "scrolled" : ""}`}
        id="navbar"
        aria-label="Navigation principale"
      >
        <button
          ref={toggleRef}
          type="button"
          className={`nav-toggle ${isNavOpen ? "active" : ""}`}
          id="navToggle"
          aria-label={isNavOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isNavOpen}
          aria-controls="navLinks"
          onClick={() => setIsNavOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <Link href={logoHref} className="nav-logo" aria-label={`${store.name} - retour à l'accueil`} onClick={closeNav}>
          <span className="nav-logo-wordmark">{brandWordmark}</span>
        </Link>

        <ul className={`nav-links ${isNavOpen ? "active" : ""}`} id="navLinks">
          {links.map((link) => (
            <li key={`${link.label}-${link.href}`}>
              <Link href={link.href} onClick={closeNav}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <Link
            href="/admin"
            className="nav-icon-link"
            aria-label="Connexion administrateur"
            title="Connexion"
            onClick={closeNav}
          >
            <UserRound size={21} strokeWidth={1.9} aria-hidden="true" />
          </Link>

          <button
            type="button"
            className="nav-icon-link nav-cart-link"
            aria-label="Voir le panier"
            aria-expanded={isCartOpen}
            aria-controls="cartDrawer"
            onClick={() => {
              closeNav();
              openCart();
            }}
          >
            <ShoppingBag size={22} strokeWidth={2.05} className="nav-cart-icon" aria-hidden="true" />
            {hasHydrated && totalItems > 0 ? (
              <span className="nav-cart-count" aria-hidden="true">
                {totalItems}
              </span>
            ) : null}
            {hasHydrated && totalItems > 0 ? (
              <span className="sr-only">
                {totalItems} article{totalItems > 1 ? "s" : ""} dans le panier
              </span>
            ) : null}
          </button>
        </div>
      </nav>

      <CartDrawer store={store} products={products} />
    </>
  );
}
