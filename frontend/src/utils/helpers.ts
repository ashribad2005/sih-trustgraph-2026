import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RiskTier } from '../types/transaction';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Risk tier classification based on the exact ranges specified in the master prompt.
 *  0–30   → NORMAL
 * 31–70   → ELEVATED
 * 71–100  → CRITICAL
 */
export function getRiskTierFromScore(score: number): RiskTier {
  if (score <= 30) return 'NORMAL';
  if (score <= 70) return 'ELEVATED';
  return 'CRITICAL';
}

/** Tailwind colour classes for each risk tier */
export const riskColors: Record<RiskTier, { bg: string; text: string; border: string; badge: string; dot: string }> = {
  NORMAL: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    badge: 'bg-success/10 text-success border border-success/20',
    dot: 'bg-success',
  },
  ELEVATED: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    badge: 'bg-warning/10 text-warning border border-warning/20',
    dot: 'bg-warning',
  },
  CRITICAL: {
    bg: 'bg-critical/10',
    text: 'text-critical',
    border: 'border-critical/20',
    badge: 'bg-critical/10 text-critical border border-critical/20',
    dot: 'bg-critical',
  },
};

/** Risk tier emoji for accessible color-independent display */
export const riskEmoji: Record<RiskTier, string> = {
  NORMAL: '🟢',
  ELEVATED: '🟡',
  CRITICAL: '🔴',
};

/**
 * Format an INR amount for display.
 * Shows Cr/Lakh/K suffixes for large values.
 */
export function formatINR(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
    if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(1)}L`;
    if (amount >= 1_000)      return `₹${(amount / 1_000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Relative time (e.g. "2 min ago") from ISO string */
export function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString('en-IN');
}

/** Format Unix timestamp as human-readable string */
export function formatUnixTimestamp(epoch: number): string {
  return new Date(epoch * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/** Truncate a string to N chars with ellipsis */
export function truncate(str: string, n: number): string {
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

/** Map recommended action enum to display string */
export function formatRecommendedAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
