import { useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { WorldApi } from '../scene/types'

export default function TouchControls({ apiRef, disabled }: { apiRef: RefObject<WorldApi | null>; disabled: boolean }) {
  const [thumb, setThumb] = useState({ x: 0, y: 0 })
  const pointer = useRef<number | null>(null)
  function move(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    let x = event.clientX - box.left - box.width / 2
    let y = event.clientY - box.top - box.height / 2
    const length = Math.hypot(x, y)
    if (length > 34) { x *= 34 / length; y *= 34 / length }
    setThumb({ x, y })
    apiRef.current?.setVirtual({ moveX: x / 34, moveZ: -y / 34 })
  }
  function stop() {
    pointer.current = null
    setThumb({ x: 0, y: 0 })
    apiRef.current?.setVirtual({ moveX: 0, moveZ: 0 })
  }
  if (disabled) return null
  return <div className="touch-controls">
    <div className="touch-stick" role="group" aria-label="Drag to move" onPointerDown={event => { pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event) }} onPointerMove={event => { if (pointer.current === event.pointerId) move(event) }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
      <span className="touch-stick-cross">+</span><span className="touch-thumb" style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }} />
    </div>
    <div className="touch-actions">
      <button className="touch-action" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); apiRef.current?.setVirtual({ sprint: true }) }} onPointerUp={() => apiRef.current?.setVirtual({ sprint: false })} onPointerCancel={() => apiRef.current?.setVirtual({ sprint: false })} onLostPointerCapture={() => apiRef.current?.setVirtual({ sprint: false })}>Sprint</button>
      <button className="touch-action touch-jump" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); apiRef.current?.setVirtual({ jump: true }) }} onPointerUp={() => apiRef.current?.setVirtual({ jump: false })} onPointerCancel={() => apiRef.current?.setVirtual({ jump: false })} onLostPointerCapture={() => apiRef.current?.setVirtual({ jump: false })}>Jump</button>
    </div>
  </div>
}
