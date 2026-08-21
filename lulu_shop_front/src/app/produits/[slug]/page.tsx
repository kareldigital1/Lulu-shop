import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getProductGroup } from "@/lib/product-category-groups";
import { loadStorefrontData } from "@/lib/load-storefront-data";
import { normalizeProductSlug } from "@/lib/product-slug";
import { createPageMetadata } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/serialize-json-ld";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { ProductDetailPage } from "@/presentation/components/storefront/product-detail-page";

type ProductDetailRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

async function getProductBySlug(slug: string) {
  const { store, products } = await loadStorefrontData();
  const normalizedSlug = normalizeProductSlug(slug);
  const activeProducts = products
    .filter((product) => product.isActive)
    .sort((left, right) => left.order - right.order);

  const product = activeProducts.find(
    (entry) => normalizeProductSlug(entry.slug) === normalizedSlug,
  );

  if (!product) {
    return null;
  }

  const relatedProducts = activeProducts
    .filter((entry) => entry.slug !== slug)
    .filter((entry) => getProductGroup(entry.category) === getProductGroup(product.category) || entry.featured)
    .slice(0, 3);

  return { store, product, products: activeProducts, relatedProducts };
}

export async function generateMetadata({ params }: ProductDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);

  if (!data) {
    return {
      title: "Produit introuvable | Tata Lulu Shop",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return createPageMetadata({
    title: `${data.product.name} | Tata Lulu Shop`,
    description: data.product.description,
    path: `/produits/${data.product.slug}`,
    image: {
      url: data.product.image,
      alt: data.product.name,
    },
  });
}

export default async function ProductPage({ params }: ProductDetailRouteProps) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);

  if (!data) {
    notFound();
  }

  if (slug !== data.product.slug) {
    permanentRedirect(`/produits/${data.product.slug}`);
  }

  const productUrl = getAbsoluteSiteUrl(`/produits/${data.product.slug}`);
  const productImages = Array.from(
    new Set([
      data.product.image,
      ...data.product.variants.flatMap((variant) => variant.images),
    ]),
  )
    .filter(Boolean)
    .map((image) =>
      image.startsWith("http") ? image : getAbsoluteSiteUrl(image),
    );
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": `${productUrl}#product`,
      name: data.product.name,
      url: productUrl,
      sku: data.product.reference,
      category: data.product.category,
      image: productImages,
      description: data.product.description,
      brand: {
        "@type": "Brand",
        name: data.store.name,
      },
      ...(data.product.currentPrice
        ? {
            offers: {
              "@type": "Offer",
              availability:
                data.product.stock > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              price: data.product.currentPrice,
              priceCurrency: "XOF",
              url: productUrl,
              seller: {
                "@type": "Organization",
                name: data.store.name,
              },
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Accueil",
          item: getAbsoluteSiteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Catalogue",
          item: getAbsoluteSiteUrl("/produits"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: data.product.name,
          item: productUrl,
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <ProductDetailPage
        key={data.product.slug}
        store={data.store}
        product={data.product}
        products={data.products}
        relatedProducts={data.relatedProducts}
      />
    </>
  );
}
