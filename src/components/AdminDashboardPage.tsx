import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  ScanLine,
  Settings,
  Utensils,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AdminOrderRecord,
  Category,
  FoodItem,
  MenuStats,
  RestaurantSettings,
} from '../types/menu';
import { adminFetch, setAdminToken } from '../utils/adminFetch';
import {
  detectNewCreatedOrders,
  formatLkrPrice,
  type NewOrderNotificationItem,
} from '../utils/menuLogic';
import {
  isAdminSoundEnabled,
  playNewOrderChime,
  setAdminSoundEnabled,
  unlockAdminAudio,
} from '../utils/soundAlert';
import { subscribeSseStream } from '../utils/sseClient';
import { AdminCategories } from './admin/AdminCategories';
import { AdminFoods } from './admin/AdminFoods';
import { AdminOrders } from './admin/AdminOrders';
import { AdminOverview, type AdminTab } from './admin/AdminOverview';
import { AdminQrCode } from './admin/AdminQrCode';
import { AdminScanOrder } from './admin/AdminScanOrder';
import { AdminSettings } from './admin/AdminSettings';

interface DashboardPayload {
  username: string;
  resolvedPublicUrl: string;
  settings: RestaurantSettings;
  categories: Category[];
  foods: FoodItem[];
  stats: MenuStats;
}

interface AdminDashboardPageProps {
  initialTab?: AdminTab;
  initialScanToken?: string | null;
  onNavigate: (path: string) => void;
  onUnauthorized: () => void;
}

