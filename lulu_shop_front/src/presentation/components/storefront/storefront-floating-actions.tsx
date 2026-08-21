"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { WhatsappIcon } from "@/presentation/components/ui/brand-icons";

type StorefrontFloatingActionsProps = {
  whatsappUrl: string;
};

export function StorefrontFloatingActions({ whatsappUrl }: StorefrontFloatingActionsProps) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const updateButton = () => {
      setShowBackToTop(window.scrollY > 500);
    };

    updateButton();
    window.addEventListener("scroll", updateButton, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateButton);
    };
  }, []);

  return (
    <>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-float"
        id="whatsappFloat"
        aria-label="Commander sur WhatsApp (nouvel onglet)"
      >
        <span className="whatsapp-float-tooltip" aria-hidden="true">
          Discutons !
        </span>
        <WhatsappIcon size={26} />
      </a>

      <button
        type="button"
        className={`back-to-top ${showBackToTop ? "visible" : ""}`}
        id="backToTop"
        aria-label="Retour en haut de page"
        // Retiré du parcours clavier tant qu'il est invisible : sinon on
        // tabule sur un bouton qu'on ne voit pas.
        tabIndex={showBackToTop ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </>
  );
}
