import React, { useEffect, useRef, useState } from 'react'

export const AnnotationEditor: React.FC<{ imageUrl: string; modelId: string; onClose: () => void }> = ({ imageUrl, modelId, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [boxes, setBoxes] = useState<Array<{ x: number; y: number; w: number; h: number; label: string }>>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [currentLabel, setCurrentLabel] = useState('Door')
  const labels = ['Door-Open','Door-Closed','Latch-Locked','Latch-Unlocked','Activity-Person','Zone']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      redraw()
    }
    img.src = imageUrl
  }, [imageUrl, boxes])

  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      ctx.drawImage(img, 0, 0)
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2
      ctx.font = '14px sans-serif'
      boxes.forEach(b => {
        ctx.strokeRect(b.x, b.y, b.w, b.h)
        const text = b.label
        const tw = ctx.measureText(text).width + 8
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(b.x, Math.max(0,b.y-18), tw, 18)
        ctx.fillStyle = '#00FF00'
        ctx.fillText(text, b.x + 4, Math.max(14,b.y-4))
      })
    }
    img.src = imageUrl
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    setStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setIsDrawing(true)
  }
  const onMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !start) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const x = Math.min(start.x, e.clientX - rect.left)
    const y = Math.min(start.y, e.clientY - rect.top)
    const w = Math.abs((e.clientX - rect.left) - start.x)
    const h = Math.abs((e.clientY - rect.top) - start.y)
    setBoxes(prev => [...prev, { x, y, w, h, label: currentLabel }])
    setIsDrawing(false)
    setStart(null)
  }

  const save = async () => {
    const annotations = boxes.map(b => ({ bbox: [b.x, b.y, b.x + b.w, b.y + b.h], label: b.label }))
    try {
      const res = await fetch(`/api/custom/models/${modelId}/annotations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: imageUrl, annotations })
      })
      if (!res.ok) throw new Error('Failed to save annotations')
      alert('Annotations saved')
      onClose()
    } catch (e) {
      console.error(e)
      alert('Failed to save annotations')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-4 max-w-5xl w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Annotation Editor</h3>
          <button onClick={onClose} className="text-gray-500">×</button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <select value={currentLabel} onChange={(e) => setCurrentLabel(e.target.value)} className="border px-2 py-1 rounded">
            {labels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={() => setBoxes([])} className="px-2 py-1 bg-gray-100 rounded">Clear</button>
          <button onClick={save} className="px-2 py-1 bg-blue-600 text-white rounded">Save</button>
        </div>
        <div className="overflow-auto">
          <canvas ref={canvasRef} onMouseDown={onMouseDown} onMouseUp={onMouseUp} className="border" />
        </div>
      </div>
    </div>
  )
}

export default AnnotationEditor
