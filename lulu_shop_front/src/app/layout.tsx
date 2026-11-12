import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./storefront.css";
import "./product-images.css";
import "./admin-profile.css";
import "./admin-login.css";
import "./admin-dashboard-analytics.css";
import "./admin-catalog-filters.css";
import "./admin-customers.css";
import "./admin-notifications.css";
import "./admin-system.css";
import "./admin-store.css";
import "./admin-documents.css";
import "./admin-product-variants.css";
import "./admin-product-lifecycle.css";
import "./admin-orders.css";
import "./admin-audit.css";
import "./admin-stock-history.css";
import "./admin-restock.css";
import "./admin-backup.css";
import "./confirmation-dialog.css";
import "./store-product-variants.css";
import "./home-compact.css";
import "./site-loading.css";
import { CartProvider } from "@/presentation/providers/cart-provider";
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_NAME,
} from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Polices auto-hébergées par next/font : aucun appel à Google Fonts au
 * runtime, donc pas de requête bloquante vers un tiers.
 *
 * `display: "swap"` affiche immédiatement le texte avec la police de repli
 * puis l'échange : le contenu est lisible tout de suite au lieu d'attendre le
 * téléchargement de la police.
 *
 * Les graisses sont limitées à celles réellement utilisées par le design
 * system (400/500/600/700) : chaque graisse superflue serait du poids
 * téléchargé pour rien.
 */

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "fr_BJ",
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  icons: {
    // Google prioritizes this high-resolution, square brand mark in search results.
    icon: [
      {
        url: "/images/favicon-round-preview.png",
        type: "image/png",
        sizes: "512x512",
      },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: ["/favicon.ico"],
    apple: ["/images/favicon-round-preview.png"],
  },
};

/**
 * `themeColor` colore la barre d'adresse du navigateur mobile aux teintes de
 * la marque : le site paraît intégré au système plutôt que posé dessus.
 */
export const viewport: Viewport = {
  themeColor: "#8c3b4a",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`no-js ${montserrat.variable} ${playfair.variable} ${cormorant.variable}`}
    >
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
