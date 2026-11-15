import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import type { RestaurantSettings } from '../../types/menu';
import {
  buildWhatsAppUrl,
  normalizeSriLankanWhatsApp,
  validateImageFileMeta,
} from '../../utils/menuLogic';
import { adminFetch } from '../../utils/adminFetch';

const DEFAULT_LOGO_URL = '/assets/aistudio/image_0b3be71d.png';

interface AdminSettingsProps {
  settings: RestaurantSettings;
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

async function prepareUploadFile(file: File): Promise<{ body: Blob; contentType: string }> {
  if (file.type !== 'image/webp') {
    return { body: file, contentType: file.type };
  }

  // Convert WebP logos to PNG in-browser so transparent backgrounds embed cleanly into print PDFs
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Unsupported image format.'));
    el.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { body: file, contentType: file.type };

  ctx.drawImage(img, 0, 0);
  const pngBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  );
  if (!pngBlob) return { body: file, contentType: file.type };
  return { body: pngBlob, contentType: 'image/png' };
}

export function AdminSettings({
  settings,
  onRefresh,
  onNotify,
}: AdminSettingsProps) {
  const [restaurantName, setRestaurantName] = useState(settings.restaurantName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [logoIncludesName, setLogoIncludesName] = useState(settings.logoIncludesName);
  const [welcomeMessage, setWelcomeMessage] = useState(settings.welcomeMessage);
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber);
  const [address, setAddress] = useState(settings.address);
  const [openingHours, setOpeningHours] = useState(settings.openingHours);
  const [publicMenuUrl, setPublicMenuUrl] = useState(settings.publicMenuUrl);

  const [providerName, setProviderName] = useState(
    settings.providerName || 'Shop Grow Media'
  );
  const [providerLogoUrl, setProviderLogoUrl] = useState(settings.providerLogoUrl || '');
  const [providerContact, setProviderContact] = useState(settings.providerContact || '');
  const [providerWebsite, setProviderWebsite] = useState(settings.providerWebsite || '');

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingProviderLogo, setUploadingProviderLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setRestaurantName(settings.restaurantName);
    setLogoUrl(settings.logoUrl);
    setLogoIncludesName(settings.logoIncludesName);
    setWelcomeMessage(settings.welcomeMessage);
    setWhatsappNumber(settings.whatsappNumber);
    setAddress(settings.address);
    setOpeningHours(settings.openingHours);
    setPublicMenuUrl(settings.publicMenuUrl);
    setProviderName(settings.providerName || 'Shop Grow Media');
    setProviderLogoUrl(settings.providerLogoUrl || '');
    setProviderContact(settings.providerContact || '');
    setProviderWebsite(settings.providerWebsite || '');
  }, [settings]);

  const phonePreview = normalizeSriLankanWhatsApp(whatsappNumber);
  const whatsappUrlPreview = buildWhatsAppUrl(whatsappNumber);

  async function handleLogoUpload(
    e: ChangeEvent<HTMLInputElement>,
    target: 'restaurant' | 'provider'
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);

    const check = validateImageFileMeta(file.type, file.size);
    if (!check.valid) {
      setFormError(check.error || 'Invalid image file.');
      e.target.value = '';
      return;
    }

    if (target === 'restaurant') {
      setUploadingLogo(true);
    } else {
      setUploadingProviderLogo(true);
    }

    try {
      const prepared = await prepareUploadFile(file);
      const res = await adminFetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': prepared.contentType },
        body: prepared.body,
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Logo upload failed.');
        return;
      }
      if (target === 'restaurant') {
        setLogoUrl(data.url);
      } else {
        setProviderLogoUrl(data.url);
      }
    } catch {
      setFormError('Network error while uploading logo.');
    } finally {
      e.target.value = '';
      if (target === 'restaurant') {
        setUploadingLogo(false);
      } else {
        setUploadingProviderLogo(false);
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!restaurantName.trim()) {
      setFormError('Restaurant name is required.');
      return;
    }
    if (!welcomeMessage.trim()) {
      setFormError('Welcome message is required.');
      return;
    }
    if (!phonePreview.valid) {
      setFormError('Enter a valid WhatsApp number (e.g., 0728044969).');
      return;
    }

    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: restaurantName.trim(),
          logoUrl: logoUrl.trim() || DEFAULT_LOGO_URL,
          logoIncludesName,
          welcomeMessage: welcomeMessage.trim(),
          whatsappNumber: whatsappNumber.trim(),
          address: address.trim(),
          openingHours: openingHours.trim(),
          publicMenuUrl: publicMenuUrl.trim(),
          providerName: providerName.trim() || 'Shop Grow Media',
          providerLogoUrl: providerLogoUrl.trim(),
          providerContact: providerContact.trim(),
          providerWebsite: providerWebsite.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Unable to save restaurant settings.');
        return;
      }
      await onRefresh();
      onNotify('success', 'Restaurant and QR stand settings saved.');
    } catch {
      setFormError('Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[#1F1F21]">
          Restaurant Settings
        </h2>
        <p className="text-sm text-[#57534E]">
          Update restaurant branding, WhatsApp contact number, and service provider details for the printable menu QR stand PDF.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-[#E7E0D6] bg-white p-6"
      >
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-[#B91C1C]/30 bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#991B1B]"
          >
            {formError}
          </div>
        )}

        {/* Restaurant Logo Preview & Upload */}
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-[#1F1F21]">
            Restaurant logo
          </span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-44 items-center justify-center rounded-xl border border-[#E7E0D6] bg-[#FAF7F2] p-3">
              <img
                src={logoUrl || DEFAULT_LOGO_URL}
                alt="Restaurant logo preview"
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#F4EFE6]">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{uploadingLogo ? 'Uploading...' : 'Upload new logo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handleLogoUpload(e, 'restaurant')}
                  disabled={uploadingLogo}
                  className="sr-only"
                />
              </label>

              {logoUrl !== DEFAULT_LOGO_URL && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoUrl(DEFAULT_LOGO_URL);
                    setLogoIncludesName(true);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DDD4C7] bg-white px-3.5 py-2 text-sm font-medium text-[#57534E] hover:bg-[#F4EFE6]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Use default Lollipop logo</span>
                </button>
              )}
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2.5 pt-1 text-sm text-[#44403C]">
            <input
              type="checkbox"
              checked={logoIncludesName}
              onChange={(e) => setLogoIncludesName(e.target.checked)}
              className="h-4 w-4 rounded border-[#DDD4C7] accent-[#B91C1C]"
            />
            <span>
              Logo already includes the restaurant name (hide duplicate name on printable QR stand)
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="settings-name"
              className="block text-sm font-semibold text-[#1F1F21]"
            >
              Restaurant name <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              id="settings-name"
              type="text"
              required
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="settings-whatsapp"
              className="block text-sm font-semibold text-[#1F1F21]"
            >
              WhatsApp contact number <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              id="settings-whatsapp"
              type="tel"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="0728044969"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] tabular-nums focus:border-[#B91C1C] focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-[#57534E]">
              {phonePreview.valid ? (
                <>
                  Displays as{' '}
                  <strong className="font-semibold text-[#1F1F21]">
                    {phonePreview.display}
                  </strong>{' '}
                  · Link:{' '}
                  <span className="font-mono text-[11px]">
                    {whatsappUrlPreview.split('?')[0]}
                  </span>
                </>
              ) : (
                <span className="text-[#B91C1C]">
                  Enter a valid local (0728044969) or international (94728044969) number.
                </span>
              )}
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="settings-welcome"
            className="block text-sm font-semibold text-[#1F1F21]"
          >
            Welcome message <span className="text-[#B91C1C]">*</span>
          </label>
          <input
            id="settings-welcome"
            type="text"
            required
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="settings-address"
              className="block text-sm font-semibold text-[#1F1F21]"
            >
              Address <span className="text-xs font-normal text-[#78716C]">(optional)</span>
            </label>
            <input
              id="settings-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Leave blank to omit from public menu"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="settings-hours"
              className="block text-sm font-semibold text-[#1F1F21]"
            >
              Opening hours <span className="text-xs font-normal text-[#78716C]">(optional)</span>
            </label>
            <input
              id="settings-hours"
              type="text"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              placeholder="Leave blank to omit from public menu"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="settings-public-url"
            className="block text-sm font-semibold text-[#1F1F21]"
          >
            Public menu URL for QR codes{' '}
            <span className="text-xs font-normal text-[#78716C]">(optional override)</span>
          </label>
          <input
            id="settings-public-url"
            type="url"
            value={publicMenuUrl}
            onChange={(e) => setPublicMenuUrl(e.target.value)}
            placeholder="Auto-detected from deployed domain when blank"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 font-mono text-xs text-[#1F1F21] placeholder:font-sans placeholder:text-sm placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
          />
          <p className="mt-1 text-xs text-[#78716C]">
            Leave empty to automatically encode your deployed public menu URL. Admin paths are always stripped.
          </p>
        </div>

        {/* Service Provider Footer Branding */}
        <div className="space-y-5 border-t border-[#E7E0D6] pt-6">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1F1F21]">
              Service Provider Branding (Menu QR Stand PDF Footer)
            </h3>
            <p className="text-xs text-[#57534E]">
              Shown cleanly in the footer of the printable A5 restaurant menu QR stand. Only configured contact details are printed.
            </p>
          </div>

          <div>
            <span className="block text-sm font-semibold text-[#1F1F21]">
              Provider logo <span className="text-xs font-normal text-[#78716C]">(optional)</span>
            </span>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              {providerLogoUrl ? (
                <div className="flex h-16 w-40 items-center justify-center rounded-xl border border-[#E7E0D6] bg-[#FAF7F2] p-2">
                  <img
                    src={providerLogoUrl}
                    alt="Service provider logo preview"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-40 items-center justify-center rounded-xl border border-dashed border-[#DDD4C7] bg-[#FAF8F5] px-3 text-center text-xs text-[#78716C]">
                  No provider logo
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#F4EFE6]">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {uploadingProviderLogo ? 'Uploading...' : 'Upload provider logo'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void handleLogoUpload(e, 'provider')}
                    disabled={uploadingProviderLogo}
                    className="sr-only"
                  />
                </label>

                {providerLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setProviderLogoUrl('')}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DDD4C7] bg-white px-3.5 py-2 text-sm font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="settings-provider-name"
                className="block text-sm font-semibold text-[#1F1F21]"
              >
                Provider name
              </label>
              <input
                id="settings-provider-name"
                type="text"
                maxLength={80}
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="Shop Grow Media"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="settings-provider-contact"
                className="block text-sm font-semibold text-[#1F1F21]"
              >
                Provider contact number{' '}
                <span className="text-xs font-normal text-[#78716C]">(optional)</span>
              </label>
              <input
                id="settings-provider-contact"
                type="text"
                maxLength={80}
                value={providerContact}
                onChange={(e) => setProviderContact(e.target.value)}
                placeholder="Leave blank if omitted"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="settings-provider-website"
                className="block text-sm font-semibold text-[#1F1F21]"
              >
                Provider website{' '}
                <span className="text-xs font-normal text-[#78716C]">(optional)</span>
              </label>
              <input
                id="settings-provider-website"
                type="text"
                maxLength={160}
                value={providerWebsite}
                onChange={(e) => setProviderWebsite(e.target.value)}
                placeholder="e.g., shopgrowmedia.lk"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-[#E7E0D6] pt-4">
          <button
            type="submit"
            disabled={saving || uploadingLogo || uploadingProviderLogo}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#B91C1C] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
