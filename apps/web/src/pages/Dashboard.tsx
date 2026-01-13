import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { useSystemStore } from '../stores/system';
// Using store-provided shapes for UI
import { 
  VideoCameraIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import WebcamPreview from '@/components/WebcamPreview';
import CommAnalysisPanel from '@/components/CommAnalysisPanel';
import { useRef } from 'react';

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { cameras, events, systemStatus, fetchCameras, fetchEvents, fetchSystemStatus, frames } = useSystemStore() as any;
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetchCameras();
    fetchEvents();
    fetchSystemStatus();
  }, [fetchCameras, fetchEvents, fetchSystemStatus]);

  const activeCameras = (cameras as any[]).filter(cam => (cam as any).status === 'online');
  const recentEvents = (events as any[]).slice(0, 10);
  const criticalEvents = (events as any[]).filter((e: any) => e.severity === 'high').slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-red-500';
      case 'error': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
      case 'warn': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  useEffect(() => {
    if (!selectedCamera || !overlayCanvasRef.current) return
    const canvas = overlayCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const imgEl = canvas.previousElementSibling as HTMLImageElement
    if (!imgEl) return
    const draw = () => {
      const overlays = (useSystemStore.getState() as any).overlays[selectedCamera] || []
      canvas.width = imgEl.clientWidth
      canvas.height = imgEl.clientHeight
      ctx.clearRect(0,0,canvas.width,canvas.height)
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
      ctx.lineWidth = 2
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      overlays.forEach((o: any) => {
        const [x1,y1,x2,y2] = o.bbox || [0,0,0,0]
        const w = Math.max(0, x2 - x1)
        const h = Math.max(0, y2 - y1)
        ctx.strokeRect(x1, y1, w, h)
        const conf = typeof o.confidence === 'number' ? ` ${Math.round(o.confidence * 100)}%` : ''
        const main = `${o.label}${conf}`
        const extra = o.explanation ? o.explanation : (o.status ? `Status: ${o.status}` : o.activity ? `Activity: ${o.activity}` : '')
        const lines = extra ? [main, extra] : [main]
        const textW = Math.max(...lines.map(l => ctx.measureText(l).width)) + 8
        const boxH = 16 * lines.length
        const ty = Math.max(0, y1 - boxH)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(x1, ty, textW, boxH)
        ctx.fillStyle = '#00FF00'
        ctx.font = '12px sans-serif'
        lines.forEach((ln, i) => ctx.fillText(ln, x1 + 4, ty + 12 + i * 16))
      })
    }
    draw()
  }, [selectedCamera, frames, overlayCanvasRef])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.email}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              systemStatus?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              System {systemStatus?.status || 'unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <VideoCameraIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Cameras</p>
              <p className="text-2xl font-bold text-gray-900">{cameras.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Online</p>
              <p className="text-2xl font-bold text-gray-900">{activeCameras.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {(events as any[]).filter((e: any) => e.severity === 'high' && 
                  new Date(e.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                ).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {(events as any[]).filter((e: any) => 
                  new Date(e.timestamp).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Live Cameras</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCameras.slice(0, 4).map((camera: any) => (
                <div
                  key={camera.id}
                  className="relative bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                  onClick={() => setSelectedCamera(camera.id)}
                >
                  {frames[camera.id] ? (
                    <img src={frames[camera.id]} className="aspect-video object-cover" />
                  ) : (
                    <div className="aspect-video bg-gray-800 flex items-center justify-center">
                      <VideoCameraIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{camera.name}</p>
                        <p className="text-gray-300 text-xs">{camera.resolution}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        camera.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                    </div>
                  </div>
                </div>
            ))}
            </div>
            {activeCameras.length === 0 && (
              <div className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <VideoCameraIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No cameras online</p>
                </div>
                <WebcamPreview />
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Recent Events */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Recent Events</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(recentEvents as any[]).map((event: any) => (
                  <div key={event.id ?? `${event.cameraId || 'unknown'}-${event.timestamp || Math.random()}`}
                       className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      event.severity === 'high' ? 'bg-red-500' :
                      event.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {((event.type || event.detectionType || event.eventType || 'event') as string).replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(event.cameraName || event.cameraId || 'Unknown')} • {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                      getSeverityColor(event.severity)
                    }`}>
                      {event.severity}
                    </span>
                  </div>
                ))}
              </div>
              {recentEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <ClockIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent events</p>
                </div>
              )}
            </div>
          </div>
          {/* Model Insights Panel */}
          <CommAnalysisPanel />
        </div>
      </div>

      {/* Camera Modal */}
      {selectedCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {(cameras as any[]).find((c: any) => c.id === selectedCamera)?.name}
              </h3>
              <button
                onClick={() => setSelectedCamera(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>
            <div className="p-6">
              {frames[selectedCamera] ? (
                <div className="relative">
                  <img src={frames[selectedCamera]} className="w-full rounded aspect-video object-cover" />
                  <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-2">
                    {(() => {
                      const overlays = (useSystemStore.getState() as any).overlays[selectedCamera] || []
                      const door = overlays.find((o: any) => (o.label||'').toLowerCase().includes('door'))
                      const latch = overlays.find((o: any) => (o.label||'').toLowerCase().includes('latch'))
                      const activity = overlays.find((o: any) => (o.label||'').toLowerCase().includes('activity'))
                      const stats = (useSystemStore.getState() as any).overlayStats[selectedCamera] || { door: { value: 'Unknown', stability: 0 }, latch: { value: 'Unknown', stability: 0 }, activity: { value: 'None', stability: 0 } }
                      const pill = (title: string, value: string, stability: number) => (
                        <span className="px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded">
                          {title}: {value} {stability ? `(stable ${stability}/30)` : ''}
                        </span>
                      )
                      return (
                        <>
                          {pill('Door', door?.status || stats.door.value, stats.door.stability)}
                          {pill('Latch', latch?.status || stats.latch.value, stats.latch.stability)}
                          {pill('Activity', activity?.activity || stats.activity.value, stats.activity.stability)}
                        </>
                      )
                    })()}
                  </div>
                  <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-auto" />
                </div>
              ) : (
                <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                  <VideoCameraIcon className="h-24 w-24 text-gray-400" />
                  <p className="text-gray-400 ml-4">No live frame yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
