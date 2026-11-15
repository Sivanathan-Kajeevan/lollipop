import { useCallback, useEffect, useState } from 'react';
import type {
  CartItem,
  FoodItem,
  LatestOrderReference,
  OrderPriceChange,
} from '../types/menu';
import { calculateCartSummary } from './menuLogic';

const CART_STORAGE_KEY = 'lollipop_cart_v1';
const LATEST_ORDER_STORAGE_KEY = 'lollipop_latest_order_v1';

function readStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.foodId === 'number' &&
        typeof item.name === 'string' &&
        typeof item.unitPriceLkr === 'number' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0
    );
  } catch {
    return [];
  }
}

function writeStoredCart(items: CartItem[]): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function readLatestOrderRef(): LatestOrderReference | null {
  try {
    const raw = window.localStorage.getItem(LATEST_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LatestOrderReference;
    if (!parsed?.customerToken || !parsed?.orderRef) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLatestOrderRef(ref: LatestOrderReference | null): void {
  try {
    if (ref) {
      window.localStorage.setItem(LATEST_ORDER_STORAGE_KEY, JSON.stringify(ref));
    } else {
      window.localStorage.removeItem(LATEST_ORDER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function useCartStore() {
  const [items, setItems] = useState<CartItem[]>(() => readStoredCart());
  const [latestOrder, setLatestOrderState] = useState<LatestOrderReference | null>(() =>
    readLatestOrderRef()
  );

  useEffect(() => {
    writeStoredCart(items);
  }, [items]);

  const setLatestOrder = useCallback((ref: LatestOrderReference | null) => {
    writeLatestOrderRef(ref);
    setLatestOrderState(ref);
  }, []);

  const addItem = useCallback(
    (food: FoodItem, quantityToAdd = 1, note?: string) => {
      if (!food.isAvailable) return;
      const safeQty = Math.max(1, Math.min(99, Math.round(quantityToAdd)));
      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => i.foodId === food.id);
        if (existingIndex === -1) {
          return [
            ...prev,
            {
              foodId: food.id,
              name: food.name,
              unitPriceLkr: food.priceLkr,
              imageUrl: food.imageUrl,
              categoryName: food.categoryName || '',
              quantity: safeQty,
              note: (note || '').trim().slice(0, 200),
            },
          ];
        }
        return prev.map((item, idx) => {
          if (idx !== existingIndex) return item;
          const nextQty = Math.min(99, item.quantity + safeQty);
          return {
            ...item,
            name: food.name,
            unitPriceLkr: food.priceLkr,
            imageUrl: food.imageUrl,
            quantity: nextQty,
            note: note !== undefined ? note.trim().slice(0, 200) : item.note,
          };
        });
      });
    },
    []
  );

  const updateQuantity = useCallback((foodId: number, nextQuantity: number) => {
    setItems((prev) => {
      if (nextQuantity <= 0) {
        return prev.filter((item) => item.foodId !== foodId);
      }
      const clamped = Math.min(99, Math.round(nextQuantity));
      return prev.map((item) =>
        item.foodId === foodId ? { ...item, quantity: clamped } : item
      );
    });
  }, []);

  const updateNote = useCallback((foodId: number, note: string) => {
    const clean = note.slice(0, 200);
    setItems((prev) =>
      prev.map((item) =>
        item.foodId === foodId ? { ...item, note: clean } : item
      )
    );
  }, []);

  const removeItem = useCallback((foodId: number) => {
    setItems((prev) => prev.filter((item) => item.foodId !== foodId));
  }, []);

  const applyPriceChanges = useCallback((changes: OrderPriceChange[]) => {
    const changeMap = new Map(changes.map((c) => [c.foodId, c.newPriceLkr]));
    setItems((prev) =>
      prev.map((item) => {
        const updatedPrice = changeMap.get(item.foodId);
        return updatedPrice !== undefined
          ? { ...item, unitPriceLkr: updatedPrice }
          : item;
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    writeStoredCart([]);
  }, []);

  const summary = calculateCartSummary(items);

  return {
    items,
    itemCount: summary.itemCount,
    totalLkr: summary.totalLkr,
    latestOrder,
    setLatestOrder,
    addItem,
    updateQuantity,
    updateNote,
    removeItem,
    applyPriceChanges,
    clearCart,
  };
}
