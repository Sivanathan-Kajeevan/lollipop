import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  Printer,
  QrCode,
  X,
} from 'lucide-react';
import type { RestaurantSettings } from '../../types/menu';
import {
  buildProviderContactLine,
  formatShortDisplayUrl,
} from '../../utils/menuLogic';
import { adminFetch } from '../../utils/adminFetch';

interface AdminQrCodeProps {
  settings: RestaurantSettings;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

interface QrPayload {
  url: string;
  isLocalhost: boolean;
  svg: string;
  pngDataUrl: string;
}

function A5StandCard({
  settings,
  qrData,
  expanded = false,
}: {
  settings: RestaurantSettings;
  qrData: QrPayload;
  expanded?: boolean;
}) {
  const shortUrl = formatShortDisplayUrl(qrData.url);
  const providerName = (settings.providerName || '').trim() || 'Shop Grow Media';
  const providerContactLine = buildProviderContactLine({
    providerContact: settings.providerContact,
    providerWebsite: settings.providerWebsite,
  });

  return (
    <div
      className={`print-only-stand relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#2C2420] bg-[#FDFBF7] text-center shadow-sm ${
        expanded ? 'max-w-[440px] aspect-[148/210]' : 'max-w-[330px] aspect-[148/210]'
      }`}
    >
      {/* Top cherry-red acrylic stand accent bar */}
      <div className="h-2.5 w-full bg-[#B91C1C]" />

      <div
        className={`flex flex-1 flex-col items-center justify-between ${
          expanded ? 'px-7 py-5' : 'px-5 py-3.5'
        }`}
      >
        {/* 1. Restaurant Logo + conditional name */}
        <div className="flex flex-col items-center">
          <img
            src={settings.logoUrl}
            alt={`${settings.restaurantName} logo`}
            referrerPolicy="no-referrer"
            className={`w-auto object-contain ${
              expanded ? 'max-h-16 max-w-[210px]' : 'max-h-12 max-w-[165px]'
            }`}
          />
          {!settings.logoIncludesName && (
            <h3
              className={`mt-1.5 font-display font-bold text-[#1F1F21] ${
                expanded ? 'text-xl' : 'text-base'
              }`}
            >
              {settings.restaurantName}
            </h3>
          )}
          <div className="mt-2.5 h-1 w-10 rounded-full bg-[#B91C1C]" />
        </div>

        {/* 2. Invitation text */}
        <div className="space-y-0.5">
          <p
            className={`font-display font-extrabold tracking-wide text-[#B91C1C] uppercase ${
              expanded ? 'text-2xl' : 'text-lg'
            }`}
          >
            SCAN OUR MENU
          </p>
          <p className={`text-[#44403C] ${expanded ? 'text-sm' : 'text-[11px]'}`}>
            Explore our food &amp; place your order.
          </p>
        </div>

        {/* 3. Pure white quiet-zone QR + short URL */}
        <div className="flex flex-col items-center">
          <div
            className={`rounded-xl border border-[#2C2420] bg-white ${
              expanded ? 'w-52 p-3' : 'w-38 p-2.5'
            }`}
          >
            <img
              src={qrData.pngDataUrl}
              alt={`Scan to view ${settings.restaurantName} menu and order`}
              className="h-auto w-full"
            />
          </div>

          <p
            className={`mt-2 max-w-full break-all font-mono font-semibold text-[#1F1F21] ${
              expanded ? 'text-[11px]' : 'text-[9.5px]'
            }`}
          >
            {shortUrl}
          </p>
        </div>

        {/* 4. Simple instructions */}
        <p
          className={`font-semibold text-[#2C2420] ${
            expanded ? 'text-xs' : 'text-[10px]'
          }`}
        >
          Open your camera • Scan the QR • View menu &amp; order
        </p>

        {/* 5. Service Provider Footer */}
        <div className="w-full border-t border-[#E2D9CC] pt-2.5">
          {settings.providerLogoUrl && (
            <img
              src={settings.providerLogoUrl}
              alt={providerName}
              referrerPolicy="no-referrer"
              className={`mx-auto mb-1 w-auto object-contain ${
                expanded ? 'max-h-6 max-w-[96px]' : 'max-h-5 max-w-[76px]'
              }`}
            />
          )}
          <p
            className={`font-bold text-[#1F1F21] ${
              expanded ? 'text-[11px]' : 'text-[9.5px]'
            }`}
          >
            Digital Menu &amp; Ordering by {providerName}
          </p>
          <p className={`text-[#57534E] ${expanded ? 'text-[10px]' : 'text-[8.5px]'}`}>
            QR Menus • Websites • Digital Solutions
          </p>
          {providerContactLine && (
            <p
              className={`mt-0.5 font-semibold text-[#B91C1C] ${
                expanded ? 'text-[10px]' : 'text-[8.5px]'
              }`}
            >
              {providerContactLine}
            </p>
          )}
        </div>
      </div>

      {/* Bottom cherry-red accent strip */}
      <div className="h-2 w-full bg-[#B91C1C]" />
    </div>
  );
}

export function AdminQrCode({ settings, onNotify }: AdminQrCodeProps) {
  const [qrData, setQrData] = useState<QrPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQr = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/qr', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to generate QR code.');
      }
      setQrData(data as QrPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate QR.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQr();
  }, [loadQr, settings.publicMenuUrl]);

  async function handleDownloadStandPdf() {
    setDownloadingPdf(true);
    try {
      const res = await adminFetch('/api/admin/qr/stand.pdf', {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Unable to generate PDF stand.');
      }
      const pdfBlob = await res.blob();
      const objectUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'Lollipop_Menu_QR_Stand.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      onNotify('success', 'Downloaded Lollipop_Menu_QR_Stand.pdf (A5 Portrait).');
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'Unable to download QR stand PDF.'
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handleDownloadPng() {
    if (!qrData) return;
    const link = document.createElement('a');
    link.href = qrData.pngDataUrl;
    link.download = `${settings.restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-menu-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('success', 'Downloaded Menu QR code PNG.');
  }

  function handleDownloadSvg() {
    if (!qrData) return;
    const blob = new Blob([qrData.svg], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${settings.restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-menu-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    onNotify('success', 'Downloaded Menu QR code SVG.');
  }

  function handlePrintStand() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h2 className="font-display text-2xl font-semibold text-[#1F1F21]">
          Restaurant Menu QR Generator
        </h2>
        <p className="text-sm text-[#57534E]">
          Download the print-ready A5 acrylic table stand PDF, or export raw PNG/SVG QR files. Updates to branding, provider details, or menu URL reflect immediately.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#E7E0D6] bg-white p-10 text-center text-sm text-[#57534E]">
          Generating scannable Menu QR code...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-[#B91C1C]/30 bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#991B1B]">{error}</p>
          <button
            type="button"
            onClick={() => void loadQr()}
            className="mt-4 min-h-[44px] rounded-xl bg-[#B91C1C] px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && qrData && (
        <>
          {qrData.isLocalhost && (
            <div
              role="alert"
              className="no-print flex items-start gap-3 rounded-2xl border border-[#D97706]/40 bg-[#FFFBEB] p-4 text-sm text-[#92400E]"
            >
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">
                  Warning: Destination URL uses localhost
                </p>
                <p className="mt-0.5 text-xs leading-relaxed">
                  Customer phones cannot open <code className="font-mono">localhost</code> links. Set your deployed HTTPS URL in <strong>Restaurant Settings</strong> or <code className="font-mono">PUBLIC_MENU_URL</code> before printing table stands.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            {/* QR Preview & Download Controls */}
            <div className="no-print space-y-5 rounded-2xl border border-[#E7E0D6] bg-white p-6">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                <div
                  className="w-44 shrink-0 rounded-xl border border-[#E7E0D6] bg-white p-3 shadow-xs"
                  aria-label="Scannable restaurant menu QR code"
                >
                  <img
                    src={qrData.pngDataUrl}
                    alt={`Restaurant Menu QR code linking to ${qrData.url}`}
                    className="h-auto w-full"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#57534E]">
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                      Destination URL
                    </span>
                    <p className="mt-1 break-all rounded-xl border border-[#E7E0D6] bg-[#FAF8F5] px-3 py-2 font-mono text-xs text-[#1F1F21]">
                      {qrData.url}
                    </p>
                  </div>

                  <p className="text-xs leading-relaxed text-[#57534E]">
                    Print-ready A5 Portrait PDF (148 × 210 mm) with vector QR modules (64 mm wide), embedded fonts, transparent logo support, and Shop Grow Media footer.
                  </p>

                  <a
                    href={qrData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C] hover:underline"
                  >
                    <span>Open public menu in new tab</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* Primary PDF Download + Preview Actions */}
              <div className="space-y-3 border-t border-[#E7E0D6] pt-5">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={downloadingPdf}
                    onClick={() => void handleDownloadStandPdf()}
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#B91C1C] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-60"
                  >
                    <FileDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {downloadingPdf ? 'Generating PDF...' : 'Download QR Stand PDF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(true)}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#2C2420] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F1F21] transition-colors hover:bg-[#FAF8F5]"
                  >
                    <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Preview PDF Stand</span>
                  </button>
                </div>

                {/* Retained PNG, SVG & Print Actions */}
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#1F1F21] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#333336]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F21] transition-colors hover:bg-[#F3EFEA]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download SVG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintStand}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F21] transition-colors hover:bg-[#F3EFEA]"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Print Stand</span>
                  </button>
                </div>

                <p className="text-xs text-[#57534E]">
                  File name: <code className="font-mono">Lollipop_Menu_QR_Stand.pdf</code> · Customize provider logo, contact, or website under <strong>Restaurant settings</strong>.
                </p>
              </div>
            </div>

            {/* Live A5 Portrait Stand Preview */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E0D6] bg-[#FAF8F5] p-6">
              <p className="no-print mb-3 text-xs font-semibold uppercase tracking-wide text-[#57534E]">
                A5 Portrait PDF Preview (148 × 210 mm)
              </p>

              <A5StandCard settings={settings} qrData={qrData} />
            </div>
          </div>

          {/* Full A5 PDF Preview Modal before downloading */}
          {previewModalOpen && (
            <div
              className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F21]/70 p-4 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
              aria-label="A5 Menu QR Stand PDF preview"
              onClick={() => setPreviewModalOpen(false)}
            >
              <div
                className="flex max-h-[94vh] w-full max-w-lg flex-col items-center overflow-y-auto rounded-2xl bg-[#F3EFEA] p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex w-full items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#1F1F21]">
                      A5 Menu QR Stand Preview
                    </h3>
                    <p className="text-xs text-[#57534E]">
                      Exact composition exported in Lollipop_Menu_QR_Stand.pdf
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    aria-label="Close PDF preview"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1F1F21] hover:bg-[#FAF8F5]"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <A5StandCard settings={settings} qrData={qrData} expanded />

                <div className="mt-4 flex w-full justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    className="min-h-[44px] rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={downloadingPdf}
                    onClick={() => void handleDownloadStandPdf()}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-bold text-white hover:bg-[#991B1B] disabled:opacity-60"
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {downloadingPdf
                        ? 'Generating PDF...'
                        : 'Download QR Stand PDF'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
