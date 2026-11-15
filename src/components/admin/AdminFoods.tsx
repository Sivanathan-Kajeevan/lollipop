import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Category, FoodItem } from '../../types/menu';
import {
  formatLkrPrice,
  validateFoodInput,
  validateImageFileMeta,
} from '../../utils/menuLogic';
import { adminFetch } from '../../utils/adminFetch';
import { FoodImage } from '../FoodImage';

interface AdminFoodsProps {
  foods: FoodItem[];
  categories: Category[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

interface FoodFormState {
  id?: number;
  name: string;
  description: string;
  priceLkr: string;
  categoryId: number;
  imageUrl: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  isSpecial: boolean;
  displayOrder: string;
}

export function AdminFoods({
  foods,
  categories,
  onRefresh,
  onNotify,
}: AdminFoodsProps) {
  const [search, setSearch] = useState('');
  const [filterCatId, setFilterCatId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'unavailable'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<FoodFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FoodItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return foods.filter((f) => {
      if (filterCatId !== 'all' && f.categoryId !== Number(filterCatId)) {
        return false;
      }
      if (filterStatus === 'available' && !f.isAvailable) return false;
      if (filterStatus === 'unavailable' && f.isAvailable) return false;
      if (q) {
        const match =
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [foods, search, filterCatId, filterStatus]);

  function openAddModal() {
    if (categories.length === 0) {
      onNotify('error', 'Create at least one category before adding foods.');
      return;
    }
    setFormError(null);
    setFormState({
      name: '',
      description: '',
      priceLkr: '',
      categoryId: categories[0].id,
      imageUrl: '',
      isAvailable: true,
      isVegetarian: false,
      isSpicy: false,
      isSpecial: false,
      displayOrder: String(foods.length + 1),
    });
    setModalOpen(true);
  }

  function openEditModal(food: FoodItem) {
    setFormError(null);
    setFormState({
      id: food.id,
      name: food.name,
      description: food.description,
      priceLkr: String(food.priceLkr),
      categoryId: food.categoryId,
      imageUrl: food.imageUrl,
      isAvailable: food.isAvailable,
      isVegetarian: food.isVegetarian,
      isSpicy: food.isSpicy,
      isSpecial: food.isSpecial,
      displayOrder: String(food.displayOrder),
    });
    setModalOpen(true);
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !formState) return;

    setFormError(null);
    const metaCheck = validateImageFileMeta(file.type, file.size);
    if (!metaCheck.valid) {
      setFormError(metaCheck.error || 'Invalid image file.');
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const res = await adminFetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Image upload failed.');
        return;
      }
      setFormState((prev) => (prev ? { ...prev, imageUrl: data.url } : prev));
    } catch {
      setFormError('Network error while uploading image.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveFood(e: FormEvent) {
    e.preventDefault();
    if (!formState) return;
    setFormError(null);

    const validation = validateFoodInput({
      name: formState.name,
      description: formState.description,
      priceLkr: formState.priceLkr === '' ? -1 : Number(formState.priceLkr),
      categoryId: formState.categoryId,
      displayOrder:
        formState.displayOrder === '' ? 0 : Number(formState.displayOrder),
    });

    if (!validation.valid) {
      setFormError(validation.errors[0]);
      return;
    }

    if (!formState.imageUrl.trim()) {
      setFormError('Please upload a food photograph.');
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(formState.id);
      const endpoint = isEdit
        ? `/api/admin/foods/${formState.id}`
        : '/api/admin/foods';
      const res = await adminFetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name.trim(),
          description: formState.description.trim(),
          priceLkr: Number(formState.priceLkr),
          categoryId: Number(formState.categoryId),
          imageUrl: formState.imageUrl.trim(),
          isAvailable: formState.isAvailable,
          isVegetarian: formState.isVegetarian,
          isSpicy: formState.isSpicy,
          isSpecial: formState.isSpecial,
          displayOrder: Number(formState.displayOrder) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Unable to save food item.');
        return;
      }

      setModalOpen(false);
      setFormState(null);
      await onRefresh();
      onNotify(
        'success',
        isEdit ? `Updated "${data.food.name}".` : `Added "${data.food.name}" to the menu.`
      );
    } catch {
      setFormError('Network error while saving food item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAvailability(food: FoodItem) {
    setTogglingId(food.id);
    try {
      const res = await adminFetch(`/api/admin/foods/${food.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: !food.isAvailable,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to update availability.');
        return;
      }
      await onRefresh();
      onNotify(
        'success',
        `"${food.name}" marked as ${!food.isAvailable ? 'available' : 'currently unavailable'}.`
      );
    } catch {
      onNotify('error', 'Network error while updating availability.');
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/foods/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to delete food item.');
        return;
      }
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      await onRefresh();
      onNotify('success', `Deleted "${deletedName}".`);
    } catch {
      onNotify('error', 'Network error while deleting food item.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#1F1F21]">
            Food Management
          </h2>
          <p className="text-sm text-[#57534E]">
            Add dishes, upload photos, update LKR prices, and toggle availability.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#991B1B]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Food</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#E7E0D6] bg-white p-4 sm:grid-cols-3">
        <div className="relative">
          <label htmlFor="admin-food-search" className="sr-only">
            Search foods
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]"
            aria-hidden="true"
          />
          <input
            id="admin-food-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search food name or description..."
            className="h-11 w-full rounded-xl border border-[#DDD4C7] bg-white pl-10 pr-3 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="admin-food-cat-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="admin-food-cat-filter"
            value={filterCatId}
            onChange={(e) => setFilterCatId(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>
                {cat.name} {!cat.isVisible ? '(Hidden)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="admin-food-status-filter" className="sr-only">
            Filter by availability
          </label>
          <select
            id="admin-food-status-filter"
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(
                e.target.value as 'all' | 'available' | 'unavailable'
              )
            }
            className="h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
          >
            <option value="all">All availability</option>
            <option value="available">Available only</option>
            <option value="unavailable">Unavailable only</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filteredFoods.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E0D6] bg-white p-10 text-center">
          <p className="font-display text-lg font-semibold text-[#1F1F21]">
            No matching dishes found
          </p>
          <p className="mt-1 text-sm text-[#57534E]">
            {foods.length === 0
              ? 'Get started by adding your first Sri Lankan dish.'
              : 'Try adjusting your search or category filter.'}
          </p>
          {foods.length === 0 ? (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 min-h-[44px] rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#991B1B]"
            >
              Add your first food
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterCatId('all');
                setFilterStatus('all');
              }}
              className="mt-4 min-h-[44px] rounded-xl border border-[#DDD4C7] bg-white px-5 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#F4EFE6]"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E7E0D6] bg-white">
          <div className="divide-y divide-[#F0EAE0]">
            {filteredFoods.map((food) => (
              <div
                key={food.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#EFE9DF]">
                    <FoodImage
                      src={food.imageUrl}
                      alt={food.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                      <span className="font-semibold text-[#1F1F21]">
                        {food.categoryName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Order #{food.displayOrder}
                      </span>
                      {food.isSpecial && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#B91C1C]">
                            Special
                          </span>
                        </>
                      )}
                      {food.isVegetarian && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#15803D]">
                            Vegetarian
                          </span>
                        </>
                      )}
                      {food.isSpicy && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#B91C1C]">
                            Spicy
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-[#1F1F21]">
                      {food.name}
                    </h3>
                    <p className="line-clamp-1 text-sm text-[#57534E]">
                      {food.description}
                    </p>
                    <p className="text-sm font-bold text-[#B91C1C] tabular-nums">
                      {formatLkrPrice(food.priceLkr)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button
                    type="button"
                    disabled={togglingId === food.id}
                    onClick={() => void handleToggleAvailability(food)}
                    aria-label={`Mark "${food.name}" as ${
                      food.isAvailable ? 'unavailable' : 'available'
                    }`}
                    className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      food.isAvailable
                        ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7]'
                        : 'border-[#B91C1C]/30 bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2]'
                    }`}
                  >
                    {food.isAvailable ? 'Available' : 'Unavailable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(food)}
                    aria-label={`Edit "${food.name}"`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DDD4C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1F21] transition-colors hover:bg-[#F4EFE6]"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(food)}
                    aria-label={`Delete "${food.name}"`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#B91C1C]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Food Modal */}
      {modalOpen && formState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F21]/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="food-form-title"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E0D6] px-6 py-4">
              <h3
                id="food-form-title"
                className="font-display text-xl font-semibold text-[#1F1F21]"
              >
                {formState.id ? 'Edit Food Item' : 'Add New Food Item'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close food form"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#57534E] hover:bg-[#F4EFE6]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveFood} className="space-y-4 p-6">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#B91C1C]/30 bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#991B1B]"
                >
                  {formError}
                </div>
              )}

              {/* Image upload + preview */}
              <div>
                <span className="block text-sm font-semibold text-[#1F1F21]">
                  Food photograph <span className="text-[#B91C1C]">*</span>
                </span>
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-28 w-36 shrink-0 overflow-hidden rounded-xl border border-[#E7E0D6] bg-[#FAF7F2]">
                    <FoodImage
                      src={formState.imageUrl}
                      alt={formState.name || 'Food preview'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21] transition-colors hover:bg-[#F4EFE6]">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {uploadingImage
                          ? 'Uploading...'
                          : formState.imageUrl
                            ? 'Replace photo'
                            : 'Upload photo'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="sr-only"
                      />
                    </label>
                    <p className="text-xs text-[#78716C]">
                      JPEG, PNG, or WebP up to 5 MB.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="food-name"
                    className="block text-sm font-semibold text-[#1F1F21]"
                  >
                    Food name <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    id="food-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) =>
                      setFormState({ ...formState, name: e.target.value })
                    }
                    placeholder="e.g., Chicken Kottu"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="food-category"
                    className="block text-sm font-semibold text-[#1F1F21]"
                  >
                    Category <span className="text-[#B91C1C]">*</span>
                  </label>
                  <select
                    id="food-category"
                    value={formState.categoryId}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        categoryId: Number(e.target.value),
                      })
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="food-description"
                  className="block text-sm font-semibold text-[#1F1F21]"
                >
                  Short description <span className="text-[#B91C1C]">*</span>
                </label>
                <textarea
                  id="food-description"
                  required
                  rows={3}
                  value={formState.description}
                  onChange={(e) =>
                    setFormState({ ...formState, description: e.target.value })
                  }
                  placeholder="Describe ingredients, preparation, and sides..."
                  className="mt-1.5 w-full rounded-xl border border-[#DDD4C7] p-3.5 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="food-price"
                    className="block text-sm font-semibold text-[#1F1F21]"
                  >
                    Price (LKR) <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    id="food-price"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={formState.priceLkr}
                    onChange={(e) =>
                      setFormState({ ...formState, priceLkr: e.target.value })
                    }
                    placeholder="850"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] tabular-nums focus:border-[#B91C1C] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="food-order"
                    className="block text-sm font-semibold text-[#1F1F21]"
                  >
                    Display order
                  </label>
                  <input
                    id="food-order"
                    type="number"
                    min={0}
                    step={1}
                    value={formState.displayOrder}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        displayOrder: e.target.value,
                      })
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] tabular-nums focus:border-[#B91C1C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E7E0D6] bg-[#FAF7F2] p-4 sm:grid-cols-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#1F1F21]">
                  <input
                    type="checkbox"
                    checked={formState.isAvailable}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isAvailable: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#B91C1C]"
                  />
                  Available
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#1F1F21]">
                  <input
                    type="checkbox"
                    checked={formState.isVegetarian}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isVegetarian: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#15803D]"
                  />
                  Vegetarian
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#1F1F21]">
                  <input
                    type="checkbox"
                    checked={formState.isSpicy}
                    onChange={(e) =>
                      setFormState({ ...formState, isSpicy: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#B91C1C]"
                  />
                  Spicy
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#1F1F21]">
                  <input
                    type="checkbox"
                    checked={formState.isSpecial}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isSpecial: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#B91C1C]"
                  />
                  Special
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#E7E0D6] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#F4EFE6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="min-h-[44px] rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:opacity-60"
                >
                  {saving
                    ? 'Saving...'
                    : formState.id
                      ? 'Save Changes'
                      : 'Add Food'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F21]/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-food-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3
              id="delete-food-title"
              className="font-display text-xl font-semibold text-[#1F1F21]"
            >
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h3>
            <p className="mt-2 text-sm text-[#57534E]">
              This dish will be removed from the menu immediately, while past customer orders remain preserved. This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] rounded-xl border border-[#DDD4C7] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#F4EFE6]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="min-h-[44px] rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Food'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
