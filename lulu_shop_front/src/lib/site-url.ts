const LOCAL_SITE_URL = "http://localhost:3000";

function getConfiguredSiteUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return LOCAL_SITE_URL;
}

export function getSiteUrl() {
  const url = new URL(getConfiguredSiteUrl());

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("NEXT_PUBLIC_APP_URL doit utiliser HTTP ou HTTPS.");
  }

  return new URL(url.origin);
}

export function getAbsoluteSiteUrl(pathname = "/") {
  return new URL(pathname, getSiteUrl()).toString();
}
