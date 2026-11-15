import { useCallback, useEffect, useState } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import type { AdminOrderRecord } from '../../types/menu';
import {
  formatColomboDateTime,
  formatLkrPrice,
  getColomboDateKey,
  ORDER_STATUSES,
} from '../../utils/menuLogic';
import { adminFetch } from '../../utils/adminFetch';
import { OrderStaffViewCard } from './OrderStaffViewCard';

interface AdminOrdersProps {
  orders: AdminOrderRecord[];
  openOrderId?: number | null;
  onClearOpenOrderId?: () => void;
  onRefreshOrders: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function AdminOrders({
  orders,
  openOrderId = null,
  onClearOpenOrderId,
  onRefreshOrders,
  onNotify,
}: AdminOrdersProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRecord | null>(null);

  const [filteredOrders, setFilteredOrders] = useState<AdminOrderRecord[]>(orders);
  const [filtering, setFiltering] = useState(false);

  const loadFiltered = useCallback(async () => {
    setFiltering(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (paymentFilter !== 'all') params.set('payment', paymentFilter);
      if (dateFilter) params.set('date', dateFilter);

      const res = await adminFetch(`/api/admin/orders?${params.toString()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setFilteredOrders((data.orders ?? []) as AdminOrderRecord[]);
      }
    } finally {
      setFiltering(false);
    }
  }, [search, statusFilter, paymentFilter, dateFilter]);

  useEffect(() => {
    void loadFiltered();
  }, [loadFiltered, orders]);

  useEffect(() => {
    if (!selectedOrder) return;
    const latest = orders.find((o) => o.id === selectedOrder.id);
    if (latest) setSelectedOrder(latest);
  }, [orders, selectedOrder]);

  useEffect(() => {
    if (!openOrderId) return;
    const target = orders.find((o) => o.id === openOrderId);
    if (target) {
      setSelectedOrder(target);
      onClearOpenOrderId?.();
    }
  }, [openOrderId, orders, onClearOpenOrderId]);

  const todayColombo = getColomboDateKey(new Date().toISOString());

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#1F1F21]">
            Orders
          </h2>
          <p className="text-sm text-[#57534E]">
            Live customer orders update automatically. Click an order to inspect items, contact the customer, or update status and payment.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setDateFilter(dateFilter === todayColombo ? '' : todayColombo)
          }
          className={`inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
            dateFilter === todayColombo
              ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
              : 'border-[#DDD4C7] bg-white text-[#1F1F21] hover:bg-[#F3EFEA]'
          }`}
        >
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>{dateFilter === todayColombo ? 'Showing Today' : 'Today Only'}</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#E7E0D6] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <label htmlFor="admin-order-search" className="sr-only">
            Search orders
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]"
            aria-hidden="true"
          />
          <input
            id="admin-order-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ref, customer name, or mobile..."
            className="h-11 w-full rounded-xl border border-[#DDD4C7] bg-white pl-10 pr-3 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="admin-order-status" className="sr-only">
            Filter by order status
          </label>
          <select
            id="admin-order-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
          >
            <option value="all">All order statuses</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="admin-order-payment" className="sr-only">
            Filter by payment status
          </label>
          <select
            id="admin-order-payment"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
          >
            <option value="all">All payment statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div>
          <label htmlFor="admin-order-date" className="sr-only">
            Filter by date
          </label>
          <input
            id="admin-order-date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3 text-sm text-[#1F1F21] focus:border-[#B91C1C] focus:outline-none"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E0D6] bg-white p-10 text-center">
          <p className="font-display text-lg font-semibold text-[#1F1F21]">
            {filtering ? 'Checking orders...' : 'No matching orders found'}
          </p>
          <p className="mt-1 text-sm text-[#57534E]">
            {orders.length === 0
              ? 'Customer orders placed from the menu will appear here automatically.'
              : 'Try clearing your search or status/date filters.'}
          </p>
          {(search || statusFilter !== 'all' || paymentFilter !== 'all' || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPaymentFilter('all');
                setDateFilter('');
              }}
              className="mt-4 min-h-[44px] rounded-xl border border-[#DDD4C7] bg-white px-5 py-2 text-sm font-semibold text-[#1F1F21] hover:bg-[#F3EFEA]"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E7E0D6] bg-white">
          <div className="divide-y divide-[#F0EAE0]">
            {filteredOrders.map((order) => {
              const totalCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-[#FAF8F5] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-[#1F1F21] tabular-nums">
                        {order.orderRef}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-bold ${
                          order.orderStatus === 'New'
                            ? 'text-[#B91C1C]'
                            : order.orderStatus === 'Completed' ||
                                order.orderStatus === 'Ready'
                              ? 'text-[#15803D]'
                              : 'text-[#92400E]'
                        }`}
                      >
                        {order.orderStatus}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          order.paymentStatus === 'Paid'
                            ? 'text-[#15803D]'
                            : 'text-[#57534E]'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[#1F1F21]">
                      {order.customerName}{' '}
                      <span className="font-mono text-xs font-normal text-[#57534E] tabular-nums">
                        ({order.customerPhoneDisplay})
                      </span>
                    </p>

                    <p className="line-clamp-1 text-xs text-[#57534E]">
                      {totalCount} {totalCount === 1 ? 'item' : 'items'} ·{' '}
                      {order.items
                        .map((i) => `${i.quantity}× ${i.foodName}`)
                        .join(', ')}
                    </p>

                    <p className="text-[11px] text-[#78716C] tabular-nums">
                      {formatColomboDateTime(order.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                    <span className="font-display text-lg font-extrabold text-[#B91C1C] tabular-nums">
                      {formatLkrPrice(order.totalLkr)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="min-h-[44px] rounded-xl border border-[#2C2420] bg-white px-4 py-2 text-xs font-bold text-[#1F1F21] transition-colors hover:bg-[#1F1F21] hover:text-white"
                    >
                      Open Order
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F21]/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedOrder(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Order details for ${selectedOrder.orderRef}`}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1F1F21] shadow-md hover:bg-[#F3EFEA]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <OrderStaffViewCard
              order={selectedOrder}
              onOrderUpdated={(updated) => {
                setSelectedOrder(updated);
                void onRefreshOrders();
              }}
              onNotify={onNotify}
            />
          </div>
        </div>
      )}
    </div>
  );
}
