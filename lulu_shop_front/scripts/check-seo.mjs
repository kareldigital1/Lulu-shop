const requestBaseUrl = (
  process.env.SEO_BASE_URL ?? "http://127.0.0.1:3000"
).replace(/\/+$/, "");
const publicBaseUrl = (
  process.env.SEO_PUBLIC_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchText(pathname) {
  const response = await fetch(`${requestBaseUrl}${pathname}`, {
    headers: {
      "user-agent": "Googlebot",
    },
  });

  assert(response.ok, `${pathname} répond en HTTP ${response.status}.`);
  return response.text();
}

function getTagAttribute(html, tagName, matcher, attributeName) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];

  for (const tag of tags) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([:\w-]+)=(?:"([^"]*)"|'([^']*)')/g)].map(
        (match) => [match[1].toLocaleLowerCase("en"), match[2] ?? match[3]],
      ),
    );

    if (matcher(attributes)) {
      return attributes[attributeName];
    }
  }

  return undefined;
}

function getMeta(html, key, value) {
  return getTagAttribute(
    html,
    "meta",
    (attributes) => attributes[key] === value,
    "content",
  );
}

function getCanonical(html) {
  return getTagAttribute(
    html,
    "link",
    (attributes) => attributes.rel === "canonical",
    "href",
  );
}

function getJsonLd(html) {
  return [...html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )].map((match) => JSON.parse(match[1]));
}

function normalizeUrl(value) {
  const url = new URL(value);
  const pathname =
    url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

  return `${url.origin}${pathname}${url.search}`;
}

async function checkPublicPage(pathname) {
  const html = await fetchText(pathname);
  const expectedCanonical = new URL(pathname, `${publicBaseUrl}/`).toString();

  assert(/<title>[^<]+<\/title>/i.test(html), `${pathname} n'a pas de titre.`);
  assert(
    Boolean(getMeta(html, "name", "description")),
    `${pathname} n'a pas de description.`,
  );
  assert(
    getCanonical(html) &&
      normalizeUrl(getCanonical(html)) === normalizeUrl(expectedCanonical),
    `${pathname} a une canonical incorrecte.`,
  );
  assert(
    Boolean(getMeta(html, "property", "og:title")),
    `${pathname} n'a pas de titre Open Graph.`,
  );
  assert(
    Boolean(getMeta(html, "property", "og:image")),
    `${pathname} n'a pas d'image Open Graph.`,
  );
  assert(
    getMeta(html, "name", "twitter:card") === "summary_large_image",
    `${pathname} n'a pas de Twitter Card large.`,
  );
  assert(
    Boolean(getMeta(html, "name", "twitter:image")),
    `${pathname} n'a pas d'image Twitter.`,
  );

  return html;
}

async function main() {
  const robots = await fetchText("/robots.txt");
  const sitemap = await fetchText("/sitemap.xml");
  const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1],
  );
  const productUrl = sitemapUrls.find((url) => url.includes("/produits/"));

  assert(
    robots.includes(`Sitemap: ${publicBaseUrl}/sitemap.xml`),
    "robots.txt référence un sitemap incorrect.",
  );
  assert(!sitemap.includes("/admin"), "Le backoffice apparaît dans le sitemap.");
  assert(Boolean(productUrl), "Le sitemap ne contient aucune fiche produit.");

  const homeHtml = await checkPublicPage("/");
  await checkPublicPage("/produits");
  await checkPublicPage("/a-propos");
  const productPath = new URL(productUrl).pathname;
  const productHtml = await checkPublicPage(productPath);
  const homeJsonLd = getJsonLd(homeHtml);
  const productJsonLd = getJsonLd(productHtml).flat();
  const productSchema = productJsonLd.find(
    (entry) => entry?.["@type"] === "Product",
  );
  const breadcrumbSchema = productJsonLd.find(
    (entry) => entry?.["@type"] === "BreadcrumbList",
  );

  assert(
    homeJsonLd.some((entry) =>
      entry?.["@graph"]?.some(
        (node) => node?.["@type"] === "ClothingStore",
      ),
    ),
    "Les données structurées de la boutique sont absentes.",
  );
  assert(productSchema, "Les données structurées produit sont absentes.");
  assert(
    typeof productSchema.offers?.price === "number" &&
      productSchema.offers.price > 0,
    "Le prix structuré du produit est absent.",
  );
  assert(
    breadcrumbSchema,
    "Le fil d'Ariane structuré du produit est absent.",
  );

  const adminHtml = await fetchText("/admin");
  const adminRobots = getMeta(adminHtml, "name", "robots") ?? "";
  assert(adminRobots.includes("noindex"), "Le backoffice n'est pas en noindex.");

  console.info(
    JSON.stringify(
      {
        pages: ["/", "/produits", "/a-propos", productPath],
        sitemapUrls: sitemapUrls.length,
        productStructuredPrice: productSchema.offers.price,
        adminNoIndex: true,
      },
      null,
      2,
    ),
  );
  console.info("Contrôles SEO réussis.");
}

main().catch((error) => {
  console.error("Contrôles SEO échoués.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
