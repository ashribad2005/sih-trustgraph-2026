import { Server } from 'lucide-react';
import { cn } from '../utils/helpers';

type SystemStatusProps = {
  backendOnline?: boolean;
  aiOnline?: boolean;
  blockchainOnline?: boolean;
  blockchainMode?: 'LIVE' | 'MOCK';
  hasLiveCases?: boolean;
};

type StatusValue = 'ONLINE' | 'READY' | 'LIVE' | 'MOCK' | 'WAITING';

export default function SystemStatus({
  backendOnline = true,
  aiOnline = true,
  blockchainOnline = true,
  blockchainMode = 'MOCK',
  hasLiveCases = false,
}: SystemStatusProps) {
  const items: Array<{ id: string; label: string; status: StatusValue }> = [
    { id: 'backend', label: 'Backend API', status: backendOnline ? 'ONLINE' : 'WAITING' },
    { id: 'ai', label: 'AI Engine', status: aiOnline ? 'READY' : 'WAITING' },
    { id: 'graph', label: 'Graph Engine', status: hasLiveCases ? 'READY' : 'WAITING' },
    { id: 'blockchain', label: 'Blockchain Anchor', status: blockchainOnline ? blockchainMode : 'WAITING' },
    { id: 'stream', label: 'Transaction Stream', status: hasLiveCases ? 'LIVE' : 'WAITING' },
  ];

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col h-full">
      <h2 className="text-gray-900 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
        <Server className="w-3.5 h-3.5 text-slate-500" />
        System Status
      </h2>

      <div className="flex-1 flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">{item.label}</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  item.status === 'WAITING' || item.status === 'MOCK' ? 'bg-amber-400' : 'bg-emerald-400',
                  item.status === 'LIVE' && 'animate-pulse',
                )}
              />
              <span className={cn(
                'text-[9px] font-bold tracking-widest uppercase',
                item.status === 'WAITING' || item.status === 'MOCK' ? 'text-amber-600' : 'text-emerald-600',
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
