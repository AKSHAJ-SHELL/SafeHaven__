import React from 'react'
import { useSystemStore } from '@/stores/system'

const CommAnalysisPanel: React.FC = () => {
  const { analyses } = useSystemStore() as any
  return (
    <div className="bg-white rounded-lg shadow p-4 mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-gray-900">Model Insights</h3>
        <span className="text-xs text-gray-500">Latest ({analyses.length})</span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {analyses.slice(0, 30).map((a: any, idx: number) => (
          <div key={idx} className="border border-gray-100 rounded p-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900 capitalize">{a.type.replace('_', ' ')}</div>
              <div className={`text-xs px-2 py-0.5 rounded-full border ${a.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200' : a.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>{a.severity}</div>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              <span>{new Date(a.ts).toLocaleTimeString()}</span>
              {typeof a.confidence === 'number' && (
                <span className="ml-2">Confidence: {(a.confidence * 100).toFixed(1)}%</span>
              )}
            </div>
            {a.tags && a.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {a.tags.slice(0, 6).map((t: string, i: number) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {analyses.length === 0 && (
          <div className="text-xs text-gray-500 py-3">No model insights yet</div>
        )}
      </div>
    </div>
  )
}

export default CommAnalysisPanel
