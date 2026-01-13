import React, { useEffect, useRef, useState } from 'react'
import { getMQTTService } from '@/services/mqtt'
import { useSystemStore } from '@/stores/system'

const WebcamPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const intervalRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const rfcActiveRef = useRef<boolean>(false)
  const publishingRef = useRef<boolean>(false)
  const [streaming, setStreaming] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const captureId = 'webcam-local'

  useEffect(() => { publishingRef.current = publishing }, [publishing])

  const start = async () => {
    try {
      setError(null)
      try {
        const mqtt = getMQTTService()
        await mqtt.connect()
      } catch (e: any) {
        console.error('MQTT connect failed', e)
      }
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (videoRef.current) {
        videoRef.current.srcObject = media
        const v = videoRef.current
        v.onloadedmetadata = () => {
          v.play().then(() => {
            setStreaming(true)
            startCaptureLoop()
          }).catch((err) => {
            console.error('Video play failed', err)
            setStreaming(true)
            startCaptureLoop()
          })
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to access webcam')
    }
  }

  const stop = () => {
    try {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(t => t.stop())
      }
    } catch {}
    rfcActiveRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setStreaming(false)
  }

  const startCaptureLoop = () => {
    if (!canvasRef.current || !videoRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const getOverlays = () => (useSystemStore.getState() as any).overlays[captureId] || []
    let lastPublish = 0
    const tick = () => {
      if (!videoRef.current || !canvasRef.current) return
      const w = videoRef.current.videoWidth || 640
      const h = videoRef.current.videoHeight || 480
      canvasRef.current.width = w
      canvasRef.current.height = h
      ctx.drawImage(videoRef.current, 0, 0, w, h)
      const overlays = getOverlays()
      ctx.strokeStyle = 'rgba(0,255,0,0.9)'
      ctx.lineWidth = 2
      ctx.font = '12px sans-serif'
      overlays.forEach((o: any) => {
        const [x1,y1,x2,y2] = o.bbox || [0,0,0,0]
        const w2 = Math.max(0, x2 - x1)
        const h2 = Math.max(0, y2 - y1)
        ctx.strokeRect(x1, y1, w2, h2)
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
        lines.forEach((ln, i) => ctx.fillText(ln, x1 + 4, ty + 12 + i * 16))
      })
      const now = Date.now()
      if (publishingRef.current && now - lastPublish >= 300) {
        try {
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5)
          const base64 = dataUrl.split(',')[1]
          const mqtt = getMQTTService()
          mqtt.publish(`camera/${captureId}/frame`, { frame: base64, timestamp: now })
          console.debug('[WebcamPreview] Published frame', { w, h, ts: now })
        } catch {}
        lastPublish = now
      }
    }
    const v = videoRef.current
    // Prefer per-frame callback when available
    if ((v as any).requestVideoFrameCallback) {
      rfcActiveRef.current = true
      const loop = () => {
        if (!rfcActiveRef.current) return
        tick()
        ;(v as any).requestVideoFrameCallback(loop)
      }
      ;(v as any).requestVideoFrameCallback(loop)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = window.requestAnimationFrame(tick)
    }
  }

  useEffect(() => {
    return () => stop()
  }, [])

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">Mac Webcam Preview</h3>
        <div className="space-x-2">
          {!streaming ? (
            <button onClick={start} className="px-3 py-1 bg-blue-600 text-white rounded">Start</button>
          ) : (
            <button onClick={stop} className="px-3 py-1 bg-gray-700 text-white rounded">Stop</button>
          )}
          <label className="inline-flex items-center space-x-2 ml-2">
            <input type="checkbox" checked={publishing} onChange={(e) => setPublishing(e.target.checked)} />
            <span className="text-sm text-gray-600">Publish to MQTT</span>
          </label>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <video ref={videoRef} className="w-full bg-black rounded" playsInline muted />
        <canvas ref={canvasRef} className="w-full bg-black rounded" />
      </div>
      <p className="text-xs text-gray-500 mt-2">Camera ID: {captureId}</p>
    </div>
  )
}

export default WebcamPreview
