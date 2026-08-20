import { Server } from 'lucide-react';
import { mockSystemStatus } from '../data/mockSystemStatus';
import { cn } from '../utils/helpers';

export default function SystemStatus() {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col h-full">
      <h2 className="text-gray-900 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
        <Server className="w-3.5 h-3.5 text-slate-500" />
        System Status
      </h2>

      <div className="flex-1 flex flex-col gap-2.5">
        {mockSystemStatus.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">{item.label}</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span 
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  item.status === 'ONLINE' ? "bg-emerald-400" :
                  item.status === 'LIVE' ? "bg-emerald-400 animate-pulse" :
                  item.status === 'DEGRADED' ? "bg-amber-400" : "bg-red-500"
                )} 
              />
              <span className={cn(
                "text-[9px] font-bold tracking-widest uppercase",
                item.status === 'ONLINE' ? "text-emerald-600" :
                item.status === 'LIVE' ? "text-emerald-600" :
                item.status === 'DEGRADED' ? "text-amber-600" : "text-red-600"
              )}>
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
