import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Flame,
  Leaf,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CartItem,
  FoodItem,
  LatestOrderReference,
  PublicMenuPayload,
} from '../types/menu';
import {
  buildWhatsAppUrl,
  filterPublicMenuFoods,
  formatLkrPrice,
  normalizeSriLankanWhatsApp,
} from '../utils/menuLogic';
import { FoodDetailModal } from './FoodDetailModal';
import { FoodImage } from './FoodImage';

interface PublicMenuPageProps {
  onNavigate: (path: string) => void;
  cartItems: CartItem[];
  cartItemCount: number;
  cartTotalLkr: number;
  latestOrder: LatestOrderReference | null;
  onAddToCart: (food: FoodItem, quantity?: number, note?: string) => void;
  onUpdateQuantity: (foodId: number, quantity: number) => void;
}

export function PublicMenuPage({
  onNavigate,
  cartItems,
  cartItemCount,
  cartTotalLkr,
  latestOrder,
  onAddToCart,
  onUpdateQuantity,
}: PublicMenuPageProps) {
  const [menuData, setMenuData] = useState<PublicMenuPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/menu', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Unable to load menu right now.');
      }
      const data = (await res.json()) as PublicMenuPayload;
      setMenuData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const categories = menuData?.categories ?? [];
  const foods = menuData?.foods ?? [];
  const settings = menuData?.settings;

  const cartByFoodId = useMemo(() => {
    const map = new Map<number, CartItem>();
    for (const item of cartItems) {
      map.set(item.foodId, item);
    }
    return map;
  }, [cartItems]);

  const filteredFoods = useMemo(() => {
    return filterPublicMenuFoods(foods, categories, {
      search: searchQuery,
      categoryId: selectedCategoryId,
    });
  }, [foods, categories, searchQuery, selectedCategoryId]);

  useEffect(() => {
    if (
      selectedCategoryId !== 'all' &&
      categories.length > 0 &&
      !categories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId('all');
    }
  }, [categories, selectedCategoryId]);

  const whatsappInfo = normalizeSriLankanWhatsApp(
    settings?.whatsappNumber || '0728044969'
  );
  const whatsappUrl = buildWhatsAppUrl(
    settings?.whatsappNumber || '0728044969'
  );
  const restaurantName = settings?.restaurantName || 'Lollipop';
  const welcomeMessage =
    settings?.welcomeMessage || 'Fresh flavours. Happy moments.';
  const logoUrl = settings?.logoUrl || '/assets/aistudio/image_0b3be71d.png';

  const selectedFoodCartItem = selectedFood
    ? cartByFoodId.get(selectedFood.id)
    : undefined;

  return (
    <div className="min-h-screen bg-[#F3EFEA] text-[#1F1F21]">
      {/* Compact 3-zone top bar */}
      <header className="border-b border-[#DED6CA] bg-[#FAF8F5]/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setSelectedCategoryId('all');
              setSearchQuery('');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
          >
            <img
              src={logoUrl}
              alt={`${restaurantName} Restaurant`}
              referrerPolicy="no-referrer"
              className="h-9 w-auto max-w-[130px] object-contain"
            />
            <span className="font-display text-lg font-extrabold tracking-tight text-[#1F1F21] whitespace-nowrap">
              {restaurantName}
            </span>
          </a>

          {latestOrder && (
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={`/order/${latestOrder.customerToken}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(`/order/${latestOrder.customerToken}`);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#2C2420]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#B91C1C] transition-colors hover:border-[#B91C1C] whitespace-nowrap"
              >
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>My Order</span>
              </a>
            </div>
          )}
        </div>
      </header>

      <main
        className={`mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7 ${
          cartItemCount > 0 ? 'pb-40' : 'pb-24'
        }`}
      >
        {/* Welcome Hero Strip */}
        <section className="mb-5 rounded-2xl border-2 border-[#2C2420] bg-[#FAF8F5] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl space-y-1.5">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#1F1F21] sm:text-4xl [text-wrap:balance]">
                {welcomeMessage}
              </h1>
              <p className="text-sm leading-relaxed text-[#44403C] sm:text-base">
                Browse freshly prepared Sri Lankan dishes at{' '}
                <span className="font-semibold text-[#1F1F21]">{restaurantName}</span>,
                add your favourites to your order, and show your order QR code at the counter.
              </p>
            </div>

            {latestOrder && (
              <button
                type="button"
                onClick={() => onNavigate(`/order/${latestOrder.customerToken}`)}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 self-start rounded-xl border-2 border-[#2C2420] bg-white px-4 py-2 text-xs font-bold text-[#1F1F21] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C] sm:self-center"
              >
                <QrCode className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
                <span>Order {latestOrder.orderRef}</span>
              </button>
            )}
          </div>
        </section>

        {/* Search and Category Filters */}
        <section aria-label="Menu search and filters" className="mb-6 space-y-3.5">
          <div className="relative">
            <label htmlFor="menu-search" className="sr-only">
              Search dishes by name or description
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#57534E]"
              aria-hidden="true"
            />
            <input
              id="menu-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, kottu, curry..."
              className="h-12 w-full rounded-xl border-2 border-[#2C2420]/25 bg-[#FAF8F5] pl-12 pr-11 text-base text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#57534E] hover:bg-[#EAE3D8] hover:text-[#1F1F21]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Food categories"
            className="flex items-center gap-2 overflow-x-auto pb-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === 'all'}
              onClick={() => setSelectedCategoryId('all')}
              className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                selectedCategoryId === 'all'
                  ? 'bg-[#B91C1C] text-white'
                  : 'border-2 border-[#2C2420]/25 bg-[#FAF8F5] text-[#1F1F21] hover:border-[#2C2420]'
              }`}
            >
              All
            </button>
            {categories.map((category) => {
              const active = selectedCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                    active
                      ? 'bg-[#B91C1C] text-white'
                      : 'border-2 border-[#2C2420]/25 bg-[#FAF8F5] text-[#1F1F21] hover:border-[#2C2420]'
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div
            className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5"
            aria-label="Loading menu"
          >
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[41%_1fr] gap-3 sm:gap-4"
              >
                <div className="min-h-[168px] animate-pulse rounded-2xl border-2 border-[#2C2420]/20 bg-[#E6DFD5] sm:min-h-[196px]" />
                <div className="flex flex-col justify-between rounded-2xl border-2 border-[#2C2420]/20 bg-[#FAF8F5] p-4 sm:p-5">
                  <div className="space-y-2.5">
                    <div className="h-5 w-3/4 animate-pulse rounded bg-[#E6DFD5]" />
                    <div className="h-3.5 w-full animate-pulse rounded bg-[#E6DFD5]" />
                    <div className="h-3.5 w-5/6 animate-pulse rounded bg-[#E6DFD5]" />
                  </div>
                  <div className="h-9 w-28 animate-pulse rounded bg-[#E6DFD5]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-2xl border-2 border-[#B91C1C]/40 bg-[#FAF8F5] p-8 text-center">
            <h2 className="font-display text-xl font-bold text-[#1F1F21]">
              Unable to load menu
            </h2>
            <p className="mt-2 text-sm text-[#57534E]">{error}</p>
            <button
              type="button"
              onClick={() => void loadMenu()}
              className="mt-5 min-h-[44px] rounded-xl bg-[#B91C1C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#991B1B]"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredFoods.length === 0 && (
          <div className="rounded-2xl border-2 border-[#2C2420]/25 bg-[#FAF8F5] px-6 py-12 text-center">
            <Search
              className="mx-auto h-10 w-10 text-[#B91C1C]/60"
              aria-hidden="true"
            />
            <h2 className="mt-4 font-display text-xl font-bold text-[#1F1F21]">
              No dishes match your selection
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#57534E]">
              {searchQuery
                ? `We couldn't find any dishes matching "${searchQuery}". Try another keyword or browse all categories.`
                : 'There are currently no dishes listed in this category.'}
            </p>
            {(searchQuery || selectedCategoryId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId('all');
                }}
                className="mt-5 min-h-[44px] rounded-xl bg-[#1F1F21] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#333336]"
              >
                Show all dishes
              </button>
            )}
          </div>
        )}

        {/* Menu Grid — Reference Split-Row Card Layout with Ordering Controls */}
        {!loading && !error && filteredFoods.length > 0 && (
          <section aria-label="Menu dishes">
            <div className="mb-4 flex items-center justify-between text-sm text-[#57534E]">
              <span>
                Showing{' '}
                <strong className="font-semibold text-[#1F1F21] tabular-nums">
                  {filteredFoods.length}
                </strong>{' '}
                {filteredFoods.length === 1 ? 'dish' : 'dishes'}
              </span>
              {selectedCategoryId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('all')}
                  className="font-semibold text-[#B91C1C] hover:underline"
                >
                  View all categories
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              {filteredFoods.map((food) => {
                const inCart = cartByFoodId.get(food.id);
                const qty = inCart?.quantity ?? 0;

                return (
                  <article
                    key={food.id}
                    className="group grid w-full grid-cols-[41%_1fr] items-stretch gap-2.5 sm:gap-4"
                  >
                    {/* Left: Rounded Photograph Box (tappable for details) */}
                    <button
                      type="button"
                      onClick={() => setSelectedFood(food)}
                      aria-label={`View details for ${food.name}`}
                      className="relative min-h-[168px] overflow-hidden rounded-2xl border-2 border-[#2C2420] bg-[#E6DFD5] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] sm:min-h-[196px]"
                    >
                      <FoodImage
                        src={food.imageUrl}
                        alt={food.name}
                        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
                          food.isAvailable ? '' : 'grayscale-[45%] opacity-75'
                        }`}
                      />
                      {!food.isAvailable && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1F1F21]/90 via-[#1F1F21]/65 to-transparent px-2.5 pb-2.5 pt-6 sm:px-3">
                          <span className="text-[11px] font-semibold tracking-wide text-white sm:text-xs">
                            Currently unavailable
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Right: Charcoal-Bordered Menu Info Box */}
                    <div className="flex flex-col justify-between rounded-2xl border-2 border-[#2C2420] bg-[#FAF8F5] px-3.5 py-3 transition-colors group-hover:bg-white sm:px-5 sm:py-4">
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedFood(food)}
                          className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
                        >
                          <h3 className="font-display text-base font-extrabold uppercase tracking-tight leading-tight text-[#B91C1C] hover:underline sm:text-xl">
                            {food.name}
                          </h3>
                          <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-[#2C2420] sm:line-clamp-3 sm:text-sm sm:leading-relaxed">
                            {food.description}
                          </p>
                        </button>

                        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-[#57534E] sm:text-xs">
                          <span>{food.categoryName}</span>
                          {food.isSpecial && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 font-semibold text-[#B91C1C]">
                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                {food.categoryName?.toLowerCase() === 'special'
                                  ? "Chef's Special"
                                  : 'Special'}
                              </span>
                            </>
                          )}
                          {food.isVegetarian && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 font-semibold text-[#15803D]">
                                <Leaf className="h-3 w-3" aria-hidden="true" />
                                Vegetarian
                              </span>
                            </>
                          )}
                          {food.isSpicy && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 font-semibold text-[#B91C1C]">
                                <Flame className="h-3 w-3" aria-hidden="true" />
                                Spicy
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="font-display text-lg font-extrabold tracking-tight text-[#B91C1C] tabular-nums sm:text-2xl">
                          {formatLkrPrice(food.priceLkr)}
                        </p>

                        {!food.isAvailable ? (
                          <span className="inline-flex min-h-[44px] items-center rounded-xl border border-[#DED6CA] bg-[#F3EFEA] px-3 text-xs font-semibold text-[#78716C]">
                            Unavailable
                          </span>
                        ) : qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => onAddToCart(food, 1)}
                            aria-label={`Add ${food.name} to cart`}
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-[#B91C1C] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#991B1B] active:scale-[0.97] sm:text-sm"
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            <span>Add</span>
                          </button>
                        ) : (
                          <div
                            className="inline-flex items-center rounded-xl border-2 border-[#2C2420] bg-white"
                            role="group"
                            aria-label={`Quantity controls for ${food.name}`}
                          >
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(food.id, qty - 1)}
                              aria-label={`Decrease quantity of ${food.name}`}
                              className="flex h-11 w-10 items-center justify-center rounded-l-lg text-[#1F1F21] transition-colors hover:bg-[#F3EFEA]"
                            >
                              <Minus className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <span className="min-w-[24px] text-center font-display text-sm font-extrabold text-[#1F1F21] tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(food.id, qty + 1)}
                              aria-label={`Increase quantity of ${food.name}`}
                              className="flex h-11 w-10 items-center justify-center rounded-r-lg text-[#B91C1C] transition-colors hover:bg-[#FEF2F2]"
                            >
                              <Plus className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Footer with WhatsApp Contact & Optional Address/Hours */}
      <footer
        className={`border-t border-[#E7E0D6] bg-white ${
          cartItemCount > 0 ? 'pb-24' : ''
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="font-display text-lg font-bold text-[#1F1F21]">
                  {restaurantName}
                </span>
                <span className="text-xs font-medium text-[#57534E]">
                  · Payment at restaurant
                </span>
              </div>

              {(settings?.address || settings?.openingHours) && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[#57534E]">
                  {settings.address && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
                      {settings.address}
                    </span>
                  )}
                  {settings.openingHours && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
                      {settings.openingHours}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#15803D] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                <span>WhatsApp · {whatsappInfo.display || '072 804 4969'}</span>
              </a>
              <span className="text-xs text-[#57534E]">
                Message {restaurantName} on WhatsApp for menu questions
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Contact Button — shifts upward when sticky cart bar is open so they never overlap */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Contact ${restaurantName} on WhatsApp (${whatsappInfo.display || '072 804 4969'})`}
        className={`fixed right-4 z-30 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#15803D] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.03] hover:bg-[#166534] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D] ${
          cartItemCount > 0 ? 'bottom-24' : 'bottom-4'
        }`}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <span>WhatsApp</span>
      </a>

      {/* Sticky Bottom Cart Bar */}
      {cartItemCount > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#2C2420] bg-[#FAF8F5]/95 px-4 py-3 shadow-2xl backdrop-blur-md"
          role="region"
          aria-label="Shopping cart summary"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#57534E] tabular-nums">
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in order
              </p>
              <p className="font-display text-xl font-extrabold text-[#B91C1C] tabular-nums">
                {formatLkrPrice(cartTotalLkr)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/cart')}
              className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-[#B91C1C] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#991B1B] active:scale-[0.98]"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              <span>View Cart</span>
            </button>
          </div>
        </div>
      )}

      <FoodDetailModal
        food={selectedFood}
        existingQuantity={selectedFoodCartItem?.quantity ?? 0}
        existingNote={selectedFoodCartItem?.note ?? ''}
        onClose={() => setSelectedFood(null)}
        onAddToCart={onAddToCart}
      />
    </div>
  );
}
