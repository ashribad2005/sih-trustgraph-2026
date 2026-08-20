import { Activity } from 'lucide-react';
import { mockFraudActivity } from '../data/mockFraudActivity';

export default function FraudActivityChart() {
  const data = mockFraudActivity;
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.suspicious_transactions + d.critical_cases));
  
  // Basic SVG scaling
  const width = 300;
  const height = 60;
  const dx = width / (data.length - 1);

  // Generate SVG path for suspicious transactions
  const pathD = data.map((d, i) => {
    const x = i * dx;
    // Simple scaling (invert Y axis for SVG)
    const y = height - (d.suspicious_transactions / (maxVal || 1)) * height;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate SVG path for critical cases
  const criticalPathD = data.map((d, i) => {
    const x = i * dx;
    const y = height - (d.critical_cases / (maxVal || 1)) * height;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-gray-900 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Fraud Activity
          </h2>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-0.5">Last 24 Hours</p>
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
        >
          {/* Grid lines */}
          <line x1="0" y1={height} x2={width} y2={height} stroke="#e2e8f0" strokeWidth="1" />
          <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
          
          {/* Paths */}
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={criticalPathD} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
