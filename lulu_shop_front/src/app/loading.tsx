import Image from "next/image";

export default function Loading() {
  return (
    <main className="site-loading" aria-label="Chargement de Tata Lulu Shop" aria-busy="true">
      <div className="site-loading-content">
        <div className="site-loading-logo" aria-hidden="true">
          <Image
            src="/images/favicon-round-preview.png"
            alt=""
            width={64}
            height={64}
            preload
          />
        </div>

        <p className="site-loading-name">Tata Lulu Shop</p>

        <div className="site-loading-track" aria-hidden="true">
          <span />
        </div>

        <p className="site-loading-label">Chargement de la boutique</p>
      </div>
    </main>
  );
}
