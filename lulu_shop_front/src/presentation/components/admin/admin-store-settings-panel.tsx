"use client";

import {
  Building2,
  FileText,
  Globe2,
  ImagePlus,
  LoaderCircle,
  MapPinned,
  Save,
  SearchCheck,
  Share2,
  Store,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type {
  StoreContent,
  StoreSettingsInput,
} from "@/core/domain/models/store";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { uploadAdminProductImage } from "@/services/admin.service";
import {
  fetchAdminStoreSettings,
  updateAdminStoreSettings,
} from "@/services/store-settings.service";
import { Button } from "../ui/button";

type StoreSettingsTab = "identity" | "content" | "seo";
type ImageField = "logoUrl" | "faviconUrl" | "heroImageUrl" | "openGraphImageUrl" | "pdfLogoUrl";

type AdminStoreSettingsPanelProps = {
  token: string;
  onSaved?: (store: StoreContent) => void;
};

const EMPTY_SETTINGS: StoreSettingsInput = {
  name: "",
  footerTagline: "",
  footerDescription: "",
  fullDescription: "",
  logoUrl: "",
  faviconUrl: "",
  email: "",
  primaryPhone: "",
  whatsappNumber: "",
  whatsappUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  heroTitle: "",
  heroHighlight: "",
  heroDescription: "",
  heroImageUrl: "",
  heroCtas: [
    { enabled: false, label: "", url: "" },
    { enabled: false, label: "", url: "" },
  ],
  about: {
    title: "",
    subtitle: "",
    history: "",
    mission: "",
    presentation: "",
    values: [],
  },
  locationSection: {
    mapUrl: "",
    mapEmbedUrl: "",
    addressLines: [],
    city: "",
    country: "",
    latitude: 0,
    longitude: 0,
  },
  seoTitle: "",
  seoDescription: "",
  openGraphImageUrl: "",
  pdfSettings: {
    logoUrl: "",
    address: "",
    phone: "",
    email: "",
    footerText: "",
  },
};

function toSettings(store: StoreContent): StoreSettingsInput {
  const heroCtas = [...store.heroCtas];

  while (heroCtas.length < 2) {
    heroCtas.push({ enabled: false, label: "", url: "" });
  }

  return {
    name: store.name,
    footerTagline: store.footerTagline,
    footerDescription: store.footerDescription,
    fullDescription: store.fullDescription,
    logoUrl: store.logoUrl,
    faviconUrl: store.faviconUrl,
    email: store.email,
    primaryPhone: store.primaryPhone,
    whatsappNumber: store.whatsappNumber,
    whatsappUrl: store.whatsappUrl,
    facebookUrl: store.facebookUrl,
    instagramUrl: store.instagramUrl,
    tiktokUrl: store.tiktokUrl,
    heroTitle: store.heroTitle,
    heroHighlight: store.heroHighlight,
    heroDescription: store.heroDescription,
    heroImageUrl: store.heroImageUrl,
    heroCtas: heroCtas.slice(0, 2),
    about: {
      title: store.about.title,
      subtitle: store.about.subtitle,
      history: store.about.history,
      mission: store.about.mission,
      presentation: store.about.presentation,
      values: store.about.values,
    },
    locationSection: {
      mapUrl: store.locationSection.mapUrl,
      mapEmbedUrl: store.locationSection.mapEmbedUrl,
      addressLines: store.locationSection.addressLines,
      city: store.locationSection.city,
      country: store.locationSection.country,
      latitude: store.locationSection.gps.latitude,
      longitude: store.locationSection.gps.longitude,
    },
    seoTitle: store.seoTitle,
    seoDescription: store.seoDescription,
    openGraphImageUrl: store.openGraphImageUrl,
    pdfSettings: store.pdfSettings,
  };
}

function ImageSettingField({
  label,
  value,
  uploading,
  onFile,
}: {
  label: string;
  value: string;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label className="admin-store-image-field">
      <span>{label}</span>
      <span className="admin-store-image-control">
        <span className="admin-store-image-preview">
          {value ? (
            <Image src={value} alt="" width={64} height={64} unoptimized />
          ) : (
            <ImagePlus size={20} aria-hidden="true" />
          )}
        </span>
        <span className="admin-store-image-copy">
          <strong>{uploading ? "Envoi en cours..." : "Choisir une image"}</strong>
          <small>JPG, PNG ou WebP, 5 Mo maximum</small>
        </span>
        {uploading ? (
          <LoaderCircle className="admin-store-spinner" size={17} aria-hidden="true" />
        ) : null}
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}

export function AdminStoreSettingsPanel({
  token,
  onSaved,
}: AdminStoreSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<StoreSettingsTab>("identity");
  const [form, setForm] = useState<StoreSettingsInput>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const store = await fetchAdminStoreSettings(token);
        if (isActive) setForm(toSettings(store));
      } catch (requestError) {
        if (isActive) {
          setError(
            getApiErrorMessage(
              requestError,
              "Impossible de charger la configuration de la boutique.",
            ),
          );
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      isActive = false;
    };
  }, [token]);

  function setImageValue(field: ImageField, image: string) {
    setForm((current) => {
      if (field === "pdfLogoUrl") {
        return {
          ...current,
          pdfSettings: { ...current.pdfSettings, logoUrl: image },
        };
      }

      return { ...current, [field]: image };
    });
  }

  async function uploadImage(field: ImageField, file: File) {
    setUploadingField(field);
    setError("");
    setStatus("");

    try {
      const image = await uploadAdminProductImage(file, token);
      setImageValue(field, image);
      setStatus("Image prête. Enregistre les modifications pour la publier.");
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Impossible d’envoyer cette image."),
      );
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    try {
      const store = await updateAdminStoreSettings(form, token);
      setForm(toSettings(store));
      setStatus("Configuration de la boutique enregistrée.");
      onSaved?.(store);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible d’enregistrer la configuration de la boutique.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-ui-card admin-store-loading" aria-busy="true">
        <span className="admin-ui-session-loader" aria-hidden="true" />
        <p>Chargement de la boutique...</p>
      </div>
    );
  }

  return (
    <section className="admin-store-settings">
      <header className="admin-ui-card admin-store-heading">
        <span className="admin-store-heading-icon">
          <Store size={21} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <span className="admin-ui-kicker">Configuration publique</span>
          <h2>Gérer la boutique</h2>
          <p>Modifie ici les informations visibles sur le site et les documents.</p>
        </div>
      </header>

      <div className="admin-store-workspace">
        <nav className="admin-ui-card admin-store-tabs" aria-label="Sections de la boutique">
          <button type="button" className={activeTab === "identity" ? "active" : ""} onClick={() => setActiveTab("identity")}>
            <Building2 size={17} aria-hidden="true" />
            Identité & contact
          </button>
          <button type="button" className={activeTab === "content" ? "active" : ""} onClick={() => setActiveTab("content")}>
            <FileText size={17} aria-hidden="true" />
            Pages du site
          </button>
          <button type="button" className={activeTab === "seo" ? "active" : ""} onClick={() => setActiveTab("seo")}>
            <SearchCheck size={17} aria-hidden="true" />
            SEO & PDF
          </button>
        </nav>

        <form className="admin-ui-card admin-store-form" onSubmit={(event) => void handleSubmit(event)}>
          {activeTab === "identity" ? (
            <>
              <fieldset>
                <legend><Building2 size={16} aria-hidden="true" /> Informations générales</legend>
                <div className="admin-store-fields two">
                  <label>Nom de la boutique<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                  <label>Slogan<input value={form.footerTagline} onChange={(event) => setForm((current) => ({ ...current, footerTagline: event.target.value }))} required /></label>
                  <label className="wide">Description courte<textarea rows={2} value={form.footerDescription} onChange={(event) => setForm((current) => ({ ...current, footerDescription: event.target.value }))} required /></label>
                  <label className="wide">Description complète<textarea rows={4} value={form.fullDescription} onChange={(event) => setForm((current) => ({ ...current, fullDescription: event.target.value }))} /></label>
                  <ImageSettingField label="Logo" value={form.logoUrl} uploading={uploadingField === "logoUrl"} onFile={(file) => void uploadImage("logoUrl", file)} />
                  <ImageSettingField label="Favicon" value={form.faviconUrl} uploading={uploadingField === "faviconUrl"} onFile={(file) => void uploadImage("faviconUrl", file)} />
                </div>
              </fieldset>

              <fieldset>
                <legend><MapPinned size={16} aria-hidden="true" /> Coordonnées</legend>
                <div className="admin-store-fields two">
                  <label>Téléphone<input value={form.primaryPhone} onChange={(event) => setForm((current) => ({ ...current, primaryPhone: event.target.value }))} required /></label>
                  <label>WhatsApp<input value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} required /></label>
                  <label className="wide">E-mail<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label>
                  <label className="wide">Adresse<textarea rows={3} value={form.locationSection.addressLines.join("\n")} onChange={(event) => setForm((current) => ({ ...current, locationSection: { ...current.locationSection, addressLines: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) } }))} required /></label>
                  <label>Ville<input value={form.locationSection.city} onChange={(event) => setForm((current) => ({ ...current, locationSection: { ...current.locationSection, city: event.target.value } }))} required /></label>
                  <label>Pays<input value={form.locationSection.country} onChange={(event) => setForm((current) => ({ ...current, locationSection: { ...current.locationSection, country: event.target.value } }))} required /></label>
                </div>
              </fieldset>

              <fieldset>
                <legend><Share2 size={16} aria-hidden="true" /> Réseaux sociaux</legend>
                <div className="admin-store-fields three">
                  <label>Facebook<input type="url" value={form.facebookUrl} onChange={(event) => setForm((current) => ({ ...current, facebookUrl: event.target.value }))} /></label>
                  <label>Instagram<input type="url" value={form.instagramUrl} onChange={(event) => setForm((current) => ({ ...current, instagramUrl: event.target.value }))} /></label>
                  <label>TikTok<input type="url" value={form.tiktokUrl} onChange={(event) => setForm((current) => ({ ...current, tiktokUrl: event.target.value }))} /></label>
                </div>
              </fieldset>

              <fieldset>
                <legend><Globe2 size={16} aria-hidden="true" /> Google Maps</legend>
                <div className="admin-store-fields two">
                  <label className="wide">URL Google Maps<input type="url" value={form.locationSection.mapUrl} onChange={(event) => setForm((current) => ({ ...current, locationSection: { ...current.locationSection, mapUrl: event.target.value } }))} /></label>
                  <label className="wide">URL d’intégration de la carte<input type="url" value={form.locationSection.mapEmbedUrl} onChange={(event) => setForm((current) => ({ ...current, locationSection: { ...current.locationSection, mapEmbedUrl: event.target.value } }))} /></label>
                  <label>Latitude<input type="number" step="any" value={form.locationSection.latitude} onChange={(event) => setForm((current) => ({ ...current, locationSection: { ...current.locationSection, latitude: Number(event.target.value) } }))} /></label>
                  <label>Longitude<input type="number" step="any" value={form.locationSection.longitude} onChange={(event) => setForm((current) => ({ ...current, locationSection: { ...current.locationSection, longitude: Number(event.target.value) } }))} /></label>
                </div>
              </fieldset>
            </>
          ) : null}

          {activeTab === "content" ? (
            <>
              <fieldset>
                <legend><Store size={16} aria-hidden="true" /> Page d’accueil</legend>
                <div className="admin-store-fields two">
                  <label>Titre Hero<input value={form.heroTitle} onChange={(event) => setForm((current) => ({ ...current, heroTitle: event.target.value }))} required /></label>
                  <label>Sous-titre Hero<input value={form.heroHighlight} onChange={(event) => setForm((current) => ({ ...current, heroHighlight: event.target.value }))} required /></label>
                  <label className="wide">Texte principal<textarea rows={4} value={form.heroDescription} onChange={(event) => setForm((current) => ({ ...current, heroDescription: event.target.value }))} required /></label>
                  <ImageSettingField label="Image Hero" value={form.heroImageUrl} uploading={uploadingField === "heroImageUrl"} onFile={(file) => void uploadImage("heroImageUrl", file)} />
                </div>
                <div className="admin-store-cta-grid">
                  {form.heroCtas.map((cta, index) => (
                    <div className="admin-store-cta" key={`cta-${index + 1}`}>
                      <label className="admin-store-checkbox"><input type="checkbox" checked={cta.enabled} onChange={(event) => setForm((current) => ({ ...current, heroCtas: current.heroCtas.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item) }))} /> Afficher le bouton {index + 1}</label>
                      <label>Libellé<input value={cta.label} onChange={(event) => setForm((current) => ({ ...current, heroCtas: current.heroCtas.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></label>
                      <label>Lien<input value={cta.url} onChange={(event) => setForm((current) => ({ ...current, heroCtas: current.heroCtas.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))} /></label>
                    </div>
                  ))}
                </div>
                <p className="admin-store-hint">Les boutons restent masqués tant que leur option n’est pas activée.</p>
              </fieldset>

              <fieldset>
                <legend><FileText size={16} aria-hidden="true" /> Page À propos</legend>
                <div className="admin-store-fields two">
                  <label>Titre<input value={form.about.title} onChange={(event) => setForm((current) => ({ ...current, about: { ...current.about, title: event.target.value } }))} required /></label>
                  <label>Sous-titre<input value={form.about.subtitle} onChange={(event) => setForm((current) => ({ ...current, about: { ...current.about, subtitle: event.target.value } }))} required /></label>
                  <label className="wide">Histoire<textarea rows={5} value={form.about.history} onChange={(event) => setForm((current) => ({ ...current, about: { ...current.about, history: event.target.value } }))} required /></label>
                  <label className="wide">Mission<textarea rows={3} value={form.about.mission} onChange={(event) => setForm((current) => ({ ...current, about: { ...current.about, mission: event.target.value } }))} required /></label>
                  <label className="wide">Présentation<textarea rows={5} value={form.about.presentation} onChange={(event) => setForm((current) => ({ ...current, about: { ...current.about, presentation: event.target.value } }))} required /></label>
                  <label className="wide">Valeurs, une par ligne<textarea rows={4} value={form.about.values.join("\n")} onChange={(event) => setForm((current) => ({ ...current, about: { ...current.about, values: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) } }))} required /></label>
                </div>
              </fieldset>
            </>
          ) : null}

          {activeTab === "seo" ? (
            <>
              <fieldset>
                <legend><SearchCheck size={16} aria-hidden="true" /> SEO</legend>
                <div className="admin-store-fields two">
                  <label className="wide">Meta title<input value={form.seoTitle} onChange={(event) => setForm((current) => ({ ...current, seoTitle: event.target.value }))} required /></label>
                  <label className="wide">Meta description<textarea rows={4} value={form.seoDescription} onChange={(event) => setForm((current) => ({ ...current, seoDescription: event.target.value }))} required /></label>
                  <ImageSettingField label="Image Open Graph" value={form.openGraphImageUrl} uploading={uploadingField === "openGraphImageUrl"} onFile={(file) => void uploadImage("openGraphImageUrl", file)} />
                </div>
              </fieldset>

              <fieldset>
                <legend><FileText size={16} aria-hidden="true" /> Informations PDF</legend>
                <div className="admin-store-fields two">
                  <ImageSettingField label="Logo PDF" value={form.pdfSettings.logoUrl} uploading={uploadingField === "pdfLogoUrl"} onFile={(file) => void uploadImage("pdfLogoUrl", file)} />
                  <label className="wide">Adresse<textarea rows={3} value={form.pdfSettings.address} onChange={(event) => setForm((current) => ({ ...current, pdfSettings: { ...current.pdfSettings, address: event.target.value } }))} required /></label>
                  <label>Téléphone<input value={form.pdfSettings.phone} onChange={(event) => setForm((current) => ({ ...current, pdfSettings: { ...current.pdfSettings, phone: event.target.value } }))} required /></label>
                  <label>E-mail<input type="email" value={form.pdfSettings.email} onChange={(event) => setForm((current) => ({ ...current, pdfSettings: { ...current.pdfSettings, email: event.target.value } }))} required /></label>
                  <label className="wide">Texte de pied de page<textarea rows={3} value={form.pdfSettings.footerText} onChange={(event) => setForm((current) => ({ ...current, pdfSettings: { ...current.pdfSettings, footerText: event.target.value } }))} /></label>
                </div>
              </fieldset>
            </>
          ) : null}

          {error ? <p className="admin-store-message error" role="alert">{error}</p> : null}
          {status ? <p className="admin-store-message success" role="status">{status}</p> : null}

          <div className="admin-store-actions">
            <Button type="submit" loading={saving} disabled={uploadingField !== null}>
              <Save size={16} aria-hidden="true" />
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
