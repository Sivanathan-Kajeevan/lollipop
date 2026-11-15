import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Printer,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import type { CustomerOrderView, OrderStatus } from '../types/menu';
import {
  formatColomboDateTime,
  formatLkrPrice,
} from '../utils/menuLogic';
import { subscribeSseStream } from '../utils/sseClient';

interface OrderConfirmationPageProps {
  customerToken: string;
  onNavigate: (path: string) => void;
}

function statusBadgeStyle(status: OrderStatus): string {
  switch (status) {
    case 'New':
      return 'border-[#B91C1C]/30 bg-[#FEF2F2] text-[#B91C1C]';
    case 'Accepted':
    case 'Preparing':
      return 'border-[#D97706]/30 bg-[#FFFBEB] text-[#92400E]';
    case 'Ready':
    case 'Completed':
      return 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]';
    case 'Cancelled':
      return 'border-[#57534E]/30 bg-[#F3EFEA] text-[#57534E]';
  }
}

export function OrderConfirmationPage({
  customerToken,
  onNavigate,
}: OrderConfirmationPageProps) {
  const [order, setOrder] = useState<CustomerOrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/orders/customer/${encodeURIComponent(customerToken)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Order not found.');
      }
      const data = await res.json();
      setOrder(data.order as CustomerOrderView);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }, [customerToken]);

  useEffect(() => {
    setLoading(true);
    void fetchOrder();

    const stopStream = subscribeSseStream(
      `/api/orders/customer/${encodeURIComponent(customerToken)}/stream`,
      {
        onEvent: (eventName) => {
          if (eventName === 'order_updated') {
            void fetchOrder();
          }
        },
      }
    );

    const interval = window.setInterval(() => {
      void fetchOrder();
    }, 8000);

    return () => {
      stopStream();
      window.clearInterval(interval);
    };
  }, [customerToken, fetchOrder]);

  function handleDownloadQr() {
    if (!order) return;
    const link = document.createElement('a');
    link.href = order.orderQrPngDataUrl;
    link.download = `${order.orderRef.toLowerCase()}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrintOrder() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3EFEA] px-4 text-sm font-medium text-[#57534E]">
        Loading your order confirmation...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3EFEA] px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-[#1F1F21]">
          Order Not Found
        </h1>
        <p className="mt-2 max-w-md text-sm text-[#57534E]">
          {error || 'We could not find this order confirmation.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="mt-6 min-h-[44px] rounded-xl bg-[#B91C1C] px-6 py-2.5 text-sm font-bold text-white"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3EFEA] pb-16 text-[#1F1F21]">
      <header className="no-print border-b border-[#DED6CA] bg-[#FAF8F5]/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#1F1F21] hover:text-[#B91C1C]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Menu</span>
          </button>

          <img
            src={order.logoUrl}
            alt={order.restaurantName}
            referrerPolicy="no-referrer"
            className="h-8 w-auto object-contain"
          />

          <button
            type="button"
            onClick={() => void fetchOrder()}
            aria-label="Refresh order status"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DED6CA] bg-white text-[#57534E] hover:text-[#1F1F21]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-6 sm:px-6">
        {/* Confirmation & Unique Order QR Card */}
        <section className="print-only-stand flex flex-col items-center rounded-2xl border-2 border-[#2C2420] bg-white p-6 text-center shadow-xs sm:p-8">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-[#15803D]">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <span>Order Received</span>
          </div>

          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#1F1F21] tabular-nums">
            {order.orderRef}
          </h1>
          <p className="mt-1 text-xs font-medium text-[#57534E] tabular-nums">
            {formatColomboDateTime(order.createdAt)} (Asia/Colombo)
          </p>

          <div
            className="my-5 w-52 rounded-2xl border-2 border-[#2C2420] bg-white p-3"
            aria-label={`Unique QR code for order ${order.orderRef}`}
          >
            <img
              src={order.orderQrPngDataUrl}
              alt={`Order QR code for ${order.orderRef}`}
              className="h-auto w-full"
            />
          </div>

          <p className="max-w-sm text-sm font-bold text-[#B91C1C]">
            Show this QR code to restaurant staff to view your order.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span
              className={`inline-flex items-center rounded-xl border px-3.5 py-1.5 text-xs font-bold ${statusBadgeStyle(
                order.orderStatus
              )}`}
            >
              Order Status: {order.orderStatus}
            </span>
            <span
              className={`inline-flex items-center rounded-xl border px-3.5 py-1.5 text-xs font-bold ${
                order.paymentStatus === 'Paid'
                  ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                  : 'border-[#2C2420]/25 bg-[#FAF8F5] text-[#1F1F21]'
              }`}
            >
              Payment: {order.paymentStatus} · {order.paymentMethod}
            </span>
          </div>

          <div className="no-print mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#1F1F21] px-4 py-2 text-sm font-semibold text-white hover:bg-[#333336]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download QR</span>
            </button>

            <button
              type="button"
              onClick={handlePrintOrder}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-[#2C2420] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#F3EFEA]"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Print Order</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#B91C1C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991B1B]"
            >
              <span>Back to Menu</span>
            </button>
          </div>
        </section>

        {/* Order Items Summary */}
        <section className="rounded-2xl border-2 border-[#2C2420] bg-[#FAF8F5] p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-[#DED6CA] pb-3">
            <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-[#1F1F21]">
              Order Summary
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#57534E]">
              <QrCode className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
              <span>{order.orderRef}</span>
            </span>
          </div>

          <div className="divide-y divide-[#DED6CA]">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1F1F21]">
                    <span className="font-display font-extrabold text-[#B91C1C] tabular-nums">
                      {item.quantity}×
                    </span>{' '}
                    {item.foodName}
                  </p>
                  <p className="text-xs text-[#57534E] tabular-nums">
                    {formatLkrPrice(item.unitPriceLkr)} each
                  </p>
                  {item.prepNote && (
                    <p className="mt-1 text-xs font-medium text-[#44403C]">
                      Note: {item.prepNote}
                    </p>
                  )}
                </div>

                <p className="shrink-0 font-display text-base font-extrabold text-[#1F1F21] tabular-nums">
                  {formatLkrPrice(item.lineTotalLkr)}
                </p>
              </div>
            ))}
          </div>

          {order.orderNotes && (
            <div className="mt-3 rounded-xl border border-[#DED6CA] bg-white px-3.5 py-2.5 text-xs text-[#44403C]">
              <strong className="font-semibold text-[#1F1F21]">Order notes:</strong>{' '}
              {order.orderNotes}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t-2 border-[#2C2420] pt-4">
            <div>
              <span className="font-display text-base font-bold text-[#1F1F21]">
                Total
              </span>
              <p className="text-xs font-medium text-[#57534E]">
                {order.paymentMethod}
              </p>
            </div>
            <span className="font-display text-2xl font-extrabold text-[#B91C1C] tabular-nums">
              {formatLkrPrice(order.totalLkr)}
            </span>
          </div>
        </section>

        {/* Live Status History */}
        {order.statusHistory.length > 0 && (
          <section className="no-print rounded-2xl border-2 border-[#2C2420]/25 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold uppercase tracking-tight text-[#1F1F21]">
              <Clock className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
              <span>Order Progress</span>
            </h2>
            <div className="mt-3 space-y-2.5">
              {order.statusHistory.map((ev, idx) => (
                <div
                  key={`${ev.status}-${idx}`}
                  className="flex items-center justify-between border-b border-[#F0EAE0] pb-2 text-sm last:border-b-0 last:pb-0"
                >
                  <span className="font-semibold text-[#1F1F21]">{ev.status}</span>
                  <span className="font-mono text-xs text-[#57534E] tabular-nums">
                    {formatColomboDateTime(ev.at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
