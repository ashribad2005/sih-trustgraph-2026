import React, { useMemo } from 'react';
import FraudGraphViewer from './graph/FraudGraphViewer';

interface CaseInvestigationProps {
  selectedCase: {
    case_id: string;
    risk_score: number;
    audit_hash?: string;
    graph_payload?: {
      elements: any[];
    };
  } | null;
}

export default function CaseInvestigation({ selectedCase }: CaseInvestigationProps) {
  const graphElements = useMemo(() => {
    if (!selectedCase?.graph_payload?.elements) return [];
    return selectedCase.graph_payload.elements;
  }, [selectedCase]);

  if (!selectedCase) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Select a case to begin investigation.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Case Header Details */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Case Investigation: {selectedCase.case_id}</h2>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Risk Score:</span>
            <span className={`ml-2 font-bold ${selectedCase.risk_score >= 75 ? 'text-red-600' : 'text-yellow-600'}`}>
              {selectedCase.risk_score}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Audit Hash (Polygon Amoy):</span>
            <span className="ml-2 font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">
              {selectedCase.audit_hash || 'Pending Anchor...'}
            </span>
          </div>
        </div>
      </div>

      {/* Network Graph Visualization */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        {graphElements.length > 0 ? (
          <FraudGraphViewer graphData={{ elements: graphElements }} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No network graph data available for this case.
          </div>
        )}
      </div>
    </div>
  );
}
