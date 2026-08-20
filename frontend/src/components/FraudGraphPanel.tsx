import { Network } from 'lucide-react';
import type { GraphData } from '../types/graph';
import { cn } from '../utils/helpers';
import FraudGraph from './FraudGraph';

interface FraudGraphPanelProps {
  graphData: GraphData;
  className?: string;
}

export default function FraudGraphPanel({ graphData, className }: FraudGraphPanelProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-gray-900 text-[11px] font-semibold uppercase tracking-widest flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-blue-600" aria-hidden />
          Fraud Network Graph
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-slate-600">
          <span>{graphData.nodes.length} nodes</span>
          <span>·</span>
          <span>{graphData.edges.length} edges</span>
        </div>
      </div>

      {/* Graph container */}
      <div
        id="tg-fraud-graph"
        role="img"
        aria-label={`Fraud network graph with ${graphData.nodes.length} entities and ${graphData.edges.length} connections`}
        className="relative w-full h-80 shrink-0 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden"
      >
        <FraudGraph graphData={graphData} />
      </div>
    </div>
  );
}
