import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import type { GraphData, GraphNode } from '../types/graph';
import { cn } from '../utils/helpers';

interface FraudGraphProps {
  graphData: GraphData;
  onNodeSelect?: (node: GraphNode) => void;
  className?: string;
}

// ─── Theme Constants ──────────────────────────────────────────────────────────

const nodeColors: Record<string, string> = {
  critical: '#ef4444',
  flagged: '#f59e0b',
  suspicious: '#eab308',
  normal: '#10b981',
  unknown: '#64748b',
};

const nodeShapes: Record<string, string> = {
  account: 'ellipse',
  device: 'roundrectangle',
  ip: 'hexagon',
  merchant: 'barrel',
  unknown: 'ellipse',
};

// ─── FraudGraph Component ──────────────────────────────────────────────────────

export default function FraudGraph({ graphData, onNodeSelect, className }: FraudGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // State for hover tooltip
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    type: string;
    status: string;
  }>({ visible: false, x: 0, y: 0, title: '', type: '', status: '' });

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy existing instance if it exists
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Map TRUSTGRAPH data format to Cytoscape elements array
    const elements: cytoscape.ElementDefinition[] = [
      ...graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          status: node.status,
        },
      })),
      ...graphData.edges.map((edge, idx) => ({
        data: {
          id: `edge-${idx}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: edge.type,
        },
      })),
    ];

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele) => nodeColors[ele.data('status')] || nodeColors.unknown,
            shape: (ele) => (nodeShapes[ele.data('type')] || nodeShapes.unknown) as cytoscape.Css.NodeShape,
            label: 'data(label)',
            color: '#1e293b',
            width: 32,
            height: 32,
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'font-size': '10px',
            'font-family': 'Inter, sans-serif'
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#cbd5e1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            color: '#64748b',
            'font-size': '8px',
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
          },
        },
        {
          selector: '.dimmed',
          style: {
            opacity: 0.25,
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: () => 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: true,
        componentSpacing: 100,
        nodeRepulsion: () => 400000,
        edgeElasticity: () => 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });
    
    cyRef.current = cy;

    // Use ResizeObserver to ensure graph fits perfectly when modal animates or window resizes
    const resizeObserver = new ResizeObserver(() => {
      if (cyRef.current) {
        cyRef.current.resize();
        cyRef.current.fit(undefined, 30);
      }
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // ─── Interaction Handlers ──────────────────────────────────────────────────

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      
      // Visual highlighting: dim all, then highlight selected and its neighbors
      cy.elements().addClass('dimmed');
      node.removeClass('dimmed');
      node.connectedEdges().removeClass('dimmed');
      node.connectedEdges().connectedNodes().removeClass('dimmed');

      // Trigger callback
      if (onNodeSelect) {
        onNodeSelect({
          id: node.data('id'),
          label: node.data('label'),
          type: node.data('type'),
          status: node.data('status'),
        });
      }
    });

    // Tap on background to clear selection
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('dimmed');
      }
    });

    // Hover tooltips
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const pos = node.renderedPosition();
      
      // Show tooltip if node is not dimmed (or if nothing is dimmed)
      if (!node.hasClass('dimmed')) {
        setTooltip({
          visible: true,
          x: pos.x,
          y: pos.y,
          title: node.data('label'),
          type: node.data('type'),
          status: node.data('status'),
        });
      }
    });

    cy.on('mouseout', 'node', () => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    });

    // Clean up
    return () => {
      resizeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData, onNodeSelect]);

  // ─── Graph Controls ────────────────────────────────────────────────────────

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);
  const handleReset = () => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass('dimmed');
    cyRef.current.elements().unselect();
    cyRef.current.layout({ name: 'cose' }).run();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (graphData.nodes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-slate-500", className)}>
        No fraud network data available for this case.
      </div>
    );
  }

  return (
    <div className={cn('relative w-full h-full min-h-[260px] flex-1', className)}>
      {/* Cytoscape Container */}
      <div ref={containerRef} className="absolute inset-0 z-0 outline-none" style={{ minHeight: '260px' }} />

      {/* Controls Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-white/80 backdrop-blur border border-slate-200 rounded-md p-1 shadow-lg">
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-slate-500 hover:text-gray-900 hover:bg-slate-100 rounded transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-slate-500 hover:text-gray-900 hover:bg-slate-100 rounded transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-slate-200 my-0.5" />
        <button
          onClick={handleFit}
          className="p-1.5 text-slate-500 hover:text-gray-900 hover:bg-slate-100 rounded transition-colors"
          title="Fit to Screen"
          aria-label="Fit Graph"
        >
          <Maximize className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 text-slate-500 hover:text-gray-900 hover:bg-slate-100 rounded transition-colors"
          title="Reset Graph"
          aria-label="Reset Graph"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2 bg-white/90 backdrop-blur border border-slate-200/80 rounded-lg p-2.5 shadow-lg select-none pointer-events-none">
        {/* Statuses */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nodeColors.critical }} />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">CRITICAL</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nodeColors.suspicious }} />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">SUSPICIOUS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nodeColors.normal }} />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">NORMAL</span>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200/80" />
        {/* Shapes */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-400" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">ACCOUNT</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px] border-2 border-slate-400" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">DEVICE</span>
          </div>
        </div>
      </div>

      {/* Hover Tooltip Overlay */}
      {tooltip.visible && (
        <div
          className="absolute z-20 pointer-events-none bg-white border border-slate-200 shadow-xl rounded px-3 py-2 flex flex-col gap-1"
          style={{
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <span className="text-gray-900 text-[11px] font-semibold whitespace-nowrap">
            {tooltip.title}
          </span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-slate-500 uppercase tracking-wide">{tooltip.type}</span>
            <span className="text-slate-400">·</span>
            <div className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: nodeColors[tooltip.status] ?? nodeColors.unknown }}
              />
              <span className="text-slate-600 capitalize">{tooltip.status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
