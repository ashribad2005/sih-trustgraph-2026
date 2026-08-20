import { Network } from 'lucide-react';
import { mockNetworkIntelligence } from '../data/mockNetworkIntelligence';

export default function NetworkIntelligenceSummary() {
  const data = mockNetworkIntelligence;

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col h-full">
      <h2 className="text-gray-900 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
        <Network className="w-3.5 h-3.5 text-indigo-600" />
        Network Intelligence
      </h2>

      <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="flex flex-col justify-end border-l border-slate-200 pl-3">
          <span className="text-slate-500 text-[9px] uppercase tracking-widest mb-0.5">Active Fraud Clusters</span>
          <span className="text-gray-900 text-lg font-mono font-semibold leading-none">{data.active_fraud_clusters}</span>
        </div>
        <div className="flex flex-col justify-end border-l border-slate-200 pl-3">
          <span className="text-slate-500 text-[9px] uppercase tracking-widest mb-0.5">Accounts Under Watch</span>
          <span className="text-amber-600 text-lg font-mono font-semibold leading-none">{data.accounts_under_watch}</span>
        </div>
        <div className="flex flex-col justify-end border-l border-slate-200 pl-3">
          <span className="text-slate-500 text-[9px] uppercase tracking-widest mb-0.5">Shared Devices</span>
          <span className="text-gray-900 text-lg font-mono font-semibold leading-none">{data.shared_devices}</span>
        </div>
        <div className="flex flex-col justify-end border-l border-slate-200 pl-3">
          <span className="text-slate-500 text-[9px] uppercase tracking-widest mb-0.5">High-Centrality Entities</span>
          <span className="text-red-600 text-lg font-mono font-semibold leading-none">{data.high_centrality_entities}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200">
        <span className="text-slate-500 text-[9px] uppercase tracking-widest mb-0.5 block">Largest Cluster</span>
        <span className="text-indigo-700 text-xs font-mono font-bold bg-indigo-50 px-2 py-1 rounded-md inline-block border border-indigo-200">
          {data.largest_cluster}
        </span>
      </div>
    </div>
  );
}
