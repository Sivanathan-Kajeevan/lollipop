import { useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { Category } from '../../types/menu';
import { adminFetch } from '../../utils/adminFetch';

interface AdminCategoriesProps {
  categories: Category[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function AdminCategories({
  categories,
  onRefresh,
  onNotify,
}: AdminCategoriesProps) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [moveToId, setMoveToId] = useState<number>(0);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      onNotify('error', 'Please enter a category name.');
      return;
    }

    setCreating(true);
    try {
      const res = await adminFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, isVisible: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to create category.');
        return;
      }
      setNewName('');
      await onRefresh();
      onNotify('success', `Category "${data.category.name}" created.`);
    } catch {
      onNotify('error', 'Network error while creating category.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveRename(cat: Category) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      onNotify('error', 'Category name cannot be empty.');
      return;
    }

    setSavingId(cat.id);
    try {
      const res = await adminFetch(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to rename category.');
        return;
      }
      setEditingId(null);
      await onRefresh();
      onNotify('success', `Renamed category to "${data.category.name}".`);
    } catch {
      onNotify('error', 'Network error while renaming category.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleVisibility(cat: Category) {
    setSavingId(cat.id);
    try {
      const res = await adminFetch(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !cat.isVisible }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to update visibility.');
        return;
      }
      await onRefresh();
      onNotify(
        'success',
        `"${cat.name}" is now ${
          !cat.isVisible ? 'visible on the menu' : 'hidden from the menu'
        }.`
      );
    } catch {
      onNotify('error', 'Network error while updating visibility.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setReordering(true);
    try {
      const res = await adminFetch('/api/admin/categories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map((c) => c.id) }),
      });
      if (!res.ok) {
        const data = await res.json();
        onNotify('error', data.error || 'Unable to reorder categories.');
        return;
      }
      await onRefresh();
    } catch {
      onNotify('error', 'Network error while reordering categories.');
    } finally {
      setReordering(false);
    }
  }

  function openDeleteDialog(cat: Category) {
    const alternatives = categories.filter((c) => c.id !== cat.id);
    setMoveToId(alternatives[0]?.id ?? 0);
    setDeleteTarget(cat);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const foodCount = deleteTarget.foodCount ?? 0;

    if (foodCount > 0 && !moveToId) {
      onNotify(
        'error',
        'Create another category first so you can move existing foods before deleting.'
      );
      return;
    }

    setDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/categories/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          foodCount > 0 ? { moveToCategoryId: moveToId } : {}
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data.error || 'Unable to delete category.');
        return;
      }

      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      await onRefresh();
      onNotify(
        'success',
        foodCount > 0
          ? `Moved ${foodCount} dish(es) and deleted "${deletedName}".`
          : `Deleted "${deletedName}".`
      );
    } catch {
      onNotify('error', 'Network error while deleting category.');
    } finally {
      setDeleting(false);
    }
  }

  const otherCategories = deleteTarget
    ? categories.filter((c) => c.id !== deleteTarget.id)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[#1F1F21]">
          Category Management
        </h2>
        <p className="text-sm text-[#57534E]">
          Organise menu sections, control display order, or hide categories temporarily. Hidden categories and their dishes do not appear on the customer menu.
        </p>
      </div>

      {/* Add Category Form */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-2xl border border-[#E7E0D6] bg-white p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="new-category-name"
            className="block text-sm font-semibold text-[#1F1F21]"
          >
            Add new category
          </label>
          <input
            id="new-category-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Beverages, Desserts, Short Eats"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{creating ? 'Adding...' : 'Create Category'}</span>
        </button>
      </form>

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E0D6] bg-white p-8 text-center">
          <p className="font-display text-lg font-semibold text-[#1F1F21]">
            No categories yet
          </p>
          <p className="mt-1 text-sm text-[#57534E]">
            Create your first category above to begin organising your dishes.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E7E0D6] bg-white">
          <div className="divide-y divide-[#F0EAE0]">
            {categories.map((cat, idx) => {
              const isEditing = editingId === cat.id;
              return (
                <div
                  key={cat.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`rename-${cat.id}`} className="sr-only">
                          Rename category {cat.name}
                        </label>
                        <input
                          id={`rename-${cat.id}`}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-10 rounded-xl border border-[#B91C1C] px-3 text-sm font-semibold text-[#1F1F21] focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={savingId === cat.id}
                          onClick={() => void handleSaveRename(cat)}
                          aria-label={`Save name for ${cat.name}`}
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166534]"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel rename"
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#DDD4C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#57534E] hover:bg-[#F4EFE6]"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-[#1F1F21]">
                            {cat.name}
                          </h3>
                          <span className="text-xs font-medium text-[#57534E] tabular-nums">
                            · {cat.foodCount ?? 0} dish
                            {(cat.foodCount ?? 0) === 1 ? '' : 'es'}
                          </span>
                          {!cat.isVisible && (
                            <span className="text-xs font-semibold text-[#B91C1C]">
                              · Hidden from public menu
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0 || reordering}
                      onClick={() => void handleMove(idx, -1)}
                      aria-label={`Move "${cat.name}" up`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDD4C7] bg-white text-[#1F1F21] transition-colors hover:bg-[#F4EFE6] disabled:opacity-40"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === categories.length - 1 || reordering}
                      onClick={() => void handleMove(idx, 1)}
                      aria-label={`Move "${cat.name}" down`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDD4C7] bg-white text-[#1F1F21] transition-colors hover:bg-[#F4EFE6] disabled:opacity-40"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      disabled={savingId === cat.id}
                      onClick={() => void handleToggleVisibility(cat)}
                      aria-label={`${
                        cat.isVisible ? 'Hide' : 'Show'
                      } "${cat.name}" on customer menu`}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        cat.isVisible
                          ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7]'
                          : 'border-[#DDD4C7] bg-[#FAF7F2] text-[#57534E] hover:bg-[#F4EFE6]'
                      }`}
                    >
                      {cat.isVisible ? (
                        <>
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.name);
                      }}
                      aria-label={`Rename "${cat.name}"`}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DDD4C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1F21] hover:bg-[#F4EFE6]"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Rename</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openDeleteDialog(cat)}
                      aria-label={`Delete "${cat.name}"`}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#B91C1C]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete / Move Foods Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F21]/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-cat-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3
              id="delete-cat-title"
              className="font-display text-xl font-semibold text-[#1F1F21]"
            >
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h3>

            {(deleteTarget.foodCount ?? 0) > 0 ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-[#57534E]">
                  This category currently contains{' '}
                  <strong className="font-semibold text-[#1F1F21]">
                    {deleteTarget.foodCount} dish
                    {(deleteTarget.foodCount ?? 0) === 1 ? '' : 'es'}
                  </strong>
                  . You must move those dishes to another category before deleting it.
                </p>

                {otherCategories.length === 0 ? (
                  <p className="rounded-xl border border-[#B91C1C]/30 bg-[#FEF2F2] p-3 text-sm text-[#991B1B]">
                    No other categories exist yet. Create another category first before deleting this one.
                  </p>
                ) : (
                  <div>
                    <label
                      htmlFor="move-foods-target"
                      className="block text-sm font-semibold text-[#1F1F21]"
                    >
                      Move dishes to
                    </label>
                    <select
                      id="move-foods-target"
                      value={moveToId}
                      onChange={(e) => setMoveToId(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
                    >
                      {otherCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#57534E]">
                This empty category will be removed immediately.
              </p>
            )}

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
                disabled={
                  deleting ||
                  ((deleteTarget.foodCount ?? 0) > 0 && otherCategories.length === 0)
                }
                onClick={() => void handleConfirmDelete()}
                className="min-h-[44px] rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:opacity-50"
              >
                {deleting
                  ? 'Deleting...'
                  : (deleteTarget.foodCount ?? 0) > 0
                    ? 'Move Foods & Delete'
                    : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
