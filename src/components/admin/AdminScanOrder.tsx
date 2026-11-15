import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import jsQR from 'jsqr';
import {
  AlertCircle,
  Camera,
  CameraOff,
  QrCode,
  Search,
  Upload,
} from 'lucide-react';
import type { AdminOrderRecord } from '../../types/menu';
import { parseOrderQrPayload } from '../../utils/menuLogic';
import { adminFetch } from '../../utils/adminFetch';
import { OrderStaffViewCard } from './OrderStaffViewCard';

interface AdminScanOrderProps {
  initialToken?: string | null;
  onRefreshOrders: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function AdminScanOrder({
  initialToken,
  onRefreshOrders,
  onNotify,
}: AdminScanOrderProps) {
  const [scannedOrder, setScannedOrder] = useState<AdminOrderRecord | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [manualInput, setManualInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastLookupRef = useRef<string>('');

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const lookupOrder = useCallback(
    async (params: { token?: string; ref?: string }) => {
      setScanError(null);
      setLookingUp(true);
      try {
        const qs = new URLSearchParams();
        if (params.token) qs.set('token', params.token);
        if (params.ref) qs.set('ref', params.ref);

        const res = await adminFetch(`/api/admin/orders/lookup?${qs.toString()}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          setScannedOrder(null);
          setScanError(
            data.error || 'No Lollipop order matched that QR code or reference.'
          );
          return;
        }
        setScannedOrder(data.order as AdminOrderRecord);
      } catch {
        setScanError('Network error while looking up the order.');
      } finally {
        setLookingUp(false);
      }
    },
    []
  );

  const handleDecodedQrText = useCallback(
    async (rawText: string) => {
      const parsed = parseOrderQrPayload(rawText);
      if (parsed.kind === 'menu_qr') {
        setScannedOrder(null);
        setScanError(
          'That is the Lollipop Restaurant menu QR code, not a customer order QR code.'
        );
        return;
      }
      if (parsed.kind === 'invalid') {
        setScannedOrder(null);
        setScanError(
          'Unrecognised QR code or reference. Please scan a valid Lollipop customer order QR or enter an order reference (e.g., LP-261114-XXXX).'
        );
        return;
      }
      if (parsed.kind === 'staff_token') {
        await lookupOrder({ token: parsed.token });
        return;
      }
      if (parsed.kind === 'order_ref') {
        await lookupOrder({ ref: parsed.orderRef });
      }
    },
    [lookupOrder]
  );

  useEffect(() => {
    if (!initialToken || lastLookupRef.current === initialToken) return;
    lastLookupRef.current = initialToken;
    void lookupOrder({ token: initialToken });
  }, [initialToken, lookupOrder]);

  async function startCameraScan() {
    setCameraError(null);
    setScanError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera scanning is not supported on this browser. Use QR image upload or manual order-reference search below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      // Wait a tick for video element to mount
      window.setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play().catch(() => {});

        const scanFrame = () => {
          if (!streamRef.current || !videoRef.current || !canvasRef.current) return;
          const vid = videoRef.current;
          const canvas = canvasRef.current;
          if (vid.readyState === vid.HAVE_ENOUGH_DATA && vid.videoWidth > 0) {
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (decoded?.data) {
                stopCamera();
                void handleDecodedQrText(decoded.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(scanFrame);
        };

        rafRef.current = requestAnimationFrame(scanFrame);
      }, 60);
    } catch (err) {
      stopCamera();
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or use QR image upload / manual lookup below.'
          : 'Unable to access the camera on this device. Use QR image upload or manual lookup below.';
      setCameraError(message);
    }
  }

  async function handleQrImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanError(null);
    setCameraError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
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
      if (!ctx) throw new Error('Unable to process image.');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (!decoded?.data) {
        setScannedOrder(null);
        setScanError(
          'No QR code could be read from that image. Ensure the QR code is sharp and clear.'
        );
        return;
      }

      await handleDecodedQrText(decoded.data);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Unable to decode uploaded QR image.'
      );
    }
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    const q = manualInput.trim();
    if (!q) {
      setScanError('Enter an order reference (e.g., LP-261114-XXXX) or paste a scanned QR link.');
      return;
    }
    void handleDecodedQrText(q);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#1F1F21]">
            Scan Order QR
          </h2>
          <p className="text-sm text-[#57534E]">
            Scan a customer&apos;s order QR code with your camera, upload a QR image, or search by order reference. Scanning only opens the order and never changes its status or payment.
          </p>
        </div>

        {scannedOrder && (
          <button
            type="button"
            onClick={() => {
              setScannedOrder(null);
              setScanError(null);
            }}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center self-start rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-xs font-bold text-[#1F1F21] transition-colors hover:bg-[#F3EFEA]"
          >
            Scan Another Order
          </button>
        )}
      </div>

      {/* Scan Errors */}
      {scanError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-[#B91C1C]/35 bg-[#FEF2F2] p-4 text-sm font-medium text-[#991B1B]"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Scanned Order Details (above scanner tools for immediate mobile visibility) */}
      {scannedOrder && (
        <OrderStaffViewCard
          order={scannedOrder}
          onOrderUpdated={(updated) => {
            setScannedOrder(updated);
            void onRefreshOrders();
          }}
          onNotify={onNotify}
        />
      )}

      {/* Scanner & Fallback Tools */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Camera Scanner Card */}
        <div className="space-y-4 rounded-2xl border border-[#E7E0D6] bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#1F1F21]">
              <Camera className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
              <span>Camera QR Scanner</span>
            </h3>
            {cameraActive && (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DDD4C7] px-3 py-1.5 text-xs font-semibold text-[#1F1F21] hover:bg-[#F3EFEA]"
              >
                <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Stop Camera</span>
              </button>
            )}
          </div>

          {cameraActive ? (
            <div className="relative overflow-hidden rounded-xl border-2 border-[#2C2420] bg-[#1F1F21]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-44 w-44 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#DDD4C7] bg-[#FAF8F5] px-5 py-8 text-center">
              <QrCode className="h-10 w-10 text-[#B91C1C]/70" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-[#1F1F21]">
                Point your rear camera at a customer&apos;s order QR code
              </p>
              <p className="mt-1 text-xs text-[#57534E]">
                Camera permission is requested only when you start scanning.
              </p>
              <button
                type="button"
                onClick={() => void startCameraScan()}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#B91C1C] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#991B1B]"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span>Start Camera Scan</span>
              </button>
            </div>
          )}

          {cameraError && (
            <div
              role="alert"
              className="rounded-xl border border-[#D97706]/40 bg-[#FFFBEB] px-3.5 py-2.5 text-xs font-medium text-[#92400E]"
            >
              {cameraError}
            </div>
          )}
        </div>

        {/* Manual Reference Search & QR Image Upload */}
        <div className="space-y-5 rounded-2xl border border-[#E7E0D6] bg-white p-5">
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <label
              htmlFor="manual-order-lookup"
              className="block text-base font-semibold text-[#1F1F21]"
            >
              Manual Order Reference Lookup
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="manual-order-lookup"
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter order ref (e.g., LP-261114-XXXX)"
                className="h-11 min-h-[44px] w-full rounded-xl border border-[#DDD4C7] px-3.5 font-mono text-sm text-[#1F1F21] placeholder:font-sans placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none sm:flex-1"
              />
              <button
                type="submit"
                disabled={lookingUp}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#1F1F21] px-4 py-2 text-sm font-semibold text-white hover:bg-[#333336] disabled:opacity-60"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>{lookingUp ? 'Finding...' : 'Find Order'}</span>
              </button>
            </div>
          </form>

          <div className="border-t border-[#E7E0D6] pt-4">
            <p className="text-sm font-semibold text-[#1F1F21]">
              Upload Order QR Image
            </p>
            <p className="mt-1 text-xs text-[#57534E]">
              When camera scanning is unavailable, upload a saved QR screenshot or PNG file.
            </p>

            <label className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[#DDD4C7] bg-[#FAF8F5] px-4 py-2 text-sm font-semibold text-[#1F1F21] transition-colors hover:bg-[#F3EFEA]">
              <Upload className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
              <span>Select QR Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrImageUpload}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
