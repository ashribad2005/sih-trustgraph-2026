import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function GlobalSearch({ query, onQueryChange }: { query: string; onQueryChange: (q: string) => void }) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    onQueryChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-md">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
          isFocused
            ? 'bg-white border-blue-500 ring-2 ring-blue-500/20'
            : 'bg-white border-slate-300 hover:border-slate-400'
        }`}
      >
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search case, transaction, account..."
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-slate-500 focus:outline-none"
          aria-label="Global search"
        />
        {query ? (
          <button
            onClick={handleClear}
            className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1 opacity-60 shrink-0 select-none">
            <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[9px] font-sans font-medium text-slate-500">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[9px] font-sans font-medium text-slate-500">K</kbd>
          </div>
        )}
      </div>
    </div>
  );
}
