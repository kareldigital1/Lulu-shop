"use client";

import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="error-page error-page--server" id="main-content">
      <div className="error-page-card" role="alert" aria-live="assertive">
        <Link href="/" className="error-brand" aria-label="Tata Lulu Shop - retour à l'accueil">
          tata lulu shop
        </Link>
        <p className="error-eyebrow">Erreur temporaire</p>
        <p className="error-code" aria-hidden="true">
          500
        </p>
        <h1 className="error-title">La boutique fait une courte pause</h1>
        <p className="error-text">
          Un imprévu empêche cette page de s&apos;afficher. Réessayez dans un
          instant : votre panier reste enregistré.
        </p>
        <div className="error-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={reset}>
            <RefreshCw size={17} strokeWidth={1.75} aria-hidden="true" />
            Réessayer
          </button>
          <Link href="/" className="btn btn-outline btn-lg">
            <Home size={17} strokeWidth={1.75} aria-hidden="true" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
