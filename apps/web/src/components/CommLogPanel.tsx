import React from 'react'
import { useSystemStore } from '@/stores/system'

const CommLogPanel: React.FC = () => {
  const { logs } = useSystemStore() as any
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow z-40">
      <div className="px-4 py-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Communication Log</h3>
        <span className="text-xs text-gray-500">Recent ({logs.length})</span>
      </div>
      <div className="max-h-40 overflow-y-auto px-4 pb-2">
        {logs.slice(0, 50).map((l: any, idx: number) => (
          <div key={idx} className="text-xs text-gray-700 py-1 border-b border-gray-50">
            <span className="text-gray-500 mr-2">{new Date(l.ts).toLocaleTimeString()}</span>
            <span className={l.source === 'mqtt' ? 'text-purple-600' : 'text-blue-600'}>{l.source.toUpperCase()}</span>
            {l.topic && <span className="text-gray-400 ml-2">{l.topic}</span>}
            <span className="ml-2 break-all">{l.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-xs text-gray-500 py-3">No activity yet</div>
        )}
      </div>
    </div>
  )}

export default CommLogPanel
