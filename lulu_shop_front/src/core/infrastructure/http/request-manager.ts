import axios from "axios";

export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export const requestManager = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
});

type ApiErrorPayload = {
  message?: unknown;
  reference?: unknown;
};

function readApiErrorPayload(value: unknown): ApiErrorPayload {
  return value && typeof value === "object" ? (value as ApiErrorPayload) : {};
}

function appendErrorReference(message: string, reference: unknown) {
  return typeof reference === "string" && /^ERR-[A-Z0-9]{4,12}$/.test(reference)
    ? `${message}\nRéférence : ${reference}`
    : message;
}

function logDevelopmentError(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  if (axios.isAxiosError(error)) {
    const payload = readApiErrorPayload(error.response?.data);
    const url = error.config?.url?.split("?")[0];
    const status = error.response?.status;
    const details = {
      method: error.config?.method?.toUpperCase(),
      url,
      status,
      reference: payload.reference,
      message: error.message,
    };

    // Un refus métier attendu ne doit pas déclencher l'overlay d'erreur Next.js.
    if (status && status >= 400 && status < 500) {
      console.warn("[Tata Lulu Shop] Requête refusée", details);
      return;
    }

    console.error("[Tata Lulu Shop] Échec d’une requête", {
      ...details,
      stack: error.stack,
    });
    return;
  }

  if (error instanceof Error) {
    console.error("[Tata Lulu Shop] Erreur inattendue", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  logDevelopmentError(error);

  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = readApiErrorPayload(error.response?.data);
  const reference = data.reference;

  if (!error.response || error.response.status >= 500) {
    return appendErrorReference(fallback, reference);
  }

  if (
    typeof data.message === "string" &&
    data.message.trim()
  ) {
    return appendErrorReference(data.message.trim(), reference);
  }

  return appendErrorReference(fallback, reference);
}

export function resolveApiAssetUrl(reference: string) {
  return reference.startsWith("/api/") ? `${apiBaseUrl}${reference}` : reference;
}

export function toApiAssetReference(reference: string) {
  return reference.startsWith(`${apiBaseUrl}/api/`)
    ? reference.slice(apiBaseUrl.length)
    : reference;
}
