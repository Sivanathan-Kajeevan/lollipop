import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { adminFetch, setAdminToken } from '../utils/adminFetch';

interface AdminLoginPageProps {
  onLoginSuccess: (redirectPath?: string) => void;
  onNavigate: (path: string) => void;
}

function getSafeRedirectTarget(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('redirect') || '';
    if (raw.startsWith('/admin') && !raw.startsWith('//')) {
      return raw;
    }
  } catch {
    // Ignore URL parsing issues
  }
  return '/admin';
}

export function AdminLoginPage({
  onLoginSuccess,
  onNavigate,
}: AdminLoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTarget = getSafeRedirectTarget();

  useEffect(() => {
    let mounted = true;
    adminFetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setNeedsInitialSetup(Boolean(data.needsInitialSetup));
        if (data.authenticated) {
          onLoginSuccess(redirectTarget);
        }
      })
      .catch(() => {
        // Ignore transient session check errors
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });
    return () => {
      mounted = false;
    };
  }, [onLoginSuccess, redirectTarget]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    if (needsInitialSetup) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = needsInitialSetup ? '/api/auth/setup' : '/api/auth/login';
      const res = await adminFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
        return;
      }
      if (data.token) setAdminToken(data.token);
      onLoginSuccess(redirectTarget);
    } catch {
      setError('Network error while signing in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3EFEA] px-4 py-8 text-[#1F1F21] sm:px-6">
      <div className="mx-auto max-w-md">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[#57534E] transition-colors hover:text-[#B91C1C]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to customer menu
        </a>

        <div className="mt-4 overflow-hidden rounded-2xl border-2 border-[#2C2420] bg-white shadow-xs">
          <div className="border-b border-[#E7E0D6] bg-[#FAF8F5] px-6 py-6 text-center">
            <img
              src="/assets/aistudio/image_0b3be71d.png"
              alt="Lollipop Restaurant logo"
              className="mx-auto h-14 w-auto object-contain"
            />
            <h1 className="mt-4 font-display text-2xl font-bold text-[#1F1F21]">
              {needsInitialSetup ? 'Initial Admin Setup' : 'Staff & Admin Sign In'}
            </h1>
            <p className="mt-1 text-sm text-[#57534E]">
              {needsInitialSetup
                ? 'Create the administrator account for Lollipop Restaurant to manage orders, menu items, and QR scanning.'
                : 'Sign in to manage customer orders, scan order QR codes, and update the menu.'}
            </p>
          </div>

          <div className="space-y-5 p-6">
            {checkingSession ? (
              <div className="py-6 text-center text-sm text-[#57534E]">
                Checking session...
              </div>
            ) : (
              <>
                {redirectTarget.startsWith('/admin/scan') && (
                  <div className="rounded-xl border border-[#B91C1C]/25 bg-[#FEF2F2] px-4 py-3 text-xs font-semibold text-[#991B1B]">
                    Sign in as authorised restaurant staff to view the scanned customer order details.
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#B91C1C]/30 bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#991B1B]"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="admin-username"
                      className="block text-sm font-semibold text-[#1F1F21]"
                    >
                      Username
                    </label>
                    <input
                      id="admin-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter admin username"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-password"
                      className="block text-sm font-semibold text-[#1F1F21]"
                    >
                      Password
                    </label>
                    <input
                      id="admin-password"
                      name="password"
                      type="password"
                      autoComplete={
                        needsInitialSetup ? 'new-password' : 'current-password'
                      }
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        needsInitialSetup
                          ? 'Create password (min 8 characters)'
                          : 'Enter password'
                      }
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/20"
                    />
                  </div>

                  {needsInitialSetup && (
                    <div>
                      <label
                        htmlFor="admin-confirm-password"
                        className="block text-sm font-semibold text-[#1F1F21]"
                      >
                        Confirm password
                      </label>
                      <input
                        id="admin-confirm-password"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="mt-1.5 h-11 w-full rounded-xl border border-[#DDD4C7] bg-white px-3.5 text-sm text-[#1F1F21] placeholder:text-[#78716C] focus:border-[#B91C1C] focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/20"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-60"
                  >
                    {needsInitialSetup ? (
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>
                      {submitting
                        ? 'Please wait...'
                        : needsInitialSetup
                          ? 'Create Admin Account & Sign In'
                          : 'Sign In'}
                    </span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
