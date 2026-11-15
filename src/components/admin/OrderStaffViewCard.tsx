import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  MessageCircle,
  Phone,
  QrCode,
} from 'lucide-react';
import type {
  AdminOrderRecord,
  OrderStatus,
  PaymentStatus,
} from '../../types/menu';
import {
  buildWhatsAppUrl,
  formatColomboDateTime,
  formatLkrPrice,
  ORDER_STATUSES,
} from '../../utils/menuLogic';
import { adminFetch } from '../../utils/adminFetch';

interface OrderStaffViewCardProps {
  order: AdminOrderRecord;
  onOrderUpdated: (updated: AdminOrderRecord) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function OrderStaffViewCard({
  order,
  onOrderUpdated,
  onNotify,
}: OrderStaffViewCardProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const whatsappContactUrl = buildWhatsAppUrl(
    order.customerPhoneNormalized,
    `Hello ${order.customerName}, regarding your Lollipop order ${order.orderRef}:`
  );

  async function handleStatusChange(nextStatus: OrderStatus) {
    if (nextStatus === order.orderStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to update order status.');
        return;
      }
      onOrderUpdated(data.order as AdminOrderRecord);
      onNotify('success', `Order ${order.orderRef} marked as ${nextStatus}.`);
    } catch {
      onNotify('error', 'Network error while updating order status.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handlePaymentChange(nextPayment: PaymentStatus) {
    if (nextPayment === order.paymentStatus) return;
    setUpdatingPayment(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${order.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: nextPayment }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to update payment status.');
        return;
      }
      onOrderUpdated(data.order as AdminOrderRecord);
      onNotify(
        'success',
        `Order ${order.orderRef} payment marked as ${nextPayment}.`
      );
    } catch {
      onNotify('error', 'Network error while updating payment status.');
    } finally {
      setUpdatingPayment(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border-2 border-[#2C2420] bg-white p-5 sm:p-6">
      {/* Order Reference & Time Header */}
      <div className="flex flex-col gap-3 border-b border-[#E7E0D6] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#57534E]">
            <QrCode className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
            <span>Order Reference</span>
          </div>
          <h3 className="mt-0.5 font-display text-2xl font-extrabold text-[#1F1F21] tabular-nums">
            {order.orderRef}
          </h3>
          <p className="mt-0.5 text-xs text-[#57534E] tabular-nums">
            Submitted: {formatColomboDateTime(order.createdAt)} (Asia/Colombo)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-bold ${
              order.orderStatus === 'Completed' || order.orderStatus === 'Ready'
                ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                : order.orderStatus === 'Cancelled'
                  ? 'border-[#57534E]/30 bg-[#F3EFEA] text-[#57534E]'
                  : 'border-[#B91C1C]/30 bg-[#FEF2F2] text-[#B91C1C]'
            }`}
          >
            Status: {order.orderStatus}
          </span>

          <span
            className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-bold ${
              order.paymentStatus === 'Paid'
                ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                : 'border-[#D97706]/30 bg-[#FFFBEB] text-[#92400E]'
            }`}
          >
            Payment: {order.paymentStatus}
          </span>
        </div>
      </div>

      {/* Customer Details & Direct Contact Actions */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#E7E0D6] bg-[#FAF8F5] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#57534E]">
            Customer Details
          </p>
          <p className="mt-1 text-base font-bold text-[#1F1F21]">
            {order.customerName}
          </p>
          <p className="font-mono text-sm font-semibold text-[#B91C1C] tabular-nums">
            {order.customerPhoneDisplay}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`tel:+${order.customerPhoneNormalized}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#2C2420] bg-white px-4 py-2 text-xs font-bold text-[#1F1F21] transition-colors hover:bg-[#F3EFEA]"
          >
            <Phone className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
            <span>Call Customer</span>
          </a>

          <a
            href={whatsappContactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#15803D] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#166534]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Ordered Foods & Preparation Notes */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[#57534E]">
          Ordered Items
        </h4>
        <div className="mt-2 divide-y divide-[#F0EAE0] rounded-xl border border-[#E7E0D6] bg-white">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
            >
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
                  <p className="mt-1 text-xs font-semibold text-[#B91C1C]">
                    Prep note: {item.prepNote}
                  </p>
                )}
              </div>

              <span className="shrink-0 font-bold text-[#1F1F21] tabular-nums">
                {formatLkrPrice(item.lineTotalLkr)}
              </span>
            </div>
          ))}
        </div>

        {order.orderNotes && (
          <div className="mt-3 rounded-xl border border-[#E7E0D6] bg-[#FAF8F5] px-4 py-2.5 text-xs text-[#1F1F21]">
            <strong className="font-semibold">Customer order note:</strong>{' '}
            {order.orderNotes}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[#E7E0D6] pt-3">
          <span className="text-sm font-semibold text-[#57534E]">
            Total ({order.paymentMethod})
          </span>
          <span className="font-display text-2xl font-extrabold text-[#B91C1C] tabular-nums">
            {formatLkrPrice(order.totalLkr)}
          </span>
        </div>
      </div>

      {/* Staff Controls: Order Status & Payment Status (Separate) */}
      <div className="grid grid-cols-1 gap-4 border-t border-[#E7E0D6] pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor={`staff-status-${order.id}`}
            className="block text-xs font-semibold uppercase tracking-wide text-[#57534E]"
          >
            Update Order Status
          </label>
          <select
            id={`staff-status-${order.id}`}
            disabled={updatingStatus}
            value={order.orderStatus}
            onChange={(e) => void handleStatusChange(e.target.value as OrderStatus)}
            className="h-11 w-full rounded-xl border border-[#2C2420]/30 bg-white px-3 text-sm font-semibold text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none disabled:opacity-60"
          >
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[#57534E]">
            Payment Status (Separate)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={updatingPayment}
              onClick={() => void handlePaymentChange('Unpaid')}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-colors ${
                order.paymentStatus === 'Unpaid'
                  ? 'border-[#D97706] bg-[#FFFBEB] text-[#92400E]'
                  : 'border-[#DDD4C7] bg-white text-[#57534E] hover:bg-[#F3EFEA]'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Unpaid</span>
            </button>

            <button
              type="button"
              disabled={updatingPayment}
              onClick={() => void handlePaymentChange('Paid')}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-colors ${
                order.paymentStatus === 'Paid'
                  ? 'border-[#15803D] bg-[#15803D] text-white'
                  : 'border-[#DDD4C7] bg-white text-[#57534E] hover:bg-[#F0FDF4] hover:text-[#15803D]'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Paid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Change History */}
      {order.statusHistory.length > 0 && (
        <div className="border-t border-[#E7E0D6] pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#57534E]">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Status Timeline (Asia/Colombo)</span>
          </p>
          <div className="mt-2 space-y-1.5">
            {order.statusHistory.map((ev, idx) => (
              <div
                key={`${ev.status}-${idx}`}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-semibold text-[#1F1F21]">{ev.status}</span>
                <span className="font-mono text-[#57534E] tabular-nums">
                  {formatColomboDateTime(ev.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
