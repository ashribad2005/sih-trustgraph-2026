import React, { useState, useMemo, useCallback, useEffect } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';

/**
 * ================================================================
 * TrustGraph 2026 — FraudGraphViewer (Module M5: Graph Intelligence UI)
 * ================================================================
 * 
 * Visualizes directed financial fraud topologies (Mule Funnels, 
 * Velocity Bursts, Shared Devices) using Cytoscape.js with COSE layout.
 * 
 * DATA CONTRACT (Strict - from Django API):
 * {
 *   "elements": [
 *     { "data": { "id": "acc_1", "label": "john@ybl", "type": "account", "risk_score": 85, "role": "Mule Aggregator" } },
 *     { "data": { "id": "dev_1", "label": "DEV_9921", "type": "device", "risk_score": 90, "role": "Shared Device" } },
 *     { "data": { "id": "tx_1", "source": "acc_2", "target": "acc_1", "amount": 5000, "is_flagged": true } }
 *   ]
 * }
 * 
 * VISUAL ENCODING:
 * - Accounts: Circular. Green (risk_score < 75), Red (risk_score >= 75)
 * - Devices: Diamond. Purple
 * - Edges: Directed arrows. Gray/solid normal; Red/dashed/thick if is_flagged
 * - Labels: Below nodes (data.label)
 * 
 * INTERACTIVITY:
 * - Tap node → Side inspector panel with id, label, type, role, risk_score progress bar
 * - Tap background → Close inspector
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface CytoscapeNodeData {
  id: string;
  label: string;
  type: 'account' | 'device' | 'ip' | 'merchant' | 'unknown';
  risk_score?: number;
  role?: string;
  [key: string]: unknown;
}

export interface CytoscapeEdgeData {
  id?: string;
  source: string;
  target: string;
  amount?: number;
  is_flagged?: boolean;
  label?: string;
  [key: string]: unknown;
}

export interface FraudGraphData {
  elements: Array<{ data: CytoscapeNodeData | CytoscapeEdgeData }>;
}

interface FraudGraphViewerProps {
  graphData: FraudGraphData;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function FraudGraphViewer({ graphData, className = '' }: FraudGraphViewerProps) {
  const [selectedNode, setSelectedNode] = useState<CytoscapeNodeData | null>(null);
  const [cyInstance, setCyInstance] = useState<cytoscape.Core | null>(null);

  // ─── Transform API elements[] → Cytoscape elements ──────────────────────
  const elements = useMemo((): cytoscape.ElementDefinition[] => {
    if (!graphData?.elements) return [];

    return graphData.elements.map((el, idx) => {
      const data = el.data || {};
      const isEdge = 'source' in data && 'target' in data;

      if (isEdge) {
        const edgeData = data as CytoscapeEdgeData;
        return {
          group: 'edges' as const,
          data: {
            id: edgeData.id ?? `edge-${idx}`,
            source: edgeData.source,
            target: edgeData.target,
            label: edgeData.label ?? (edgeData.amount ? `₹${edgeData.amount.toLocaleString()}` : ''),
            amount: edgeData.amount,
            is_flagged: edgeData.is_flagged ?? false,
            ...edgeData,
          },
        };
      }

      const nodeData = data as CytoscapeNodeData;
      return {
        group: 'nodes' as const,
        data: {
          id: nodeData.id,
          label: nodeData.label,
          type: nodeData.type ?? 'unknown',
          risk_score: nodeData.risk_score ?? 0,
          role: nodeData.role ?? 'N/A',
          ...nodeData,
        },
      };
    });
  }, [graphData]);

  // ─── COSE Layout Config ─────────────────────────────────────────────────
  const layout = useMemo(() => ({
    name: 'cose',
    animate: true,
    animationDuration: 500,
    nodeDimensionsIncludeLabels: true,
    idealEdgeLength: 120,
    nodeOverlap: 20,
    nodeRepulsion: 450000,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0,
    fit: true,
    padding: 50,
    randomize: false,
    componentSpacing: 120,
  }), []);

  // ─── Cytoscape Stylesheet (Visual Encoding) ─────────────────────────────
  const stylesheet = useMemo((): cytoscape.Stylesheet[] => [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 10,
        'color': '#e2e8f0',
        'font-size': '11px',
        'font-weight': '500',
        'font-family': 'Inter, system-ui, sans-serif',
        'text-outline-color': '#020617',
        'text-outline-width': 2,
        'background-color': '#64748b',
        'width': 36,
        'height': 36,
      },
    },
    {
      selector: 'node[type = "account"]',
      style: {
        'shape': 'ellipse',
        'background-color': (ele: cytoscape.NodeSingular) => {
          const risk = ele.data('risk_score') ?? 0;
          return risk >= 75 ? '#ef4444' : '#22c55e';
        },
        'border-width': 2,
        'border-color': '#ffffff',
        'width': 40,
        'height': 40,
      },
    },
    {
      selector: 'node[type = "device"]',
      style: {
        'shape': 'diamond',
        'background-color': '#a855f7',
        'width': 42,
        'height': 42,
        'border-width': 2,
        'border-color': '#ffffff',
      },
    },
    {
      selector: 'node[type = "ip"]',
      style: {
        'shape': 'hexagon',
        'background-color': '#f59e0b',
        'width': 36,
        'height': 36,
        'border-width': 2,
        'border-color': '#ffffff',
      },
    },
    {
      selector: 'node[type = "merchant"]',
      style: {
        'shape': 'barrel',
        'background-color': '#8b5cf6',
        'width': 36,
        'height': 36,
        'border-width': 2,
        'border-color': '#ffffff',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#fbbf24',
        'background-color': (ele: cytoscape.NodeSingular) => {
          const type = ele.data('type');
          if (type === 'account') {
            const risk = ele.data('risk_score') ?? 0;
            return risk >= 75 ? '#ef4444' : '#22c55e';
          }
          if (type === 'device') return '#a855f7';
          if (type === 'ip') return '#f59e0b';
          return '#8b5cf6';
        },
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'color': '#94a3b8',
        'font-size': '9px',
        'font-weight': '500',
        'font-family': 'Inter, system-ui, sans-serif',
        'text-background-color': '#020617',
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle',
      },
    },
    {
      selector: 'edge[is_flagged = true]',
      style: {
        'line-color': '#ef4444',
        'target-arrow-color': '#ef4444',
        'width': 3,
        'line-style': 'dashed',
        'text-background-color': '#7f1d1d',
      },
    },
  ], []);

  // ─── Event Handlers ─────────────────────────────────────────────────────

  const handleCy = useCallback((cy: cytoscape.Core) => {
    setCyInstance(cy);
  }, []);

  const handleNodeTap = useCallback((event: { target: cytoscape.NodeSingular }) => {
    const node = event.target;
    const data = node.data();
    setSelectedNode(data as CytoscapeNodeData);
  }, []);

  const handleBackgroundTap = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ─── Fit viewport on data change ────────────────────────────────────────
  useEffect(() => {
    if (cyInstance && elements.length > 0) {
      cyInstance.fit(null, 50);
    }
  }, [elements, cyInstance]);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/50 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Fraud Network</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>Accounts: {elements.filter(e => e.group === 'nodes' && e.data.type === 'account').length}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>Devices: {elements.filter(e => e.group === 'nodes' && e.data.type === 'device').length}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Flagged Edges: {elements.filter(e => e.group === 'edges' && e.data.is_flagged).length}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => cyInstance?.fit(null, 50)}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Fit to Screen"
            aria-label="Fit Graph"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4-4l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Graph Canvas + Inspector */}
      <div className="flex-1 flex relative min-h-0">
        {/* Cytoscape Canvas */}
        <div className="flex-1 relative min-w-0">
          <CytoscapeComponent
            elements={elements}
            stylesheet={stylesheet}
            layout={layout}
            style={{ width: '100%', height: '100%' }}
            cy={handleCy}
            onTapNode={handleNodeTap}
            onTap={handleBackgroundTap}
          />
        </div>

        {/* Inspector Side Panel */}
        {selectedNode && (
          <div className="w-72 sm:w-80 bg-slate-950 border-l border-slate-800 flex flex-col overflow-hidden animate-slide-in">
            {/* Inspector Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h4 className="text-sm font-semibold text-slate-100">Node Inspector</h4>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                aria-label="Close inspector"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Inspector Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ID */}
              <div>
                <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-1">ID</p>
                <p className="font-mono text-sm text-slate-200 break-all">{selectedNode.id}</p>
              </div>

              {/* Label */}
              <div>
                <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-1">Label</p>
                <p className="text-base font-medium text-slate-100 break-all">{selectedNode.label}</p>
              </div>

              {/* Type & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-1">Type</p>
                  <span className="inline-flex items-center px-2 py-1 bg-slate-800 rounded text-xs capitalize text-slate-300">
                    {selectedNode.type}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-1">Role</p>
                  <span className="inline-flex items-center px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">
                    {selectedNode.role}
                  </span>
                </div>
              </div>

              {/* Risk Score Progress Bar */}
              {selectedNode.risk_score !== undefined && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Risk Score</p>
                    <p className={`text-sm font-bold ${(selectedNode.risk_score as number) >= 75 ? 'text-red-400' : 'text-green-400'}`}>
                      {selectedNode.risk_score}/100
                    </p>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${(selectedNode.risk_score as number) >= 75 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(selectedNode.risk_score as number, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Additional Metadata */}
              {selectedNode && Object.keys(selectedNode).length > 5 && (
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-2">Additional Data</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {Object.entries(selectedNode)
                      .filter(([key]) => !['id', 'label', 'type', 'risk_score', 'role'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-mono text-slate-300 truncate max-w-[60%] text-right">
                            {value !== null && value !== undefined ? String(value) : 'N/A'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {elements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            <div className="text-center p-8">
              <svg className="w-16 h-16 mx-auto text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-sm">No graph data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}