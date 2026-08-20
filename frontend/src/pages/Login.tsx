import { useState, type FormEvent } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, Loader2, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/helpers';

export default function Login() {
  const { login, error, clearError, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    clearError();
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      // error is already set in AuthContext
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || isLoading;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center relative overflow-hidden">
      {/* Ambient background gradients */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-900/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-900/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-blue-100/30 blur-3xl" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-xl shadow-slate-200 p-8">

          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Shield className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-widest text-gray-900 uppercase">
              TRUSTGRAPH
            </h1>
            <p className="text-slate-500 text-sm mt-1 tracking-wide">
              Financial Fraud Intelligence Platform
            </p>
            <div className="mt-3 flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 text-xs font-medium tracking-wide">
                LIVE MONITORING ACTIVE
              </span>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-center text-slate-500 text-xs mb-6 uppercase tracking-widest">
            SOC Investigator Access
          </p>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Username */}
            <div>
              <label
                htmlFor="tg-username"
                className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                />
                <input
                  id="tg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={busy}
                  required
                  placeholder="investigator@trustgraph"
                  className={cn(
                    'w-full bg-white border border-slate-200 rounded-lg',
                    'pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-slate-400',
                    'focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors duration-200'
                  )}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="tg-password"
                className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                />
                <input
                  id="tg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy}
                  required
                  placeholder="••••••••••••"
                  className={cn(
                    'w-full bg-white border border-slate-200 rounded-lg',
                    'pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder-slate-400',
                    'focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors duration-200'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="tg-login-btn"
              type="submit"
              disabled={busy || !username.trim() || !password.trim()}
              className={cn(
                'w-full mt-2 flex items-center justify-center gap-2',
                'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'text-white font-semibold text-sm tracking-wide uppercase',
                'rounded-lg py-2.5 transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                'shadow-lg shadow-blue-500/20'
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Secure Login
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-slate-500 text-xs">
            Authorised personnel only. All sessions are logged and audited.
          </p>
        </div>

        {/* Below card labels */}
        <div className="mt-4 flex justify-center gap-6 text-slate-600 text-xs">
          <span>RBI/NPCI Trust Rail Demo</span>
          <span>·</span>
          <span>v2.6.1</span>
          <span>·</span>
          <span>SOC Environment</span>
        </div>
      </div>
    </div>
  );
}
