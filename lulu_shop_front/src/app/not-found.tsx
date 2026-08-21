import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

export default function NotFound() {
  return (
    <main className="error-page" id="main-content">
      <div className="error-page-card">
        <Link href="/" className="error-brand" aria-label="Tata Lulu Shop - retour à l'accueil">
          tata lulu shop
        </Link>
        <p className="error-eyebrow">Page introuvable</p>
        <p className="error-code" aria-hidden="true">
          404
        </p>
        <h1 className="error-title">Cette page a quitté la boutique</h1>
        <p className="error-text">
          Le lien est peut-être ancien, ou l&apos;article n&apos;est plus en ligne.
          Le catalogue, lui, est toujours là et se met à jour régulièrement.
        </p>
        <div className="error-actions">
          <Link href="/produits" className="btn btn-primary btn-lg">
            <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />
            Voir le catalogue
          </Link>
          <Link href="/" className="btn btn-outline btn-lg">
            <ArrowLeft size={17} strokeWidth={1.75} aria-hidden="true" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
