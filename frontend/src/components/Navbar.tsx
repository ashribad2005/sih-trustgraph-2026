import { Shield, Radio, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import { cn } from '../utils/helpers';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  }

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border shadow-sm transition-colors duration-200">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4">

        {/* ── Left: Branding ── */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" strokeWidth={1.5} />
          </div>
          <span className="text-text-primary font-bold tracking-[0.2em] uppercase text-sm select-none">
            TRUSTGRAPH
          </span>
        </div>

        {/* ── Centre: Live status pill ── */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 cursor-default">
          <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" aria-hidden />
          <span className="text-emerald-700 text-xs font-semibold tracking-widest uppercase">
            Live Monitoring Active
          </span>
        </div>

        {/* ── Right: Theme + Institution + Role + Logout ── */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-full bg-surface-secondary border border-border text-text-muted hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Sun className={cn("w-3.5 h-3.5 transition-colors", theme === 'light' && "text-warning")} />
            <div className="w-6 h-3 bg-border rounded-full relative flex items-center px-0.5">
              <div className={cn("w-2 h-2 rounded-full transition-all duration-300", theme === 'light' ? "bg-warning translate-x-0" : "bg-indigo-accent translate-x-3")} />
            </div>
            <Moon className={cn("w-3.5 h-3.5 transition-colors", theme === 'dark' && "text-indigo-accent")} />
          </button>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px bg-border" aria-hidden />

          {/* Institution / context */}
          <div className="hidden md:flex flex-col items-end leading-none gap-0.5">
            <span className="text-text-secondary text-xs font-medium">RBI/NPCI Trust Rail Demo</span>
            <span className="text-text-muted text-[11px] tracking-wide">
              {user?.role ?? 'Investigator SOC-L2'}
            </span>
          </div>

          {/* Divider */}
          <div className="hidden md:block h-8 w-px bg-border" aria-hidden />

          {/* User menu button */}
          <div className="relative">
            <button
              id="tg-user-menu-btn"
              type="button"
              onClick={() => setShowUserMenu((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showUserMenu}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                'bg-surface-secondary border border-border hover:border-text-muted',
                'text-text-secondary hover:text-text-primary transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold uppercase">
                {(user?.username?.[0] ?? 'I')}
              </div>
              <span className="text-xs font-medium hidden sm:block">
                {user?.username ?? 'Investigator'}
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showUserMenu && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-surface border border-border shadow-lg overflow-hidden z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-text-primary text-sm font-medium">{user?.username ?? 'Investigator'}</p>
                  <p className="text-text-muted text-xs mt-0.5">{user?.role ?? 'SOC-L2'}</p>
                </div>
                {/* Theme Toggle (Mobile) */}
                <div className="sm:hidden px-4 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-text-secondary text-xs">Theme</span>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 px-2 py-1 rounded-full bg-surface-secondary border border-border text-text-muted hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    <Sun className={cn("w-3.5 h-3.5 transition-colors", theme === 'light' && "text-warning")} />
                    <div className="w-6 h-3 bg-border rounded-full relative flex items-center px-0.5">
                      <div className={cn("w-2 h-2 rounded-full transition-all duration-300", theme === 'light' ? "bg-warning translate-x-0" : "bg-indigo-accent translate-x-3")} />
                    </div>
                    <Moon className={cn("w-3.5 h-3.5 transition-colors", theme === 'dark' && "text-indigo-accent")} />
                  </button>
                </div>
                {/* Logout */}
                <button
                  id="tg-logout-btn"
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2.5',
                    'text-text-secondary hover:text-critical hover:bg-critical/10',
                    'text-sm transition-colors disabled:opacity-50',
                    'focus:outline-none focus-visible:bg-critical/10'
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  {loggingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: live status bar below navbar */}
      <div className="sm:hidden flex items-center justify-center gap-2 px-4 py-1 bg-emerald-50 border-t border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-emerald-700 text-[10px] font-semibold tracking-widest uppercase">
          Live Monitoring Active
        </span>
      </div>
    </header>
  );
}
