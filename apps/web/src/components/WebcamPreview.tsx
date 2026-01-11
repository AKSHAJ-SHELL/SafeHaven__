import React, { useEffect, useRef, useState } from 'react'
import { getMQTTService } from '@/services/mqtt'

const WebcamPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const captureId = 'webcam-local'
  let intervalId: number | null = null

  const start = async () => {
    try {
      setError(null)
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (videoRef.current) {
        videoRef.current.srcObject = media
        await videoRef.current.play()
      }
      setStreaming(true)
      startCaptureLoop()
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
    if (intervalId) {
      window.clearInterval(intervalId)
      intervalId = null
    }
    setStreaming(false)
  }

  const startCaptureLoop = () => {
    if (!canvasRef.current || !videoRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    intervalId = window.setInterval(() => {
      if (!videoRef.current) return
      const w = videoRef.current.videoWidth || 640
      const h = videoRef.current.videoHeight || 480
      canvasRef.current!.width = w
      canvasRef.current!.height = h
      ctx.drawImage(videoRef.current, 0, 0, w, h)
      if (publishing) {
        try {
          const dataUrl = canvasRef.current!.toDataURL('image/jpeg', 0.7)
          const base64 = dataUrl.split(',')[1]
          const mqtt = getMQTTService()
          mqtt.publish(`camera/${captureId}/frame`, { frame: base64, timestamp: Date.now() })
        } catch {}
      }
    }, 500)
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
