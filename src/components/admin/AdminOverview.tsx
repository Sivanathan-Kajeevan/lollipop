import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FolderKanban,
  QrCode,
  ScanLine,
  Utensils,
  XCircle,
} from 'lucide-react';
import type {
  AdminOrderRecord,
  Category,
  FoodItem,
  MenuStats,
} from '../../types/menu';
import { formatColomboDateTime, formatLkrPrice } from '../../utils/menuLogic';

export type AdminTab =
  | 'overview'
  | 'orders'
  | 'scan'
  | 'foods'
  | 'categories'
  | 'settings'
  | 'qr';

interface AdminOverviewProps {
  stats: MenuStats;
  orders: AdminOrderRecord[];
  categories: Category[];
  foods: FoodItem[];
  onSwitchTab: (tab: AdminTab) => void;
}

export function AdminOverview({
  stats,
  orders,
  categories,
  foods,
  onSwitchTab,
}: AdminOverviewProps) {
  const orderKpis = [
    {
      label: 'New orders',
      value: stats.newOrders,
      icon: ClipboardList,
      tone: 'text-[#B91C1C]',
    },
    {
      label: 'Active orders',
      value: stats.activeOrders,
      icon: Clock,
      tone: 'text-[#D97706]',
    },
    {
      label: 'Completed orders',
      value: stats.completedOrders,
      icon: CheckCircle2,
      tone: 'text-[#15803D]',
    },
  ];

  const menuKpis = [
    {
      label: 'Total foods',
      value: stats.totalFoods,
      icon: Utensils,
      tone: 'text-[#1F1F21]',
    },
    {
      label: 'Available foods',
      value: stats.availableFoods,
      icon: CheckCircle2,
      tone: 'text-[#15803D]',
    },
    {
      label: 'Unavailable foods',
      value: stats.unavailableFoods,
      icon: XCircle,
      tone: 'text-[#B91C1C]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#1F1F21]">
            Overview
          </h2>
          <p className="text-sm text-[#57534E]">
            Live orders, menu availability, and QR tools for Lollipop Restaurant.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSwitchTab('scan')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#B91C1C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#991B1B]"
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            <span>Scan Order QR</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchTab('qr')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#2C2420] bg-white px-4 py-2 text-sm font-semibold text-[#1F1F21] transition-colors hover:bg-[#F3EFEA]"
          >
            <QrCode className="h-4 w-4" aria-hidden="true" />
            <span>Menu QR</span>
          </button>
        </div>
      </div>

      {/* Order & Food KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[...orderKpis, ...menuKpis].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-2xl border border-[#E7E0D6] bg-white p-5"
            >
              <div className="flex items-center justify-between text-[#57534E]">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {item.label}
                </span>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className={`mt-3 text-3xl font-bold tabular-nums ${item.tone}`}>
                {item.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Orders & Categories Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7E0D6] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3">
            <h3 className="text-base font-semibold text-[#1F1F21]">
              Recent Orders
            </h3>
            <button
              type="button"
              onClick={() => onSwitchTab('orders')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C] hover:underline"
            >
              View all orders
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="py-6 text-sm text-[#57534E]">
              No customer orders submitted yet.
            </p>
          ) : (
            <div className="divide-y divide-[#F0EAE0]">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1F1F21]">
                      <span className="font-mono text-xs">{order.orderRef}</span> ·{' '}
                      {order.customerName}
                    </p>
                    <p className="text-xs text-[#57534E] tabular-nums">
                      {order.orderStatus} · {order.paymentStatus} ·{' '}
                      {formatColomboDateTime(order.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-[#B91C1C] tabular-nums">
                    {formatLkrPrice(order.totalLkr)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#E7E0D6] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#1F1F21]">
              <FolderKanban className="h-4 w-4 text-[#57534E]" aria-hidden="true" />
              <span>Categories ({categories.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => onSwitchTab('categories')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C] hover:underline"
            >
              Manage categories
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="py-6 text-sm text-[#57534E]">
              No categories created yet.
            </p>
          ) : (
            <div className="divide-y divide-[#F0EAE0]">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1F1F21]">
                      {cat.name}
                    </span>
                    {!cat.isVisible && (
                      <span className="text-xs font-medium text-[#78716C]">
                        · Hidden from menu
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#57534E] tabular-nums">
                    {cat.foodCount ?? 0} dishes
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {foods.length > 0 && (
        <div className="rounded-2xl border border-[#E7E0D6] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3">
            <h3 className="text-base font-semibold text-[#1F1F21]">
              Menu Highlights
            </h3>
            <button
              type="button"
              onClick={() => onSwitchTab('foods')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C] hover:underline"
            >
              Manage foods
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="divide-y divide-[#F0EAE0]">
            {foods.slice(0, 4).map((food) => (
              <div
                key={food.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#1F1F21]">
                    {food.name}
                  </p>
                  <p className="text-xs text-[#57534E]">
                    {food.categoryName} ·{' '}
                    <span
                      className={
                        food.isAvailable ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }
                    >
                      {food.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-[#1F1F21] tabular-nums">
                  {formatLkrPrice(food.priceLkr)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
