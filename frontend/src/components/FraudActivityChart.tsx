import { Activity } from 'lucide-react';
import type { Alert } from '../types/case';

type FraudActivityChartProps = {
  alerts: Alert[];
};

type ActivityPoint = {
  suspicious_transactions: number;
  critical_cases: number;
};

function buildActivity(alerts: Alert[]): ActivityPoint[] {
  const ordered = [...alerts].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
  const bucketCount = 12;
  return Array.from({ length: bucketCount }, (_, index) => {
    const start = Math.floor((index * ordered.length) / bucketCount);
    const end = Math.floor(((index + 1) * ordered.length) / bucketCount);
    const bucket = ordered.slice(start, end);
    return {
      suspicious_transactions: bucket.filter((alert) => alert.risk_tier !== 'CRITICAL').length,
      critical_cases: bucket.filter((alert) => alert.risk_tier === 'CRITICAL').length,
    };
  });
}

export default function FraudActivityChart({ alerts }: FraudActivityChartProps) {
  const data = buildActivity(alerts);
  const maxVal = Math.max(...data.map((point) => point.suspicious_transactions + point.critical_cases), 1);
  const width = 300;
  const height = 60;
  const dx = width / (data.length - 1);

  const pathD = data.map((point, index) => {
    const x = index * dx;
    const y = height - (point.suspicious_transactions / maxVal) * height;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const criticalPathD = data.map((point, index) => {
    const x = index * dx;
    const y = height - (point.critical_cases / maxVal) * height;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-gray-900 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Fraud Activity
          </h2>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-0.5">Live case activity</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500/80" />
            <span className="text-[9px] text-slate-400 font-medium">Suspicious</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500/80" />
            <span className="text-[9px] text-slate-400 font-medium">Critical</span>
          </div>
        </div>
      </div>

      <div className="relative w-full flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          aria-label={`Live fraud activity chart with ${alerts.length} cases`}
        >
          <line x1="0" y1={height} x2={width} y2={height} stroke="#e2e8f0" strokeWidth="1" />
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={criticalPathD} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
