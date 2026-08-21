import type { Product } from "@/core/domain/models/product";
import type { StoreContent } from "@/core/domain/models/store";
import { ProductCatalog } from "./product-catalog";
import { storefrontNavbarLinks } from "./storefront-links";
import { StorefrontFloatingActions } from "./storefront-floating-actions";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontNavigation } from "./storefront-navigation";

type CatalogPageProps = {
  store: StoreContent;
  products: Product[];
};

const catalogNavigationLinks = storefrontNavbarLinks;

export function CatalogPage({ store, products }: CatalogPageProps) {
  return (
    <>
      <StorefrontNavigation store={store} products={products} links={catalogNavigationLinks} logoHref="/" />

      <main id="main-content">
        <ProductCatalog
          products={products}
          mode="catalog"
          label="Catalogue complet"
          title="Tous les produits de Tata Lulu Shop"
          subtitle="Filtre rapidement par catégorie, disponibilité ou mot-clé pour trouver exactement ce qu'il te faut."
          sectionId="catalogue"
        />
      </main>

      <StorefrontFooter store={store} navigationLinks={catalogNavigationLinks} />
      <StorefrontFloatingActions whatsappUrl={store.whatsappUrl} />
    </>
  );
}
