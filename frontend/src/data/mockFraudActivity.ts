export interface FraudActivityPoint {
  timestamp: string; // ISO string
  suspicious_transactions: number;
  critical_cases: number;
  simulated_holds: number;
}

// Generate 24 hours of mock data points
const now = Date.now();
const oneHour = 60 * 60 * 1000;

export const mockFraudActivity: FraudActivityPoint[] = Array.from({ length: 24 }).map((_, i) => {
  const time = new Date(now - (23 - i) * oneHour);
  // Add some realistic variation using sine waves + noise
  const baseVal = 10 + Math.sin(i / 3) * 8 + Math.random() * 5;
  return {
    timestamp: time.toISOString(),
    suspicious_transactions: Math.max(0, Math.floor(baseVal * 2.5)),
    critical_cases: Math.max(0, Math.floor(baseVal * 0.8)),
    simulated_holds: Math.max(0, Math.floor(baseVal * 0.4)),
  };
});