export function AdminDashboardPage({
  initialTab = 'overview',
  initialScanToken = null,
  onNavigate,
  onUnauthorized,
}: AdminDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    isAdminSoundEnabled()
  );
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [newOrderAlerts, setNewOrderAlerts] = useState<
    NewOrderNotificationItem[]
  >([]);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const knownOrderIdsRef = useRef<Set<number> | null>(null);
  const notifiedOrderIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Unlock Web Audio on the first user gesture in the admin workspace
  useEffect(() => {
    if (!soundEnabled) return;
    const handleGesture = () => {
      void unlockAdminAudio().then((state) => {
        if (state === 'running') {
          setAudioBlocked(false);
        }
      });
    };
    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [soundEnabled]);

  const triggerNewOrderNotifications = useCallback(
    (incoming: NewOrderNotificationItem[]) => {
      const freshItems = incoming.filter(
        (item) => !notifiedOrderIdsRef.current.has(item.orderId)
      );
      if (freshItems.length === 0) return;

      for (const item of freshItems) {
        notifiedOrderIdsRef.current.add(item.orderId);
        knownOrderIdsRef.current?.add(item.orderId);
      }

      setNewOrderAlerts((prev) => {
        const existingIds = new Set(prev.map((p) => p.orderId));
        const uniqueNew = freshItems.filter(
          (item) => !existingIds.has(item.orderId)
        );
        return [...uniqueNew, ...prev];
      });

      void playNewOrderChime().then((result) => {
        if (!result.played && result.reason === 'suspended') {
          setAudioBlocked(true);
        } else if (result.played) {
          setAudioBlocked(false);
        }
      });
    },
    []
  );

  const loadOrders = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/orders', { cache: 'no-store' });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) return;
      const payload = await res.json();
      const loadedOrders = (payload.orders ?? []) as AdminOrderRecord[];

      const { nextKnownIds, newOrders } = detectNewCreatedOrders(
        knownOrderIdsRef.current,
        loadedOrders,
        notifiedOrderIdsRef.current
      );
      knownOrderIdsRef.current = nextKnownIds;
      if (newOrders.length > 0) {
        triggerNewOrderNotifications(newOrders);
      }

      setOrders(loadedOrders);
      if (payload.stats) {
        setData((prev) => (prev ? { ...prev, stats: payload.stats } : prev));
      }
    } catch {
      // Ignore background refresh error
    }
  }, [onUnauthorized, triggerNewOrderNotifications]);

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      const sessionRes = await adminFetch('/api/auth/session', {
        cache: 'no-store',
      });
      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as {
          authenticated?: boolean;
        };
        if (!sessionData.authenticated) {
          onUnauthorized();
          return;
        }
      }

      const [dashRes, ordersRes] = await Promise.all([
        adminFetch('/api/admin/dashboard', { cache: 'no-store' }),
        adminFetch('/api/admin/orders', { cache: 'no-store' }),
      ]);

      if (dashRes.status === 401 || ordersRes.status === 401) {
        onUnauthorized();
        return;
      }
      if (!dashRes.ok) {
        throw new Error('Unable to load admin dashboard.');
      }

      const dashPayload = (await dashRes.json()) as DashboardPayload;
      setData(dashPayload);

      if (ordersRes.ok) {
        const ordersPayload = await ordersRes.json();
        const loadedOrders = (ordersPayload.orders ?? []) as AdminOrderRecord[];
        knownOrderIdsRef.current = new Set(loadedOrders.map((o) => o.id));
        for (const order of loadedOrders) {
          notifiedOrderIdsRef.current.add(order.id);
        }
        setOrders(loadedOrders);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load admin dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Live SSE updates + 8s safety poll so new orders appear promptly with chime alerts
  useEffect(() => {
    if (!data) return;
    const stopSse = subscribeSseStream('/api/admin/orders/stream', {
      withAdminAuth: true,
      onEvent: (eventName, eventData) => {
        if (eventName === 'orders_changed') {
          if (
            eventData &&
            typeof eventData === 'object' &&
            'type' in eventData &&
            (eventData as { type?: unknown }).type === 'order_created'
          ) {
            const payload = eventData as {
              orderId?: unknown;
              orderRef?: unknown;
              customerName?: unknown;
              totalLkr?: unknown;
              createdAt?: unknown;
            };
            const orderId = Number(payload.orderId);
            if (Number.isInteger(orderId) && orderId > 0) {
              triggerNewOrderNotifications([
                {
                  orderId,
                  orderRef:
                    typeof payload.orderRef === 'string' && payload.orderRef
                      ? payload.orderRef
                      : `#${orderId}`,
                  customerName:
                    typeof payload.customerName === 'string' &&
                    payload.customerName
                      ? payload.customerName
                      : 'Customer',
                  totalLkr: Number(payload.totalLkr) || 0,
                  createdAt:
                    typeof payload.createdAt === 'string' && payload.createdAt
                      ? payload.createdAt
                      : new Date().toISOString(),
                },
              ]);
            }
          }
          void loadOrders();
        }
      },
    });

    const interval = window.setInterval(() => {
      void loadOrders();
    }, 8000);

    return () => {
      stopSse();
      window.clearInterval(interval);
    };
  }, [data !== null, loadOrders, triggerNewOrderNotifications]);

  async function handleToggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setAdminSoundEnabled(next);
    if (next) {
      await unlockAdminAudio();
      const result = await playNewOrderChime({ force: true });
      if (result.played) {
        setAudioBlocked(false);
      } else if (result.reason === 'suspended') {
        setAudioBlocked(true);
      }
    } else {
      setAudioBlocked(false);
    }
  }

  async function handleTestSound() {
    if (!soundEnabled) {
      setSoundEnabled(true);
      setAdminSoundEnabled(true);
    }
    await unlockAdminAudio();
    const result = await playNewOrderChime({ force: true });
    if (result.played) {
      setAudioBlocked(false);
      notify('success', 'Order alert chime played.');
    } else if (result.reason === 'suspended') {
      setAudioBlocked(true);
      notify('error', 'Browser blocked audio playback. Click Enable Sound to allow alerts.');
    } else {
      notify('error', 'Audio playback is not supported in this browser.');
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await adminFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAdminToken(null);
      setLoggingOut(false);
      onNavigate('/admin/login');
    }
  }

  const navItems: {
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    badgeCount?: number;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'orders',
      label: 'Orders',
      icon: ClipboardList,
      badgeCount: data?.stats.newOrders || 0,
    },
    { id: 'scan', label: 'Scan Order QR', icon: ScanLine },
    { id: 'foods', label: 'Foods', icon: Utensils },
    { id: 'categories', label: 'Categories', icon: FolderKanban },
    { id: 'settings', label: 'Restaurant settings', icon: Settings },
    { id: 'qr', label: 'Menu QR generator', icon: QrCode },
  ];

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (window.location.pathname !== '/admin' && tab !== 'scan') {
      window.history.replaceState({}, '', '/admin');
    }
  }

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = '';
      return;
    }

    const media = window.matchMedia('(min-width: 1024px)');
    const syncScrollLock = () => {
      document.body.style.overflow = media.matches ? '' : 'hidden';
    };

    syncScrollLock();
    media.addEventListener('change', syncScrollLock);

    return () => {
      media.removeEventListener('change', syncScrollLock);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3EFEA] text-sm text-[#57534E]">
        Loading admin workspace...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3EFEA] px-4 text-center">
        <p className="font-display text-xl font-semibold text-[#1F1F21]">
          Dashboard Unavailable
        </p>
        <p className="mt-2 text-sm text-[#57534E]">
          {error || 'Could not load dashboard data.'}
        </p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-4 min-h-[44px] rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3EFEA] text-[#1F1F21]">
      {/* Mobile Header */}
      <header className="no-print sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#E7E0D6] bg-white px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E0D6] text-[#1F1F21]"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <span className="font-display text-lg font-semibold text-[#1F1F21]">
            {data.settings.restaurantName} Admin
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={soundEnabled}
            aria-label={
              soundEnabled
                ? 'Mute new order sound alerts'
                : 'Enable new order sound alerts'
            }
            onClick={() => void handleToggleSound()}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              soundEnabled
                ? 'border-[#E7E0D6] bg-[#FAF8F5] text-[#B91C1C]'
                : 'border-[#E7E0D6] bg-white text-[#78716C]'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-[#B91C1C]"
          >
            <span>View Menu</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* Sidebar Navigation */}
        <aside
          className={`no-print border-b border-[#E7E0D6] bg-white lg:static lg:inset-auto lg:z-auto lg:min-h-screen lg:w-64 lg:shrink-0 lg:overflow-visible lg:border-b-0 lg:border-r ${
            mobileMenuOpen
              ? 'fixed inset-x-0 top-16 bottom-0 z-30 block overflow-y-auto'
              : 'hidden lg:block'
          }`}
        >
          <div className="flex h-full flex-col justify-between p-4">
            <div className="space-y-6">
              <div className="hidden items-center gap-3 border-b border-[#F0EAE0] pb-4 lg:flex">
                <img
                  src={data.settings.logoUrl}
                  alt={`${data.settings.restaurantName} logo`}
                  referrerPolicy="no-referrer"
                  className="h-9 w-auto max-w-[100px] object-contain"
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-[#1F1F21]">
                    {data.settings.restaurantName}
                  </p>
                  <p className="truncate text-xs text-[#57534E]">
                    Signed in as {data.username}
                  </p>
                </div>
              </div>

              <nav aria-label="Admin sections" className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-[#B91C1C] text-white'
                          : 'text-[#44403C] hover:bg-[#FAF8F5] hover:text-[#1F1F21]'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </span>
                      {item.badgeCount !== undefined && item.badgeCount > 0 && (
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            active ? 'text-white' : 'text-[#B91C1C]'
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-6 space-y-2 border-t border-[#F0EAE0] pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={soundEnabled}
                  onClick={() => void handleToggleSound()}
                  className={`flex min-h-[44px] flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    soundEnabled
                      ? 'border-[#15803D]/25 bg-[#F0FDF4] text-[#166534] hover:bg-[#DCFCE7]'
                      : 'border-[#E7E0D6] bg-[#FAF8F5] text-[#57534E] hover:bg-[#F0EAE0]'
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{soundEnabled ? 'Sound On' : 'Sound Muted'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleTestSound()}
                  aria-label="Test new order alert sound"
                  className="min-h-[44px] rounded-xl border border-[#E7E0D6] bg-white px-3 py-2 text-xs font-semibold text-[#1F1F21] transition-colors hover:bg-[#FAF8F5]"
                >
                  Test
                </button>
              </div>

              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/');
                }}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#E7E0D6] bg-[#FAF8F5] px-3.5 py-2 text-sm font-semibold text-[#1F1F21] transition-colors hover:bg-[#F0EAE0]"
              >
                <span>Open Customer Menu</span>
                <ExternalLink className="h-4 w-4 text-[#57534E]" aria-hidden="true" />
              </a>

              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
                className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-[#57534E] transition-colors hover:bg-[#FAF8F5] hover:text-[#1F1F21]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {newOrderAlerts.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              data-testid="new-order-alert-banner"
              className="no-print mb-5 rounded-2xl border-2 border-[#B91C1C] bg-white p-4 shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#B91C1C] text-white">
                    <BellRing className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-base font-bold text-[#1F1F21]">
                        New Order Received
                      </p>
                      {newOrderAlerts.length > 1 && (
                        <span className="text-xs font-bold text-[#B91C1C]">
                          +{newOrderAlerts.length - 1} more
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-[#44403C]">
                      <span className="font-mono font-bold text-[#1F1F21] tabular-nums">
                        {newOrderAlerts[0].orderRef}
                      </span>{' '}
                      · {newOrderAlerts[0].customerName} ·{' '}
                      <span className="font-bold text-[#B91C1C] tabular-nums">
                        {formatLkrPrice(newOrderAlerts[0].totalLkr)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {audioBlocked && soundEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        void unlockAdminAudio().then(() =>
                          playNewOrderChime({ force: true })
                        ).then((res) => {
                          if (res.played) setAudioBlocked(false);
                        });
                      }}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#B91C1C]/40 bg-[#FEF2F2] px-3.5 py-2 text-xs font-bold text-[#991B1B] hover:bg-[#FEE2E2]"
                    >
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      <span>Enable Sound</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const latest = newOrderAlerts[0];
                      setOpenOrderId(latest.orderId);
                      setNewOrderAlerts((prev) =>
                        prev.filter((item) => item.orderId !== latest.orderId)
                      );
                      selectTab('orders');
                    }}
                    className="min-h-[44px] rounded-xl bg-[#B91C1C] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#991B1B]"
                  >
                    Open Order
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewOrderAlerts([])}
                    aria-label="Dismiss new order alert"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E0D6] bg-[#FAF8F5] text-[#57534E] hover:bg-[#F0EAE0] hover:text-[#1F1F21]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {toast && (
            <div
              role="status"
              className={`no-print mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                toast.type === 'success'
                  ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#166534]'
                  : 'border-[#B91C1C]/30 bg-[#FEF2F2] text-[#991B1B]'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Dismiss message"
                className="rounded p-1 hover:bg-black/5"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <AdminOverview
              stats={data.stats}
              orders={orders}
              categories={data.categories}
              foods={data.foods}
              onSwitchTab={selectTab}
            />
          )}

          {activeTab === 'orders' && (
            <AdminOrders
              orders={orders}
              openOrderId={openOrderId}
              onClearOpenOrderId={() => setOpenOrderId(null)}
              onRefreshOrders={loadOrders}
              onNotify={notify}
            />
          )}

          {activeTab === 'scan' && (
            <AdminScanOrder
              initialToken={initialScanToken}
              onRefreshOrders={loadOrders}
              onNotify={notify}
            />
          )}

          {activeTab === 'foods' && (
            <AdminFoods
              foods={data.foods}
              categories={data.categories}
              onRefresh={loadDashboard}
              onNotify={notify}
            />
          )}

          {activeTab === 'categories' && (
            <AdminCategories
              categories={data.categories}
              onRefresh={loadDashboard}
              onNotify={notify}
            />
          )}

          {activeTab === 'settings' && (
            <AdminSettings
              settings={data.settings}
              onRefresh={loadDashboard}
              onNotify={notify}
            />
          )}

          {activeTab === 'qr' && (
            <AdminQrCode settings={data.settings} onNotify={notify} />
          )}
        </main>
      </div>
    </div>
  );
}
