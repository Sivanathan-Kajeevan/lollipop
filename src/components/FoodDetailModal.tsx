import { useEffect, useState } from 'react';
import { Flame, Leaf, Minus, Plus, ShoppingBag, Sparkles, X } from 'lucide-react';
import type { FoodItem } from '../types/menu';
import { formatLkrPrice } from '../utils/menuLogic';
import { FoodImage } from './FoodImage';

interface FoodDetailModalProps {
  food: FoodItem | null;
  existingQuantity?: number;
  existingNote?: string;
  onClose: () => void;
  onAddToCart: (food: FoodItem, quantity: number, note?: string) => void;
}

export function FoodDetailModal({
  food,
  existingQuantity = 0,
  existingNote = '',
  onClose,
  onAddToCart,
}: FoodDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!food) return;
    setQuantity(1);
    setNote(existingNote);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [food, existingNote, onClose]);

  if (!food) return null;

  const linePreviewTotal = food.priceLkr * quantity;

  function handleConfirmAdd() {
    if (!food || !food.isAvailable) return;
    onAddToCart(food, quantity, note);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1F1F21]/65 p-0 backdrop-blur-xs sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-detail-title"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-2 border-[#2C2420] bg-[#FAF8F5] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[4/3] w-full bg-[#E6DFD5]">
          <FoodImage
            src={food.imageUrl}
            alt={food.name}
            className={`h-full w-full object-cover ${
              food.isAvailable ? '' : 'grayscale-[45%] opacity-75'
            }`}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close food details"
            className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#1F1F21]/85 text-white transition-colors hover:bg-[#1F1F21] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {!food.isAvailable && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1F1F21]/90 via-[#1F1F21]/60 to-transparent px-4 pb-3 pt-8">
              <span className="text-xs font-semibold tracking-wide text-white">
                Currently unavailable
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#57534E]">
            <span>{food.categoryName || 'Menu'}</span>
            {food.isSpecial && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {food.categoryName?.toLowerCase() === 'special'
                    ? "Chef's Special"
                    : 'Special'}
                </span>
              </>
            )}
            {food.isVegetarian && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#15803D]">
                  <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
                  Vegetarian
                </span>
              </>
            )}
            {food.isSpicy && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  Spicy
                </span>
              </>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <h2
              id="food-detail-title"
              className="font-display text-2xl font-extrabold uppercase tracking-tight text-[#B91C1C] leading-tight"
            >
              {food.name}
            </h2>
            <p className="shrink-0 font-display text-2xl font-extrabold text-[#B91C1C] tabular-nums">
              {formatLkrPrice(food.priceLkr)}
            </p>
          </div>

          <p className="text-sm leading-relaxed text-[#2C2420] sm:text-base">
            {food.description}
          </p>

          {food.isAvailable ? (
            <div className="space-y-4 border-t border-[#DED6CA] pt-4">
              {existingQuantity > 0 && (
                <p className="text-xs font-semibold text-[#15803D]">
                  Currently in your cart: {existingQuantity}{' '}
                  {existingQuantity === 1 ? 'portion' : 'portions'}
                </p>
              )}

              <div>
                <label
                  htmlFor="modal-prep-note"
                  className="block text-xs font-semibold uppercase tracking-wide text-[#57534E]"
                >
                  Preparation note (optional)
                </label>
                <input
                  id="modal-prep-note"
                  type="text"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Less spicy, extra gravy, no onions"
                  className="mt-1.5 h-11 w-full rounded-xl border-2 border-[#2C2420]/20 bg-white px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center justify-between rounded-xl border-2 border-[#2C2420] bg-white px-2 py-1 sm:w-40">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-[#1F1F21] hover:bg-[#F3EFEA]"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span
                    className="font-display text-lg font-extrabold text-[#1F1F21] tabular-nums"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                    aria-label="Increase quantity"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-[#1F1F21] hover:bg-[#F3EFEA]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#991B1B] active:scale-[0.99]"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  <span>Add to Cart · {formatLkrPrice(linePreviewTotal)}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-[#DED6CA] pt-4">
              <span className="text-sm font-semibold text-[#B91C1C]">
                Currently unavailable for ordering
              </span>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl border-2 border-[#2C2420] bg-white px-5 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#EFEAE2]"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
