import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import type {
  CartItem,
  CustomerOrderView,
  LatestOrderReference,
  OrderPriceChange,
} from '../types/menu';
import { formatLkrPrice, validateSriLankanMobile } from '../utils/menuLogic';
import { FoodImage } from './FoodImage';

interface CartCheckoutPageProps {
  items: CartItem[];
  itemCount: number;
  totalLkr: number;
  onUpdateQuantity: (foodId: number, quantity: number) => void;
  onUpdateNote: (foodId: number, note: string) => void;
  onRemoveItem: (foodId: number) => void;
  onApplyPriceChanges: (changes: OrderPriceChange[]) => void;
  onOrderSuccess: (order: CustomerOrderView, latestRef: LatestOrderReference) => void;
  onNavigate: (path: string) => void;
}

function createRequestUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CartCheckoutPage({
  items,
  itemCount,
  totalLkr,
  onUpdateQuantity,
  onUpdateNote,
  onRemoveItem,
  onApplyPriceChanges,
  onOrderSuccess,
  onNavigate,
}: CartCheckoutPageProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [clientRequestId, setClientRequestId] = useState<string>(() =>
    createRequestUuid()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChangeNotice, setPriceChangeNotice] = useState<{
    changes: OrderPriceChange[];
    updatedTotalLkr: number;
  } | null>(null);

  async function submitOrder(acceptPriceChange: boolean) {
    setError(null);

    const cleanName = customerName.trim();
    if (!cleanName) {
      setError('Please enter your name.');
      return;
    }

    const phoneValidation = validateSriLankanMobile(customerPhone);
    if (!phoneValidation.valid) {
      setError(
        phoneValidation.error ||
          'Enter a valid Sri Lankan mobile number (e.g., 077 123 4567).'
      );
      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: cleanName,
          customerPhone: customerPhone.trim(),
          orderNotes: orderNotes.trim(),
          clientRequestId,
          acceptPriceChange,
          items: items.map((item) => ({
            foodId: item.foodId,
            quantity: item.quantity,
            expectedPriceLkr: item.unitPriceLkr,
            note: item.note,
          })),
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.code === 'PRICE_CHANGED') {
        const changes = (data.changes ?? []) as OrderPriceChange[];
        onApplyPriceChanges(changes);
        setPriceChangeNotice({
          changes,
          updatedTotalLkr: Number(data.updatedTotalLkr) || totalLkr,
        });
        setClientRequestId(createRequestUuid());
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Unable to place your order right now.');
        return;
      }

      const savedOrder = data.order as CustomerOrderView;
      onOrderSuccess(savedOrder, {
        customerToken: savedOrder.customerToken,
        orderRef: savedOrder.orderRef,
        createdAt: savedOrder.createdAt,
      });
    } catch {
      setError('Network error while placing order. Please tap Place Order again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitOrder(false);
  }

  return (
    <div className="min-h-screen bg-[#F3EFEA] pb-16 text-[#1F1F21]">
      <header className="border-b border-[#DED6CA] bg-[#FAF8F5]/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#1F1F21] transition-colors hover:text-[#B91C1C]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Menu</span>
          </button>

          <span className="font-display text-lg font-extrabold text-[#1F1F21]">
            Your Order
          </span>

          <span className="text-xs font-semibold text-[#57534E] tabular-nums">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#2C2420]/25 bg-[#FAF8F5] px-6 py-12 text-center">
            <ShoppingBag
              className="mx-auto h-12 w-12 text-[#B91C1C]/60"
              aria-hidden="true"
            />
            <h1 className="mt-4 font-display text-2xl font-bold text-[#1F1F21]">
              Your cart is empty
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#57534E]">
              Browse our Sri Lankan dishes and tap Add on anything you would like to order.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="mt-6 min-h-[48px] rounded-xl bg-[#B91C1C] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#991B1B]"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            {/* Cart Items List */}
            <section
              aria-label="Selected dishes"
              className="space-y-4 rounded-2xl border-2 border-[#2C2420] bg-[#FAF8F5] p-4 sm:p-6"
            >
              <div className="flex items-center justify-between border-b border-[#DED6CA] pb-3">
                <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-[#1F1F21]">
                  Order Items
                </h1>
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  className="text-xs font-bold text-[#B91C1C] hover:underline"
                >
                  + Add more items
                </button>
              </div>

              <div className="divide-y divide-[#DED6CA]">
                {items.map((item) => {
                  const subtotal = item.unitPriceLkr * item.quantity;
                  return (
                    <div key={item.foodId} className="space-y-3 py-4 first:pt-1 last:pb-1">
                      <div className="flex items-start gap-3">
                        <div className="h-18 w-20 shrink-0 overflow-hidden rounded-xl border border-[#2C2420] bg-[#E6DFD5]">
                          <FoodImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="font-display text-base font-extrabold uppercase leading-snug text-[#B91C1C]">
                              {item.name}
                            </h2>
                            <button
                              type="button"
                              onClick={() => {
                                onRemoveItem(item.foodId);
                                setClientRequestId(createRequestUuid());
                              }}
                              aria-label={`Remove ${item.name}`}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#78716C] hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>

                          <p className="text-xs font-medium text-[#57534E] tabular-nums">
                            {formatLkrPrice(item.unitPriceLkr)} each
                          </p>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex items-center rounded-xl border-2 border-[#2C2420] bg-white">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateQuantity(item.foodId, item.quantity - 1);
                                  setClientRequestId(createRequestUuid());
                                }}
                                aria-label={`Decrease quantity of ${item.name}`}
                                className="flex h-10 w-10 items-center justify-center rounded-l-lg text-[#1F1F21] hover:bg-[#F3EFEA]"
                              >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <span className="min-w-[28px] text-center font-display text-sm font-extrabold text-[#1F1F21] tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateQuantity(item.foodId, item.quantity + 1);
                                  setClientRequestId(createRequestUuid());
                                }}
                                aria-label={`Increase quantity of ${item.name}`}
                                className="flex h-10 w-10 items-center justify-center rounded-r-lg text-[#B91C1C] hover:bg-[#FEF2F2]"
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>

                            <p className="font-display text-base font-extrabold text-[#1F1F21] tabular-nums">
                              {formatLkrPrice(subtotal)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`prep-note-${item.foodId}`}
                          className="sr-only"
                        >
                          Preparation note for {item.name}
                        </label>
                        <input
                          id={`prep-note-${item.foodId}`}
                          type="text"
                          maxLength={200}
                          value={item.note}
                          onChange={(e) => {
                            onUpdateNote(item.foodId, e.target.value);
                            setClientRequestId(createRequestUuid());
                          }}
                          placeholder="Optional preparation note (e.g., less spicy, no onions)"
                          className="h-10 w-full rounded-xl border border-[#DED6CA] bg-white px-3 text-xs text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t-2 border-[#2C2420] pt-4">
                <div className="flex items-center justify-between text-base font-bold text-[#1F1F21]">
                  <span>Total</span>
                  <span className="font-display text-2xl font-extrabold text-[#B91C1C] tabular-nums">
                    {formatLkrPrice(totalLkr)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#15803D]">
                  Payment at restaurant
                </p>
              </div>
            </section>

            {/* Customer Details & Submission Form */}
            <section
              aria-label="Customer contact details"
              className="rounded-2xl border-2 border-[#2C2420] bg-white p-4 sm:p-6"
            >
              <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-[#1F1F21]">
                Your Details
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
                Your contact details are used only to manage your order.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-[#B91C1C]/40 bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#991B1B]"
                >
                  {error}
                </div>
              )}

              {priceChangeNotice && (
                <div
                  role="alert"
                  className="mt-4 space-y-3 rounded-xl border-2 border-[#D97706] bg-[#FFFBEB] p-4 text-sm text-[#92400E]"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" aria-hidden="true" />
                    <div>
                      <p className="font-bold">Menu prices have been updated</p>
                      <ul className="mt-1.5 space-y-1 text-xs">
                        {priceChangeNotice.changes.map((ch) => (
                          <li key={ch.foodId} className="tabular-nums">
                            <strong>{ch.name}:</strong>{' '}
                            <span className="line-through">
                              {formatLkrPrice(ch.oldPriceLkr)}
                            </span>{' '}
                            →{' '}
                            <strong className="text-[#1F1F21]">
                              {formatLkrPrice(ch.newPriceLkr)}
                            </strong>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 font-bold text-[#1F1F21] tabular-nums">
                        Updated Total: {formatLkrPrice(priceChangeNotice.updatedTotalLkr)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submitOrder(true)}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-4 py-2 text-sm font-bold text-white hover:bg-[#991B1B] disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Confirm Updated Total & Place Order</span>
                  </button>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="customer-name"
                    className="block text-sm font-semibold text-[#1F1F21]"
                  >
                    Customer name <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    id="customer-name"
                    name="customerName"
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    className="mt-1.5 h-12 w-full rounded-xl border-2 border-[#2C2420]/25 bg-[#FAF8F5] px-3.5 text-base text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customer-phone"
                    className="block text-sm font-semibold text-[#1F1F21]"
                  >
                    Mobile number <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    id="customer-phone"
                    name="customerPhone"
                    type="tel"
                    inputMode="tel"
                    required
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="077 123 4567 or +94 77 123 4567"
                    className="mt-1.5 h-12 w-full rounded-xl border-2 border-[#2C2420]/25 bg-[#FAF8F5] px-3.5 text-base text-[#1F1F21] tabular-nums placeholder:text-[#78716C] focus:border-[#B91C1C] focus:bg-white focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-[#57534E]">
                    Sri Lankan mobile formats accepted (e.g., 072 804 4969 or +94 72 804 4969).
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="order-notes"
                    className="block text-sm font-semibold text-[#1F1F21]"
                  >
                    Order notes{' '}
                    <span className="text-xs font-normal text-[#78716C]">(optional)</span>
                  </label>
                  <textarea
                    id="order-notes"
                    name="orderNotes"
                    rows={2}
                    maxLength={300}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Table number, takeaway request, or cutlery preferences..."
                    className="mt-1.5 w-full rounded-xl border-2 border-[#2C2420]/25 bg-[#FAF8F5] p-3 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-[#DED6CA] bg-[#FAF8F5] p-3.5 text-xs leading-relaxed text-[#44403C]">
                  <div className="flex items-start gap-2.5">
                    <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold text-[#1F1F21]">
                        Payment at restaurant
                      </p>
                      <p>
                        After placing your order, you will receive a unique order QR code to present to restaurant staff.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-6 py-3 text-base font-bold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-60"
                >
                  <QrCode className="h-5 w-5" aria-hidden="true" />
                  <span>
                    {submitting
                      ? 'Submitting Order...'
                      : `Place Order · ${formatLkrPrice(totalLkr)}`}
                  </span>
                </button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
