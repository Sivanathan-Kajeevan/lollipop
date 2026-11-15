import { useCallback, useEffect, useState } from 'react';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { CartCheckoutPage } from './components/CartCheckoutPage';
import { OrderConfirmationPage } from './components/OrderConfirmationPage';
import { PublicMenuPage } from './components/PublicMenuPage';
import { useCartStore } from './utils/cartStore';

interface RouteLocation {
  pathname: string;
  search: string;
}

function normalizePathname(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '');
  return clean || '/';
}

function getCurrentRoute(): RouteLocation {
  return {
    pathname: normalizePathname(window.location.pathname),
    search: window.location.search || '',
  };
}

export default function App() {
  const [route, setRoute] = useState<RouteLocation>(() => getCurrentRoute());
  const cart = useCartStore();

  useEffect(() => {
    const onPopState = () => {
      setRoute(getCurrentRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextTarget: string) => {
    const url = new URL(nextTarget, window.location.origin);
    const normalizedPath = normalizePathname(url.pathname);
    const fullTarget = `${normalizedPath}${url.search}`;
    const currentFull = `${normalizePathname(window.location.pathname)}${window.location.search}`;

    if (currentFull !== fullTarget) {
      window.history.pushState({}, '', fullTarget);
    }
    setRoute({ pathname: normalizedPath, search: url.search });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  if (route.pathname === '/admin/login') {
    return (
      <AdminLoginPage
        onLoginSuccess={(redirectPath) => navigate(redirectPath || '/admin')}
        onNavigate={navigate}
      />
    );
  }

  if (route.pathname === '/admin/scan') {
    const params = new URLSearchParams(route.search);
    const scanToken = params.get('token');
    const returnUrl = `/admin/scan${route.search}`;

    return (
      <AdminDashboardPage
        initialTab="scan"
        initialScanToken={scanToken}
        onNavigate={navigate}
        onUnauthorized={() =>
          navigate(`/admin/login?redirect=${encodeURIComponent(returnUrl)}`)
        }
      />
    );
  }

  if (route.pathname === '/admin') {
    return (
      <AdminDashboardPage
        initialTab="overview"
        onNavigate={navigate}
        onUnauthorized={() => navigate('/admin/login')}
      />
    );
  }

  if (route.pathname === '/cart') {
    return (
      <CartCheckoutPage
        items={cart.items}
        itemCount={cart.itemCount}
        totalLkr={cart.totalLkr}
        onUpdateQuantity={cart.updateQuantity}
        onUpdateNote={cart.updateNote}
        onRemoveItem={cart.removeItem}
        onApplyPriceChanges={cart.applyPriceChanges}
        onOrderSuccess={(order, latestRef) => {
          cart.setLatestOrder(latestRef);
          cart.clearCart();
          navigate(`/order/${encodeURIComponent(order.customerToken)}`);
        }}
        onNavigate={navigate}
      />
    );
  }

  if (route.pathname.startsWith('/order/')) {
    const customerToken = decodeURIComponent(
      route.pathname.slice('/order/'.length)
    );
    return (
      <OrderConfirmationPage
        customerToken={customerToken}
        onNavigate={navigate}
      />
    );
  }

  return (
    <PublicMenuPage
      onNavigate={navigate}
      cartItems={cart.items}
      cartItemCount={cart.itemCount}
      cartTotalLkr={cart.totalLkr}
      latestOrder={cart.latestOrder}
      onAddToCart={cart.addItem}
      onUpdateQuantity={cart.updateQuantity}
    />
  );
}
